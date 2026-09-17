import os
import re
import hmac
import hashlib
import logging
from datetime import datetime, timedelta
import httpx
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from database import DATABASE_URL, SessionLocal
import models
from whatsapp_service import send_whatsapp_template

logger = logging.getLogger("scheduler")
scheduler = BackgroundScheduler(jobstores={"default": SQLAlchemyJobStore(url=DATABASE_URL)})

import config

WEBHOOK_SECRET = config.WEBHOOK_SECRET
MANUBHAI_STORE_INACTIVE_FEED_URL = config.MANUBHAI_STORE_INACTIVE_FEED_URL

# In-memory short-lived cache for external API pulls to prevent duplicate HTTP calls for the same customer
_api_cache = {}


def fetch_external_api_value(field_key: str, phone: str, source_id: int = None, db = None) -> str:
    """
    Safely and securely queries an external e-commerce API to fetch customer/order data by phone.
    Caches responses for 60 seconds.
    """
    if not phone or not field_key:
        return ""

    cache_key = f"{source_id or 'default'}:{phone}"
    now_ts = datetime.utcnow().timestamp()

    if cache_key in _api_cache:
        data, expiry = _api_cache[cache_key]
        if now_ts < expiry:
            return str(data.get(field_key, ""))

    # Find data source
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        source = None
        if source_id:
            source = db.query(models.ExternalDataSource).filter(
                models.ExternalDataSource.id == source_id,
                models.ExternalDataSource.is_active == True
            ).first()
        if not source:
            source = db.query(models.ExternalDataSource).filter(
                models.ExternalDataSource.is_active == True
            ).first()

        if not source:
            logger.info(f"No active ExternalDataSource found to pull field '{field_key}' for {phone}")
            return ""

        headers = {}
        if source.auth_method == "bearer" and source.api_key:
            headers["Authorization"] = f"Bearer {source.api_key}"
        elif source.api_key:
            h_name = source.header_name or "X-CRM-Token"
            headers[h_name] = source.api_key

        param_name = source.lookup_param or "phone"
        clean_phone = re.sub(r"[^\d+]", "", str(phone)).strip()
        params = {param_name: clean_phone}

        logger.info(f"🌐 [External API Pull] Querying {source.endpoint_url} for {clean_phone}")
        with httpx.Client(timeout=config.HTTP_TIMEOUT_SECONDS) as client:
            resp = client.get(source.endpoint_url, params=params, headers=headers)
            if resp.status_code == 200:
                resp_json = resp.json()
                if isinstance(resp_json, dict):
                    # Cache result for 60 seconds
                    _api_cache[cache_key] = (resp_json, now_ts + 60.0)
                    val = resp_json.get(field_key)
                    return str(val) if val is not None else ""
            else:
                logger.warning(f"External API returned {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.error(f"Error pulling from external API: {e}")
    finally:
        if close_db:
            db.close()

    return ""


def process_abandoned_cart_job(cart_event_id: int):
    """
    Called when delay timer expires. Checks if the customer completed checkout.
    If not, and not opted-out, sends abandoned cart recovery template.
    """
    logger.info(f"⏰ [Scheduler] Executing delayed cart check for cart_event_id={cart_event_id}")
    db = SessionLocal()
    try:
        cart = db.query(models.CartEvent).filter(models.CartEvent.id == cart_event_id).first()
        if not cart:
            logger.warning(f"Cart event {cart_event_id} not found.")
            return

        if cart.status == "RECOVERED":
            logger.info(f"🛒 Order already completed for cart {cart.cart_token}. Skipping WhatsApp message.")
            return

        if cart.message_sent:
            logger.info(f"Message already sent for cart {cart.cart_token}. Skipping.")
            return

        # Fetch contact details if available
        contact = db.query(models.Contact).filter(models.Contact.phone == cart.customer_phone).first()
        customer_name = contact.name if contact and contact.name else "Valued Customer"

        # Item summary
        items_summary = ", ".join([item.get("item", "Namkeen Item") for item in cart.items]) if cart.items else "Special Vanela Gathiya & Bhavnagari Gathiya"
        cart_val_str = str(int(cart.cart_value)) if cart.cart_value == int(cart.cart_value) else f"{cart.cart_value:.2f}"

        # Look up active cart recovery rule to use the user's mapped template & parameters
        cart_rule = db.query(models.AutomationRule).filter(
            models.AutomationRule.rule_type == "CART_RECOVERY",
            models.AutomationRule.is_active == True
        ).first()

        target_template = cart_rule.template_name if cart_rule and cart_rule.template_name else "cart_recovery_v1"
        target_lang = "en_IN" if target_template == "cart_recovery_v1" else "en"
        tmpl_rec = db.query(models.Template).filter(models.Template.template_name == target_template).first()
        if tmpl_rec and tmpl_rec.language:
            target_lang = tmpl_rec.language

        # Extract placeholder indices from template body
        body_text = tmpl_rec.body_text if tmpl_rec and tmpl_rec.body_text else ""
        placeholder_matches = re.findall(r"\{\{(\d+)\}\}", body_text)
        placeholder_indices = sorted(list(set(int(m) for m in placeholder_matches))) if placeholder_matches else [1, 2, 3, 4]

        user_mappings = cart_rule.variable_mappings if cart_rule and isinstance(cart_rule.variable_mappings, dict) else {}

        param_dict = {}
        for idx in placeholder_indices:
            idx_str = str(idx)
            m_def = user_mappings.get(idx_str, {})
            m_type = m_def.get("type") if isinstance(m_def, dict) else None
            m_val = m_def.get("value") if isinstance(m_def, dict) else None

            if m_type == "contact_field":
                val_str = customer_name if m_val == "name" else (cart.customer_phone if m_val == "phone" else customer_name)
            elif m_type == "cart_event":
                val_str = cart_val_str if m_val == "cart_value" else items_summary
            elif m_type == "event_field":
                # Direct lookup from cart's extra_data payload
                extra = cart.extra_data if isinstance(cart.extra_data, dict) else {}
                if m_val == "firstname" or m_val == "first_name":
                    val_str = extra.get("first_name") or extra.get("firstname") or customer_name
                elif m_val == "products" or m_val == "products_summary" or m_val == "items":
                    val_str = extra.get("products_summary") or extra.get("products") or items_summary
                elif m_val == "amount" or m_val == "cart_value":
                    val_str = str(extra.get("amount")) if extra.get("amount") else f"₹{cart_val_str}"
                elif m_val == "delivery_address" or m_val == "address":
                    val_str = extra.get("delivery_address") or extra.get("address") or (contact.city if contact else "")
                else:
                    val_str = str(extra.get(m_val, ""))
            elif m_type == "external_api":
                src_id = m_def.get("source_id")
                val_str = fetch_external_api_value(field_key=m_val, phone=cart.customer_phone, source_id=src_id, db=db)
            elif m_type == "coupon":
                effective_code = (cart_rule.coupon_code if cart_rule and cart_rule.coupon_code else config.DEFAULT_COUPON_CODE)
                coupon_rec = db.query(models.DiscountCode).filter(
                    models.DiscountCode.code == effective_code
                ).first()

                if m_val == "discount_value":
                    val_str = f"{int(coupon_rec.discount_value)}%" if coupon_rec and coupon_rec.discount_type == "PERCENT" else f"{config.DEFAULT_DISCOUNT_PERCENT}%"
                elif m_val == "expires_at":
                    val_str = coupon_rec.expires_at.strftime("%d/%m/%Y") if coupon_rec and coupon_rec.expires_at else (datetime.utcnow() + timedelta(days=config.DEFAULT_EXPIRY_DAYS)).strftime("%d/%m/%Y")
                else:
                    val_str = effective_code
            elif m_type == "static":
                val_str = str(m_val) if m_val else ""
            else:
                effective_code = (cart_rule.coupon_code if cart_rule and cart_rule.coupon_code else config.DEFAULT_COUPON_CODE)
                # Default smart fallback for cart recovery templates (e.g. cart_recovery_v1)
                if idx == 1:
                    val_str = customer_name
                elif idx == 2:
                    val_str = items_summary
                elif idx == 3:
                    val_str = cart_val_str
                elif idx == 4:
                    val_str = effective_code
                else:
                    val_str = config.BRAND_NAME

            param_dict[f"param_{idx}"] = val_str

        # Send recovery template
        recovery_coupon = (cart_rule.coupon_code if cart_rule and cart_rule.coupon_code else config.DEFAULT_COUPON_CODE)
        result = send_whatsapp_template(
            recipient_phone=cart.customer_phone,
            template_name=target_template,
            language=target_lang,
            parameters=param_dict,
            coupon_code=recovery_coupon
        )

        if result.get("status") in ["success", "success_simulated"]:
            cart.message_sent = True
            cart.message_sent_at = datetime.utcnow()
            if cart_rule:
                cart_rule.total_triggered += 1
            db.commit()
            logger.info(f"✅ Abandoned cart recovery dispatched for {cart.customer_phone}")
        else:
            logger.warning(f"Cart message was not sent: {result}")
            try:
                reason = result.get("reason") or result.get("error") or "Template dispatch failed"
                fail_entry = models.MessageLog(
                    recipient_phone=cart.customer_phone,
                    template_name=target_template,
                    language=target_lang,
                    status="FAILED",
                    error_message=f"Recovery failed: {reason}"
                )
                db.add(fail_entry)
                db.commit()
            except Exception as log_err:
                logger.warning(f"Could not save un-sent MessageLog: {log_err}")

    except Exception as e:
        logger.error(f"Error in process_abandoned_cart_job: {e}")
        try:
            cart = db.query(models.CartEvent).filter(models.CartEvent.id == cart_event_id).first()
            fail_entry = models.MessageLog(
                recipient_phone=cart.customer_phone if cart else "Unknown",
                template_name="cart_recovery_v1",
                language="en_IN",
                status="FAILED",
                error_message=f"Cart job crashed: {str(e)[:400]}"
            )
            db.add(fail_entry)
            db.commit()
        except Exception as log_err:
            logger.warning(f"Could not save exception MessageLog: {log_err}")
    finally:
        db.close()


def schedule_cart_recovery(cart_event_id: int, delay_seconds: int = 0):
    """
    Dispatches immediately if delay_seconds <= 0, or schedules a delayed job.
    """
    if delay_seconds <= 0:
        logger.info(f"⚡ Processing cart recovery immediately for cart_event_id={cart_event_id}")
        process_abandoned_cart_job(cart_event_id)
        return

    run_date = datetime.now() + timedelta(seconds=delay_seconds)
    job_id = f"cart_recovery_{cart_event_id}"
    
    scheduler.add_job(
        func=process_abandoned_cart_job,
        trigger=DateTrigger(run_date=run_date),
        args=[cart_event_id],
        id=job_id,
        replace_existing=True
    )
    logger.info(f"📅 Scheduled recovery job {job_id} to run at {run_date.strftime('%H:%M:%S')} (in {delay_seconds}s)")


def fetch_inactive_customers_from_store(days: int = 30) -> list:
    """
    Calls the external store API using secure HMAC signing to pull customers
    who have not ordered in > 30 days. Returns empty list if URL is not configured.
    """
    if not MANUBHAI_STORE_INACTIVE_FEED_URL:
        return []

    try:
        query_param = f"days={days}"
        secret_bytes = (WEBHOOK_SECRET or "").encode()
        sig = "sha256=" + hmac.new(secret_bytes, query_param.encode(), hashlib.sha256).hexdigest()
        headers = {
            "X-Hub-Signature-256": sig,
            "Accept": "application/json"
        }
        url = f"{MANUBHAI_STORE_INACTIVE_FEED_URL}?{query_param}"
        with httpx.Client(timeout=config.HTTP_TIMEOUT_SECONDS) as client:
            res = client.get(url, headers=headers)
            if res.status_code == 200:
                data = res.json()
                return data.get("customers", [])
    except Exception as e:
        logger.error(f"Failed to fetch inactive customers from store: {e}")
    return []


def run_thirty_day_reengagement_sweep():
    """
    Daily cron task (and callable manually):
    1. Queries local DB for inactive customers.
    2. Also queries external PHP store API feed for customers who haven't ordered in 30 days.
    3. De-duplicates: ensures customer wasn't messaged within the last 7 days.
    4. Sends re-engagement promo code via WhatsApp template.
    """
    logger.info("🔄 [Cron Sweep] Starting 30-day customer re-engagement sweep...")
    db = SessionLocal()
    try:
        # Step A: Fetch from local DB
        cutoff_date = datetime.utcnow() - timedelta(days=30)
        contacts = db.query(models.Contact).filter(
            models.Contact.is_active == True,
            (models.Contact.last_order_date <= cutoff_date) | (models.Contact.last_order_date == None)
        ).all()

        target_phones = {c.phone: (c.name or "Valued Customer") for c in contacts}

        # Step B: Pull fresh inactive customers from Manubhai's PHP store feed
        external_customers = fetch_inactive_customers_from_store(days=30)
        for ec in external_customers:
            p = ec.get("phone")
            if p:
                target_phones[p] = ec.get("name", "Valued Customer")

        logger.info(f"📋 Found {len(target_phones)} customers eligible for 30-day re-engagement.")

        # Step C: 7-Day Deduplication Gate
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        sent_count = 0
        skipped_count = 0

        for phone, name in target_phones.items():
            # Check if messaged within the last 7 days (only count successfully sent)
            recent_msg = db.query(models.MessageLog).filter(
                models.MessageLog.recipient_phone == phone,
                models.MessageLog.template_name == "reengagement_30_days",
                models.MessageLog.status.in_(["SENT", "SENT_SIMULATED", "DELIVERED", "READ"]),
                models.MessageLog.created_at >= seven_days_ago
            ).first()

            if recent_msg:
                logger.info(f"⏭️ Skipping {phone}: Already received 30-day promo within the last 7 days.")
                skipped_count += 1
                continue

            # Dispatch personalized winback template with coupon code
            res = send_whatsapp_template(
                recipient_phone=phone,
                template_name="reengagement_30_days",
                language="en",
                parameters={"name": name, "discount_code": "SPECIAL10"}
            )
            if res.get("status") in ["success", "success_simulated"]:
                sent_count += 1

        logger.info(f"🏁 Re-engagement sweep complete: {sent_count} sent, {skipped_count} skipped (7-day dedup).")
    except Exception as e:
        logger.error(f"Error in re-engagement sweep: {e}")
    finally:
        db.close()


def execute_campaign_broadcast(campaign_id: int, recipient_phones: list = None):
    """
    Executes a bulk broadcast campaign safely with rate-limiting and opt-out checks.
    """
    logger.info(f"🚀 [Campaign] Starting execution of campaign_id={campaign_id}")
    db = SessionLocal()
    try:
        campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
        if not campaign:
            logger.error(f"Campaign {campaign_id} not found.")
            return

        campaign.status = "IN_PROGRESS"
        db.commit()

        phones = recipient_phones or []
        if not phones:
            if campaign.target_filter == "ALL":
                contacts = db.query(models.Contact).filter(models.Contact.is_active == True).all()
                phones = [c.phone for c in contacts]

        campaign.total_recipients = len(phones)
        db.commit()

        success_count = 0
        fail_count = 0

        import re
        tmpl = db.query(models.Template).filter(models.Template.template_name == campaign.template_name).first()
        placeholder_count = 2
        if tmpl and tmpl.body_text:
            matches = re.findall(r"\{\{(\d+)\}\}", tmpl.body_text)
            if matches:
                placeholder_count = max([int(m) for m in matches])

        for phone in phones:
            contact = db.query(models.Contact).filter(models.Contact.phone == phone).first()
            customer_name = contact.name if contact and contact.name else "Valued Customer"

            # Build parameters: use template-level mappings first, then positional fallback
            params = {}
            if tmpl and tmpl.variable_mappings and isinstance(tmpl.variable_mappings, dict):
                cart_val_str = str(contact.total_spent if contact else 0)
                items_summary = campaign.title
                for idx_str, m_def in tmpl.variable_mappings.items():
                    if not isinstance(m_def, dict):
                        continue
                    m_type = m_def.get("type")
                    m_val = m_def.get("value")
                    if m_type == "contact_field":
                        if m_val == "phone":
                            val_str = phone
                        elif m_val == "city":
                            val_str = contact.city if contact and contact.city else "Ahmedabad"
                        elif m_val == "total_orders":
                            val_str = str(contact.total_orders) if contact else "1"
                        elif m_val == "last_order_date":
                            val_str = contact.last_order_date.strftime("%d/%m/%Y") if contact and contact.last_order_date else "Recently"
                        else:
                            val_str = customer_name
                    elif m_type == "cart_event":
                        val_str = cart_val_str if m_val == "cart_value" else items_summary
                    elif m_type == "coupon":
                        val_str = config.DEFAULT_COUPON_CODE if hasattr(config, "DEFAULT_COUPON_CODE") else "MANU10"
                    elif m_type == "static":
                        val_str = str(m_val) if m_val else ""
                    else:
                        val_str = customer_name
                    params[f"param_{idx_str}"] = val_str
            else:
                # Positional fallback if template has no configured mappings
                fallback_values = [
                    customer_name,
                    campaign.title,
                    config.STORE_SUPPORT_PHONE or phone,
                    f"{config.DEFAULT_DISCOUNT_PERCENT}% OFF",
                    config.STORE_LOCATION or config.BRAND_NAME,
                    config.BRAND_NAME
                ]
                for i in range(1, placeholder_count + 1):
                    params[f"param_{i}"] = fallback_values[(i - 1) % len(fallback_values)]

            res = send_whatsapp_template(
                recipient_phone=phone,
                template_name=campaign.template_name,
                language=campaign.language,
                parameters=params
            )

            if res.get("status") in ["success", "success_simulated"]:
                success_count += 1
            else:
                fail_count += 1

        campaign.successful_sends = success_count
        campaign.failed_sends = fail_count
        campaign.status = "COMPLETED"
        db.commit()
        logger.info(f"🏁 Campaign {campaign_id} COMPLETED: {success_count} sent, {fail_count} failed/blocked.")

    except Exception as e:
        logger.error(f"Error executing campaign {campaign_id}: {e}")
        if campaign:
            campaign.status = "FAILED"
            db.commit()
    finally:
        db.close()


def run_all_active_automation_rules():
    """
    Automatic daily cron job: iterates through every active automation rule
    (15-day inactive, 30-day winback, VIP repeat buyer, etc.) and executes them
    with deduplication without requiring manual button clicks.
    """
    logger.info("⏰ [Daily Cron] Auto-executing all active automation rules...")
    db = SessionLocal()
    try:
        rules = db.query(models.AutomationRule).filter(models.AutomationRule.is_active == True).all()
        for rule in rules:
            if rule.rule_type != "CART_RECOVERY":
                dispatched = run_rule_execution(rule.id)
                logger.info(f"⚡ [Daily Cron] Rule '{rule.rule_name}': {dispatched} sent.")
    except Exception as e:
        logger.error(f"Error in daily automation rules execution: {e}")
    finally:
        db.close()


def start_scheduler():
    if not config.SCHEDULER_ENABLED:
        logger.info("Scheduler is disabled for this application instance.")
        return
    if not scheduler.running:
        # 1. Automatic Daily Sweep at 10:00 AM IST for ALL active automation rules (15-day, 30-day, VIP, etc.)
        scheduler.add_job(
            func=run_all_active_automation_rules,
            trigger=CronTrigger(hour=10, minute=0),
            id="daily_all_automations_sweep",
            replace_existing=True
        )
        # 2. Continuous Multi-Step Workflow Engine Sweep (checks delays & conditions every minute)
        scheduler.add_job(
            func=process_all_active_workflow_sessions,
            trigger=IntervalTrigger(minutes=1),
            id="continuous_workflow_engine_sweep",
            replace_existing=True
        )
        scheduler.start()
        logger.info("🚀 APScheduler started successfully with daily sweep and continuous workflow engine.")

def run_rule_execution(rule_id: int, force_approved: bool = False) -> dict:
    """
    Executes an individual automation rule dynamically based on its condition.
    - INACTIVE_DAYS (e.g. 15 days or 30 days)
    - ORDER_COUNT_VIP (e.g. >= 2 orders)

    🛡️ HIGH-VOLUME SAFEGUARD:
    If the rule targets more than 100 contacts (> 100), it is held in PENDING_APPROVAL
    and dispatches an alert email to all admin emails asking for 2FA permission,
    unless explicitly authorized by admin (force_approved=True).
    """
    db = SessionLocal()
    sent_count = 0
    try:
        rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
        if not rule or not rule.is_active:
            return {"status": "inactive", "messages_dispatched": 0, "requires_approval": False}

        # ⏳ Check Expiration Deadline: If past expires_at, automatically turn rule OFF
        if rule.expires_at and datetime.utcnow() > rule.expires_at:
            rule.is_active = False
            db.commit()
            logger.info(f"⏳ [Rule Engine] Rule '{rule.rule_name}' has passed its deadline ({rule.expires_at}). Auto-deactivated.")
            return {"status": "expired", "messages_dispatched": 0, "requires_approval": False, "message": "Automation rule has reached its deadline and is now inactive."}

        logger.info(f"⚙️ [Rule Engine] Running automation rule: '{rule.rule_name}' (force_approved={force_approved})")
        target_phones = {}

        if rule.rule_type == "INACTIVE_DAYS":
            cutoff_date = datetime.utcnow() - timedelta(days=rule.threshold_value)
            contacts = db.query(models.Contact).filter(
                models.Contact.is_active == True,
                (models.Contact.last_order_date <= cutoff_date) | (models.Contact.last_order_date == None)
            ).all()
            for c in contacts:
                target_phones[c.phone] = c

        elif rule.rule_type == "ORDER_COUNT_VIP":
            vip_contacts = db.query(models.Contact).filter(
                models.Contact.is_active == True,
                models.Contact.total_orders >= rule.threshold_value
            ).all()
            for c in vip_contacts:
                target_phones[c.phone] = c

        # Apply deduplication gate to calculate ACTUAL eligible contacts to receive messages
        # Only deduplicate contacts who actually received a message (do not block failed attempts)
        dedup_cutoff = datetime.utcnow() - timedelta(days=rule.dedup_days)
        eligible_phones = {}
        for phone, contact_obj in target_phones.items():
            recent_msg = db.query(models.MessageLog).filter(
                models.MessageLog.recipient_phone == phone,
                models.MessageLog.template_name == rule.template_name,
                models.MessageLog.status.in_(["SENT", "SENT_SIMULATED", "DELIVERED", "READ"]),
                models.MessageLog.created_at >= dedup_cutoff
            ).first()
            if not recent_msg:
                eligible_phones[phone] = contact_obj

        total_eligible = len(eligible_phones)

        # 🛡️ SAFEGUARD: If > 100 recipients and not force_approved by admin, hold and email alert!
        if total_eligible > 100 and not force_approved:
            rule.approval_status = "PENDING_APPROVAL"
            rule.pending_recipients_count = total_eligible
            db.commit()

            logger.info(f"⏸️ Rule '{rule.rule_name}' held: {total_eligible} eligible recipients (> 100 threshold). Requires dashboard approval.")
            return {
                "status": "pending_approval",
                "messages_dispatched": 0,
                "requires_approval": True,
                "eligible_count": total_eligible,
                "rule": rule.rule_name,
                "message": f"Rule held for approval: targets {total_eligible} contacts (>100 threshold). Please review in dashboard."
            }

        # Determine template language dynamically from DB
        import re
        tmpl_rec = db.query(models.Template).filter(models.Template.template_name == rule.template_name).first()
        target_lang = (tmpl_rec.language if tmpl_rec and tmpl_rec.language else "en")

        # Parse placeholder indices from template body (e.g. {{1}}, {{2}}, {{3}}, {{4}})
        placeholder_indices = []
        if tmpl_rec and tmpl_rec.body_text:
            raw_matches = re.findall(r"\{\{(\d+)\}\}", tmpl_rec.body_text)
            if raw_matches:
                placeholder_indices = sorted(list(set(int(m) for m in raw_matches)))
        if not placeholder_indices:
            placeholder_indices = [1, 2]

        user_mappings = rule.variable_mappings if isinstance(rule.variable_mappings, dict) else {}

        # If <= 100 OR already approved by admin with 2FA
        for phone, contact_obj in eligible_phones.items():
            cust_name = contact_obj.name if contact_obj and contact_obj.name else "Valued Customer"
            cust_phone = contact_obj.phone if contact_obj and contact_obj.phone else phone
            cust_city = contact_obj.city if contact_obj and contact_obj.city else "Ahmedabad"
            cust_orders = str(contact_obj.total_orders) if contact_obj and contact_obj.total_orders is not None else "1"
            cust_last_order = contact_obj.last_order_date.strftime("%d %b %Y") if contact_obj and contact_obj.last_order_date else "Recently"

            # Construct ordered parameters for Meta
            param_dict = {}
            for idx in placeholder_indices:
                idx_str = str(idx)
                mapping_def = user_mappings.get(idx_str, {})
                m_type = mapping_def.get("type") if isinstance(mapping_def, dict) else None
                m_val = mapping_def.get("value") if isinstance(mapping_def, dict) else None

                if m_type == "contact_field":
                    if m_val == "name":
                        val_str = cust_name
                    elif m_val == "phone":
                        val_str = cust_phone
                    elif m_val == "city":
                        val_str = cust_city
                    elif m_val == "total_orders":
                        val_str = cust_orders
                    elif m_val == "last_order_date":
                        val_str = cust_last_order
                    else:
                        val_str = cust_name
                elif m_type == "cart_event":
                    # Look up latest cart event for this phone if available
                    recent_cart = db.query(models.CartEvent).filter(
                        models.CartEvent.customer_phone == phone
                    ).order_by(models.CartEvent.id.desc()).first()
                    if m_val == "cart_value":
                        val_str = str(int(recent_cart.cart_value)) if recent_cart and recent_cart.cart_value == int(recent_cart.cart_value) else (f"{recent_cart.cart_value:.2f}" if recent_cart else "450")
                    else:
                        val_str = ", ".join([it.get("item", "Namkeen") for it in recent_cart.items]) if recent_cart and recent_cart.items else "Special Vanela Gathiya & Bhavnagari Gathiya"
                elif m_type == "event_field":
                    recent_cart = db.query(models.CartEvent).filter(
                        models.CartEvent.customer_phone == phone
                    ).order_by(models.CartEvent.id.desc()).first()
                    extra = recent_cart.extra_data if recent_cart and isinstance(recent_cart.extra_data, dict) else {}
                    if m_val == "firstname" or m_val == "first_name":
                        val_str = extra.get("first_name") or extra.get("firstname") or cust_name
                    elif m_val == "products" or m_val == "products_summary" or m_val == "items":
                        val_str = extra.get("products_summary") or extra.get("products") or ", ".join([it.get("item", "Namkeen") for it in recent_cart.items]) if recent_cart and recent_cart.items else "Special Vanela Gathiya & Bhavnagari Gathiya"
                    elif m_val == "amount" or m_val == "cart_value":
                        val_str = str(extra.get("amount")) if extra.get("amount") else (f"₹{int(recent_cart.cart_value)}" if recent_cart else "₹450")
                    elif m_val == "delivery_address" or m_val == "address":
                        val_str = extra.get("delivery_address") or extra.get("address") or cust_city
                    else:
                        val_str = str(extra.get(m_val, ""))
                elif m_type == "external_api":
                    src_id = mapping_def.get("source_id")
                    val_str = fetch_external_api_value(field_key=m_val, phone=phone, source_id=src_id, db=db)
                elif m_type == "coupon":
                    # Look up attached coupon details from DB
                    coupon_rec = db.query(models.DiscountCode).filter(
                        models.DiscountCode.code == rule.coupon_code
                    ).first() if rule.coupon_code else None

                    if m_val == "discount_value":
                        if coupon_rec:
                            val_str = f"{int(coupon_rec.discount_value)}%" if coupon_rec.discount_type == "PERCENT" else f"₹{int(coupon_rec.discount_value)}"
                        else:
                            val_str = f"{config.DEFAULT_DISCOUNT_PERCENT}%"
                    elif m_val == "expires_at":
                        if coupon_rec and coupon_rec.expires_at:
                            val_str = coupon_rec.expires_at.strftime("%d/%m/%Y")
                        elif rule.expires_at:
                            val_str = rule.expires_at.strftime("%d/%m/%Y")
                        else:
                            val_str = (datetime.utcnow() + timedelta(days=config.DEFAULT_EXPIRY_DAYS)).strftime("%d/%m/%Y")
                    else:
                        val_str = rule.coupon_code or config.DEFAULT_COUPON_CODE
                elif m_type == "static":
                    val_str = str(m_val).strip() if m_val else "-"
                else:
                    # Default intelligent fallback if no explicit user mapping
                    if idx == 1:
                        val_str = cust_name
                    elif idx == 2:
                        val_str = rule.coupon_code or config.DEFAULT_COUPON_CODE
                    elif idx == 3:
                        val_str = f"{config.DEFAULT_DISCOUNT_PERCENT}% OFF"
                    elif idx == 4:
                        val_str = "Limited Time"
                    else:
                        val_str = config.BRAND_NAME

                param_dict[f"param_{idx}"] = val_str

            res = send_whatsapp_template(
                recipient_phone=phone,
                template_name=rule.template_name,
                language=target_lang,
                parameters=param_dict,
                coupon_code=rule.coupon_code or config.DEFAULT_COUPON_CODE
            )
            if res.get("status") in ["success", "success_simulated"]:
                sent_count += 1
            else:
                logger.warning(f"⚠️ [Rule Engine] Dispatch to {phone} returned: {res}")

        rule.total_triggered += sent_count
        rule.approval_status = "IDLE"
        rule.pending_recipients_count = 0
        db.commit()
        logger.info(f"🏁 Rule '{rule.rule_name}' finished: {sent_count}/{total_eligible} messages sent.")
        return {
            "status": "success",
            "messages_dispatched": sent_count,
            "requires_approval": False,
            "rule": rule.rule_name
        }
    except Exception as e:
        logger.error(f"Error executing rule {rule_id}: {e}")
        return {"status": "error", "error": str(e), "messages_dispatched": 0, "requires_approval": False}
    finally:
        db.close()


# =====================================================================
# 🔀 MULTI-STEP VISUAL FLOWCHART WORKFLOW EXECUTION ENGINE
# =====================================================================

def find_node_by_id(nodes: list, node_id: str):
    """Finds a node inside a workflow's nodes list by its ID."""
    for n in nodes:
        if str(n.get("id")) == str(node_id):
            return n
    return None


def find_next_node(nodes: list, edges: list, current_node_id: str, handle: str = None):
    """
    Finds the next node in the graph.
    If handle is provided ('yes' or 'no'), matches the edge sourceHandle.
    """
    candidate_edges = [
        e for e in edges
        if str(e.get("source")) == str(current_node_id)
    ]
    if not candidate_edges:
        return None

    if handle:
        matching = [e for e in candidate_edges if str(e.get("sourceHandle", "")).lower() == handle.lower()]
        if matching:
            target_id = matching[0].get("target")
            return find_node_by_id(nodes, target_id)
        # Fallback if handle wasn't explicitly tagged
        target_id = candidate_edges[0].get("target")
        return find_node_by_id(nodes, target_id)
    else:
        target_id = candidate_edges[0].get("target")
        return find_node_by_id(nodes, target_id)


def start_workflow_session(flow_id: int, customer_phone: str, state_data: dict, db=None) -> models.WorkflowSession:
    """
    Initializes a new customer session into a visual workflow journey.
    Locates the trigger node, persists state, and processes the initial step.
    """
    owns_db = False
    if db is None:
        db = SessionLocal()
        owns_db = True

    try:
        flow = db.query(models.WorkflowFlow).filter(models.WorkflowFlow.id == flow_id).first()
        if not flow or not flow.is_active:
            logger.info(f"Flow {flow_id} is inactive or not found.")
            return None

        nodes = flow.nodes or []
        edges = flow.edges or []
        if not nodes:
            logger.warning(f"Flow {flow_id} has no nodes.")
            return None

        # Find entry node: node with type 'trigger' or the first node
        trigger_node = next((n for n in nodes if n.get("type") == "trigger"), nodes[0])

        session = models.WorkflowSession(
            flow_id=flow.id,
            customer_phone=customer_phone,
            current_node_id=str(trigger_node.get("id")),
            state_data=state_data or {},
            status="ACTIVE",
            next_evaluation_at=datetime.utcnow(),
            history=[{
                "node_id": str(trigger_node.get("id")),
                "node_type": "trigger",
                "label": trigger_node.get("label", "Workflow Started"),
                "timestamp": datetime.utcnow().isoformat(),
                "details": f"Session enrolled for {customer_phone}"
            }]
        )
        db.add(session)

        # Update flow stats
        current_stats = dict(flow.stats or {})
        current_stats["entered"] = current_stats.get("entered", 0) + 1
        flow.stats = current_stats

        db.commit()
        db.refresh(session)

        logger.info(f"🚀 [Workflow Engine] Session #{session.id} started for {customer_phone} in flow '{flow.name}'")
        
        # Advance from trigger to first downstream node
        process_workflow_session_step(session.id, db=db)
        db.refresh(session)
        return session
    except Exception as e:
        logger.error(f"Error starting workflow session: {e}")
        db.rollback()
        return None
    finally:
        if owns_db:
            db.close()


def process_workflow_session_step(session_id: int, db=None, mock_send: bool = False) -> dict:
    """
    Evaluates and advances a single session in a workflow.
    Handles Delays, WhatsApp Message Templates, Condition branching, Tagging, and Goals/Exits.
    """
    owns_db = False
    if db is None:
        db = SessionLocal()
        owns_db = True

    try:
        session = db.query(models.WorkflowSession).filter(models.WorkflowSession.id == session_id).first()
        if not session or session.status in ["COMPLETED_GOAL", "COMPLETED_DROPOUT", "CANCELLED"]:
            return {"status": "skipped", "reason": "session_inactive_or_finished"}

        flow = db.query(models.WorkflowFlow).filter(models.WorkflowFlow.id == session.flow_id).first()
        if not flow or not flow.is_active:
            session.status = "CANCELLED"
            db.commit()
            return {"status": "cancelled", "reason": "flow_inactive"}

        nodes = flow.nodes or []
        edges = flow.edges or []
        curr_node = find_node_by_id(nodes, session.current_node_id)
        if not curr_node:
            logger.warning(f"Session #{session.id} current_node {session.current_node_id} not found in flow.")
            session.status = "COMPLETED_DROPOUT"
            db.commit()
            return {"status": "error", "reason": "node_not_found"}

        node_type = curr_node.get("type", "").lower()
        node_data = curr_node.get("data", {})
        now = datetime.utcnow()

        logger.info(f"⚙️ [Workflow Engine] Session #{session.id} ({session.customer_phone}) at node: {curr_node.get('label')} ({node_type})")

        # ─── 1. TRIGGER NODE ───
        if node_type == "trigger":
            # Immediately advance to next node
            next_node = find_next_node(nodes, edges, curr_node.get("id"))
            if next_node:
                session.current_node_id = str(next_node.get("id"))
                db.commit()
                # Recurse to execute the next node immediately
                return process_workflow_session_step(session.id, db=db, mock_send=mock_send)
            else:
                session.status = "COMPLETED_DROPOUT"
                db.commit()
                return {"status": "completed", "outcome": "no_downstream_nodes"}

        # ─── 2. DELAY NODE ───
        elif node_type == "delay":
            delay_minutes = int(node_data.get("delay_minutes", 30))
            if session.status != "WAITING_DELAY":
                # Enter delay wait
                session.status = "WAITING_DELAY"
                session.next_evaluation_at = now + timedelta(minutes=delay_minutes)
                session.history = (session.history or []) + [{
                    "node_id": str(curr_node.get("id")),
                    "node_type": "delay",
                    "label": curr_node.get("label", f"Wait {delay_minutes}m"),
                    "timestamp": now.isoformat(),
                    "details": f"Delayed until {session.next_evaluation_at.strftime('%Y-%m-%d %H:%M:%S UTC')}"
                }]
                db.commit()
                logger.info(f"⏳ [Workflow Engine] Session #{session.id} queued for {delay_minutes}m delay.")
                return {"status": "delay_scheduled", "delay_minutes": delay_minutes}
            else:
                # Delay period has elapsed!
                session.status = "ACTIVE"
                next_node = find_next_node(nodes, edges, curr_node.get("id"))
                if next_node:
                    session.current_node_id = str(next_node.get("id"))
                    db.commit()
                    return process_workflow_session_step(session.id, db=db, mock_send=mock_send)
                else:
                    session.status = "COMPLETED_DROPOUT"
                    db.commit()
                    return {"status": "completed"}

        # ─── 3. WHATSAPP MESSAGE NODE ───
        elif node_type in ["whatsapp_message", "action_whatsapp", "whatsapp"]:
            # Check DND & Opt-out
            opt_out = db.query(models.OptOut).filter(models.OptOut.phone == session.customer_phone).first()
            if opt_out:
                session.status = "COMPLETED_DROPOUT"
                session.history = (session.history or []) + [{
                    "node_id": str(curr_node.get("id")),
                    "node_type": "whatsapp_message",
                    "label": curr_node.get("label"),
                    "timestamp": now.isoformat(),
                    "details": "Customer in Opt-Out DND list. Message suppressed."
                }]
                db.commit()
                return {"status": "opted_out", "reason": "dnd_active"}

            template_name = node_data.get("template_name", "cart_recovery_v1")
            coupon_code = node_data.get("coupon_code", config.DEFAULT_COUPON_CODE)

            # Look up template record for language and default mappings
            template_record = db.query(models.Template).filter(
                models.Template.template_name == template_name
            ).first()

            language = node_data.get("language")
            if not language or language == "en":
                if template_record and template_record.language:
                    language = template_record.language
                elif template_name == "cart_recovery_v1":
                    language = "en_IN"
                else:
                    language = "en"

            # Look up contact info
            contact = db.query(models.Contact).filter(models.Contact.phone == session.customer_phone).first()
            customer_name = contact.name if contact and contact.name else session.state_data.get("customer_name", "Valued Customer")
            cart_val_str = str(session.state_data.get("cart_value", "450"))
            items_summary = session.state_data.get("items_summary", "Special Vanela Gathiya & Bhavnagari Gathiya")

            # Resolve dynamic column / parameter mappings
            # Priority: node overrides > template-level mappings > smart default fallback
            user_mappings = node_data.get("variable_mappings")
            if not user_mappings:
                # Inherit from the template itself (Configure-Once-Use-Everywhere pattern)
                if template_record and template_record.variable_mappings:
                    user_mappings = template_record.variable_mappings
                else:
                    user_mappings = {}
            param_dict = {}

            if isinstance(user_mappings, dict) and user_mappings:
                for idx_str, m_def in user_mappings.items():
                    if not isinstance(m_def, dict):
                        continue
                    m_type = m_def.get("type")
                    m_val = m_def.get("value")

                    if m_type == "contact_field":
                        if m_val == "phone":
                            val_str = session.customer_phone
                        elif m_val == "city":
                            val_str = contact.city if contact and contact.city else "Ahmedabad"
                        elif m_val == "total_orders":
                            val_str = str(contact.total_orders) if contact else "1"
                        elif m_val == "last_order_date":
                            val_str = contact.last_order_date.strftime("%d/%m/%Y") if contact and contact.last_order_date else "Recently"
                        else:
                            val_str = customer_name
                    elif m_type == "cart_event":
                        if m_val == "cart_value":
                            val_str = cart_val_str
                        elif m_val == "cart_url":
                            val_str = session.state_data.get("cart_url", "https://manubhai.com/cart")
                        else:
                            val_str = items_summary
                    elif m_type == "event_field":
                        # Look up from session.state_data or extra_data dict
                        state_dict = session.state_data if isinstance(session.state_data, dict) else {}
                        extra_dict = state_dict.get("extra_data") if isinstance(state_dict.get("extra_data"), dict) else {}
                        if m_val == "firstname" or m_val == "first_name":
                            val_str = state_dict.get("first_name") or extra_dict.get("first_name") or customer_name
                        elif m_val == "products" or m_val == "products_summary" or m_val == "items":
                            val_str = state_dict.get("products_summary") or extra_dict.get("products_summary") or items_summary
                        elif m_val == "amount" or m_val == "cart_value":
                            val_str = str(state_dict.get("amount") or extra_dict.get("amount") or f"₹{cart_val_str}")
                        elif m_val == "delivery_address" or m_val == "address":
                            val_str = state_dict.get("delivery_address") or extra_dict.get("delivery_address") or (contact.city if contact else "")
                        else:
                            val_str = str(state_dict.get(m_val) or extra_dict.get(m_val, ""))
                    elif m_type == "external_api":
                        src_id = m_def.get("source_id")
                        val_str = fetch_external_api_value(field_key=m_val, phone=session.customer_phone, source_id=src_id, db=db)
                    elif m_type == "coupon":
                        coupon_rec = db.query(models.DiscountCode).filter(models.DiscountCode.code == coupon_code).first()
                        if m_val == "discount_value":
                            val_str = f"{int(coupon_rec.discount_value)}%" if coupon_rec and coupon_rec.discount_type == "PERCENT" else f"{config.DEFAULT_DISCOUNT_PERCENT}%"
                        elif m_val == "expires_at":
                            val_str = coupon_rec.expires_at.strftime("%d/%m/%Y") if coupon_rec and coupon_rec.expires_at else (datetime.utcnow() + timedelta(days=config.DEFAULT_EXPIRY_DAYS)).strftime("%d/%m/%Y")
                        else:
                            val_str = coupon_code
                    elif m_type == "static":
                        val_str = str(m_val) if m_val else ""
                    else:
                        val_str = customer_name

                    param_dict[f"param_{idx_str}"] = val_str
            else:
                # Default smart fallback
                param_dict = {
                    "param_1": customer_name,
                    "param_2": items_summary,
                    "param_3": cart_val_str,
                    "param_4": coupon_code,
                    "param_5": config.BRAND_NAME
                }

            if mock_send:
                res = {"status": "success_simulated", "message_id": f"sim_{int(now.timestamp())}"}
            else:
                res = send_whatsapp_template(
                    recipient_phone=session.customer_phone,
                    template_name=template_name,
                    language=language,
                    parameters=param_dict,
                    coupon_code=coupon_code
                )

            sent_msg_id = res.get("message_id") or res.get("id") or f"msg_{int(now.timestamp())}"
            new_state = dict(session.state_data or {})
            new_state["last_meta_message_id"] = sent_msg_id
            new_state["last_sent_template"] = template_name
            session.state_data = new_state

            session.history = (session.history or []) + [{
                "node_id": str(curr_node.get("id")),
                "node_type": "whatsapp_message",
                "label": curr_node.get("label", f"Send {template_name}"),
                "timestamp": now.isoformat(),
                "details": f"Dispatched template '{template_name}' (Status: {res.get('status')})"
            }]

            # Advance to next node
            next_node = find_next_node(nodes, edges, curr_node.get("id"))
            if next_node:
                session.current_node_id = str(next_node.get("id"))
                db.commit()
                return {"status": "message_sent", "template": template_name, "next_node": next_node.get("id")}
            else:
                session.status = "COMPLETED_GOAL"
                db.commit()
                return {"status": "completed", "outcome": "flow_finished"}

        # ─── 4. CONDITION / DECISION NODE ───
        elif node_type in ["condition", "decision"]:
            condition_type = node_data.get("condition_type", "ORDER_PLACED")
            condition_met = False

            if condition_type in ["ORDER_PLACED", "CART_RECOVERED"]:
                # Check 1: Did cart get marked RECOVERED in CartEvent?
                cart_token = session.state_data.get("cart_token")
                if cart_token:
                    cart = db.query(models.CartEvent).filter(models.CartEvent.cart_token == cart_token).first()
                    if cart and cart.status == "RECOVERED":
                        condition_met = True
                # Check 2: Did contact place a new order after session start?
                if not condition_met:
                    contact = db.query(models.Contact).filter(models.Contact.phone == session.customer_phone).first()
                    if contact and contact.last_order_date and contact.last_order_date >= session.created_at:
                        condition_met = True
                # Check 3: State flag
                if not condition_met and session.state_data.get("order_placed"):
                    condition_met = True

            elif condition_type == "MESSAGE_READ":
                # Check if last sent message was READ
                last_msg_id = session.state_data.get("last_meta_message_id")
                if last_msg_id:
                    msg = db.query(models.MessageLog).filter(models.MessageLog.meta_message_id == last_msg_id).first()
                    if msg and msg.status == "READ":
                        condition_met = True
                    chat_msg = db.query(models.ChatMessage).filter(models.ChatMessage.meta_message_id == last_msg_id).first()
                    if chat_msg and (chat_msg.is_read or chat_msg.status == "READ"):
                        condition_met = True
                if not condition_met and session.state_data.get("message_read"):
                    condition_met = True

            elif condition_type == "CART_VALUE_ABOVE":
                threshold = float(node_data.get("threshold", 500))
                cart_val = float(session.state_data.get("cart_value", 0))
                condition_met = (cart_val >= threshold)

            branch_handle = "yes" if condition_met else "no"
            logger.info(f"⚖️ [Workflow Engine] Condition '{condition_type}' evaluated to: {condition_met} -> Branch: {branch_handle}")

            cond_str = "YES" if condition_met else "NO"
            session.history = (session.history or []) + [{
                "node_id": str(curr_node.get("id")),
                "node_type": "condition",
                "label": curr_node.get("label", f"Check {condition_type}"),
                "timestamp": now.isoformat(),
                "details": f"Condition evaluated to {cond_str} -> Took '{branch_handle.upper()}' path"
            }]

            next_node = find_next_node(nodes, edges, curr_node.get("id"), handle=branch_handle)
            if next_node:
                session.current_node_id = str(next_node.get("id"))
                db.commit()
                # Immediately execute next branch node
                return process_workflow_session_step(session.id, db=db, mock_send=mock_send)
            else:
                session.status = "COMPLETED_GOAL" if condition_met else "COMPLETED_DROPOUT"
                db.commit()
                return {"status": "completed", "outcome": f"branch_{branch_handle}_end"}

        # ─── 5. TAG CONTACT NODE ───
        elif node_type in ["tag", "tag_contact"]:
            tag_name = node_data.get("tag_name", "Recovered Customer")
            contact = db.query(models.Contact).filter(models.Contact.phone == session.customer_phone).first()
            if contact:
                current_tags = [t.strip() for t in (contact.tags or "").split(",") if t.strip()]
                if tag_name not in current_tags:
                    current_tags.append(tag_name)
                    contact.tags = ", ".join(current_tags)
                    db.commit()

            session.history = (session.history or []) + [{
                "node_id": str(curr_node.get("id")),
                "node_type": "tag",
                "label": curr_node.get("label", f"Tag '{tag_name}'"),
                "timestamp": now.isoformat(),
                "details": f"Contact tagged with '{tag_name}'"
            }]

            next_node = find_next_node(nodes, edges, curr_node.get("id"))
            if next_node:
                session.current_node_id = str(next_node.get("id"))
                db.commit()
                return process_workflow_session_step(session.id, db=db, mock_send=mock_send)
            else:
                session.status = "COMPLETED_GOAL"
                db.commit()
                return {"status": "completed"}

        # ─── 6. EXIT / GOAL NODE ───
        elif node_type in ["exit", "goal"]:
            outcome = node_data.get("outcome", "GOAL_MET")
            session.status = "COMPLETED_GOAL" if outcome == "GOAL_MET" else "COMPLETED_DROPOUT"

            # Update stats
            current_stats = dict(flow.stats or {})
            current_stats["completed"] = current_stats.get("completed", 0) + 1
            if outcome == "GOAL_MET":
                current_stats["goals_converted"] = current_stats.get("goals_converted", 0) + 1
                cart_val = float(session.state_data.get("cart_value", 0))
                current_stats["revenue_recovered"] = current_stats.get("revenue_recovered", 0) + cart_val
            flow.stats = current_stats

            session.history = (session.history or []) + [{
                "node_id": str(curr_node.get("id")),
                "node_type": "exit",
                "label": curr_node.get("label", "Flow Completed"),
                "timestamp": now.isoformat(),
                "details": f"Journey concluded with status: {session.status}"
            }]
            db.commit()
            logger.info(f"🏁 [Workflow Engine] Session #{session.id} concluded with outcome: {outcome}")
            return {"status": "completed", "outcome": outcome}

        else:
            logger.warning(f"Unknown node type '{node_type}'. Advancing.")
            next_node = find_next_node(nodes, edges, curr_node.get("id"))
            if next_node:
                session.current_node_id = str(next_node.get("id"))
                db.commit()
                return process_workflow_session_step(session.id, db=db, mock_send=mock_send)
            else:
                session.status = "COMPLETED_DROPOUT"
                db.commit()
                return {"status": "completed"}

    except Exception as e:
        logger.error(f"Error in process_workflow_session_step: {e}")
        db.rollback()
        return {"status": "error", "error": str(e)}
    finally:
        if owns_db:
            db.close()


def process_all_active_workflow_sessions():
    """
    Periodic job (every minute) that evaluates all active workflow sessions
    whose next_evaluation_at has arrived.
    """
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        due_sessions = db.query(models.WorkflowSession).filter(
            models.WorkflowSession.status.in_(["ACTIVE", "WAITING_DELAY", "WAITING_CONDITION"]),
            models.WorkflowSession.next_evaluation_at <= now
        ).all()

        if due_sessions:
            logger.info(f"⏰ [Workflow Engine] Processing {len(due_sessions)} due workflow session(s)...")
            for sess in due_sessions:
                process_workflow_session_step(sess.id, db=db)
    except Exception as e:
        logger.error(f"Error in process_all_active_workflow_sessions: {e}")
    finally:
        db.close()
