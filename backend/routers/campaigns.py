"""
Campaigns Router
Handles campaign listing, detail retrieval, creation/scheduling, and cancellation.
"""

from datetime import datetime
import logging
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, status
from apscheduler.triggers.date import DateTrigger
from sqlalchemy.orm import Session

import auth
import config
import models
import schemas
from database import get_db
from rate_limiter import limiter
from scheduler import scheduler, execute_campaign_broadcast

logger = logging.getLogger("campaigns_router")

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


@router.post("", response_model=schemas.CampaignResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def create_and_trigger_campaign(
    request: Request,
    payload: schemas.CampaignCreate,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    # 🔐 CRITICAL SECURITY GUARD: Verify Password + 2FA before mass broadcasting
    try:
        auth.verify_user_stepup_auth(
            user=current_user,
            password=payload.password,
            two_factor_code=payload.two_factor_code,
            db=db
        )
    except HTTPException:
        raise
    except Exception as auth_err:
        logger.error(f"Step-up authentication failed: {auth_err}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Security verification failed: {str(auth_err)}"
        )

    scheduled_dt = None
    scheduled_dt_tz = None
    if payload.scheduled_for:
        try:
            tz_kolkata = ZoneInfo(config.TIMEZONE)
            raw = str(payload.scheduled_for).strip()
            if raw.endswith("Z"):
                dt_obj = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            elif "+" in raw or "-" in raw[10:]:
                dt_obj = datetime.fromisoformat(raw)
            else:
                clean_str = raw.replace("T", " ")
                naive_dt = datetime.fromisoformat(clean_str)
                dt_obj = naive_dt.replace(tzinfo=tz_kolkata)
            
            scheduled_dt_tz = dt_obj.astimezone(tz_kolkata)
            # Store local Indian Standard Time in database
            scheduled_dt = scheduled_dt_tz.replace(tzinfo=None)
        except Exception as parse_err:
            logger.warning(f"Failed to parse scheduled_for '{payload.scheduled_for}': {parse_err}")
            scheduled_dt = None
            scheduled_dt_tz = None

    try:
        now_ist = datetime.now(ZoneInfo(config.TIMEZONE))
        is_future = scheduled_dt_tz and scheduled_dt_tz > now_ist
        campaign = models.Campaign(
            title=payload.title,
            template_name=payload.template_name,
            language=payload.language or "en",
            target_filter=payload.target_filter or "ALL",
            per_day_limit=payload.per_day_limit,
            status="SCHEDULED" if is_future else "IN_PROGRESS",
            scheduled_for=scheduled_dt
        )
        db.add(campaign)
        db.commit()
        db.refresh(campaign)

        if is_future:
            # Schedule future execution with exact Indian Standard Time (IST)
            job_id = f"campaign_{campaign.id}"
            scheduler.add_job(
                func=execute_campaign_broadcast,
                trigger=DateTrigger(run_date=scheduled_dt_tz, timezone=ZoneInfo(config.TIMEZONE)),
                args=[campaign.id, payload.custom_phones],
                id=job_id,
                replace_existing=True
            )
            logger.info(f"📅 Campaign {campaign.id} scheduled to execute at {scheduled_dt_tz} (IST)")
        else:
            # Trigger campaign broadcast asynchronously in background to prevent HTTP 500 / timeout
            logger.info(f"🚀 Queueing immediate broadcast for Campaign #{campaign.id} via BackgroundTasks")
            background_tasks.add_task(execute_campaign_broadcast, campaign.id, payload.custom_phones)

        return campaign
    except Exception as e:
        logger.error(f"Failed to create and launch campaign: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Campaign creation failed: {str(e)}"
        )


@router.get("", response_model=List[schemas.CampaignResponse])
def list_campaigns(
    skip: int = 0,
    limit: int = 50,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    try:
        return db.query(models.Campaign).order_by(models.Campaign.created_at.desc()).offset(skip).limit(limit).all()
    except Exception as e:
        logger.error(f"Error fetching campaigns: {e}", exc_info=True)
        return []


@router.get("/{campaign_id}", response_model=schemas.CampaignResponse)
def get_campaign(
    campaign_id: int,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    try:
        campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        return campaign
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching campaign {campaign_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error fetching campaign")


@router.delete("/{campaign_id}")
def cancel_campaign(
    campaign_id: int,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    try:
        campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        job_id = f"campaign_{campaign.id}"
        try:
            if scheduler.get_job(job_id):
                scheduler.remove_job(job_id)
                logger.info(f"Removed scheduled job {job_id}")
        except Exception as sj_err:
            logger.warning(f"Note on removing scheduler job {job_id}: {sj_err}")

        campaign.status = "CANCELLED"
        db.commit()
        return {"message": f"Campaign #{campaign_id} cancelled", "id": campaign_id, "status": "CANCELLED"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling campaign {campaign_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to cancel campaign")
