"""
Webhooks Router
Handles incoming e-commerce webhooks (cart-event, order-completed) with HMAC security,
and Meta WhatsApp Cloud API webhooks (verification, inbound message processing, DND triggers).
"""

from datetime import datetime
import hashlib
import hmac
import logging
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import auth
import config
import models
import schemas
from database import get_db
from rate_limiter import limiter
from scheduler import schedule_cart_recovery
from services.phone_service import normalize_phone
from services.policy_service import record_consent, revoke_consent
from services.audit_service import record_audit_event, hash_phone
from whatsapp_service import send_whatsapp_template

logger = logging.getLogger("webhooks_router")

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

OPT_OUT_KEYWORDS = {
    "stop", "unsubscribe", "dnd", "cancel",
    "બંધ", "બંધ કરો", "સંદેશા બંધ કરો",  # Gujarati
    "रोको", "बंद करो", "मैसेज बंद करो"      # Hindi
}


async def get_webhook_authenticated_user(
    request: Request,
    db: Session = Depends(get_db)
) -> models.User:
    """
    Validates e-commerce HMAC signatures for external requests.
    Missing or invalid signatures are recorded in WebhookEvent and rejected with HTTP 401.
    """
    correlation_id = request.headers.get("X-Correlation-ID") or request.headers.get("x-correlation-id") or str(uuid.uuid4())
    raw_sig = request.headers.get("X-Hub-Signature-256") or request.headers.get("x-hub-signature-256") or ""
    sig_clean = raw_sig.lower().strip()
    if sig_clean.startswith("sha256="):
        sig_clean = sig_clean[7:].strip()

    def _record_failure():
        try:
            failed_event = models.WebhookEvent(
                source="store",
                event_type="store_auth_failure",
                external_event_id=None,
                idempotency_key=f"auth_failure:{correlation_id}",
                hmac_validated=False,
                correlation_id=correlation_id,
                received_at=datetime.utcnow()
            )
            db.add(failed_event)
            db.commit()
        except Exception as e:
            try:
                db.rollback()
            except Exception:
                pass
            logger.warning(f"Note: Webhook audit record could not be persisted: {e}")

    if not sig_clean or not config.WEBHOOK_SECRET:
        logger.warning("🚨 [Webhook Security] Store webhook rejected: missing HMAC signature or WEBHOOK_SECRET.")
        _record_failure()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing HMAC signature",
            headers={"WWW-Authenticate": "HMAC-SHA256"}
        )

    raw_body = await request.body()
    computed_hex = hmac.new(
        config.WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256
    ).hexdigest().lower()

    if not hmac.compare_digest(computed_hex, sig_clean):
        logger.warning(
            f"🚨 [Webhook Security] Store webhook rejected: HMAC signature mismatch. "
            f"Received sig length={len(sig_clean)}, body bytes={len(raw_body)}"
        )
        _record_failure()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing HMAC signature",
            headers={"WWW-Authenticate": "HMAC-SHA256"}
        )

    svc = db.query(models.User).filter(models.User.username == config.ECOM_SERVICE_USERNAME).first()
    return svc or models.User(username=config.ECOM_SERVICE_USERNAME, is_active=True)



@router.post("/cart-event", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("60/minute")
async def receive_cart_webhook(
    request: Request,
    payload: schemas.CartEventPayload,
    delay_seconds: Optional[int] = 0,
    current_user: models.User = Depends(get_webhook_authenticated_user),
    db: Session = Depends(get_db)
):
    correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
    external_event_id = str(payload.cart_token)
    idempotency_key = request.headers.get("X-Idempotency-Key") or f"cart:{payload.cart_token}"

    existing_event = db.query(models.WebhookEvent).filter(
        (models.WebhookEvent.idempotency_key == idempotency_key) |
        ((models.WebhookEvent.source == "store") & (models.WebhookEvent.external_event_id == external_event_id) & (models.WebhookEvent.hmac_validated == True))
    ).first()
    if existing_event:
        return {"status": "duplicate", "message": "Webhook event was already processed."}

    db.add(models.WebhookEvent(
        source="store",
        event_type="cart",
        external_event_id=external_event_id,
        idempotency_key=idempotency_key,
        hmac_validated=True,
        correlation_id=correlation_id,
        received_at=datetime.utcnow()
    ))
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return {"status": "duplicate", "message": "Webhook event was already processed."}

    is_opted_out = db.query(models.OptOut).filter(models.OptOut.phone == payload.customer_phone).first()
    if is_opted_out:
        return {"status": "ignored", "reason": "Customer is on Opt-Out / DND list"}

    extra_payload = dict(payload.extra_data or {})
    if payload.first_name:
        extra_payload.setdefault("first_name", payload.first_name)
    if payload.customer_name:
        extra_payload.setdefault("customer_name", payload.customer_name)
    if payload.delivery_address:
        extra_payload.setdefault("delivery_address", payload.delivery_address)

    resolved_cust_name = payload.first_name or payload.customer_name or "Valued Customer"

    record_consent(
        db=db,
        phone=payload.customer_phone,
        source="store_checkout",
        proof_details=f"cart:{payload.cart_token}"
    )

    cart_record = models.CartEvent(
        cart_token=payload.cart_token,
        customer_phone=payload.customer_phone,
        cart_value=payload.cart_value,
        items=payload.items,
        extra_data=extra_payload,
        status="PENDING",
        authenticated_user=current_user.username
    )
    db.add(cart_record)
    db.commit()
    db.refresh(cart_record)

    active_cart_flow = db.query(models.WorkflowFlow).filter(
        models.WorkflowFlow.trigger_type == "ABANDONED_CART",
        models.WorkflowFlow.is_active == True
    ).first()

    workflow_session_id = None
    skipped_due_to_min_cart = False
    if active_cart_flow:
        flow_nodes = active_cart_flow.nodes or []
        trigger_n = next((n for n in flow_nodes if n.get("type") == "trigger"), None)
        min_thresh = None
        if trigger_n and isinstance(trigger_n.get("data"), dict):
            min_thresh = trigger_n["data"].get("min_cart_value")
        if min_thresh is None and isinstance(active_cart_flow.trigger_config, dict):
            min_thresh = active_cart_flow.trigger_config.get("min_cart_value")

        if min_thresh is not None:
            try:
                if float(payload.cart_value) < float(min_thresh):
                    skipped_due_to_min_cart = True
            except (ValueError, TypeError):
                pass

        if not skipped_due_to_min_cart:
            items_summary = ", ".join([item.get("item", "Namkeen Item") for item in (payload.items or [])]) if payload.items else "Special Vanela Gathiya & Bhavnagari Gathiya"
            state_data = {
                "cart_token": payload.cart_token,
                "cart_value": payload.cart_value,
                "customer_name": resolved_cust_name,
                "items_summary": items_summary,
                "extra_data": extra_payload,
                "sender_user": current_user.username
            }
            for k, v in extra_payload.items():
                state_data.setdefault(k, str(v))

            from scheduler import start_workflow_session
            wf_sess = start_workflow_session(flow_id=active_cart_flow.id, customer_phone=payload.customer_phone, state_data=state_data, db=db)
            if wf_sess:
                workflow_session_id = wf_sess.id

    eff_delay = delay_seconds if delay_seconds is not None else 0
    if not active_cart_flow and not skipped_due_to_min_cart:
        schedule_cart_recovery(cart_event_id=cart_record.id, delay_seconds=eff_delay)

    if skipped_due_to_min_cart:
        msg_detail = f"Cart event recorded, but recovery workflow skipped: cart value (₹{payload.cart_value}) is below minimum threshold (₹{min_thresh})."
    elif workflow_session_id:
        msg_detail = f"Multi-step journey enrolled (Session #{workflow_session_id})"
    elif eff_delay <= 0:
        msg_detail = "WhatsApp message dispatched immediately"
    else:
        msg_detail = f"WhatsApp message scheduled in {eff_delay}s"

    return {
        "status": "received",
        "cart_event_id": cart_record.id,
        "workflow_session_id": workflow_session_id,
        "skipped_min_cart": skipped_due_to_min_cart,
        "scheduled_in_seconds": eff_delay,
        "authenticated_as": current_user.username,
        "message": msg_detail
    }


@router.post("/order-completed")
@limiter.limit("60/minute")
async def receive_order_completed_webhook(
    request: Request,
    payload: Optional[schemas.OrderCompletedPayload] = None,
    cart_token: Optional[str] = None,
    customer_phone: Optional[str] = None,
    current_user: models.User = Depends(get_webhook_authenticated_user),
    db: Session = Depends(get_db)
):
    token = payload.cart_token if payload else cart_token
    raw_phone = payload.customer_phone if payload else customer_phone

    if not token or not raw_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing cart_token or customer_phone"
        )

    try:
        clean_phone = normalize_phone(raw_phone)
    except InvalidPhoneNumberError as pe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid customer_phone: {pe}"
        )

    cart_token = token
    correlation_id = request.headers.get("X-Correlation-ID") or request.headers.get("X-Request-ID") or str(uuid.uuid4())
    external_event_id = f"order:{cart_token}"
    idempotency_key = request.headers.get("X-Idempotency-Key") or f"order:{cart_token}"

    existing_event = db.query(models.WebhookEvent).filter(
        (models.WebhookEvent.idempotency_key == idempotency_key) |
        ((models.WebhookEvent.source == "store") & (models.WebhookEvent.external_event_id == external_event_id) & (models.WebhookEvent.hmac_validated == True))
    ).first()
    if existing_event:
        return {"status": "duplicate", "message": "Webhook event was already processed."}

    db.add(models.WebhookEvent(
        source="store",
        event_type="order",
        external_event_id=external_event_id,
        idempotency_key=idempotency_key,
        hmac_validated=True,
        correlation_id=correlation_id,
        received_at=datetime.utcnow()
    ))
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return {"status": "duplicate", "message": "Webhook event was already processed."}

    # 1. Update contact order statistics
    record_consent(
        db=db,
        phone=clean_phone,
        source="store_checkout",
        proof_details=f"order:{cart_token}"
    )

    contact = db.query(models.Contact).filter(models.Contact.phone == clean_phone).first()
    if not contact:
        contact = models.Contact(phone=clean_phone, total_orders=1, last_order_date=datetime.utcnow())
        db.add(contact)
    else:
        contact.total_orders = (contact.total_orders or 0) + 1
        contact.last_order_date = datetime.utcnow()

    # 2. Check Order Milestone (e.g. 5th, 10th order VIP reward)
    milestone_triggered = None
    if contact.total_orders in [5, 10, 20]:
        milestone = contact.total_orders
        coupon = f"VIP{milestone}"
        disc = db.query(models.DiscountCode).filter(models.DiscountCode.code == coupon).first()
        if not disc:
            disc = models.DiscountCode(
                code=coupon,
                discount_type="PERCENT",
                discount_value=15.0 if milestone >= 10 else 10.0,
                max_uses=1000,
                is_active=True
            )
            db.add(disc)

        send_whatsapp_template(
            recipient_phone=clean_phone,
            template_name="milestone_reward_offer",
            language="en",
            parameters={
                "name": contact.name or "Valued Customer",
                "milestone": str(milestone),
                "coupon": coupon
            }
        )
        milestone_triggered = f"Milestone {milestone}th order reward dispatched with coupon {coupon}"
        logger.info(f"🎉 [MILESTONE REWARD] Customer {clean_phone} reached order #{milestone}! Sent coupon {coupon}")

    # 3. Mark cart as RECOVERED if associated with a pending cart event
    cart = db.query(models.CartEvent).filter(
        models.CartEvent.cart_token == cart_token,
        models.CartEvent.customer_phone.in_([clean_phone, customer_phone])
    ).first()

    if cart:
        cart.status = "RECOVERED"
        db.commit()
        return {
            "status": "success",
            "message": f"Cart {cart_token} marked as RECOVERED. Recovery message cancelled.",
            "milestone": milestone_triggered,
            "total_orders": contact.total_orders
        }
    
    db.commit()
    return {
        "status": "success",
        "message": f"Order completion recorded. Total customer orders: {contact.total_orders}",
        "milestone": milestone_triggered,
        "total_orders": contact.total_orders
    }


@router.get("/whatsapp")
def verify_whatsapp_webhook(
    request: Request
):
    """
    Required by Meta to verify webhook endpoint URL.
    Checks hub.verify_token and echoes back hub.challenge.
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if not config.WHATSAPP_VERIFY_TOKEN:
        logger.error("WHATSAPP_VERIFY_TOKEN is not configured in environment variables.")
        raise HTTPException(status_code=500, detail="Webhook verify token not configured on server")

    if mode == "subscribe" and token == config.WHATSAPP_VERIFY_TOKEN:
        return int(challenge) if challenge and challenge.isdigit() else challenge
    raise HTTPException(status_code=403, detail="Verification token mismatch")


@router.post("/whatsapp")
async def receive_inbound_whatsapp_message(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Receives incoming customer messages/replies from Meta WhatsApp Cloud API.
    1. If customer types 'STOP', 'બંધ કરો', or 'रोको', added to opt_outs DND table.
    2. Incoming messages saved into ChatMessage for real-time 2-Way Chat.
    """
    signature = request.headers.get("X-Hub-Signature-256", "")
    correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
    if config.META_APP_SECRET:
        raw_body = await request.body()
        expected_signature = "sha256=" + hmac.new(
            config.META_APP_SECRET.encode(), raw_body, hashlib.sha256
        ).hexdigest()
        if not signature or not hmac.compare_digest(expected_signature, signature):
            failed_event = models.WebhookEvent(
                source="meta",
                event_type="meta_auth_failure",
                external_event_id=None,
                idempotency_key=f"meta_auth_failure:{correlation_id}",
                hmac_validated=False,
                correlation_id=correlation_id,
                received_at=datetime.utcnow()
            )
            db.add(failed_event)
            try:
                db.commit()
            except Exception:
                db.rollback()
            raise HTTPException(status_code=401, detail="Invalid Meta webhook signature")

    try:
        data = await request.json()
    except Exception:
        return {"status": "ignored", "reason": "invalid json"}

    entries = data.get("entry", [])
    if not entries:
        return {"status": "ok"}

    processed_messages_count = 0
    processed_statuses_count = 0
    any_opt_out = False

    for entry in entries:
        changes = entry.get("changes", [])
        for chg in changes:
            value = chg.get("value", {})
            if not isinstance(value, dict):
                continue

            # 1. Process Status Updates (DELIVERED, READ, FAILED, SENT)
            statuses = value.get("statuses", [])
            for st in statuses:
                wamid = st.get("id")
                new_status = st.get("status", "").upper()
                if not wamid:
                    continue

                status_event_id = f"meta_status:{wamid}:{new_status}"
                existing_status_event = db.query(models.InboundWebhookEvent).filter(
                    models.InboundWebhookEvent.provider == "meta",
                    models.InboundWebhookEvent.provider_event_id == status_event_id
                ).first()
                if existing_status_event:
                    continue

                status_record = models.InboundWebhookEvent(
                    provider="meta",
                    provider_event_id=status_event_id,
                    event_type="status_update",
                    correlation_id=correlation_id,
                    processed_at=datetime.utcnow()
                )
                db.add(status_record)

                chat_msg = db.query(models.ChatMessage).filter(models.ChatMessage.meta_message_id == wamid).first()
                if chat_msg:
                    chat_msg.status = new_status

                msg_log = db.query(models.MessageLog).filter(models.MessageLog.meta_message_id == wamid).first()
                if msg_log:
                    msg_log.status = new_status
                    errors = st.get("errors", [])
                    if errors:
                        msg_log.error_message = str(errors)

                try:
                    db.commit()
                    processed_statuses_count += 1
                except Exception as e:
                    db.rollback()
                    logger.warning(f"Error updating status for {wamid}: {e}")

            # 2. Process Messages (Inbound customer messages & DND requests)
            messages = value.get("messages", [])
            for msg in messages:
                raw_meta_id = msg.get("id")
                meta_id = raw_meta_id or f"inbound_{uuid.uuid4().hex}"

                # Deduplicate: check InboundWebhookEvent
                existing_inbound = db.query(models.InboundWebhookEvent).filter(
                    models.InboundWebhookEvent.provider == "meta",
                    models.InboundWebhookEvent.provider_event_id == meta_id
                ).first()
                if existing_inbound:
                    logger.info(f"Duplicate Meta message replay skipped: {meta_id}")
                    continue

                # Deduplicate: check existing ChatMessage
                existing_chat = db.query(models.ChatMessage).filter(
                    models.ChatMessage.meta_message_id == meta_id
                ).first()
                if existing_chat:
                    logger.info(f"ChatMessage already exists for meta_id: {meta_id}")
                    continue

                db.add(models.InboundWebhookEvent(
                    provider="meta",
                    provider_event_id=meta_id,
                    event_type="inbound_message",
                    correlation_id=correlation_id,
                    processed_at=datetime.utcnow()
                ))
                db.add(models.WebhookEvent(
                    source="meta",
                    event_type="inbound_message",
                    external_event_id=meta_id,
                    idempotency_key=f"meta_msg:{meta_id}",
                    hmac_validated=True,
                    correlation_id=correlation_id,
                    received_at=datetime.utcnow()
                ))

                try:
                    db.flush()
                except IntegrityError:
                    db.rollback()
                    logger.info(f"Duplicate Meta message skipped on flush: {meta_id}")
                    continue

                raw_from = msg.get("from", "")
                try:
                    sender_phone = normalize_phone(raw_from)
                except ValueError:
                    sender_phone = "+" + raw_from.strip("+")

                msg_type = msg.get("type", "text")
                raw_body = ""

                if msg_type == "text":
                    raw_body = msg.get("text", {}).get("body", "").strip()
                elif msg_type == "button":
                    raw_body = msg.get("button", {}).get("text", "")
                elif msg_type == "interactive":
                    interactive = msg.get("interactive", {})
                    raw_body = interactive.get("button_reply", {}).get("title") or interactive.get("list_reply", {}).get("title") or "Interactive Response"
                else:
                    raw_body = f"[{msg_type.upper()} message received]"

                is_opt_out = any(keyword in raw_body.lower() for keyword in OPT_OUT_KEYWORDS)

                if is_opt_out:
                    any_opt_out = True
                    revoke_consent(db, sender_phone, reason="INBOUND_STOP_COMMAND")
                    logger.info(f"🛑 [AUTO-DND] Customer opted out via inbound message. Added to Opt-Out DND list and consent revoked.")
                else:
                    record_consent(db, sender_phone, source="inbound_message", proof_details=f"meta_msg:{meta_id}")

                new_chat_msg = models.ChatMessage(
                    customer_phone=sender_phone,
                    sender_type="CUSTOMER",
                    message_type=msg_type,
                    text=raw_body,
                    meta_message_id=meta_id,
                    status="RECEIVED",
                    is_read=False
                )
                db.add(new_chat_msg)

                recent_outbound_logs = db.query(models.MessageLog).filter(
                    models.MessageLog.recipient_phone == sender_phone,
                    models.MessageLog.status.in_(["SENT", "SENT_SIMULATED", "DELIVERED"])
                ).order_by(models.MessageLog.id.desc()).limit(3).all()
                for out_log in recent_outbound_logs:
                    out_log.status = "READ"

                recent_outbound_chats = db.query(models.ChatMessage).filter(
                    models.ChatMessage.customer_phone == sender_phone,
                    models.ChatMessage.sender_type.in_(["AGENT", "SYSTEM", "BOT"]),
                    models.ChatMessage.status.in_(["SENT", "DELIVERED"])
                ).order_by(models.ChatMessage.id.desc()).limit(3).all()
                for out_chat in recent_outbound_chats:
                    out_chat.status = "READ"

                existing_contact = db.query(models.Contact).filter(models.Contact.phone == sender_phone).first()
                if not existing_contact:
                    contacts_list = value.get("contacts") or []
                    profile_name = "New WhatsApp Lead"
                    if isinstance(contacts_list, list) and len(contacts_list) > 0 and isinstance(contacts_list[0], dict):
                        profile_name = contacts_list[0].get("profile", {}).get("name") or "New WhatsApp Lead"

                    new_contact = models.Contact(
                        phone=sender_phone,
                        name=profile_name,
                        total_orders=0,
                        tags="Inbound Lead",
                        city="WhatsApp"
                    )
                    db.add(new_contact)

                try:
                    db.commit()
                    processed_messages_count += 1
                except IntegrityError:
                    db.rollback()
                    logger.info(f"Duplicate ChatMessage skipped on commit: {meta_id}")

    if any_opt_out:
        return {"status": "opted_out", "messages_processed": processed_messages_count, "statuses_processed": processed_statuses_count}
    if processed_messages_count > 0:
        return {"status": "message_processed", "messages_processed": processed_messages_count, "statuses_processed": processed_statuses_count}
    if processed_statuses_count > 0:
        return {"status": "status_update_acknowledged", "statuses_processed": processed_statuses_count}
    return {"status": "ok"}


# ============================================================================
# Webhook Simulation Routes (WP1) - Admin-only, step-up auth, audit logged
# ============================================================================

@router.post("/simulate/cart-event", status_code=status.HTTP_202_ACCEPTED)
def simulate_cart_event(
    request: Request,
    payload: schemas.CartEventPayload,
    password: Optional[str] = None,
    two_factor_code: Optional[str] = None,
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    """
    Simulates a cart-event webhook without HMAC signatures.
    Strictly restricted to Admin role with step-up authentication.
    Generates an immutable AuditEvent and idempotency ledger entry.
    """
    auth.verify_user_stepup_auth(current_user, password, two_factor_code, db)

    correlation_id = request.headers.get("X-Correlation-ID") or request.headers.get("X-Request-ID") or str(uuid.uuid4())
    idempotency_key = f"sim_cart:{payload.cart_token}:{int(datetime.utcnow().timestamp())}"

    # Record AuditEvent
    record_audit_event(
        db=db,
        action="SIMULATE_CART_WEBHOOK",
        actor_user_id=current_user.id,
        target_type="cart_event",
        target_id=payload.cart_token,
        correlation_id=correlation_id,
        metadata={"recipient_hash": hash_phone(payload.customer_phone)}
    )

    # Record WebhookEvent audit record
    sim_event = models.WebhookEvent(
        source="internal_sim",
        event_type="cart",
        external_event_id=str(payload.cart_token),
        idempotency_key=idempotency_key,
        hmac_validated=True,
        correlation_id=correlation_id,
        received_at=datetime.utcnow()
    )
    db.add(sim_event)
    db.commit()

    return {
        "status": "simulation_accepted",
        "cart_token": payload.cart_token,
        "customer_phone": payload.customer_phone,
        "correlation_id": correlation_id
    }


@router.post("/simulate/order-completed")
def simulate_order_completed(
    request: Request,
    payload: schemas.OrderCompletedPayload,
    password: Optional[str] = None,
    two_factor_code: Optional[str] = None,
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    """
    Simulates an order-completed webhook without HMAC signatures.
    Strictly restricted to Admin role with step-up authentication.
    Generates an immutable AuditEvent.
    """
    auth.verify_user_stepup_auth(current_user, password, two_factor_code, db)

    correlation_id = request.headers.get("X-Correlation-ID") or request.headers.get("X-Request-ID") or str(uuid.uuid4())
    idempotency_key = f"sim_order:{payload.cart_token}:{int(datetime.utcnow().timestamp())}"

    record_audit_event(
        db=db,
        action="SIMULATE_ORDER_WEBHOOK",
        actor_user_id=current_user.id,
        target_type="order_completed",
        target_id=payload.cart_token,
        correlation_id=correlation_id,
        metadata={"recipient_hash": hash_phone(payload.customer_phone)}
    )

    sim_event = models.WebhookEvent(
        source="internal_sim",
        event_type="order",
        external_event_id=f"order:{payload.cart_token}",
        idempotency_key=idempotency_key,
        hmac_validated=True,
        correlation_id=correlation_id,
        received_at=datetime.utcnow()
    )
    db.add(sim_event)
    db.commit()

    return {
        "status": "simulation_accepted",
        "cart_token": payload.cart_token,
        "customer_phone": payload.customer_phone,
        "correlation_id": correlation_id
    }

