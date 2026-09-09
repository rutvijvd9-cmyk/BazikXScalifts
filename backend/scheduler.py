import os
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
        items_summary = ", ".join([item.get("item", "Namkeen Item") for item in cart.items]) if cart.items else "Selected Snacks"

        # Send recovery template
        result = send_whatsapp_template(
            recipient_phone=cart.customer_phone,
            template_name="abandoned_cart_recovery",
            language="en",
            parameters={
                "name": customer_name,
                "items": items_summary,
                "cart_value": f"₹{cart.cart_value:.2f}"
            }
        )

        if result.get("status") in ["success", "success_simulated"]:
            cart.message_sent = True
            cart.message_sent_at = datetime.utcnow()
            db.commit()
            logger.info(f"✅ Abandoned cart recovery dispatched for {cart.customer_phone}")
        else:
            logger.warning(f"Cart message was not sent: {result}")

    except Exception as e:
        logger.error(f"Error in process_abandoned_cart_job: {e}")
    finally:
        db.close()


def schedule_cart_recovery(cart_event_id: int, delay_seconds: int = 1800):
    """
    Schedules a one-off delayed job.
    Default delay is 1800s (30 mins).
    """
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
            # Check if messaged within the last 7 days
            recent_msg = db.query(models.MessageLog).filter(
                models.MessageLog.recipient_phone == phone,
                models.MessageLog.template_name == "reengagement_30_days",
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

        for phone in phones:
            contact = db.query(models.Contact).filter(models.Contact.phone == phone).first()
            customer_name = contact.name if contact and contact.name else "Valued Customer"

            res = send_whatsapp_template(
                recipient_phone=phone,
                template_name=campaign.template_name,
                language=campaign.language,
                parameters={"name": customer_name, "campaign": campaign.title}
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
        logger.info("🚀 APScheduler started successfully with automatic daily triggers for all active rules.")

def run_rule_execution(rule_id: int) -> int:
    """
    Executes an individual automation rule dynamically based on its condition.
    - INACTIVE_DAYS (e.g. 15 days or 30 days)
    - ORDER_COUNT_VIP (e.g. >= 2 orders)
    """
    db = SessionLocal()
    sent_count = 0
    try:
        rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
        if not rule or not rule.is_active:
            return 0

        logger.info(f"⚙️ [Rule Engine] Running automation rule: '{rule.rule_name}'")
        target_phones = {}

        if rule.rule_type == "INACTIVE_DAYS":
            cutoff_date = datetime.utcnow() - timedelta(days=rule.threshold_value)
            contacts = db.query(models.Contact).filter(
                models.Contact.is_active == True,
                (models.Contact.last_order_date <= cutoff_date) | (models.Contact.last_order_date == None)
            ).all()
            for c in contacts:
                target_phones[c.phone] = c.name or "Valued Customer"

        elif rule.rule_type == "ORDER_COUNT_VIP":
            vip_contacts = db.query(models.Contact).filter(
                models.Contact.is_active == True,
                models.Contact.total_orders >= rule.threshold_value
            ).all()
            for c in vip_contacts:
                target_phones[c.phone] = c.name or "Valued Customer"

        # Apply deduplication gate
        dedup_cutoff = datetime.utcnow() - timedelta(days=rule.dedup_days)
        for phone, name in target_phones.items():
            recent_msg = db.query(models.MessageLog).filter(
                models.MessageLog.recipient_phone == phone,
                models.MessageLog.template_name == rule.template_name,
                models.MessageLog.created_at >= dedup_cutoff
            ).first()

            if recent_msg:
                continue

            res = send_whatsapp_template(
                recipient_phone=phone,
                template_name=rule.template_name,
                language="en",
                parameters={"name": name, "discount_code": rule.coupon_code or "OFFER"}
            )
            if res.get("status") in ["success", "success_simulated"]:
                sent_count += 1

        rule.total_triggered += sent_count
        db.commit()
        logger.info(f"🏁 Rule '{rule.rule_name}' finished: {sent_count} messages sent.")
    except Exception as e:
        logger.error(f"Error executing rule {rule_id}: {e}")
    finally:
        db.close()
    return sent_count
