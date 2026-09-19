import os
import io
import csv
import logging
import hmac
import hashlib
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import List, Optional
from dotenv import load_dotenv
import httpx
from pydantic import BaseModel


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
from scheduler import start_scheduler, schedule_cart_recovery, execute_campaign_broadcast, scheduler
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
    logger.warning(f"Alembic auto-upgrade note (non-critical): {m_err}")

# Non-destructive column sync for existing tables
migration_statements = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_2fa_enabled BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64);",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_recovery_code VARCHAR(10);",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_recovery_code_expires TIMESTAMP;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'agent';",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS api_token VARCHAR(128);",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS api_token_created_at TIMESTAMP;",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS per_day_limit INTEGER;",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP;",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS error_message TEXT;",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
    "ALTER TABLE cart_events ADD COLUMN IF NOT EXISTS extra_data JSON;",
    "ALTER TABLE templates ADD COLUMN IF NOT EXISTS variable_mappings JSON;",
    "ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id);",
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

@app.exception_handler(ResponseValidationError)
async def response_validation_error_handler(request: Request, exc: ResponseValidationError):
    logger.error(f"ResponseValidationError on {request.method} {request.url.path}: {exc.errors()}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Response serialization error: {exc.errors()}"}
    )

# Enable CORS for local Vite development, Vercel production deployment & Android Capacitor
allowed_origins_env = config.ALLOWED_ORIGINS_RAW
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost",
    "https://localhost",
    "capacitor://localhost"
]
if allowed_origins_env:
    allowed_origins.extend([origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"(https://.*\.vercel\.app|http://192\.168\..*|http://10\..*|capacitor://.*|https?://localhost.*)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    start_scheduler()

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
        # system_settings: key-value system configuration
        "CREATE TABLE IF NOT EXISTS system_settings (key VARCHAR(50) PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMP DEFAULT NOW())",
    ]
    try:
        with engine.connect() as _conn:
            for _sql in _migrations:
                try:
                    _conn.execute(text(_sql))
                except Exception as _col_err:
                    print(f"⚠️  Migration note: {_col_err}")
            _conn.commit()
        print("✅ [DB] Safe column migrations applied.")
    except Exception as _mig_err:
        print(f"⚠️  [DB] Migration step error (non-fatal): {_mig_err}")

    # ── Admin user sync ───────────────────────────────────────────────────────
    db = next(get_db())
    initial_user = config.INITIAL_ADMIN_USERNAME
    initial_pass = config.INITIAL_ADMIN_PASSWORD
    initial_email = config.INITIAL_ADMIN_EMAIL

    if initial_pass:
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
            print(f"🔒 [Security] Initial admin '{initial_user}' credentials synchronized.")
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
            print(f"🔒 [Security] Initial admin '{initial_user}' created successfully.")

    # ── Service Account user sync (For external PHP store integration) ────────
    svc_username = config.ECOM_SERVICE_USERNAME
    svc_password = config.ECOM_SERVICE_PASSWORD
    svc_email = config.ECOM_SERVICE_EMAIL

    if svc_password:
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
            print(f"🔒 [Security] Service account '{svc_username}' created successfully.")
        else:
            svc_user.hashed_password = auth.get_password_hash(svc_password)
            svc_user.is_active = True
            svc_user.is_2fa_enabled = False
            svc_user.role = "service"
            db.commit()

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
                # One-time clean slate wipe of dummy/sample automations
                _conn.execute(text("DELETE FROM workflow_sessions"))
                _conn.execute(text("DELETE FROM workflow_flows"))
                _conn.execute(text("DELETE FROM automation_rules"))
                _conn.execute(
                    text("INSERT INTO system_migrations (migration_name) VALUES ('purge_sample_automations_2026_09_16')")
                )
                _conn.commit()
                print("🧹 [Clean Slate] Successfully purged all sample workflows, sessions, and automation rules from database.")
    except Exception as _clean_err:
        print(f"⚠️  [Clean Slate] Note: {_clean_err}")

    # ── One-time Backfill: Customer Replies to READ status ───────────────────
    try:
        with engine.connect() as _conn:
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
                print("🚀 [Read Sync] Successfully backfilled past customer replies to READ status.")
    except Exception as _bf_err:
        print(f"⚠️  [Read Sync] Backfill note: {_bf_err}")

    db.close()





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

