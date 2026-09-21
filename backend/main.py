import os
import io
import csv
import logging
import hmac
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import List, Optional
from dotenv import load_dotenv
import httpx
from pydantic import BaseModel

from services.logging_config import configure_secure_logging
configure_secure_logging()
logger = logging.getLogger("main")
from fastapi import FastAPI, Depends, HTTPException, Header, Request, status, UploadFile, File, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from sqlalchemy.exc import IntegrityError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from database import engine, get_db, Base
import models
import schemas
import auth
from scheduler import schedule_cart_recovery, execute_campaign_broadcast, scheduler
import whatsapp_service
from whatsapp_service import send_whatsapp_template, create_meta_template
from apscheduler.triggers.date import DateTrigger

import config

# Ensure tables exist
Base.metadata.create_all(bind=engine)

from fastapi.exceptions import ResponseValidationError
from fastapi.responses import JSONResponse

# Auto-apply Alembic migrations on startup if configured
try:
    import alembic.config
    import alembic.command
    ini_path = "alembic.ini"
    if not os.path.exists(ini_path):
        ini_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alembic.ini")
    alembic_cfg = alembic.config.Config(ini_path)
    alembic.command.upgrade(alembic_cfg, "head")
    logger.info("Alembic migrations verified up-to-date at head.")
except Exception as m_err:
    logger.error(f"Alembic auto-upgrade failed: {m_err}", exc_info=True)

# Non-destructive column sync for existing tables
migration_statements = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_2fa_enabled BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64);",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_recovery_code VARCHAR(10);",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_recovery_code_expires TIMESTAMP;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'agent';",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS per_day_limit INTEGER;",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP;",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS error_message TEXT;",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
    "ALTER TABLE cart_events ADD COLUMN IF NOT EXISTS extra_data JSON;",
    "ALTER TABLE templates ADD COLUMN IF NOT EXISTS variable_mappings JSON;",
    "ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id);",
    "ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS sender_user VARCHAR(50) DEFAULT 'System';",
    "ALTER TABLE cart_events ADD COLUMN IF NOT EXISTS authenticated_user VARCHAR(50);",
    "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'store';",
    "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS external_event_id VARCHAR(150);",
    "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(150);",
    "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS hmac_validated BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(64);",
    "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS received_at TIMESTAMP DEFAULT NOW();",
    "CREATE TABLE IF NOT EXISTS system_settings (key VARCHAR(50) PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMP DEFAULT NOW());"
]
for stmt in migration_statements:
    try:
        with engine.begin() as conn:
            from sqlalchemy import text
            conn.execute(text(stmt))
    except Exception as col_err:
        logger.warning(f"Note on DB migration ({stmt}): {col_err}")

# Rate Limiter setup
from rate_limiter import limiter
app = FastAPI(
    title=config.APP_NAME,
    version="1.0.0"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    corr_id = request.headers.get("X-Correlation-ID") or request.headers.get("x-correlation-id") or str(uuid.uuid4())
    request.state.correlation_id = corr_id
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = corr_id
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    corr_id = getattr(request.state, "correlation_id", None) or str(uuid.uuid4())
    headers = dict(exc.headers or {})
    headers["X-Correlation-ID"] = corr_id
    content = {
        "detail": exc.detail,
        "correlation_id": corr_id
    }
    return JSONResponse(status_code=exc.status_code, content=content, headers=headers)


@app.exception_handler(ResponseValidationError)
async def response_validation_error_handler(request: Request, exc: ResponseValidationError):
    corr_id = getattr(request.state, "correlation_id", None) or str(uuid.uuid4())
    logger.error(f"[{corr_id}] ResponseValidationError on {request.method} {request.url.path}: {exc.errors()}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal response formatting error occurred.",
            "correlation_id": corr_id
        },
        headers={"X-Correlation-ID": corr_id}
    )


@app.exception_handler(Exception)
async def global_unhandled_exception_handler(request: Request, exc: Exception):
    corr_id = getattr(request.state, "correlation_id", None) or str(uuid.uuid4())
    logger.error(f"[{corr_id}] Unhandled Exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"An internal server error occurred: {str(exc)}",
            "correlation_id": corr_id,
            "error_type": type(exc).__name__
        },
        headers={"X-Correlation-ID": corr_id}
    )



# ── WP7: Environment-aware CORS — no wildcard origins/methods/headers in production ──
_SAFE_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
_SAFE_HEADERS = [
    "Authorization", "Content-Type", "X-Correlation-ID",
    "X-Hub-Signature-256", "X-Idempotency-Key", "X-Request-ID",
]

if config.ENVIRONMENT == "production":
    # Production: exact origins only from ALLOWED_ORIGINS env var; no regex
    _prod_origins = config.ALLOWED_ORIGINS  # validated non-wildcard by validate_production_config()
    if not _prod_origins:
        raise RuntimeError("FATAL: ALLOWED_ORIGINS must be set in production.")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_prod_origins,
        allow_credentials=True,
        allow_methods=_SAFE_METHODS,
        allow_headers=_SAFE_HEADERS,
    )
else:
    # Development / staging: permissive, includes Vite, Capacitor, Vercel preview, local IP
    _dev_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost",
        "https://localhost",
        "capacitor://localhost",
    ]
    if config.ALLOWED_ORIGINS_RAW:
        _dev_origins.extend(
            [o.strip() for o in config.ALLOWED_ORIGINS_RAW.split(",") if o.strip()]
        )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_dev_origins,
        allow_origin_regex=r"(https://.*\.vercel\.app|http://192\.168\..*|http://10\..*|capacitor://.*|https?://localhost.*)",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )



@app.on_event("startup")
def on_startup():
    # ── WP8: Scheduler runs in a SEPARATE worker process only (backend/worker.py).
    # The API process never starts the scheduler. Set SCHEDULER_ENABLED=true only
    # in the worker process environment.
    logger.info("API process started. Scheduler is NOT started here — use worker.py.")

    # Diagnostic: confirm WEBHOOK_SECRET is loaded
    _ws = config.WEBHOOK_SECRET or ""
    logger.info(f"[Startup] WEBHOOK_SECRET loaded: length={len(_ws)}, prefix={repr(_ws[:8])}")

    # ── Safe column migrations ────────────────────────────────────────────────
    # ADD COLUMN IF NOT EXISTS is idempotent – safe to run on every deploy.
    # Uses the already-imported `engine` and `text` from sqlalchemy.
    _migrations = [
        # automation_rules: columns added for high-volume safeguard + 2FA approval gate
        "ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'IDLE'",
        "ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS pending_recipients_count INTEGER DEFAULT 0",
        "ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS total_triggered INTEGER DEFAULT 0",
        "ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
        "ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS variable_mappings JSON",
        "ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP",
        # users: 2FA / TOTP columns
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_email VARCHAR(200)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'agent'",
        # contacts: extended profile columns
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS city VARCHAR(100)",
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags VARCHAR(500)",
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE",
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS order_count INTEGER DEFAULT 0",
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_order_date TIMESTAMP",
        # templates: configure-once variable mappings
        "ALTER TABLE templates ADD COLUMN IF NOT EXISTS variable_mappings JSON",
        # cart_events: open extra_data payload for dynamic ecom variables
        "ALTER TABLE cart_events ADD COLUMN IF NOT EXISTS extra_data JSON",
        # message_logs: link to campaigns
        "ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id)",
        # webhook_events: canonical audit columns
        "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'store'",
        "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS external_event_id VARCHAR(150)",
        "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(150)",
        "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS hmac_validated BOOLEAN DEFAULT FALSE",
        "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(64)",
        "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS received_at TIMESTAMP DEFAULT NOW()",
        # system_settings: key-value system configuration
        "CREATE TABLE IF NOT EXISTS system_settings (key VARCHAR(50) PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMP DEFAULT NOW())",
    ]
    _ok, _fail = 0, 0
    for _sql in _migrations:
        try:
            with engine.begin() as _conn:  # each statement in its OWN transaction
                _conn.execute(text(_sql))
            _ok += 1
        except Exception as _col_err:
            _fail += 1
            logger.warning(f"⚠️  Migration note ({_sql[:60]}): {_col_err}")
    logger.info(f"✅ [DB] Safe column migrations done: {_ok} applied, {_fail} skipped.")

    # Verify webhook_events columns after migrations
    try:
        from sqlalchemy import inspect as sa_inspect
        _insp = sa_inspect(engine)
        _we_cols = [c['name'] for c in _insp.get_columns('webhook_events')]
        logger.info(f"[DB] webhook_events columns: {_we_cols}")
    except Exception as _ve:
        logger.warning(f"[DB] Could not inspect webhook_events: {_ve}")

    # ── Database Initialization & Sync ──────────────────────────────────────
    db = next(get_db())
    try:
        # Fixed Daily Limit Sync (200 messages / day)
        try:
            limit_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "daily_limit").first()
            if limit_setting:
                limit_setting.value = "200"
            else:
                db.add(models.SystemSetting(key="daily_limit", value="200"))
            db.commit()
        except Exception as _set_err:
            db.rollback()
            logger.warning(f"⚠️  [Settings] Daily limit sync note: {_set_err}")

        # ── Admin user sync ───────────────────────────────────────────────────────
        initial_user = config.INITIAL_ADMIN_USERNAME
        initial_pass = config.INITIAL_ADMIN_PASSWORD
        initial_email = config.INITIAL_ADMIN_EMAIL

        if initial_pass:
            try:
                admin = db.query(models.User).filter(models.User.username == initial_user).first()
                if not admin:
                    admin = db.query(models.User).filter(models.User.email == initial_email).first()

                if admin:
                    admin.username = initial_user
                    admin.email = initial_email
                    admin.hashed_password = auth.get_password_hash(initial_pass)
                    admin.is_active = True
                    admin.role = "admin"
                    db.commit()
                    logger.info(f"🔒 [Security] Initial admin '{initial_user}' credentials synchronized.")
                else:
                    default_admin = models.User(
                        username=initial_user,
                        email=initial_email,
                        hashed_password=auth.get_password_hash(initial_pass),
                        is_active=True,
                        role="admin"
                    )
                    db.add(default_admin)
                    db.commit()
                    logger.info(f"🔒 [Security] Initial admin '{initial_user}' created successfully.")
            except Exception as _admin_err:
                db.rollback()
                logger.error(f"⚠️  [Security] Admin user sync failed (non-fatal): {_admin_err}")

        # ── Service Account user sync (For external PHP store integration) ────────
        svc_username = config.ECOM_SERVICE_USERNAME
        svc_password = config.ECOM_SERVICE_PASSWORD
        svc_email = config.ECOM_SERVICE_EMAIL

        if svc_password:
            try:
                svc_user = db.query(models.User).filter(models.User.username == svc_username).first()
                if not svc_user:
                    svc_user = models.User(
                        username=svc_username,
                        email=svc_email,
                        hashed_password=auth.get_password_hash(svc_password),
                        is_active=True,
                        is_2fa_enabled=False,
                        role="service"
                    )
                    db.add(svc_user)
                    db.commit()
                    logger.info(f"🔒 [Security] Service account '{svc_username}' created successfully.")
                else:
                    svc_user.hashed_password = auth.get_password_hash(svc_password)
                    svc_user.is_active = True
                    svc_user.is_2fa_enabled = False
                    svc_user.role = "service"
                    db.commit()
            except Exception as _svc_err:
                db.rollback()
                logger.error(f"⚠️  [Security] Service account sync failed (non-fatal): {_svc_err}")

    except Exception as _db_init_err:
        logger.error(f"⚠️  [Startup] DB initialisation error (non-fatal): {_db_init_err}", exc_info=True)
    finally:
        db.close()

    # ── Clean Slate Migration: Purge all legacy sample workflows and dummy rules ────
    try:
        with engine.connect() as _conn:
            _conn.execute(text("""
                CREATE TABLE IF NOT EXISTS system_migrations (
                    migration_name VARCHAR(120) PRIMARY KEY,
                    applied_at TIMESTAMP DEFAULT NOW()
                )
            """))
            _mig_check = _conn.execute(
                text("SELECT 1 FROM system_migrations WHERE migration_name = 'purge_sample_automations_2026_09_16'")
            ).scalar()
            if not _mig_check:
                # One-time clean slate wipe of dummy/sample automations with FK safety
                try:
                    _conn.execute(text("UPDATE outbound_messages SET workflow_session_id = NULL WHERE workflow_session_id IS NOT NULL"))
                    _conn.execute(text("DELETE FROM workflow_sessions"))
                    _conn.execute(text("DELETE FROM workflow_flows"))
                    _conn.execute(text("DELETE FROM automation_rules"))
                    _conn.execute(
                        text("INSERT INTO system_migrations (migration_name) VALUES ('purge_sample_automations_2026_09_16')")
                    )
                    _conn.commit()
                    logger.info("🧹 [Clean Slate] Successfully purged all sample workflows, sessions, and automation rules from database.")
                except Exception as _purge_sub_err:
                    _conn.rollback()
                    logger.warning(f"⚠️  [Clean Slate] Purge step bypassed: {_purge_sub_err}")
    except Exception as _clean_err:
        logger.warning(f"⚠️  [Clean Slate] Note: {_clean_err}")

    # ── One-time Backfill: Customer Replies to READ status ───────────────────
    try:
        with engine.connect() as _conn:
            _conn.execute(text("""
                CREATE TABLE IF NOT EXISTS system_migrations (
                    migration_name VARCHAR(120) PRIMARY KEY,
                    applied_at TIMESTAMP DEFAULT NOW()
                )
            """))
            _backfill_check = _conn.execute(
                text("SELECT 1 FROM system_migrations WHERE migration_name = 'backfill_replies_to_read_v1'")
            ).scalar()
            if not _backfill_check:
                _conn.execute(text("""
                    UPDATE message_logs
                    SET status = 'READ'
                    WHERE recipient_phone IN (
                        SELECT DISTINCT customer_phone
                        FROM chat_messages
                        WHERE sender_type = 'CUSTOMER'
                    )
                    AND status IN ('SENT', 'SENT_SIMULATED', 'DELIVERED')
                """))
                _conn.execute(
                    text("INSERT INTO system_migrations (migration_name) VALUES ('backfill_replies_to_read_v1')")
                )
                _conn.commit()
                logger.info("🚀 [Read Sync] Successfully backfilled past customer replies to READ status.")
    except Exception as _bf_err:
        logger.warning(f"⚠️  [Read Sync] Backfill note: {_bf_err}")





@app.get("/")
def root():
    return {"message": "WhatsApp CRM is running ✅", "client": config.BRAND_NAME}


@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"status": "ok", "database": "connected", "scheduler": "running"}


# ==========================================
# 🧩 MODULAR DOMAIN ROUTERS
# ==========================================

from routers import (
    auth as auth_router,
    contacts as contacts_router,
    campaigns as campaigns_router,
    chat as chat_router,
    templates as templates_router,
    webhooks as webhooks_router,
    marketing as marketing_router,
    automations as automations_router,
    workflows as workflows_router,
    settings as settings_router,
    analytics as analytics_router,
)

app.include_router(auth_router.router)
app.include_router(contacts_router.router)
app.include_router(campaigns_router.router)
app.include_router(chat_router.router)
app.include_router(templates_router.router)
app.include_router(webhooks_router.router)
app.include_router(marketing_router.router)
app.include_router(automations_router.router)
app.include_router(workflows_router.router)
app.include_router(settings_router.router)
app.include_router(analytics_router.router)

