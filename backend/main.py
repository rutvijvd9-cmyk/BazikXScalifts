import os
import io
import csv
import logging
import hmac
import hashlib
from datetime import datetime, timedelta
from typing import List, Optional
from dotenv import load_dotenv
import httpx
from pydantic import BaseModel


logger = logging.getLogger("main")
from fastapi import FastAPI, Depends, HTTPException, Header, Request, status, UploadFile, File, Query
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
from whatsapp_service import send_whatsapp_template, create_meta_template
from apscheduler.triggers.date import DateTrigger

import config

# Ensure tables exist
Base.metadata.create_all(bind=engine)

# Ensure 2FA columns exist in users table (non-destructive migration for existing tables)
try:
    with engine.connect() as conn:
        from sqlalchemy import text
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_2fa_enabled BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64);"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_recovery_code VARCHAR(10);"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_recovery_code_expires TIMESTAMP;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'agent';"))
        conn.commit()
except Exception as col_err:
    logger.warning(f"Note on 2FA column sync: {col_err}")

# Rate Limiter setup
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app = FastAPI(
    title=config.APP_NAME,
    version="1.0.0"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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


@app.post("/api/automations/clean-slate")
def purge_all_sample_automations(
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    """Admin endpoint to purge all sample workflows, sessions, and rules for a 100% fresh clean slate."""
    db.query(models.WorkflowSession).delete()
    db.query(models.WorkflowFlow).delete()
    db.query(models.AutomationRule).delete()
    db.commit()
    return {"status": "ok", "message": "All automations and sample data purged successfully. Clean slate active."}


@app.get("/")
def root():
    return {"message": "WhatsApp CRM is running ✅", "client": config.BRAND_NAME}


@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"status": "ok", "database": "connected", "scheduler": "running"}


# ==========================================
# 🔐 AUTHENTICATION ENDPOINTS
# ==========================================

@app.post("/api/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register_user(
    request: Request,
    payload: schemas.UserCreate,
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    max_users = config.MAX_USERS_LIMIT
    current_user_count = db.query(models.User).count()
    if current_user_count >= max_users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User registration limit reached ({max_users}/{max_users} users created). No more user accounts can be registered."
        )

    existing = db.query(models.User).filter(
        (models.User.username == payload.username) | (models.User.email == payload.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already registered")

    user = models.User(
        username=payload.username.strip(),
        email=payload.email.strip().lower(),
        hashed_password=auth.get_password_hash(payload.password),
        is_active=True,
        role="agent"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# In-memory failed login tracker for brute-force intrusion detection
FAILED_LOGIN_ATTEMPTS = {}

@app.post("/api/auth/login", response_model=schemas.Token)
@limiter.limit("10/minute")
def login(request: Request, payload: schemas.UserLogin, db: Session = Depends(get_db)):
    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if not user or not auth.verify_password(payload.password, user.hashed_password):
        # Increment failed login counter for this IP
        attempts = FAILED_LOGIN_ATTEMPTS.get(client_ip, 0) + 1
        FAILED_LOGIN_ATTEMPTS[client_ip] = attempts

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Reset counter on successful login
    FAILED_LOGIN_ATTEMPTS.pop(client_ip, None)

    # Check if user has Two-Factor Authentication (2FA) enabled
    if user.is_2fa_enabled:
        temp_token = auth.create_temp_2fa_token(user.username)
        return {
            "access_token": "",
            "token_type": "bearer",
            "username": user.username,
            "requires_2fa": True,
            "temp_token": temp_token
        }

    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer", "username": user.username, "requires_2fa": False}


def verify_user_stepup_auth(user: models.User, password: Optional[str], two_factor_code: Optional[str], db: Session):
    """
    🔐 Step-Up Authentication Guard for Critical & High-Volume Operations:
    Validates user password and (if 2FA enabled or code provided) verifies 6-digit TOTP / Email OTP.
    """
    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account password is required to authorize this high-impact action."
        )

    if not auth.verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect account password. Authorization denied."
        )

    # If user has 2FA enabled, 2FA code is mandatory
    if user.is_2fa_enabled or two_factor_code:
        code = (two_factor_code or "").strip().replace(" ", "")
        if not code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA verification code is required to authorize this action."
            )

        verified = False
        # 1. TOTP code
        if user.totp_secret:
            try:
                import pyotp
                totp = pyotp.TOTP(user.totp_secret)
                if totp.verify(code, valid_window=1):
                    verified = True
            except Exception as e:
                logger.warning(f"Error in TOTP check: {e}")

        # 2. Email recovery OTP
        if not verified and user.email_recovery_code and user.email_recovery_code_expires:
            if datetime.utcnow() <= user.email_recovery_code_expires and user.email_recovery_code == code:
                verified = True
                user.email_recovery_code = None
                user.email_recovery_code_expires = None
                db.commit()

        if not verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired 2FA verification code."
            )

    return True


# ==========================================
# 🛡️ TWO-FACTOR AUTHENTICATION (2FA) ENDPOINTS
# ==========================================

@app.post("/api/auth/2fa/verify", response_model=schemas.Token)
@limiter.limit("10/minute")
def verify_two_factor_code(
    request: Request,
    payload: schemas.TwoFactorVerifyRequest,
    db: Session = Depends(get_db)
):
    """
    Verifies a 6-digit TOTP Google Authenticator code OR an emergency email recovery code.
    Issues the full 24-hour access token upon success.
    """
    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
    
    if not payload.temp_token:
        raise HTTPException(status_code=400, detail="Missing 2FA temporary session token")
    
    username = auth.verify_temp_2fa_token(payload.temp_token)
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or deactivated")

    code = payload.code.strip().replace(" ", "")
    verified = False

    # 1. Try TOTP code via pyotp
    if user.totp_secret:
        try:
            import pyotp
            totp = pyotp.TOTP(user.totp_secret)
            # valid_window=1 allows +- 30s clock drift
            if totp.verify(code, valid_window=1):
                verified = True
        except Exception as e:
            logger.warning(f"Error in TOTP verification: {e}")

    # 2. Try Email Recovery Code if not verified via TOTP
    if not verified and user.email_recovery_code and user.email_recovery_code_expires:
        if datetime.utcnow() <= user.email_recovery_code_expires and user.email_recovery_code == code:
            verified = True
            # Clear recovery code after successful use (single-use)
            user.email_recovery_code = None
            user.email_recovery_code_expires = None
            db.commit()

    if not verified:
        attempts = FAILED_LOGIN_ATTEMPTS.get(f"2fa_{client_ip}", 0) + 1
        FAILED_LOGIN_ATTEMPTS[f"2fa_{client_ip}"] = attempts
        raise HTTPException(status_code=400, detail="Invalid 2FA code or expired recovery code")

    # Reset failed counter
    FAILED_LOGIN_ATTEMPTS.pop(f"2fa_{client_ip}", None)

    # Issue access token
    access_token = auth.create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username,
        "requires_2fa": False
    }


@app.get("/api/auth/2fa/setup", response_model=schemas.TwoFactorSetupResponse)
def setup_two_factor_auth(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generates a new TOTP secret key and QR code for the authenticated user to scan with Google Authenticator.
    """
    import pyotp
    import qrcode
    import base64

    # Generate fresh 32-char base32 secret
    new_secret = pyotp.random_base32()
    current_user.totp_secret = new_secret
    db.commit()

    # Generate otpauth URI standard for authenticator apps
    issuer = "Manubhai Gathiyawala"
    otpauth_url = pyotp.totp.TOTP(new_secret).provisioning_uri(
        name=current_user.username,
        issuer_name=issuer
    )

    # Generate QR Code PNG in memory as base64 data URI
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=3,
    )
    qr.add_data(otpauth_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#111827", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    qr_data_uri = f"data:image/png;base64,{qr_b64}"

    return {
        "secret": new_secret,
        "otpauth_url": otpauth_url,
        "qr_code_base64": qr_data_uri
    }


@app.post("/api/auth/2fa/enable")
def enable_two_factor_auth(
    payload: schemas.TwoFactorVerifyRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Verifies that the user successfully scanned the QR code before permanently locking 2FA ON.
    """
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA setup not initiated. Please request /api/auth/2fa/setup first.")

    import pyotp
    totp = pyotp.TOTP(current_user.totp_secret)
    code = payload.code.strip().replace(" ", "")
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid 6-digit verification code. Please check Google Authenticator time and try again.")

    current_user.is_2fa_enabled = True
    db.commit()

    return {
        "status": "success",
        "message": "Two-Factor Authentication (2FA) successfully activated for your account!"
    }


@app.post("/api/auth/2fa/disable")
def disable_two_factor_auth(
    payload: schemas.TwoFactorDisableRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Disables 2FA on the user's account after confirming current password.
    """
    if not auth.verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password. Cannot disable 2FA.")

    current_user.is_2fa_enabled = False
    current_user.totp_secret = None
    current_user.email_recovery_code = None
    current_user.email_recovery_code_expires = None
    db.commit()

    return {
        "status": "success",
        "message": "Two-Factor Authentication (2FA) has been disabled for your account."
    }



@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_current_user_profile(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


@app.get("/api/auth/registration-status")
def get_registration_status(db: Session = Depends(get_db)):
    max_users = config.MAX_USERS_LIMIT
    count = db.query(models.User).count()
    return {
        "current_users": count,
        "max_users": max_users,
        "can_register": count < max_users
    }


@app.get("/api/users", response_model=List[schemas.UserResponse])
def list_system_users(
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    """
    Returns all registered team users (up to MAX_USERS_LIMIT).
    """
    return db.query(models.User).order_by(models.User.id.asc()).all()


@app.post("/api/users", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def create_system_user(
    payload: schemas.UserCreate,
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    """
    Creates a new team member account (authenticated admin only, configurable user limit).
    """
    max_users = config.MAX_USERS_LIMIT
    current_user_count = db.query(models.User).count()
    if current_user_count >= max_users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User limit reached ({max_users}/{max_users} users created). Cannot register more accounts."
        )

    existing = db.query(models.User).filter(
        (models.User.username == payload.username) | (models.User.email == payload.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already registered")

    user = models.User(
        username=payload.username.strip(),
        email=payload.email.strip().lower(),
        hashed_password=auth.get_password_hash(payload.password),
        is_active=True,
        role=payload.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ==========================================
# 🔒 PROTECTED CRM ENDPOINTS (Require JWT)
# ==========================================

# --- Contacts API ---
@app.post("/api/contacts", response_model=schemas.ContactResponse, status_code=status.HTTP_201_CREATED)
def create_or_get_contact(
    payload: schemas.ContactCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    clean_phone = payload.phone.strip()
    if not clean_phone.startswith("+"):
        clean_phone = "+" + clean_phone

    contact = db.query(models.Contact).filter(models.Contact.phone == clean_phone).first()
    if contact:
        if payload.name:
            contact.name = payload.name
        if payload.email:
            contact.email = payload.email
        if payload.city:
            contact.city = payload.city
        if payload.tags:
            contact.tags = payload.tags
        if payload.total_orders is not None and payload.total_orders > 0:
            contact.total_orders = payload.total_orders
        if payload.last_order_date:
            contact.last_order_date = payload.last_order_date
        if payload.birth_day:
            contact.birth_day = payload.birth_day
        if payload.birth_month:
            contact.birth_month = payload.birth_month
        db.commit()
        db.refresh(contact)
        return contact
    
    new_contact = models.Contact(
        phone=clean_phone,
        name=payload.name,
        email=payload.email,
        city=payload.city,
        tags=payload.tags,
        total_orders=payload.total_orders or 0,
        last_order_date=payload.last_order_date,
        birth_day=payload.birth_day,
        birth_month=payload.birth_month
    )
    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)
    return new_contact


@app.put("/api/contacts/{contact_id}", response_model=schemas.ContactResponse)
def update_contact(
    contact_id: int,
    payload: schemas.ContactUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    if payload.phone:
        clean_phone = payload.phone.strip()
        if not clean_phone.startswith("+"):
            clean_phone = "+" + clean_phone
        # Check if phone is taken by another contact
        existing = db.query(models.Contact).filter(models.Contact.phone == clean_phone, models.Contact.id != contact_id).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Phone {clean_phone} is already registered to another contact")
        contact.phone = clean_phone

    if payload.name is not None:
        contact.name = payload.name
    if payload.email is not None:
        contact.email = payload.email
    if payload.city is not None:
        contact.city = payload.city
    if payload.tags is not None:
        contact.tags = payload.tags
    if payload.total_orders is not None:
        contact.total_orders = max(0, payload.total_orders)
    if payload.last_order_date is not None:
        contact.last_order_date = payload.last_order_date

    db.commit()
    db.refresh(contact)
    return contact


@app.delete("/api/contacts/{contact_id}")
def delete_contact(
    contact_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    db.delete(contact)
    db.commit()
    return {"status": "success", "message": f"Contact {contact.phone} deleted successfully"}


@app.get("/api/contacts", response_model=List[schemas.ContactResponse])
def list_contacts(
    search: Optional[str] = None,
    tag: Optional[str] = None,
    skip: int = 0,
    limit: int = 5000,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Contact)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (models.Contact.phone.ilike(search_pattern)) |
            (models.Contact.name.ilike(search_pattern)) |
            (models.Contact.email.ilike(search_pattern)) |
            (models.Contact.city.ilike(search_pattern))
        )
    if tag:
        query = query.filter(models.Contact.tags.ilike(f"%{tag}%"))

    return query.order_by(models.Contact.id.desc()).offset(skip).limit(limit).all()


@app.post("/api/contacts/import-csv")
async def import_contacts_csv(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Imports contacts from a CSV file. Expected columns (case-insensitive):
    phone, name, email, city, tags, total_orders
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 Megabytes
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File size exceeds 5MB limit (File size: {len(content) / (1024 * 1024):.2f}MB). Please upload a smaller file."
        )

    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    
    # 1. Deduplicate queue in memory first (keeps last seen data for duplicate rows in CSV)
    queue_contacts = {}
    for row in reader:
        norm_row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
        raw_phone = norm_row.get("phone") or norm_row.get("mobile") or norm_row.get("contact")
        if not raw_phone:
            continue

        phone = raw_phone.strip().replace(" ", "").replace("-", "")
        if not phone.startswith("+"):
            phone = "+" + phone

        name = norm_row.get("name") or norm_row.get("full_name") or "Valued Customer"
        email = norm_row.get("email")
        city = norm_row.get("city")
        tags = norm_row.get("tags")
        orders_str = norm_row.get("total_orders") or norm_row.get("orders") or "0"
        try:
            total_orders = int(orders_str)
        except ValueError:
            total_orders = 0

        last_order_raw = norm_row.get("last_order_date") or norm_row.get("last_order") or norm_row.get("order_date")
        parsed_last_order = None
        if last_order_raw:
            for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y"):
                try:
                    parsed_last_order = datetime.strptime(last_order_raw.strip(), fmt)
                    break
                except ValueError:
                    pass

        queue_contacts[phone] = {
            "name": name,
            "email": email,
            "city": city,
            "tags": tags,
            "total_orders": total_orders,
            "last_order_date": parsed_last_order
        }

    imported_count = 0
    updated_count = 0
    BATCH_SIZE = 500

    # 2. Process queue in batches of 500
    phone_keys = list(queue_contacts.keys())
    for i in range(0, len(phone_keys), BATCH_SIZE):
        batch_chunk = phone_keys[i:i + BATCH_SIZE]
        
        # Pre-fetch existing contacts for this 500-item batch
        existing_contacts = {
            c.phone: c for c in db.query(models.Contact).filter(models.Contact.phone.in_(batch_chunk)).all()
        }

        for phone in batch_chunk:
            item = queue_contacts[phone]
            if phone in existing_contacts:
                c = existing_contacts[phone]
                if item["name"]:
                    c.name = item["name"]
                if item["email"]:
                    c.email = item["email"]
                if item["city"]:
                    c.city = item["city"]
                if item["tags"]:
                    c.tags = item["tags"]
                if item["total_orders"] > 0:
                    c.total_orders = item["total_orders"]
                if item["last_order_date"]:
                    c.last_order_date = item["last_order_date"]
                updated_count += 1
            else:
                new_c = models.Contact(
                    phone=phone,
                    name=item["name"],
                    email=item["email"],
                    city=item["city"],
                    tags=item["tags"],
                    total_orders=item["total_orders"],
                    last_order_date=item["last_order_date"]
                )
                db.add(new_c)
                imported_count += 1

        db.commit()

    return {
        "status": "success",
        "imported": imported_count,
        "updated": updated_count,
        "total_queued": len(queue_contacts),
        "message": f"Queue batch processed: {imported_count} new contacts added, {updated_count} existing contacts updated ({len(queue_contacts)} unique)."
    }



# --- Opt-Out / DND API ---
@app.post("/api/opt-out")
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


# --- Message Logs API ---
@app.get("/api/message-logs")
def get_message_logs(
    limit: int = 50,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    logs = db.query(models.MessageLog).order_by(models.MessageLog.created_at.desc()).limit(limit).all()
    return logs


@app.post("/api/campaigns", response_model=schemas.CampaignResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def create_and_trigger_campaign(
    request: Request,
    payload: schemas.CampaignCreate,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    # 🔐 CRITICAL SECURITY GUARD: Verify Password + 2FA before mass broadcasting
    verify_user_stepup_auth(
        user=current_user,
        password=payload.password,
        two_factor_code=payload.two_factor_code,
        db=db
    )

    scheduled_dt = None
    if payload.scheduled_for:
        try:
            # Handle ISO string from datetime-local input
            clean_str = payload.scheduled_for.replace("Z", "").replace("T", " ")
            scheduled_dt = datetime.fromisoformat(clean_str)
        except Exception:
            scheduled_dt = None

    campaign = models.Campaign(
        title=payload.title,
        template_name=payload.template_name,
        language=payload.language or "en",
        target_filter=payload.target_filter or "ALL",
        status="SCHEDULED" if scheduled_dt and scheduled_dt > datetime.utcnow() else "IN_PROGRESS",
        scheduled_for=scheduled_dt
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    if scheduled_dt and scheduled_dt > datetime.utcnow():
        # Schedule future execution
        job_id = f"campaign_{campaign.id}"
        scheduler.add_job(
            func=execute_campaign_broadcast,
            trigger=DateTrigger(run_date=scheduled_dt),
            args=[campaign.id, payload.custom_phones],
            id=job_id,
            replace_existing=True
        )
        logger.info(f"📅 Campaign {campaign.id} scheduled to execute at {scheduled_dt}")
    else:
        # Trigger campaign broadcast immediately
        execute_campaign_broadcast(campaign.id, recipient_phones=payload.custom_phones)

    db.refresh(campaign)
    return campaign



@app.get("/api/campaigns", response_model=List[schemas.CampaignResponse])
def list_campaigns(
    skip: int = 0,
    limit: int = 50,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    return db.query(models.Campaign).order_by(models.Campaign.created_at.desc()).offset(skip).limit(limit).all()


@app.get("/api/campaigns/{campaign_id}", response_model=schemas.CampaignResponse)
def get_campaign(
    campaign_id: int,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


# ==========================================
# 🛡️ WEBHOOK ENDPOINTS (Strictly Authenticated & Rate limited)
# ==========================================

async def get_webhook_authenticated_user(
    request: Request,
    db: Session = Depends(get_db)
) -> models.User:
    """
    Validates e-commerce HMAC signatures for external requests. Dashboard
    simulations may use an admin or service JWT, but arbitrary user JWTs and
    raw shared-secret headers are never accepted.
    """
    auth_header = request.headers.get("Authorization", "").strip()
    signature = request.headers.get("X-Hub-Signature-256", "")
    if config.WEBHOOK_SECRET and signature:
        raw_body = await request.body()
        expected = "sha256=" + hmac.new(
            config.WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
        svc = db.query(models.User).filter(models.User.username == config.ECOM_SERVICE_USERNAME).first()
        return svc or models.User(username=config.ECOM_SERVICE_USERNAME, is_active=True)

    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        try:
            user = auth.get_current_user(token=token, db=db)
            if user.role in {"admin", "service"}:
                return user
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Webhook access requires a service account")
        except HTTPException as he:
            raise he
        except Exception:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized: webhook requires a valid HMAC signature or service-account token.",
        headers={"WWW-Authenticate": "Bearer"},
    )


@app.post("/api/webhooks/cart-event", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("60/minute")
async def receive_cart_webhook(
    request: Request,
    payload: schemas.CartEventPayload,
    delay_seconds: Optional[int] = 0,
    current_user: models.User = Depends(get_webhook_authenticated_user),
    db: Session = Depends(get_db)
):
    idempotency_key = request.headers.get("X-Idempotency-Key") or f"cart:{payload.cart_token}"
    existing_event = db.query(models.WebhookEvent).filter(
        models.WebhookEvent.idempotency_key == idempotency_key
    ).first()
    if existing_event:
        return {"status": "duplicate", "message": "Webhook event was already processed."}

    db.add(models.WebhookEvent(event_type="cart", idempotency_key=idempotency_key))
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return {"status": "duplicate", "message": "Webhook event was already processed."}
    # Check if user is in opt-out list
    is_opted_out = db.query(models.OptOut).filter(models.OptOut.phone == payload.customer_phone).first()
    if is_opted_out:
        return {"status": "ignored", "reason": "Customer is on Opt-Out / DND list"}

    # Collect all dynamic ecom extra payload data
    extra_payload = dict(payload.extra_data or {})
    if payload.first_name:
        extra_payload.setdefault("first_name", payload.first_name)
    if payload.customer_name:
        extra_payload.setdefault("customer_name", payload.customer_name)
    if payload.delivery_address:
        extra_payload.setdefault("delivery_address", payload.delivery_address)

    resolved_cust_name = payload.first_name or payload.customer_name or "Valued Customer"

    # Save cart event
    cart_record = models.CartEvent(
        cart_token=payload.cart_token,
        customer_phone=payload.customer_phone,
        cart_value=payload.cart_value,
        items=payload.items,
        extra_data=extra_payload,
        status="PENDING"
    )
    db.add(cart_record)
    db.commit()
    db.refresh(cart_record)

    # Check if there is an active multi-step visual workflow for abandoned carts
    active_cart_flow = db.query(models.WorkflowFlow).filter(
        models.WorkflowFlow.trigger_type == "ABANDONED_CART",
        models.WorkflowFlow.is_active == True
    ).first()

    workflow_session_id = None
    if active_cart_flow:
        items_summary = ", ".join([item.get("item", "Namkeen Item") for item in (payload.items or [])]) if payload.items else "Special Vanela Gathiya & Bhavnagari Gathiya"
        state_data = {
            "cart_token": payload.cart_token,
            "cart_value": payload.cart_value,
            "customer_name": resolved_cust_name,
            "items_summary": items_summary,
            "extra_data": extra_payload
        }
        # Flatten extra_payload directly into state_data for direct access
        for k, v in extra_payload.items():
            state_data.setdefault(k, str(v))

        from scheduler import start_workflow_session
        wf_sess = start_workflow_session(flow_id=active_cart_flow.id, customer_phone=payload.customer_phone, state_data=state_data, db=db)
        if wf_sess:
            workflow_session_id = wf_sess.id

    # Fallback / Dual safety: if no active visual flow exists, schedule classic single-step rule
    eff_delay = delay_seconds if delay_seconds is not None else 0
    if not active_cart_flow:
        schedule_cart_recovery(cart_event_id=cart_record.id, delay_seconds=eff_delay)

    msg_detail = (
        f"Multi-step journey enrolled (Session #{workflow_session_id})"
        if workflow_session_id
        else ("WhatsApp message dispatched immediately" if eff_delay <= 0 else f"WhatsApp message scheduled in {eff_delay}s")
    )
    return {
        "status": "received",
        "cart_event_id": cart_record.id,
        "workflow_session_id": workflow_session_id,
        "scheduled_in_seconds": eff_delay,
        "authenticated_as": current_user.username,
        "message": f"Cart abandonment event recorded. {msg_detail}."
    }


@app.post("/api/webhooks/order-completed")
@limiter.limit("60/minute")
async def receive_order_completed_webhook(
    request: Request,
    cart_token: str,
    customer_phone: str,
    current_user: models.User = Depends(get_webhook_authenticated_user),
    db: Session = Depends(get_db)
):
    idempotency_key = request.headers.get("X-Idempotency-Key") or f"order:{cart_token}"
    existing_event = db.query(models.WebhookEvent).filter(
        models.WebhookEvent.idempotency_key == idempotency_key
    ).first()
    if existing_event:
        return {"status": "duplicate", "message": "Webhook event was already processed."}
    db.add(models.WebhookEvent(event_type="order", idempotency_key=idempotency_key))
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return {"status": "duplicate", "message": "Webhook event was already processed."}
    clean_phone = customer_phone.strip()
    if not clean_phone.startswith("+"):
        clean_phone = "+" + clean_phone

    # 1. Update contact order statistics
    contact = db.query(models.Contact).filter(models.Contact.phone == clean_phone).first()
    if not contact:
        contact = models.Contact(phone=clean_phone, total_orders=1, last_order_date=datetime.utcnow())
        db.add(contact)
    else:
        contact.total_orders = (contact.total_orders or 0) + 1
        contact.last_order_date = datetime.utcnow()

    # 2. Check Order Milestone (e.g. 5th, 10th order VIP reward)
    milestone_triggered = None
    if contact.total_orders in [5, 10, 20]:
        milestone = contact.total_orders
        coupon = f"VIP{milestone}"
        # Check if discount code exists, or auto-create it
        disc = db.query(models.DiscountCode).filter(models.DiscountCode.code == coupon).first()
        if not disc:
            disc = models.DiscountCode(
                code=coupon,
                discount_type="PERCENT",
                discount_value=15.0 if milestone >= 10 else 10.0,
                max_uses=1000,
                is_active=True
            )
            db.add(disc)

        # Trigger milestone reward WhatsApp template
        send_whatsapp_template(
            recipient_phone=clean_phone,
            template_name="milestone_reward_offer",
            language="en",
            parameters={
                "name": contact.name or "Valued Customer",
                "milestone": str(milestone),
                "coupon": coupon
            }
        )
        milestone_triggered = f"Milestone {milestone}th order reward dispatched with coupon {coupon}"
        logger.info(f"🎉 [MILESTONE REWARD] Customer {clean_phone} reached order #{milestone}! Sent coupon {coupon}")

    # 3. Mark cart as RECOVERED if associated with a pending cart event
    cart = db.query(models.CartEvent).filter(
        models.CartEvent.cart_token == cart_token,
        models.CartEvent.customer_phone == customer_phone
    ).first()

    if cart:
        cart.status = "RECOVERED"
        db.commit()
        return {
            "status": "success",
            "message": f"Cart {cart_token} marked as RECOVERED. Recovery message cancelled.",
            "milestone": milestone_triggered,
            "total_orders": contact.total_orders
        }
    
    db.commit()
    return {
        "status": "success",
        "message": f"Order completion recorded. Total customer orders: {contact.total_orders}",
        "milestone": milestone_triggered,
        "total_orders": contact.total_orders
    }


# ==========================================
# 📲 META WHATSAPP INBOUND WEBHOOK (DND / STOP)
# ==========================================

WHATSAPP_VERIFY_TOKEN = config.WHATSAPP_VERIFY_TOKEN

# Multilingual opt-out trigger keywords
OPT_OUT_KEYWORDS = {
    "stop", "unsubscribe", "dnd", "cancel",
    "બંધ", "બંધ કરો", "સંદેશા બંધ કરો",  # Gujarati
    "रोको", "बंद करो", "मैसेज बंद करो"      # Hindi
}


@app.get("/api/webhooks/whatsapp")
def verify_whatsapp_webhook(
    request: Request
):
    """
    Required by Meta to verify webhook endpoint URL.
    Checks hub.verify_token and echoes back hub.challenge.
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if not WHATSAPP_VERIFY_TOKEN:
        logger.error("WHATSAPP_VERIFY_TOKEN is not configured in environment variables.")
        raise HTTPException(status_code=500, detail="Webhook verify token not configured on server")

    if mode == "subscribe" and token == WHATSAPP_VERIFY_TOKEN:
        return int(challenge) if challenge and challenge.isdigit() else challenge
    raise HTTPException(status_code=403, detail="Verification token mismatch")


@app.post("/api/webhooks/whatsapp")
async def receive_inbound_whatsapp_message(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Receives incoming customer messages/replies from Meta WhatsApp Cloud API.
    1. If the customer types 'STOP', 'બંધ કરો', or 'रोકો', they are automatically added to the opt_outs DND table.
    2. All incoming messages are saved into ChatMessage for real-time 2-Way Chat.
    """
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not config.META_APP_SECRET:
        raise HTTPException(status_code=503, detail="Meta webhook signature validation is not configured")

    raw_body = await request.body()
    expected_signature = "sha256=" + hmac.new(
        config.META_APP_SECRET.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    if not signature or not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(status_code=401, detail="Invalid Meta webhook signature")

    try:
        data = await request.json()
    except Exception:
        return {"status": "ignored", "reason": "invalid json"}

    # Parse Meta Cloud API inbound structure
    entry = data.get("entry", [])
    if not entry:
        return {"status": "ok"}

    changes = entry[0].get("changes", [])
    if not changes:
        return {"status": "ok"}

    value = changes[0].get("value", {})
    messages = value.get("messages", [])

    if not messages:
        # Might be a status update (delivered, read)
        statuses = value.get("statuses", [])
        if statuses:
            for st in statuses:
                wamid = st.get("id")
                new_status = st.get("status", "").upper()
                if wamid:
                    chat_msg = db.query(models.ChatMessage).filter(models.ChatMessage.meta_message_id == wamid).first()
                    if chat_msg:
                        chat_msg.status = new_status

                    msg_log = db.query(models.MessageLog).filter(models.MessageLog.meta_message_id == wamid).first()
                    if msg_log:
                        msg_log.status = new_status
                        errors = st.get("errors", [])
                        if errors:
                            msg_log.error_message = str(errors)

                    db.commit()
        return {"status": "status_update_acknowledged"}

    any_opt_out = False
    for msg in messages:
        sender_phone = "+" + msg.get("from", "").strip("+")
        msg_type = msg.get("type", "text")
        raw_body = ""
        meta_id = msg.get("id", "")

        if msg_type == "text":
            raw_body = msg.get("text", {}).get("body", "").strip()
        elif msg_type == "button":
            raw_body = msg.get("button", {}).get("text", "")
        elif msg_type == "interactive":
            interactive = msg.get("interactive", {})
            raw_body = interactive.get("button_reply", {}).get("title") or interactive.get("list_reply", {}).get("title") or "Interactive Response"
        else:
            raw_body = f"[{msg_type.upper()} message received]"

        # Check for opt-out keywords
        is_opt_out = any(keyword in raw_body.lower() for keyword in OPT_OUT_KEYWORDS)

        if is_opt_out:
            any_opt_out = True
            existing_opt = db.query(models.OptOut).filter(models.OptOut.phone == sender_phone).first()
            if not existing_opt:
                opt_record = models.OptOut(phone=sender_phone, reason=f"INBOUND_REPLY: {raw_body}")
                db.add(opt_record)
                db.commit()
                print(f"🛑 [AUTO-DND] Customer {sender_phone} texted '{raw_body}'. Added to Opt-Out DND list.")

        # Save to ChatMessage database
        new_chat_msg = models.ChatMessage(
            customer_phone=sender_phone,
            sender_type="CUSTOMER",
            message_type=msg_type,
            text=raw_body,
            meta_message_id=meta_id,
            status="RECEIVED",
            is_read=False
        )
        db.add(new_chat_msg)

        # 🚀 SMART READ INFERENCE: Customer replied!
        # A customer cannot reply without opening/reading the WhatsApp message.
        # Mark recent outbound messages to this customer as READ to ensure 100% accurate read rates
        # even if the recipient disabled blue-tick receipts in their WhatsApp privacy settings.
        recent_outbound_logs = db.query(models.MessageLog).filter(
            models.MessageLog.recipient_phone == sender_phone,
            models.MessageLog.status.in_(["SENT", "SENT_SIMULATED", "DELIVERED"])
        ).order_by(models.MessageLog.id.desc()).limit(3).all()
        for out_log in recent_outbound_logs:
            out_log.status = "READ"

        # Also mark any preceding outbound ChatMessage as READ
        recent_outbound_chats = db.query(models.ChatMessage).filter(
            models.ChatMessage.customer_phone == sender_phone,
            models.ChatMessage.sender_type.in_(["AGENT", "SYSTEM", "BOT"]),
            models.ChatMessage.status.in_(["SENT", "DELIVERED"])
        ).order_by(models.ChatMessage.id.desc()).limit(3).all()
        for out_chat in recent_outbound_chats:
            out_chat.status = "READ"

        # Also auto-create contact if not existing yet
        existing_contact = db.query(models.Contact).filter(models.Contact.phone == sender_phone).first()
        if not existing_contact:
            contacts_list = value.get("contacts") or []
            profile_name = "New WhatsApp Lead"
            if isinstance(contacts_list, list) and len(contacts_list) > 0 and isinstance(contacts_list[0], dict):
                profile_name = contacts_list[0].get("profile", {}).get("name") or "New WhatsApp Lead"

            new_contact = models.Contact(
                phone=sender_phone,
                name=profile_name,
                total_orders=0,
                tags="Inbound Lead",
                city="WhatsApp"
            )
            db.add(new_contact)

        db.commit()

    return {"status": "opted_out" if any_opt_out else "message_processed"}


# ==========================================
# 💬 TWO-WAY CONVERSATION INBOX APIs
# ==========================================

@app.get("/api/chat/conversations", response_model=List[schemas.ChatConversationSummary])
def list_conversations(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns active conversation threads grouped by customer phone,
    with unread counts, contact details, and last message snippet.
    """
    # Ensure broadcast recipients from MessageLog have chat records
    recent_broadcast_phones = (
        db.query(models.MessageLog.recipient_phone)
        .filter(models.MessageLog.status.in_(["SENT", "SENT_SIMULATED", "DELIVERED", "READ"]))
        .distinct()
        .all()
    )
    for (r_phone,) in recent_broadcast_phones:
        if r_phone:
            has_chat = db.query(models.ChatMessage).filter(models.ChatMessage.customer_phone == r_phone).first()
            if not has_chat:
                last_log = (
                    db.query(models.MessageLog)
                    .filter(models.MessageLog.recipient_phone == r_phone)
                    .order_by(models.MessageLog.created_at.desc())
                    .first()
                )
                if last_log and last_log.meta_message_id:
                    tmpl = db.query(models.Template).filter(models.Template.template_name == last_log.template_name).first()
                    content = tmpl.body_text if tmpl and tmpl.body_text else f"📢 WhatsApp Template: {last_log.template_name}"
                    db.add(models.ChatMessage(
                        customer_phone=r_phone,
                        sender_type="AGENT",
                        message_type="template",
                        text=content,
                        meta_message_id=last_log.meta_message_id,
                        status=last_log.status,
                        is_read=True,
                        created_at=last_log.created_at
                    ))
    db.commit()

    # Get distinct customer phones ordered by latest message
    subquery = (
        db.query(
            models.ChatMessage.customer_phone,
            func.max(models.ChatMessage.created_at).label("latest_time")
        )
        .group_by(models.ChatMessage.customer_phone)
        .order_by(desc("latest_time"))
        .all()
    )

    results = []
    for phone, latest_time in subquery:
        # Fetch last message
        last_msg = (
            db.query(models.ChatMessage)
            .filter(models.ChatMessage.customer_phone == phone)
            .order_by(models.ChatMessage.created_at.desc())
            .first()
        )
        # Unread count (customer messages not yet read by agent)
        unread = (
            db.query(models.ChatMessage)
            .filter(
                models.ChatMessage.customer_phone == phone,
                models.ChatMessage.sender_type == "CUSTOMER",
                models.ChatMessage.is_read == False
            )
            .count()
        )
        # Contact metadata
        contact = db.query(models.Contact).filter(models.Contact.phone == phone).first()

        results.append(
            schemas.ChatConversationSummary(
                customer_phone=phone,
                customer_name=contact.name if contact and contact.name else "Customer",
                customer_city=contact.city if contact else None,
                total_orders=contact.total_orders if contact else 0,
                unread_count=unread,
                last_message_text=last_msg.text if last_msg else None,
                last_message_time=latest_time,
                last_sender=last_msg.sender_type if last_msg else None
            )
        )

    return results


@app.get("/api/chat/messages/{phone}", response_model=List[schemas.ChatMessageResponse])
def get_chat_history(
    phone: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves full chronological message history for a specific customer phone.
    Marks customer messages as read.
    """
    clean_phone = phone.strip()
    if not clean_phone.startswith("+"):
        clean_phone = "+" + clean_phone

    # Ensure any past marketing template dispatches from MessageLog are present in ChatMessage
    historical_logs = (
        db.query(models.MessageLog)
        .filter(
            models.MessageLog.recipient_phone == clean_phone,
            models.MessageLog.status.in_(["SENT", "SENT_SIMULATED", "DELIVERED", "READ"])
        )
        .all()
    )
    for h_log in historical_logs:
        if h_log.meta_message_id:
            exists = (
                db.query(models.ChatMessage)
                .filter(models.ChatMessage.meta_message_id == h_log.meta_message_id)
                .first()
            )
            if not exists:
                tmpl = db.query(models.Template).filter(models.Template.template_name == h_log.template_name).first()
                content = tmpl.body_text if tmpl and tmpl.body_text else f"📢 WhatsApp Template: {h_log.template_name}"
                db.add(models.ChatMessage(
                    customer_phone=clean_phone,
                    sender_type="AGENT",
                    message_type="template",
                    text=content,
                    meta_message_id=h_log.meta_message_id,
                    status=h_log.status,
                    is_read=True,
                    created_at=h_log.created_at
                ))
    db.commit()

    # Mark as read
    db.query(models.ChatMessage).filter(
        models.ChatMessage.customer_phone == clean_phone,
        models.ChatMessage.sender_type == "CUSTOMER",
        models.ChatMessage.is_read == False
    ).update({"is_read": True})
    db.commit()

    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.customer_phone == clean_phone)
        .order_by(models.ChatMessage.created_at.asc())
        .limit(200)
        .all()
    )
    return messages


@app.post("/api/chat/send", response_model=schemas.ChatMessageResponse)
def send_agent_reply(
    payload: schemas.ChatSendMessageRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Allows store owner/agent to send an outbound text reply to a customer's WhatsApp.
    Dispatches via Meta Cloud API or simulation mode and saves to chat history.
    """
    clean_phone = payload.customer_phone.strip()
    if not clean_phone.startswith("+"):
        clean_phone = "+" + clean_phone

    # Dispatch via whatsapp_service
    from whatsapp_service import send_whatsapp_free_text
    res = send_whatsapp_free_text(clean_phone, payload.text)

    msg_id = res.get("message_id")
    status_str = "SENT" if res.get("status") in ["success", "success_simulated"] else "FAILED"

    chat_entry = models.ChatMessage(
        customer_phone=clean_phone,
        sender_type="AGENT",
        message_type="text",
        text=payload.text,
        meta_message_id=msg_id,
        status=status_str,
        is_read=True
    )
    db.add(chat_entry)

    # Also log in general message_logs table
    log_entry = models.MessageLog(
        recipient_phone=clean_phone,
        template_name="two_way_custom_chat",
        language="en",
        status=status_str,
        meta_message_id=msg_id
    )
    db.add(log_entry)
    db.commit()
    db.refresh(chat_entry)

    return chat_entry


# --- Cart Events List API ---
@app.get("/api/cart-events")
def list_cart_events(
    limit: int = 50,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(models.CartEvent).order_by(models.CartEvent.created_at.desc()).limit(limit).all()


# --- Opt-Outs List API ---
@app.get("/api/opt-outs")
def list_opt_outs(
    limit: int = 100,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(models.OptOut).order_by(models.OptOut.created_at.desc()).limit(limit).all()


@app.delete("/api/opt-outs/{phone}")
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

# --- Mock Store Inactive Customer Endpoint (Simulates what Manubhai's PHP site returns) ---
@app.get("/api/mock-store-feed/inactive-customers")
def mock_store_inactive_feed(days: int = 30):
    return {
        "status": "success",
        "days_threshold": days,
        "customers": [
            {
                "phone": "+919825123456",
                "name": "Kishorebhai Mehta",
                "email": "kishore@example.com",
                "total_orders": 4
            },
            {
                "phone": "+919898765432",
                "name": "Pravinbhai Trivedi",
                "email": "pravin@example.com",
                "total_orders": 2
            }
        ]
    }


# --- Manual Trigger Endpoint for 30-Day Inactive Re-engagement Sweep ---
from scheduler import run_thirty_day_reengagement_sweep

@app.post("/api/triggers/reengagement-sweep")
def trigger_manual_reengagement_sweep(
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Allows the admin to manually trigger the 30-day customer re-engagement sweep
    immediately rather than waiting for the 10:00 AM daily cron.
    """
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

@app.post("/api/messages/send-test")
def send_direct_test_message(
    payload: DirectTestMessageRequest,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """
    Directly dispatches a test WhatsApp template to a specific phone number
    using the template's exact approved language and placeholder parameters.
    """
    clean_phone = payload.phone.strip()
    if not clean_phone.startswith("+"):
        clean_phone = "+" + clean_phone

    # Look up the template in DB to get its exact language code (e.g. en_US, en, hi, gu)
    tmpl = db.query(models.Template).filter(models.Template.template_name == payload.template_name).first()
    lang = payload.language
    if tmpl and tmpl.language:
        lang = tmpl.language

    # Prepare parameters matching the template
    params = payload.parameters
    if not params:
        if tmpl and tmpl.body_text:
            import re
            # Count placeholders like {{1}}, {{2}}, etc.
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
        parameters=params
    )
    return res


# --- Templates List & Meta Live Sync API ---
@app.post("/api/templates/sync-from-meta")
def sync_templates_from_meta(
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """
    Connects to live Meta Graph API using your WABA_ID & ACCESS_TOKEN,
    fetches all approved message templates, and syncs them into your database.
    """
    waba_id = config.WHATSAPP_BUSINESS_ACCOUNT_ID
    access_token = config.WHATSAPP_API_TOKEN

    if not waba_id or not access_token:
        raise HTTPException(
            status_code=400,
            detail="Meta WABA ID or Access Token is missing from environment configuration"
        )

    try:
        url = f"{config.META_GRAPH_BASE_URL}/{config.META_GRAPH_VERSION}/{waba_id}/message_templates?limit=100"
        headers = {"Authorization": f"Bearer {access_token}"}
        resp = httpx.get(url, headers=headers, timeout=config.HTTP_TIMEOUT_SECONDS)

        if resp.status_code != 200:
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"Meta API error: {resp.text}"
            )

        data = resp.json().get("data", [])
        synced_count = 0

        for item in data:
            name = item.get("name")
            category = item.get("category", "MARKETING")
            language = item.get("language", "en")
            tmpl_status = item.get("status", "APPROVED")

            # Extract header, body, footer from components
            header_text = ""
            body_text = ""
            footer_text = ""
            for comp in item.get("components", []):
                ctype = comp.get("type")
                if ctype == "HEADER":
                    header_text = comp.get("text", "")
                elif ctype == "BODY":
                    body_text = comp.get("text", "")
                elif ctype == "FOOTER":
                    footer_text = comp.get("text", "")

            # Check existing
            existing = db.query(models.Template).filter(
                models.Template.template_name == name,
                models.Template.language == language
            ).first()

            if existing:
                existing.header_text = header_text
                existing.body_text = body_text
                existing.footer_text = footer_text
                existing.category = category
                existing.status = tmpl_status
            else:
                new_tmpl = models.Template(
                    template_name=name,
                    category=category,
                    language=language,
                    header_text=header_text,
                    body_text=body_text,
                    footer_text=footer_text,
                    status=tmpl_status
                )
                db.add(new_tmpl)
            synced_count += 1

        # Prune local templates that no longer exist in Meta's active catalog
        meta_keys = {(item.get("name"), item.get("language", "en")) for item in data}
        db_templates = db.query(models.Template).all()
        pruned_count = 0
        for dbt in db_templates:
            if (dbt.template_name, dbt.language) not in meta_keys:
                db.delete(dbt)
                pruned_count += 1

        # 📊 META TEMPLATE ANALYTICS / READ INSIGHTS SYNC
        # Query Meta Graph API for official template analytics / read counts if available
        meta_insights_synced = 0
        try:
            # Query template_analytics from WABA endpoint (last 30 days)
            now_ts = int(datetime.utcnow().timestamp())
            start_ts = now_ts - (30 * 86400)
            analytics_url = (
                f"{config.META_GRAPH_BASE_URL}/{config.META_GRAPH_VERSION}/{waba_id}"
                f"?fields=template_analytics.start({start_ts}).end({now_ts}).granularity(DAILY)"
            )
            analytics_resp = httpx.get(analytics_url, headers=headers, timeout=config.HTTP_TIMEOUT_SECONDS)
            if analytics_resp.status_code == 200:
                analytics_data = analytics_resp.json().get("template_analytics", {}).get("data", [])
                for t_stat in analytics_data:
                    t_points = t_stat.get("data_points", [])
                    t_read_count = sum(p.get("read", 0) for p in t_points)
                    t_delivered_count = sum(p.get("delivered", 0) for p in t_points)
                    t_id_or_name = t_stat.get("template_id") or t_stat.get("name")
                    if t_read_count > 0:
                        meta_insights_synced += t_read_count
            else:
                logger.info(f"Meta template analytics query info: {analytics_resp.status_code} - {analytics_resp.text[:200]}")
        except Exception as e:
            logger.warning(f"Optional Meta template_analytics fetch skipped: {e}")

        # 🚀 CUSTOMER REPLY TO READ BACKFILL
        # For every customer who sent an inbound reply, ensure their preceding outbound message is marked as READ
        replied_customers = [
            r[0] for r in db.query(models.ChatMessage.customer_phone)
            .filter(models.ChatMessage.sender_type == "CUSTOMER")
            .distinct().all()
        ]
        backfilled_reads = 0
        for phone in replied_customers:
            out_logs = db.query(models.MessageLog).filter(
                models.MessageLog.recipient_phone == phone,
                models.MessageLog.status.in_(["SENT", "SENT_SIMULATED", "DELIVERED"])
            ).all()
            for log in out_logs:
                log.status = "READ"
                backfilled_reads += 1

        db.commit()
        prune_msg = f" (pruned {pruned_count} deleted/unregistered templates)" if pruned_count > 0 else ""
        backfill_msg = f", synced {backfilled_reads} read events from customer replies" if backfilled_reads > 0 else ""
        return {
            "status": "success",
            "message": f"Successfully synced {synced_count} templates from Meta WhatsApp Business Manager{prune_msg}{backfill_msg}.",
            "synced_count": synced_count,
            "pruned_count": pruned_count,
            "backfilled_reads": backfilled_reads,
            "meta_insights_read_count": meta_insights_synced
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing templates from Meta: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/templates")
def list_templates(
    language: Optional[str] = None,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Template)
    if language and language != "ALL":
        query = query.filter(models.Template.language == language)
    return query.order_by(models.Template.template_name.asc()).all()


@app.post("/api/templates", status_code=status.HTTP_201_CREATED)
def create_template(
    payload: schemas.TemplateCreate,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """
    Submits a new WhatsApp template to Meta Graph API and saves it in the database.
    """
    clean_name = payload.template_name.strip().lower().replace(" ", "_")
    meta_result = create_meta_template(
        template_name=clean_name,
        category=payload.category,
        language=payload.language,
        body_text=payload.body_text,
        header_text=payload.header_text,
        footer_text=payload.footer_text
    )

    if "error" in meta_result and meta_result.get("status") == "FAILED":
        raise HTTPException(status_code=400, detail=f"Meta submission error: {meta_result['error']}")

    existing = db.query(models.Template).filter(
        models.Template.template_name == clean_name,
        models.Template.language == payload.language
    ).first()

    status_val = meta_result.get("status", "APPROVED")
    if existing:
        existing.category = payload.category
        existing.body_text = payload.body_text
        existing.header_text = payload.header_text
        existing.footer_text = payload.footer_text
        existing.status = status_val
        if payload.variable_mappings is not None:
            existing.variable_mappings = payload.variable_mappings
        db.commit()
        db.refresh(existing)
        return existing

    new_tmpl = models.Template(
        template_name=clean_name,
        category=payload.category,
        language=payload.language,
        body_text=payload.body_text,
        header_text=payload.header_text,
        footer_text=payload.footer_text,
        status=status_val,
        variable_mappings=payload.variable_mappings or {}
    )
    db.add(new_tmpl)
    db.commit()
    db.refresh(new_tmpl)
    return new_tmpl


@app.delete("/api/templates/{template_id}")
def delete_template(
    template_id: int,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """
    Deletes a WhatsApp template from the database, and attempts to delete it from Meta Graph API if registered.
    """
    tmpl = db.query(models.Template).filter(models.Template.id == template_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    tmpl_name = tmpl.template_name
    waba_id = config.WHATSAPP_BUSINESS_ACCOUNT_ID
    access_token = config.WHATSAPP_API_TOKEN
    meta_deleted = False

    if waba_id and access_token:
        try:
            url = f"{config.META_GRAPH_BASE_URL}/{config.META_GRAPH_VERSION}/{waba_id}/message_templates?name={tmpl_name}"
            headers = {"Authorization": f"Bearer {access_token}"}
            del_resp = httpx.delete(url, headers=headers, timeout=config.HTTP_TIMEOUT_SECONDS)
            if del_resp.status_code == 200:
                meta_deleted = True
            else:
                logger.info(f"Meta template delete response: {del_resp.status_code} - {del_resp.text}")
        except Exception as e:
            logger.warning(f"Could not delete template on Meta API: {e}")

    db.delete(tmpl)
    db.commit()

    meta_note = " (also removed from Meta)" if meta_deleted else ""
    return {
        "status": "success",
        "message": f"Template '{tmpl_name}' was successfully deleted{meta_note}."
    }


@app.patch("/api/templates/{template_id}/mappings")
def update_template_mappings(
    template_id: int,
    payload: schemas.TemplateUpdateMappings,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """
    Update only the variable_mappings for an existing template.
    Allows reconfiguring which contact/cart/coupon field maps to each {{N}} placeholder.
    """
    tmpl = db.query(models.Template).filter(models.Template.id == template_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    tmpl.variable_mappings = payload.variable_mappings or {}
    db.commit()
    db.refresh(tmpl)
    return {"status": "updated", "id": tmpl.id, "variable_mappings": tmpl.variable_mappings}


# ==========================================
# 🏷️ DISCOUNT CODES API
# ==========================================

@app.get("/api/discount-codes", response_model=List[schemas.DiscountCodeResponse])
def list_discount_codes(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(models.DiscountCode).order_by(models.DiscountCode.id.desc()).all()


@app.post("/api/discount-codes", response_model=schemas.DiscountCodeResponse, status_code=status.HTTP_201_CREATED)
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
        is_active=payload.is_active if payload.is_active is not None else True
    )
    db.add(disc)
    db.commit()
    db.refresh(disc)
    return disc


@app.delete("/api/discount-codes/{code_id}")
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
# 🌐 EXTERNAL DATA SOURCES API (LIVE ECOM PULL)
# ==========================================

@app.get("/api/external-data-sources", response_model=List[schemas.ExternalDataSourceResponse])
def list_external_data_sources(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Lists all configured external e-commerce REST API data sources."""
    return db.query(models.ExternalDataSource).order_by(models.ExternalDataSource.id.asc()).all()


@app.post("/api/external-data-sources", response_model=schemas.ExternalDataSourceResponse, status_code=status.HTTP_201_CREATED)
def create_external_data_source(
    payload: schemas.ExternalDataSourceCreate,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """Registers a new external API endpoint for customer data lookup."""
    src = models.ExternalDataSource(
        name=payload.name.strip(),
        endpoint_url=payload.endpoint_url.strip(),
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


@app.patch("/api/external-data-sources/{source_id}", response_model=schemas.ExternalDataSourceResponse)
def update_external_data_source(
    source_id: int,
    payload: schemas.ExternalDataSourceUpdate,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """Updates external data source settings."""
    src = db.query(models.ExternalDataSource).filter(models.ExternalDataSource.id == source_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Data source not found")
    if payload.name is not None:
        src.name = payload.name.strip()
    if payload.endpoint_url is not None:
        src.endpoint_url = payload.endpoint_url.strip()
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


@app.delete("/api/external-data-sources/{source_id}")
def delete_external_data_source(
    source_id: int,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """Deletes an external data source."""
    src = db.query(models.ExternalDataSource).filter(models.ExternalDataSource.id == source_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Data source not found")
    db.delete(src)
    db.commit()
    return {"status": "success", "message": f"External data source '{src.name}' removed."}


@app.post("/api/external-data-sources/{source_id}/test")
def test_external_data_source(
    source_id: int,
    test_phone: Optional[str] = "+919876543210",
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """Tests connection to an external API endpoint with a sample phone number."""
    src = db.query(models.ExternalDataSource).filter(models.ExternalDataSource.id == source_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Data source not found")

    import httpx
    headers = {}
    if src.auth_method == "bearer" and src.api_key:
        headers["Authorization"] = f"Bearer {src.api_key}"
    elif src.api_key:
        headers[src.header_name or "X-CRM-Token"] = src.api_key

    params = {src.lookup_param or "phone": test_phone}
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(src.endpoint_url, params=params, headers=headers)
            return {
                "status_code": resp.status_code,
                "is_success": resp.status_code == 200,
                "response_data": resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text[:500]
            }
    except Exception as err:
        return {
            "status_code": 0,
            "is_success": False,
            "error": str(err)
        }



# ==========================================
# ⚙️ AUTOMATION RULES & SETTINGS API
# ==========================================

@app.get("/api/automation-rules")
def list_automation_rules(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all automation rules. Falls back gracefully if newer columns are missing from DB.
    """
    try:
        # Normal ORM query — works once startup migration has run
        rules = db.query(models.AutomationRule).order_by(models.AutomationRule.id.asc()).all()
        return rules
    except Exception:
        db.rollback()
        # Fallback 1: raw SQL with COALESCE for missing newer columns
        try:
            sql = text("""
                SELECT
                    id, rule_name, rule_type, trigger_condition,
                    COALESCE(threshold_value, 30)         AS threshold_value,
                    template_name, coupon_code,
                    COALESCE(dedup_days, 7)               AS dedup_days,
                    COALESCE(is_active, true)             AS is_active,
                    COALESCE(total_triggered, 0)          AS total_triggered,
                    COALESCE(approval_status, 'IDLE')     AS approval_status,
                    COALESCE(pending_recipients_count, 0) AS pending_recipients_count,
                    created_at
                FROM automation_rules
                ORDER BY id ASC
            """)
            rows = db.execute(sql).mappings().all()
            return [dict(r) for r in rows]
        except Exception:
            db.rollback()
            # Fallback 2: minimal columns only, inject defaults for new ones
            sql2 = text("""
                SELECT id, rule_name, rule_type, trigger_condition,
                    COALESCE(threshold_value, 30) AS threshold_value,
                    template_name, coupon_code,
                    COALESCE(dedup_days, 7) AS dedup_days,
                    COALESCE(is_active, true) AS is_active
                FROM automation_rules ORDER BY id ASC
            """)
            rows2 = db.execute(sql2).mappings().all()
            return [
                {**dict(r), "total_triggered": 0, "approval_status": "IDLE",
                 "pending_recipients_count": 0, "created_at": None}
                for r in rows2
            ]


@app.post("/api/automation-rules", status_code=status.HTTP_201_CREATED)
def create_automation_rule(
    payload: schemas.AutomationRuleCreate,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    rule = models.AutomationRule(
        rule_name=payload.rule_name,
        rule_type=payload.rule_type,
        trigger_condition=payload.trigger_condition,
        threshold_value=payload.threshold_value,
        template_name=payload.template_name,
        coupon_code=payload.coupon_code,
        dedup_days=payload.dedup_days,
        variable_mappings=payload.variable_mappings,
        expires_at=payload.expires_at,
        is_active=payload.is_active
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@app.patch("/api/automation-rules/{rule_id}")
def update_automation_rule(
    rule_id: int,
    payload: schemas.AutomationRuleUpdate,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    if payload.rule_name is not None:
        rule.rule_name = payload.rule_name
    if payload.trigger_condition is not None:
        rule.trigger_condition = payload.trigger_condition
    if payload.template_name is not None:
        rule.template_name = payload.template_name
    if payload.is_active is not None:
        rule.is_active = payload.is_active
    if payload.threshold_value is not None:
        rule.threshold_value = payload.threshold_value
    if payload.coupon_code is not None:
        rule.coupon_code = payload.coupon_code
    if payload.dedup_days is not None:
        rule.dedup_days = payload.dedup_days
    if payload.variable_mappings is not None:
        rule.variable_mappings = payload.variable_mappings
    if payload.expires_at is not None:
        rule.expires_at = payload.expires_at

    db.commit()
    db.refresh(rule)
    return rule


@app.delete("/api/automation-rules/{rule_id}")
def delete_automation_rule(
    rule_id: int,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    db.delete(rule)
    db.commit()
    return {"status": "success", "message": f"Rule '{rule.rule_name}' deleted."}


@app.post("/api/automation-rules/{rule_id}/trigger")
def trigger_specific_automation_rule(
    rule_id: int,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    from scheduler import run_rule_execution
    res = run_rule_execution(rule.id, force_approved=False)
    return res


@app.post("/api/automation-rules/{rule_id}/approve")
def approve_and_dispatch_automation_rule(
    rule_id: int,
    payload: schemas.RuleApproveRequest,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """
    🔐 Step-Up 2FA Authorization to release a high-volume automation (> 100 recipients).
    Requires valid password and 2FA code.
    """
    rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    # Verify password and 2FA
    verify_user_stepup_auth(
        user=current_user,
        password=payload.password,
        two_factor_code=payload.two_factor_code,
        db=db
    )

    from scheduler import run_rule_execution
    res = run_rule_execution(rule.id, force_approved=True)
    return {
        "status": "success",
        "message": f"Automation '{rule.rule_name}' approved with 2FA and dispatched to {res.get('messages_dispatched', 0)} recipients!",
        "messages_dispatched": res.get("messages_dispatched", 0),
        "rule": rule.rule_name
    }


@app.get("/api/settings")
def get_system_settings(
    current_user: models.User = Depends(auth.get_current_user)
):
    return {
        "daily_limit": config.DAILY_MESSAGE_SEND_LIMIT,
        "cart_delay_minutes": 30,
        "active_phone_id": config.WHATSAPP_PHONE_NUMBER_ID or "Not Configured (Simulation Mode)",
        "webhook_endpoint": config.WHATSAPP_WEBHOOK_URL or "/api/webhooks/whatsapp",
        "dnd_keywords": list(OPT_OUT_KEYWORDS)
    }


# =====================================================================
# 🔀 VISUAL FLOWCHART WORKFLOW REST APIS
# =====================================================================

@app.get("/api/workflows", response_model=list[schemas.WorkflowFlowResponse])
def list_workflow_flows(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Lists all visual journey workflows with execution metrics."""
    return db.query(models.WorkflowFlow).order_by(models.WorkflowFlow.id.asc()).all()


@app.post("/api/workflows", response_model=schemas.WorkflowFlowResponse, status_code=status.HTTP_201_CREATED)
def create_workflow_flow(
    payload: schemas.WorkflowFlowCreate,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """Creates a new multi-step visual journey workflow."""
    flow = models.WorkflowFlow(
        name=payload.name,
        description=payload.description,
        trigger_type=payload.trigger_type,
        trigger_config=payload.trigger_config or {},
        nodes=payload.nodes or [],
        edges=payload.edges or [],
        is_active=payload.is_active,
        stats={"entered": 0, "completed": 0, "goals_converted": 0, "revenue_recovered": 0}
    )
    db.add(flow)
    db.commit()
    db.refresh(flow)
    return flow


@app.get("/api/workflows/{flow_id}", response_model=schemas.WorkflowFlowResponse)
def get_workflow_flow(
    flow_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves a single workflow with its complete node and edge graph."""
    flow = db.query(models.WorkflowFlow).filter(models.WorkflowFlow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Workflow flow not found")
    return flow


@app.put("/api/workflows/{flow_id}", response_model=schemas.WorkflowFlowResponse)
def update_workflow_flow(
    flow_id: int,
    payload: schemas.WorkflowFlowUpdate,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """Updates a workflow's details, node positions, connections, and properties."""
    flow = db.query(models.WorkflowFlow).filter(models.WorkflowFlow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Workflow flow not found")

    if payload.name is not None:
        flow.name = payload.name
    if payload.description is not None:
        flow.description = payload.description
    if payload.trigger_type is not None:
        flow.trigger_type = payload.trigger_type
    if payload.trigger_config is not None:
        flow.trigger_config = payload.trigger_config
    if payload.nodes is not None:
        flow.nodes = payload.nodes
    if payload.edges is not None:
        flow.edges = payload.edges
    if payload.is_active is not None:
        flow.is_active = payload.is_active

    flow.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(flow)
    return flow


@app.delete("/api/workflows/{flow_id}")
def delete_workflow_flow(
    flow_id: int,
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    """Deletes a workflow and all associated execution sessions."""
    flow = db.query(models.WorkflowFlow).filter(models.WorkflowFlow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Workflow flow not found")

    # Clean up associated sessions
    db.query(models.WorkflowSession).filter(models.WorkflowSession.flow_id == flow_id).delete()
    db.delete(flow)
    db.commit()
    return {"status": "success", "message": f"Workflow flow #{flow_id} deleted successfully"}


@app.post("/api/workflows/{flow_id}/toggle", response_model=schemas.WorkflowFlowResponse)
def toggle_workflow_status(
    flow_id: int,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """Toggles active/paused state for a workflow journey."""
    flow = db.query(models.WorkflowFlow).filter(models.WorkflowFlow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Workflow flow not found")

    flow.is_active = not flow.is_active
    db.commit()
    db.refresh(flow)
    return flow


@app.get("/api/workflows/{flow_id}/sessions", response_model=list[schemas.WorkflowSessionResponse])
def get_workflow_sessions(
    flow_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the most recent customer sessions traversing this workflow."""
    return (
        db.query(models.WorkflowSession)
        .filter(models.WorkflowSession.flow_id == flow_id)
        .order_by(models.WorkflowSession.id.desc())
        .limit(50)
        .all()
    )


@app.post("/api/workflows/{flow_id}/simulate")
def simulate_workflow_flow(
    flow_id: int,
    payload: schemas.WorkflowSimulateRequest,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """
    Test-runs a workflow flow immediately for a designated phone number.
    Executes initial trigger and actions, recording steps in session history.
    """
    flow = db.query(models.WorkflowFlow).filter(models.WorkflowFlow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Workflow flow not found")

    from scheduler import start_workflow_session, process_workflow_session_step

    sim_token = f"sim_{int(datetime.utcnow().timestamp())}"
    state_data = {
        "cart_token": sim_token,
        "cart_value": payload.test_cart_value or 450.0,
        "customer_name": "Test Patron",
        "items_summary": "Special Vanela Gathiya & Bhavnagari Gathiya",
        "simulation": True,
        "simulated_by": current_user.username
    }

    # Start session
    session = start_workflow_session(
        flow_id=flow.id,
        customer_phone=payload.customer_phone,
        state_data=state_data,
        db=db
    )

    if not session:
        raise HTTPException(status_code=500, detail="Failed to initialize workflow session")

    # If in mock mode, execute one additional step if waiting on delay or message
    if payload.mock_mode and session.status == "WAITING_DELAY":
        session.status = "ACTIVE"
        db.commit()
        process_workflow_session_step(session.id, db=db, mock_send=True)

    db.refresh(session)
    return {
        "status": "success",
        "message": f"Simulation initiated for {payload.customer_phone} in '{flow.name}'",
        "session_id": session.id,
        "current_status": session.status,
        "history": session.history or []
    }


# =====================================================================
# 📊 WHATSAPP ENGAGEMENT & DELIVERY ANALYTICS APIS
# =====================================================================

@app.get("/api/analytics/overview")
def get_analytics_overview(
    time_range: str = Query("30d", enum=["today", "7d", "30d", "all"]),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Computes comprehensive WhatsApp CRM funnel metrics, delivery & read rates,
    click engagement, customer replies, recovered cart revenue, and template breakdown.
    """
    now = datetime.utcnow()
    start_date = None
    if time_range == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif time_range == "7d":
        start_date = now - timedelta(days=7)
    elif time_range == "30d":
        start_date = now - timedelta(days=30)

    # 1. Outbound Message Funnel (MessageLog)
    msg_q = db.query(models.MessageLog)
    if start_date:
        msg_q = msg_q.filter(models.MessageLog.created_at >= start_date)
    logs = msg_q.all()

    # 2. Inbound Customer Replies & Clicks (ChatMessage)
    chat_q = db.query(models.ChatMessage)
    if start_date:
        chat_q = chat_q.filter(models.ChatMessage.created_at >= start_date)
    chats = chat_q.all()

    inbound_replies = [c for c in chats if c.sender_type == "CUSTOMER"]
    total_replied = len(inbound_replies)
    replied_phone_set = {c.customer_phone for c in inbound_replies}

    # 🚀 REPLIES-TO-READ CORRELATION:
    # A customer who replies has conclusively read the message. If the message log is still
    # at 'SENT' or 'DELIVERED' (e.g. because recipient disabled blue ticks in WhatsApp privacy settings),
    # count it as READ so analytics reflect real-world engagement accurately.
    total_sent = sum(1 for m in logs if m.status in ("SENT", "DELIVERED", "READ"))
    total_delivered = sum(1 for m in logs if m.status in ("DELIVERED", "READ") or m.recipient_phone in replied_phone_set)
    total_read = sum(1 for m in logs if m.status == "READ" or m.recipient_phone in replied_phone_set)
    total_failed = sum(1 for m in logs if m.status == "FAILED")

    # Interactive button clicks / CTA taps
    total_clicks = sum(
        1 for c in inbound_replies
        if c.message_type in ("button", "interactive")
        or (c.text and any(k in c.text.lower() for k in ["[button", "clicked", "yes", "order", "view"]))
    )

    # 3. Cart Conversions & Revenue
    cart_q = db.query(models.CartEvent)
    if start_date:
        cart_q = cart_q.filter(models.CartEvent.created_at >= start_date)
    carts = cart_q.all()
    recovered_carts = [c for c in carts if c.status == "RECOVERED"]
    revenue_recovered = sum(c.cart_value or 0.0 for c in recovered_carts)

    # 4. Opt-Outs
    opt_q = db.query(models.OptOut)
    if start_date:
        opt_q = opt_q.filter(models.OptOut.created_at >= start_date)
    total_opt_outs = opt_q.count()

    # 5. Calculated Rates
    delivery_rate = round((total_delivered / total_sent * 100), 1) if total_sent > 0 else 0.0
    read_rate = round((total_read / total_delivered * 100), 1) if total_delivered > 0 else 0.0
    click_rate = round((total_clicks / total_read * 100), 1) if total_read > 0 else 0.0
    reply_rate = round((total_replied / total_delivered * 100), 1) if total_delivered > 0 else 0.0
    opt_out_rate = round((total_opt_outs / max(1, total_sent) * 100), 2) if total_sent > 0 else 0.0

    # 6. Template Performance Breakdown
    tmpl_map = {}
    for m in logs:
        tname = m.template_name or "custom_message"
        if tname not in tmpl_map:
            tmpl_map[tname] = {"sent": 0, "delivered": 0, "read": 0, "failed": 0}
        has_reply = m.recipient_phone in replied_phone_set
        if m.status in ("SENT", "DELIVERED", "READ"):
            tmpl_map[tname]["sent"] += 1
        if m.status in ("DELIVERED", "READ") or has_reply:
            tmpl_map[tname]["delivered"] += 1
        if m.status == "READ" or has_reply:
            tmpl_map[tname]["read"] += 1
        if m.status == "FAILED":
            tmpl_map[tname]["failed"] += 1

    template_performance = []
    for tname, tdata in tmpl_map.items():
        t_del = tdata["delivered"]
        t_read = tdata["read"]
        t_rate = round((t_read / t_del * 100), 1) if t_del > 0 else 0.0
        template_performance.append({
            "template_name": tname,
            "sent": tdata["sent"],
            "delivered": t_del,
            "read": t_read,
            "read_rate": t_rate,
            "failed": tdata["failed"]
        })
    template_performance.sort(key=lambda x: x["sent"], reverse=True)

    # 7. Daily Volume Trend (Last 7 days or 14 days)
    trend_days = 7 if time_range in ("today", "7d") else 14
    daily_trends = []
    for i in range(trend_days - 1, -1, -1):
        day_date = (now - timedelta(days=i)).date()
        day_str = day_date.strftime("%b %d")
        day_logs = [m for m in logs if m.created_at and m.created_at.date() == day_date]
        day_replies = [c for c in inbound_replies if c.created_at and c.created_at.date() == day_date]
        day_replied_phones = {c.customer_phone for c in day_replies}
        daily_trends.append({
            "date": day_str,
            "sent": sum(1 for m in day_logs if m.status in ("SENT", "DELIVERED", "READ")),
            "delivered": sum(1 for m in day_logs if m.status in ("DELIVERED", "READ") or m.recipient_phone in day_replied_phones),
            "read": sum(1 for m in day_logs if m.status == "READ" or m.recipient_phone in day_replied_phones),
            "replied": len(day_replies)
        })

    # 8. Meta Phone Health & Guardrails
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_sent = db.query(models.MessageLog).filter(
        models.MessageLog.created_at >= today_start,
        models.MessageLog.status.in_(("SENT", "DELIVERED", "READ"))
    ).count()

    quality_rating = "HIGH"
    if opt_out_rate > 3.0:
        quality_rating = "LOW"
    elif opt_out_rate > 1.0:
        quality_rating = "MEDIUM"

    return {
        "time_range": time_range,
        "funnel": {
            "total_sent": total_sent,
            "total_delivered": total_delivered,
            "total_read": total_read,
            "total_replied": total_replied,
            "total_clicks": total_clicks,
            "total_failed": total_failed,
            "recovered_carts": len(recovered_carts),
            "revenue_recovered": round(revenue_recovered, 2)
        },
        "rates": {
            "delivery_rate": delivery_rate,
            "read_rate": read_rate,
            "click_rate": click_rate,
            "reply_rate": reply_rate,
            "opt_out_rate": opt_out_rate
        },
        "meta_health": {
            "quality_rating": quality_rating,
            "phone_status": "ONLINE",
            "daily_limit": config.DAILY_MESSAGE_SEND_LIMIT,
            "used_today": today_sent,
            "remaining_today": max(0, config.DAILY_MESSAGE_SEND_LIMIT - today_sent),
            "tier_name": "Tier 1 (1,000 / 24h)"
        },
        "template_performance": template_performance,
        "daily_trends": daily_trends
    }
