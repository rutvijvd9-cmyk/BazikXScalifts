"""
Marketing & Promotions Router
Handles discount codes, external e-commerce data sources, opt-out management,
direct test WhatsApp messages, and 30-day customer re-engagement sweep trigger.
"""

import ipaddress
import logging
import re
import socket
import time
from datetime import datetime, timedelta
from typing import List, Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

import auth
import config
import models
import schemas
from database import get_db
from rate_limiter import limiter
from scheduler import run_thirty_day_reengagement_sweep
from whatsapp_service import send_whatsapp_template

logger = logging.getLogger("marketing_router")

router = APIRouter(tags=["marketing"])


# ==========================================
# 🏷️ DISCOUNT CODES
# ==========================================

@router.get("/api/discount-codes", response_model=List[schemas.DiscountCodeResponse])
def list_discount_codes(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(models.DiscountCode).order_by(models.DiscountCode.id.desc()).all()


@router.post("/api/discount-codes", response_model=schemas.DiscountCodeResponse, status_code=status.HTTP_201_CREATED)
def create_discount_code(
    payload: schemas.DiscountCodeCreate,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    clean_code = payload.code.strip().upper()
    existing = db.query(models.DiscountCode).filter(models.DiscountCode.code == clean_code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Discount code '{clean_code}' already exists.")

    disc = models.DiscountCode(
        code=clean_code,
        discount_type=payload.discount_type,
        discount_value=payload.discount_value,
        min_order_value=payload.min_order_value or 0.0,
        max_uses=payload.max_uses or 1000,
        expires_at=payload.expires_at,
        is_active=payload.is_active if payload.is_active is not None else True
    )
    db.add(disc)
    db.commit()
    db.refresh(disc)
    return disc


@router.delete("/api/discount-codes/{code_id}")
def delete_discount_code(
    code_id: int,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    disc = db.query(models.DiscountCode).filter(models.DiscountCode.id == code_id).first()
    if not disc:
        raise HTTPException(status_code=404, detail="Discount code not found")
    db.delete(disc)
    db.commit()
    return {"status": "success", "message": f"Discount code {disc.code} deleted."}


# ==========================================
# 🌐 EXTERNAL DATA SOURCES
# ==========================================

# ==========================================
# 🌐 EXTERNAL DATA SOURCES & SSRF GUARD
# ==========================================

def validate_ssrf_safe_url(url: str) -> None:
    """
    Validates that a URL uses HTTPS and does not resolve to private,
    loopback, link-local, multicast, or cloud-metadata IP addresses (SSRF mitigation).
    """
    parsed = urlparse(url)
    if parsed.scheme.lower() != "https":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid endpoint URL: Only secure HTTPS endpoints are permitted."
        )

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid endpoint URL: Hostname is required."
        )

    # Check for direct IP literal strings attempting loopback/private/metadata bypass
    try:
        direct_ip = ipaddress.ip_address(hostname)
        if (
            direct_ip.is_loopback
            or direct_ip.is_private
            or direct_ip.is_link_local
            or direct_ip.is_multicast
            or direct_ip.is_reserved
            or direct_ip.is_unspecified
            or str(direct_ip) == "169.254.169.254"
        ):
            logger.warning(f"🚨 [SSRF Blocked] Direct IP literal forbidden: {direct_ip}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Access denied: Requests to internal, loopback, private, or metadata addresses are prohibited."
            )
    except ValueError:
        pass  # Hostname is a domain name, proceed to DNS resolution

    port = parsed.port or 443
    try:
        addr_info = socket.getaddrinfo(hostname, port, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid endpoint URL: Unable to resolve hostname '{hostname}'."
        )

    for item in addr_info:
        sockaddr = item[4]
        ip_str = sockaddr[0]
        try:
            ip_obj = ipaddress.ip_address(ip_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid endpoint URL: Unrecognized IP address format for '{hostname}'."
            )

        if (
            ip_obj.is_loopback
            or ip_obj.is_private
            or ip_obj.is_link_local
            or ip_obj.is_multicast
            or ip_obj.is_reserved
            or ip_obj.is_unspecified
            or str(ip_obj) == "169.254.169.254"
        ):
            logger.warning(f"🚨 [SSRF Blocked] Host '{hostname}' resolved to forbidden IP {ip_str}.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Access denied: Requests to internal, loopback, private, or metadata network addresses are prohibited."
            )


@router.get("/api/external-data-sources", response_model=List[schemas.ExternalDataSourceResponse])
def list_external_data_sources(
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """Lists all configured external e-commerce REST API data sources (api_key redacted)."""
    return db.query(models.ExternalDataSource).order_by(models.ExternalDataSource.id.asc()).all()


@router.post("/api/external-data-sources", response_model=schemas.ExternalDataSourceResponse, status_code=status.HTTP_201_CREATED)
def create_external_data_source(
    payload: schemas.ExternalDataSourceCreate,
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    """Registers a new external API endpoint with mandatory HTTPS and SSRF verification."""
    clean_url = payload.endpoint_url.strip()
    validate_ssrf_safe_url(clean_url)

    src = models.ExternalDataSource(
        name=payload.name.strip(),
        endpoint_url=clean_url,
        auth_method=payload.auth_method or "api_key",
        api_key=payload.api_key.strip() if payload.api_key else None,
        header_name=payload.header_name.strip() if payload.header_name else "X-CRM-Token",
        lookup_param=payload.lookup_param.strip() if payload.lookup_param else "phone",
        is_active=payload.is_active if payload.is_active is not None else True
    )
    db.add(src)
    db.commit()
    db.refresh(src)
    return src


@router.patch("/api/external-data-sources/{source_id}", response_model=schemas.ExternalDataSourceResponse)
def update_external_data_source(
    source_id: int,
    payload: schemas.ExternalDataSourceUpdate,
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    src = db.query(models.ExternalDataSource).filter(models.ExternalDataSource.id == source_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Data source not found")

    if payload.endpoint_url is not None:
        clean_url = payload.endpoint_url.strip()
        validate_ssrf_safe_url(clean_url)
        src.endpoint_url = clean_url

    if payload.name is not None:
        src.name = payload.name.strip()
    if payload.auth_method is not None:
        src.auth_method = payload.auth_method
    if payload.api_key is not None:
        src.api_key = payload.api_key.strip()
    if payload.header_name is not None:
        src.header_name = payload.header_name.strip()
    if payload.lookup_param is not None:
        src.lookup_param = payload.lookup_param.strip()
    if payload.is_active is not None:
        src.is_active = payload.is_active

    db.commit()
    db.refresh(src)
    return src


@router.delete("/api/external-data-sources/{source_id}")
def delete_external_data_source(
    source_id: int,
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    src = db.query(models.ExternalDataSource).filter(models.ExternalDataSource.id == source_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Data source not found")
    db.delete(src)
    db.commit()
    return {"status": "success", "message": f"External data source '{src.name}' removed."}


@router.post("/api/external-data-sources/{source_id}/test")
def test_external_data_source(
    source_id: int,
    test_phone: Optional[str] = "+919876543210",
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    src = db.query(models.ExternalDataSource).filter(models.ExternalDataSource.id == source_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Data source not found")

    validate_ssrf_safe_url(src.endpoint_url)

    headers = {}
    if src.auth_method == "bearer" and src.api_key:
        headers["Authorization"] = f"Bearer {src.api_key}"
    elif src.api_key:
        headers[src.header_name or "X-CRM-Token"] = src.api_key

    params = {src.lookup_param or "phone": test_phone}
    start_time = time.time()
    try:
        # Strict security: follow_redirects=False prevents open redirect SSRF bypass,
        # and upstream response content is never returned to the client to prevent exfiltration.
        with httpx.Client(timeout=8.0, follow_redirects=False) as client:
            resp = client.get(src.endpoint_url, params=params, headers=headers)
            elapsed_ms = (time.time() - start_time) * 1000.0
            return {
                "status_code": resp.status_code,
                "is_success": resp.status_code == 200,
                "latency_ms": round(elapsed_ms, 2),
                "message": "Connection verified successfully." if resp.status_code == 200 else f"Upstream endpoint responded with status {resp.status_code}."
            }
    except Exception as err:
        elapsed_ms = (time.time() - start_time) * 1000.0
        logger.warning(f"⚠️ [Integration Test] Connectivity test error for source #{source_id}: {err}")
        return {
            "status_code": 0,
            "is_success": False,
            "latency_ms": round(elapsed_ms, 2),
            "message": "Connection attempt failed or timed out."
        }



# ==========================================
# 🛑 OPT-OUT / DND MANAGEMENT
# ==========================================

@router.post("/api/opt-out")
@limiter.limit("30/minute")
def register_opt_out(
    request: Request,
    payload: schemas.OptOutRequest,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db),
):
    existing = db.query(models.OptOut).filter(models.OptOut.phone == payload.phone).first()
    if not existing:
        opt_out = models.OptOut(phone=payload.phone, reason=payload.reason)
        db.add(opt_out)
        db.commit()
    return {"status": "success", "message": f"{payload.phone} added to DND list."}


@router.get("/api/opt-outs")
def list_opt_outs(
    limit: int = 100,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(models.OptOut).order_by(models.OptOut.created_at.desc()).limit(limit).all()


@router.delete("/api/opt-outs/{phone}")
def remove_opt_out(
    phone: str,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    record = db.query(models.OptOut).filter(models.OptOut.phone == phone).first()
    if not record:
        raise HTTPException(status_code=404, detail="Opt-out record not found")
    db.delete(record)
    db.commit()
    return {"status": "success", "message": f"{phone} removed from DND list."}


# ==========================================
# 🛒 CART EVENTS & MESSAGE LOGS
# ==========================================

@router.get("/api/cart-events")
def list_cart_events(
    limit: int = 50,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(models.CartEvent).order_by(models.CartEvent.created_at.desc()).limit(limit).all()


@router.get("/api/message-logs")
def get_message_logs(
    limit: int = 200,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the WhatsApp message audit trail ordered by most recent."""
    logs = db.query(models.MessageLog).order_by(models.MessageLog.created_at.desc()).limit(limit).all()
    return logs


@router.delete("/api/message-logs")
def delete_message_logs(
    older_than_days: Optional[int] = None,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """
    Deletes WhatsApp audit logs:
    - If older_than_days is provided (e.g. 90, 120, 175): deletes logs older than that threshold.
    - If older_than_days is None: deletes all message logs.
    """
    from datetime import datetime, timedelta
    query = db.query(models.MessageLog)
    if older_than_days is not None and older_than_days > 0:
        cutoff_date = datetime.utcnow() - timedelta(days=older_than_days)
        deleted_count = query.filter(models.MessageLog.created_at < cutoff_date).delete(synchronize_session=False)
        message = f"Successfully purged {deleted_count} logs older than {older_than_days} days."
    else:
        deleted_count = query.delete(synchronize_session=False)
        message = f"Successfully cleared all {deleted_count} message logs."

    db.commit()
    remaining_count = db.query(models.MessageLog).count()
    return {
        "status": "success",
        "deleted_count": deleted_count,
        "remaining_count": remaining_count,
        "message": message
    }


@router.get("/api/message-logs/download")
def download_message_logs(
    format: str = "csv",
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Exports and downloads message audit trail logs as CSV or JSON.
    """
    import csv
    import io
    from fastapi.responses import Response, JSONResponse

    logs = db.query(models.MessageLog).order_by(models.MessageLog.created_at.desc()).all()

    if format.lower() == "json":
        data = [
            {
                "id": l.id,
                "sender_user": l.sender_user or "System",
                "recipient_phone": l.recipient_phone,
                "template_name": l.template_name,
                "campaign_id": l.campaign_id,
                "status": l.status,
                "meta_message_id": l.meta_message_id,
                "error_message": l.error_message,
                "created_at": l.created_at.isoformat() if l.created_at else None
            }
            for l in logs
        ]
        return JSONResponse(
            content=data,
            headers={
                "Content-Disposition": f"attachment; filename=whatsapp_logs_{datetime.utcnow().strftime('%Y%m%d')}.json"
            }
        )

    # CSV format
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Log ID", "Initiated By / User", "Recipient Phone",
        "Template", "Status", "Meta Message ID", "Error Details", "Timestamp (UTC)"
    ])
    for l in logs:
        writer.writerow([
            l.id,
            l.sender_user or "System",
            l.recipient_phone,
            l.template_name,
            l.status,
            l.meta_message_id or "-",
            l.error_message or "",
            l.created_at.strftime("%Y-%m-%d %H:%M:%S") if l.created_at else ""
        ])

    csv_content = output.getvalue()
    filename = f"whatsapp_logs_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==========================================
# 🎯 RE-ENGAGEMENT SWEEPS & TEST MESSAGES
# ==========================================

@router.get("/api/mock-store-feed/inactive-customers")
def mock_store_inactive_feed(
    days: int = 30,
    current_user: models.User = Depends(auth.require_roles("admin"))
):
    if config.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mock endpoints are disabled in production environments."
        )
    return {
        "status": "success",
        "days_threshold": days,
        "customers": [
            {
                "phone": "+919000000001",
                "name": "Dev Test Patron 1",
                "email": "test1@example.invalid",
                "total_orders": 4
            },
            {
                "phone": "+919000000002",
                "name": "Dev Test Patron 2",
                "email": "test2@example.invalid",
                "total_orders": 2
            }
        ]
    }



@router.post("/api/triggers/reengagement-sweep")
def trigger_manual_reengagement_sweep(
    current_user: models.User = Depends(auth.get_current_user)
):
    run_thirty_day_reengagement_sweep()
    return {
        "status": "completed",
        "message": "30-day inactive customer sweep executed successfully"
    }


class DirectTestMessageRequest(BaseModel):
    phone: str
    template_name: str = "abandoned_cart_recovery"
    language: str = "en"
    parameters: Optional[dict] = None


@router.post("/api/messages/send-test")
def send_direct_test_message(
    payload: DirectTestMessageRequest,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    clean_phone = payload.phone.strip()
    if not clean_phone.startswith("+"):
        clean_phone = "+" + clean_phone

    tmpl = db.query(models.Template).filter(models.Template.template_name == payload.template_name).first()
    lang = payload.language
    if tmpl and tmpl.language:
        lang = tmpl.language

    params = payload.parameters
    if not params:
        if tmpl and tmpl.body_text:
            matches = re.findall(r"\{\{(\d+)\}\}", tmpl.body_text)
            if matches:
                sample_vals = [
                    current_user.username or "Customer",
                    config.BRAND_NAME,
                    "100",
                    config.DEFAULT_COUPON_CODE,
                    config.STORE_LOCATION or config.BRAND_NAME
                ]
                params = {f"param_{m}": sample_vals[int(m)-1] if int(m)-1 < len(sample_vals) else f"Val{m}" for m in matches}
        if not params:
            params = {}

    res = send_whatsapp_template(
        recipient_phone=clean_phone,
        template_name=payload.template_name,
        language=lang,
        parameters=params,
        sender_user=current_user.username
    )
    return res
