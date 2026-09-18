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

import config

WHATSAPP_API_TOKEN = config.WHATSAPP_API_TOKEN
WHATSAPP_PHONE_NUMBER_ID = config.WHATSAPP_PHONE_NUMBER_ID
DAILY_MESSAGE_SEND_LIMIT = config.DAILY_MESSAGE_SEND_LIMIT
META_API_URL = (
    f"{config.META_GRAPH_BASE_URL}/{config.META_GRAPH_VERSION}/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    if WHATSAPP_PHONE_NUMBER_ID
    else ""
)


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
    parameters: dict = None,
    coupon_code: str = None,
    button_parameters: list = None
) -> dict:
    """
    Sends a WhatsApp message via Meta Cloud API or simulation mode.
    Guarded by:
    1. Opt-Out / DND check
    2. Hard daily spending limit check
    """
    db = SessionLocal()
    try:
        # Normalize language code for Meta API (e.g. EN_US -> en_US)
        if language:
            parts = language.split("_")
            if len(parts) == 2:
                language = f"{parts[0].lower()}_{parts[1].upper()}"
            else:
                language = language.lower()

        # Resolve exact approved template language from DB if not explicitly non-default
        if not language or language == "en":
            tmpl_record = db.query(models.Template).filter(models.Template.template_name == template_name).first()
            if tmpl_record and tmpl_record.language:
                language = tmpl_record.language

        # Guardrail 1: Check if recipient is in DND/Opt-Out list
        is_opted_out = db.query(models.OptOut).filter(models.OptOut.phone == recipient_phone).first()
        if is_opted_out:
            logger.info(f"🚫 [Opt-Out Blocked] Cannot send message to {recipient_phone} (User opted out).")
            try:
                log_entry = models.MessageLog(
                    recipient_phone=recipient_phone,
                    template_name=template_name,
                    language=language,
                    status="FAILED",
                    error_message="Customer opted out / on DND list"
                )
                db.add(log_entry)
                db.commit()
            except Exception:
                pass
            return {"status": "blocked", "reason": "Customer opted out / on DND list"}

        # Guardrail 2: Hard Daily Spend Limit
        under_limit, count_today = check_daily_limit(db)
        if not under_limit:
            logger.error(f"🚨 [BUDGET GUARD] Daily send limit ({DAILY_MESSAGE_SEND_LIMIT}) reached! Current today: {count_today}. Message blocked to protect spend.")
            try:
                log_entry = models.MessageLog(
                    recipient_phone=recipient_phone,
                    template_name=template_name,
                    language=language,
                    status="FAILED",
                    error_message=f"Daily budget limit reached ({count_today}/{DAILY_MESSAGE_SEND_LIMIT} sent today)"
                )
                db.add(log_entry)
                db.commit()
            except Exception:
                pass
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
            # Sort by key (param_1, param_2 ...) to guarantee correct positional order
            sorted_params = sorted(parameters.items(), key=lambda x: x[0])
            body_params = []
            for k, v in sorted_params:
                text_val = str(v).strip() if v is not None else ""
                if not text_val:
                    # Meta rejects empty parameters (#131008) — use a safe placeholder
                    text_val = "-"
                body_params.append({"type": "text", "text": text_val})
            logger.info(f"📤 [Meta Payload] template={template_name} to={recipient_phone} params={[p['text'] for p in body_params]}")
            components.append({
                "type": "body",
                "parameters": body_params
            })

        # Handle button parameters (e.g. COPY_CODE buttons required by Meta for templates like bazik_reengagement_v1)
        if button_parameters:
            for btn in button_parameters:
                components.append(btn)
        elif template_name in ["bazik_reengagement_v1"]:
            code_val = coupon_code
            if not code_val and parameters:
                # In bazik_reengagement_v1, param_2 is usually the coupon code
                code_val = parameters.get("param_2") or parameters.get("coupon_code")
            if not code_val:
                code_val = config.DEFAULT_COUPON_CODE
            components.append({
                "type": "button",
                "sub_type": "copy_code",
                "index": 0,
                "parameters": [
                    {
                        "type": "coupon_code",
                        "coupon_code": str(code_val).strip()
                    }
                ]
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

        with httpx.Client(timeout=config.HTTP_TIMEOUT_SECONDS) as client:
            resp = client.post(META_API_URL, headers=headers, json=payload)
            data = resp.json()

            if resp.status_code == 200:
                msg_id = data.get("messages", [{}])[0].get("id", "")
                try:
                    log_entry = models.MessageLog(
                        recipient_phone=recipient_phone,
                        template_name=template_name,
                        language=language,
                        status="SENT",
                        meta_message_id=msg_id
                    )
                    db.add(log_entry)
                    db.commit()
                except Exception as log_err:
                    db.rollback()
                    logger.warning(f"Could not save MessageLog: {log_err}")

                # Also insert into ChatMessage for real-time 2-way live chat visibility
                try:
                    tmpl = db.query(models.Template).filter(models.Template.template_name == template_name).first()
                    body_content = tmpl.body_text if tmpl and tmpl.body_text else f"📢 Template: {template_name}"
                    if parameters:
                        for i, (k, val) in enumerate(parameters.items(), 1):
                            body_content = body_content.replace(f"{{{{{i}}}}}", str(val))
                    chat_entry = models.ChatMessage(
                        customer_phone=recipient_phone,
                        sender_type="AGENT",
                        message_type="template",
                        text=body_content,
                        meta_message_id=msg_id,
                        status="SENT",
                        is_read=True
                    )
                    db.add(chat_entry)
                    db.commit()
                except Exception as c_err:
                    db.rollback()
                    logger.warning(f"Could not mirror template send to ChatMessage: {c_err}")

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

                return {"status": "failed", "error": error_info}

    except Exception as e:
        logger.error(f"Error in send_whatsapp_template: {e}", exc_info=True)
        try:
            log_entry = models.MessageLog(
                recipient_phone=recipient_phone,
                template_name=template_name,
                language=language,
                status="FAILED",
                error_message=str(e)
            )
            db.add(log_entry)
            db.commit()
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
    waba_id = config.WHATSAPP_BUSINESS_ACCOUNT_ID
    token = config.WHATSAPP_API_TOKEN

    if not waba_id or not token:
        logger.info(f"📱 [SIMULATION MODE] Template '{template_name}' simulated in Meta API.")
        return {
            "status": "APPROVED",
            "id": f"sim_tmpl_{int(datetime.utcnow().timestamp())}",
            "info": "Meta credentials empty. Created locally."
        }

    url = f"{config.META_GRAPH_BASE_URL}/{config.META_GRAPH_VERSION}/{waba_id}/message_templates"
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
        with httpx.Client(timeout=config.HTTP_TIMEOUT_SECONDS) as client:
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
        with httpx.Client(timeout=config.HTTP_TIMEOUT_SECONDS) as client:
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


