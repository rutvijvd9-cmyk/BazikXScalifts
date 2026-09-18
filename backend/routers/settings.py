import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
import auth
import config
from whatsapp_service import OPT_OUT_KEYWORDS

logger = logging.getLogger("settings_router")

router = APIRouter(tags=["Platform & Integration Settings"])


@router.get("/api/settings")
def get_system_settings(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "daily_limit").first()
    effective_limit = int(setting.value) if setting and setting.value else config.DAILY_MESSAGE_SEND_LIMIT
    return {
        "daily_limit": effective_limit,
        "cart_delay_minutes": 30,
        "active_phone_id": config.WHATSAPP_PHONE_NUMBER_ID or "Not Configured (Simulation Mode)",
        "webhook_endpoint": config.WHATSAPP_WEBHOOK_URL or "/api/webhooks/whatsapp",
        "dnd_keywords": list(OPT_OUT_KEYWORDS)
    }


@router.put("/api/settings/daily-limit")
def update_daily_limit_setting(
    payload: schemas.DailyLimitUpdateRequest,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "daily_limit").first()
    if setting:
        setting.value = str(payload.daily_limit)
        setting.updated_at = datetime.utcnow()
    else:
        setting = models.SystemSetting(key="daily_limit", value=str(payload.daily_limit))
        db.add(setting)
    db.commit()
    logger.info(f"⚙️ Daily outbound message limit updated to {payload.daily_limit} by user '{current_user.username}'.")
    return {
        "status": "success",
        "message": f"Daily outbound message limit updated to {payload.daily_limit} messages per day.",
        "daily_limit": payload.daily_limit
    }
