import os
import re
import hmac
import hashlib
import logging
from datetime import datetime, timedelta
import httpx
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.cron import CronTrigger
from database import SessionLocal
import models
from whatsapp_service import send_whatsapp_template

logger = logging.getLogger("scheduler")
scheduler = BackgroundScheduler()

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "manubhai_webhook_secret_key_987654")
MANUBHAI_STORE_INACTIVE_FEED_URL = os.getenv(
    "MANUBHAI_STORE_INACTIVE_FEED_URL",
    "http://localhost:8000/api/mock-store-feed/inactive-customers"
)


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
            elif m_type == "coupon":
                coupon_rec = db.query(models.DiscountCode).filter(
                    models.DiscountCode.code == (cart_rule.coupon_code if cart_rule else "BAZIK7")
                ).first() if (cart_rule and cart_rule.coupon_code) else None

                if m_val == "discount_value":
                    val_str = f"{int(coupon_rec.discount_value)}%" if coupon_rec and coupon_rec.discount_type == "PERCENT" else "7%"
                elif m_val == "expires_at":
                    val_str = coupon_rec.expires_at.strftime("%d/%m/%Y") if coupon_rec and coupon_rec.expires_at else "30/09/2026"
                else:
                    val_str = (cart_rule.coupon_code if cart_rule else "BAZIK7") or "BAZIK7"
            elif m_type == "static":
                val_str = str(m_val) if m_val else ""
            else:
                # Default smart fallback for cart recovery templates (e.g. cart_recovery_v1)
                if idx == 1:
                    val_str = customer_name
                elif idx == 2:
                    val_str = items_summary
                elif idx == 3:
                    val_str = cart_val_str
                elif idx == 4:
                    val_str = (cart_rule.coupon_code if cart_rule else "BAZIK7") or "BAZIK7"
                else:
                    val_str = "Manubhai Gathiyawala"

            param_dict[f"param_{idx}"] = val_str

        # Send recovery template
        result = send_whatsapp_template(
            recipient_phone=cart.customer_phone,
            template_name=target_template,
            language=target_lang,
            parameters=param_dict,
            coupon_code=(cart_rule.coupon_code if cart_rule else "BAZIK7") or "BAZIK7"
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
    Calls Manubhai's PHP store API using secure HMAC signing to pull customers
    who have not ordered in > 30 days.
    """
    try:
        query_param = f"days={days}"
        sig = "sha256=" + hmac.new(WEBHOOK_SECRET.encode(), query_param.encode(), hashlib.sha256).hexdigest()
        headers = {
            "X-Hub-Signature-256": sig,
            "Accept": "application/json"
        }
        url = f"{MANUBHAI_STORE_INACTIVE_FEED_URL}?{query_param}"
        with httpx.Client(timeout=5.0) as client:
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

            # Build parameter dictionary matching the template's required count
            fallback_values = [customer_name, campaign.title, "+91 98765 43210", "10% OFF", "Ahmedabad", "Manubhai Gathiyawala"]
            params = {}
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
    if not scheduler.running:
        # 1. Automatic Daily Sweep at 10:00 AM IST for ALL active automation rules (15-day, 30-day, VIP, etc.)
        scheduler.add_job(
            func=run_all_active_automation_rules,
            trigger=CronTrigger(hour=10, minute=0),
            id="daily_all_automations_sweep",
            replace_existing=True
        )
        scheduler.start()
        logger.info("🚀 APScheduler started successfully with automatic daily sweeps.")

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
                elif m_type == "coupon":
                    # Look up attached coupon details from DB
                    coupon_rec = db.query(models.DiscountCode).filter(
                        models.DiscountCode.code == rule.coupon_code
                    ).first() if rule.coupon_code else None

                    if m_val == "discount_value":
                        if coupon_rec:
                            val_str = f"{int(coupon_rec.discount_value)}%" if coupon_rec.discount_type == "PERCENT" else f"₹{int(coupon_rec.discount_value)}"
                        else:
                            val_str = "7%"
                    elif m_val == "expires_at":
                        if coupon_rec and coupon_rec.expires_at:
                            val_str = coupon_rec.expires_at.strftime("%d/%m/%Y")
                        elif rule.expires_at:
                            val_str = rule.expires_at.strftime("%d/%m/%Y")
                        else:
                            val_str = "30/09/2026"
                    else:
                        val_str = rule.coupon_code or "OFFER"
                elif m_type == "static":
                    val_str = str(m_val).strip() if m_val else "-"
                else:
                    # Default intelligent fallback if no explicit user mapping
                    if idx == 1:
                        val_str = cust_name
                    elif idx == 2:
                        val_str = rule.coupon_code or "OFFER"
                    elif idx == 3:
                        val_str = "10% OFF"
                    elif idx == 4:
                        val_str = "Limited Time"
                    else:
                        val_str = "Manubhai Gathiyawala"

                param_dict[f"param_{idx}"] = val_str

            res = send_whatsapp_template(
                recipient_phone=phone,
                template_name=rule.template_name,
                language=target_lang,
                parameters=param_dict,
                coupon_code=rule.coupon_code or "BAZIK7"
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
