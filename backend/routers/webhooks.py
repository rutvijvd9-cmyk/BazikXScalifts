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
    Validates e-commerce HMAC signatures for external requests. Dashboard
    simulations may use an admin or service JWT, but arbitrary user JWTs and
    raw shared-secret headers are never accepted.
    """
    auth_header = request.headers.get("Authorization", "").strip()
    signature = request.headers.get("X-Hub-Signature-256", "")
    if config.WEBHOOK_SECRET and signature:
        raw_body = await request.body()
        expected = "sha256=" + hmac.new(
            config.WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")
        svc = db.query(models.User).filter(models.User.username == config.ECOM_SERVICE_USERNAME).first()
        return svc or models.User(username=config.ECOM_SERVICE_USERNAME, is_active=True)

    # 1. Check permanent API Key from X-API-Key or query params
    api_key_header = request.headers.get("X-API-Key", "").strip() or request.query_params.get("api_key", "").strip()
    if api_key_header:
        api_user = db.query(models.User).filter(models.User.api_token == api_key_header).first()
        if api_user and api_user.is_active:
            return api_user
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")

    # 2. Check Bearer token (supports both JWT and permanent API token)
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        try:
            user = auth.get_current_user(token=token, db=db)
            if user and user.is_active:
                return user
        except HTTPException:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")
        except Exception:
            pass
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")

    # Stealth Security: Return 404 Not Found if called without token
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Not Found"
    )


@router.post("/cart-event", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("60/minute")
async def receive_cart_webhook(
    request: Request,
    payload: schemas.CartEventPayload,
    delay_seconds: Optional[int] = 0,
    current_user: models.User = Depends(get_webhook_authenticated_user),
    db: Session = Depends(get_db)
):
    idempotency_key = request.headers.get("X-Idempotency-Key") or f"cart:{payload.cart_token}"
    existing_event = db.query(models.WebhookEvent).filter(
        models.WebhookEvent.idempotency_key == idempotency_key
    ).first()
    if existing_event:
        return {"status": "duplicate", "message": "Webhook event was already processed."}

    db.add(models.WebhookEvent(event_type="cart", idempotency_key=idempotency_key))
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
    cart_token: str,
    customer_phone: str,
    current_user: models.User = Depends(get_webhook_authenticated_user),
    db: Session = Depends(get_db)
):
    idempotency_key = request.headers.get("X-Idempotency-Key") or f"order:{cart_token}"
    existing_event = db.query(models.WebhookEvent).filter(
        models.WebhookEvent.idempotency_key == idempotency_key
    ).first()
    if existing_event:
        return {"status": "duplicate", "message": "Webhook event was already processed."}
    db.add(models.WebhookEvent(event_type="order", idempotency_key=idempotency_key))
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return {"status": "duplicate", "message": "Webhook event was already processed."}

    clean_phone = customer_phone.strip()
    if not clean_phone.startswith("+"):
        clean_phone = "+" + clean_phone

    # 1. Update contact order statistics
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
        models.CartEvent.customer_phone == customer_phone
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
    if config.META_APP_SECRET:
        raw_body = await request.body()
        expected_signature = "sha256=" + hmac.new(
            config.META_APP_SECRET.encode(), raw_body, hashlib.sha256
        ).hexdigest()
        if not signature or not hmac.compare_digest(expected_signature, signature):
            raise HTTPException(status_code=401, detail="Invalid Meta webhook signature")

    try:
        data = await request.json()
    except Exception:
        return {"status": "ignored", "reason": "invalid json"}

    entry = data.get("entry", [])
    if not entry:
        return {"status": "ok"}

    changes = entry[0].get("changes", [])
    if not changes:
        return {"status": "ok"}

    value = changes[0].get("value", {})
    messages = value.get("messages", [])

    if not messages:
        statuses = value.get("statuses", [])
        if statuses:
            for st in statuses:
                wamid = st.get("id")
                new_status = st.get("status", "").upper()
                if wamid:
                    chat_msg = db.query(models.ChatMessage).filter(models.ChatMessage.meta_message_id == wamid).first()
                    if chat_msg:
                        chat_msg.status = new_status

                    msg_log = db.query(models.MessageLog).filter(models.MessageLog.meta_message_id == wamid).first()
                    if msg_log:
                        msg_log.status = new_status
                        errors = st.get("errors", [])
                        if errors:
                            msg_log.error_message = str(errors)

                    db.commit()
        return {"status": "status_update_acknowledged"}

    any_opt_out = False
    for msg in messages:
        sender_phone = "+" + msg.get("from", "").strip("+")
        msg_type = msg.get("type", "text")
        raw_body = ""
        meta_id = msg.get("id", "")

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
            existing_opt = db.query(models.OptOut).filter(models.OptOut.phone == sender_phone).first()
            if not existing_opt:
                opt_record = models.OptOut(phone=sender_phone, reason=f"INBOUND_REPLY: {raw_body}")
                db.add(opt_record)
                db.commit()
                print(f"🛑 [AUTO-DND] Customer {sender_phone} texted '{raw_body}'. Added to Opt-Out DND list.")

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

        db.commit()

    return {"status": "opted_out" if any_opt_out else "message_processed"}
