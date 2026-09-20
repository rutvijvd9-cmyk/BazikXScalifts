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
    return {
        "daily_limit": 200,
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
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Daily outbound message limit is fixed to 200 messages per day and cannot be edited."
    )

