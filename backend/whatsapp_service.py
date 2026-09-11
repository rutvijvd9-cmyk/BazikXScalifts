import os
import logging
from datetime import datetime
from dotenv import load_dotenv
import httpx
from database import SessionLocal
import models

load_dotenv()
logger = logging.getLogger("whatsapp_service")
logging.basicConfig(level=logging.INFO)

WHATSAPP_API_TOKEN = os.getenv("WHATSAPP_API_TOKEN", "")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
DAILY_MESSAGE_SEND_LIMIT = int(os.getenv("DAILY_MESSAGE_SEND_LIMIT", "500"))
META_API_URL = f"https://graph.facebook.com/v19.0/{WHATSAPP_PHONE_NUMBER_ID}/messages" if WHATSAPP_PHONE_NUMBER_ID else ""


def check_daily_limit(db) -> tuple[bool, int]:
    """
    Counts total messages dispatched today (UTC).
    Returns (is_under_limit, current_count).
    """
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    current_count = db.query(models.MessageLog).filter(
        models.MessageLog.created_at >= today_start,
        models.MessageLog.status.in_(["SENT", "SENT_SIMULATED", "DELIVERED", "READ"])
    ).count()

    is_allowed = current_count < DAILY_MESSAGE_SEND_LIMIT
    return is_allowed, current_count


def send_whatsapp_template(
    recipient_phone: str,
    template_name: str,
    language: str = "en",
    parameters: dict = None
) -> dict:
    """
    Sends a WhatsApp message via Meta Cloud API or simulation mode.
    Guarded by:
    1. Opt-Out / DND check
    2. Hard daily spending limit check
    """
    db = SessionLocal()
    try:
        # Guardrail 1: Check if recipient is in DND/Opt-Out list
        is_opted_out = db.query(models.OptOut).filter(models.OptOut.phone == recipient_phone).first()
        if is_opted_out:
            logger.info(f"🚫 [Opt-Out Blocked] Cannot send message to {recipient_phone} (User opted out).")
            return {"status": "blocked", "reason": "Customer opted out / on DND list"}

        # Guardrail 2: Hard Daily Spend Limit
        under_limit, count_today = check_daily_limit(db)
        if not under_limit:
            logger.error(f"🚨 [BUDGET GUARD] Daily send limit ({DAILY_MESSAGE_SEND_LIMIT}) reached! Current today: {count_today}. Message blocked to protect spend.")
            return {
                "status": "blocked",
                "reason": f"Daily budget ceiling reached ({count_today}/{DAILY_MESSAGE_SEND_LIMIT} messages sent today)."
            }

        # Safe local mock mode when Meta credentials are empty
        if not WHATSAPP_API_TOKEN or not WHATSAPP_PHONE_NUMBER_ID:
            mock_wamid = f"mock_wamid_{int(datetime.utcnow().timestamp())}"
            logger.info(f"📱 [SIMULATION MODE] Template '{template_name}' ({language}) to {recipient_phone} with params {parameters} (Today's count: {count_today + 1}/{DAILY_MESSAGE_SEND_LIMIT})")
            
            log_entry = models.MessageLog(
                recipient_phone=recipient_phone,
                template_name=template_name,
                language=language,
                status="SENT_SIMULATED",
                meta_message_id=mock_wamid
            )
            db.add(log_entry)
            db.commit()
            return {
                "status": "success_simulated",
                "message_id": mock_wamid,
                "info": "Meta API credentials not set. Simulated locally and logged in DB."
            }

        # Live Meta Cloud API Call
        headers = {
            "Authorization": f"Bearer {WHATSAPP_API_TOKEN}",
            "Content-Type": "application/json"
        }
        
        components = []
        if parameters:
            body_params = [{"type": "text", "text": str(v)} for v in parameters.values()]
            components.append({
                "type": "body",
                "parameters": body_params
            })

        payload = {
            "messaging_product": "whatsapp",
            "to": recipient_phone.replace("+", "").strip(),
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language},
                "components": components
            }
        }

        with httpx.Client(timeout=10.0) as client:
            resp = client.post(META_API_URL, headers=headers, json=payload)
            data = resp.json()

            if resp.status_code == 200:
                msg_id = data.get("messages", [{}])[0].get("id", "")
                log_entry = models.MessageLog(
                    recipient_phone=recipient_phone,
                    template_name=template_name,
                    language=language,
                    status="SENT",
                    meta_message_id=msg_id
                )
                db.add(log_entry)
                db.commit()
                return {"status": "success", "message_id": msg_id}
            else:
                error_info = str(data.get("error", {}))
                log_entry = models.MessageLog(
                    recipient_phone=recipient_phone,
                    template_name=template_name,
                    language=language,
                    status="FAILED",
                    error_message=error_info
                )
                db.add(log_entry)
                db.commit()

                # 🚨 Trigger Immediate Email Alert to Admins
                try:
                    from email_service import send_whatsapp_failure_alert
                    send_whatsapp_failure_alert(
                        recipient_phone=recipient_phone,
                        template_name=template_name,
                        error_reason=error_info
                    )
                except Exception as mail_err:
                    logger.warning(f"Could not send failure alert email: {mail_err}")

                return {"status": "failed", "error": error_info}

    except Exception as e:
        logger.error(f"Error in send_whatsapp_template: {e}")
        try:
            from email_service import send_whatsapp_failure_alert
            send_whatsapp_failure_alert(
                recipient_phone=recipient_phone,
                template_name=template_name,
                error_reason=str(e)
            )
        except Exception:
            pass
        return {"status": "error", "message": str(e)}
    finally:
        db.close()


def create_meta_template(
    template_name: str,
    category: str,
    language: str,
    body_text: str,
    header_text: str = None,
    footer_text: str = None
) -> dict:
    """
    Submits a new WhatsApp message template to Meta Graph API.
    If Meta API credentials are not set, records in local simulation mode.
    """
    waba_id = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
    token = os.getenv("WHATSAPP_API_TOKEN", "")

    if not waba_id or not token:
        logger.info(f"📱 [SIMULATION MODE] Template '{template_name}' simulated in Meta API.")
        return {
            "status": "APPROVED",
            "id": f"sim_tmpl_{int(datetime.utcnow().timestamp())}",
            "info": "Meta credentials empty. Created locally."
        }

    url = f"https://graph.facebook.com/v20.0/{waba_id}/message_templates"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    components = [
        {
            "type": "BODY",
            "text": body_text
        }
    ]

    if header_text:
        components.append({
            "type": "HEADER",
            "format": "TEXT",
            "text": header_text
        })

    if footer_text:
        components.append({
            "type": "FOOTER",
            "text": footer_text
        })

    payload = {
        "name": template_name.lower().replace(" ", "_"),
        "category": category.upper(),
        "language": language,
        "components": components
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            data = resp.json()
            if resp.status_code in [200, 201]:
                return {
                    "status": data.get("status", "PENDING"),
                    "id": data.get("id"),
                    "category": data.get("category")
                }
            else:
                error_msg = data.get("error", {}).get("message", "Meta template submission failed")
                return {"error": error_msg, "status": "FAILED"}
    except Exception as e:
        logger.error(f"Error submitting template to Meta: {e}")
        return {"error": str(e), "status": "FAILED"}


def send_whatsapp_free_text(recipient_phone: str, message_text: str) -> dict:
    """
    Sends a free-form customer service text message (used within Meta's 24-hour service window).
    Falls back to simulation mode if API credentials are not set.
    """
    clean_phone = recipient_phone.strip().replace(" ", "").replace("-", "")
    if not clean_phone.startswith("+"):
        clean_phone = "+" + clean_phone

    # Check if simulated or live
    if not WHATSAPP_API_TOKEN or not WHATSAPP_PHONE_NUMBER_ID:
        mock_id = f"sim_chat_{int(datetime.utcnow().timestamp())}"
        logger.info(f"💬 [SIMULATED 2-WAY CHAT] Agent sent to {clean_phone}: '{message_text}'")
        return {
            "status": "success_simulated",
            "message_id": mock_id,
            "info": "Simulated locally without live Meta credentials"
        }

    headers = {
        "Authorization": f"Bearer {WHATSAPP_API_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": clean_phone.replace("+", ""),
        "type": "text",
        "text": {
            "preview_url": False,
            "body": message_text
        }
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(META_API_URL, headers=headers, json=payload)
            data = resp.json()
            if resp.status_code == 200:
                msg_id = data.get("messages", [{}])[0].get("id", "")
                return {"status": "success", "message_id": msg_id}
            else:
                error_info = str(data.get("error", {}))
                logger.error(f"Meta chat send error: {error_info}")
                return {"status": "failed", "error": error_info}
    except Exception as e:
        logger.error(f"Error in send_whatsapp_free_text: {e}")
        return {"status": "error", "message": str(e)}


