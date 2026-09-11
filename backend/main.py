import os
import io
import csv
import logging
import hmac
import hashlib
from datetime import datetime
from typing import List, Optional
from dotenv import load_dotenv
import httpx
from pydantic import BaseModel


logger = logging.getLogger("main")
from fastapi import FastAPI, Depends, HTTPException, Header, Request, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
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

load_dotenv()

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
        conn.commit()
except Exception as col_err:
    logger.warning(f"Note on 2FA column sync: {col_err}")

# Rate Limiter setup
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app = FastAPI(
    title=os.getenv("APP_NAME", "WhatsApp CRM — Manubhai Gathiyawala"),
    version="1.0.0"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Enable CORS for local Vite development & Vercel production deployment
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000"
]
if allowed_origins_env:
    allowed_origins.extend([origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "dev_secret")


@app.on_event("startup")
def on_startup():
    start_scheduler()
    # Create or update default admin user from environment variables
    db = next(get_db())
    initial_user = os.getenv("INITIAL_ADMIN_USERNAME", "admin").strip()
    initial_pass = os.getenv("INITIAL_ADMIN_PASSWORD")
    initial_email = os.getenv("INITIAL_ADMIN_EMAIL", "admin@manubhaigathiyawala.com").strip()
    
    if initial_pass:
        admin = db.query(models.User).filter(models.User.username == initial_user).first()
        if not admin:
            # Also check by email to prevent duplicate accounts
            admin = db.query(models.User).filter(models.User.email == initial_email).first()
            
        if admin:
            admin.username = initial_user
            admin.email = initial_email
            admin.hashed_password = auth.get_password_hash(initial_pass)
            admin.is_active = True
            db.commit()
            print(f"🔒 [Security] Initial admin '{initial_user}' credentials synchronized.")
        else:
            default_admin = models.User(
                username=initial_user,
                email=initial_email,
                hashed_password=auth.get_password_hash(initial_pass),
                is_active=True
            )
            db.add(default_admin)
            db.commit()
            print(f"🔒 [Security] Initial admin '{initial_user}' created successfully.")
    db.close()


@app.get("/")
def root():
    return {"message": "WhatsApp CRM is running ✅", "client": "Manubhai Gathiyawala"}


@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"status": "ok", "database": "connected", "scheduler": "running"}


# ==========================================
# 🔐 AUTHENTICATION ENDPOINTS
# ==========================================

@app.post("/api/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register_user(request: Request, payload: schemas.UserCreate, db: Session = Depends(get_db)):
    MAX_USERS = 5
    current_user_count = db.query(models.User).count()
    if current_user_count >= MAX_USERS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User registration limit reached ({MAX_USERS}/{MAX_USERS} users created). No more user accounts can be registered."
        )

    existing = db.query(models.User).filter(
        (models.User.username == payload.username) | (models.User.email == payload.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already registered")

    user = models.User(
        username=payload.username,
        email=payload.email,
        hashed_password=auth.get_password_hash(payload.password),
        is_active=True
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
        
        # If 3 or more failed attempts, trigger security email alert!
        if attempts >= 3:
            try:
                from email_service import send_security_intrusion_alert
                send_security_intrusion_alert(
                    event_type="Brute-Force Login / Unauthorized Access Attempt",
                    ip_address=client_ip,
                    details=f"{attempts} consecutive failed login attempts detected targeting username '{payload.username}'."
                )
            except Exception as mail_err:
                logger.warning(f"Could not dispatch security alert: {mail_err}")

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
        if attempts >= 3:
            try:
                from email_service import send_security_intrusion_alert
                send_security_intrusion_alert(
                    event_type="Invalid 2FA Code / Suspicious Verification Attempt",
                    ip_address=client_ip,
                    details=f"{attempts} consecutive failed 2FA verification attempts for username '{user.username}'."
                )
            except Exception as mail_err:
                logger.warning(f"Could not dispatch 2fa security alert: {mail_err}")

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


@app.post("/api/auth/2fa/send-recovery-email")
@limiter.limit("5/minute")
def send_two_factor_recovery_email(
    request: Request,
    payload: dict,
    db: Session = Depends(get_db)
):
    """
    Dispatches a 6-digit emergency OTP to the user's email address via Gmail SMTP.
    """
    temp_token = payload.get("temp_token")
    if not temp_token:
        raise HTTPException(status_code=400, detail="Missing temp_token")

    username = auth.verify_temp_2fa_token(temp_token)
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="User account not found or deactivated")

    if not user.email:
        raise HTTPException(status_code=400, detail="No email address associated with this user account.")

    # Generate random 6-digit numeric OTP
    import secrets
    recovery_code = f"{secrets.randbelow(900000) + 100000}"
    user.email_recovery_code = recovery_code
    user.email_recovery_code_expires = datetime.utcnow() + timedelta(minutes=10)
    db.commit()

    from email_service import send_2fa_recovery_email
    res = send_2fa_recovery_email(
        recipient_email=user.email,
        username=user.username,
        recovery_code=recovery_code
    )

    masked_email = user.email[:2] + "***@" + user.email.split("@")[-1] if "@" in user.email else "your email"
    return {
        "status": "success",
        "message": f"Emergency 6-digit recovery code sent to {masked_email}",
        "email_preview": masked_email
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
    MAX_USERS = 5
    count = db.query(models.User).count()
    return {
        "current_users": count,
        "max_users": MAX_USERS,
        "can_register": count < MAX_USERS
    }


@app.get("/api/users", response_model=List[schemas.UserResponse])
def list_system_users(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns all registered team users (up to 5 maximum).
    """
    return db.query(models.User).order_by(models.User.id.asc()).all()


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
def register_opt_out(request: Request, payload: schemas.OptOutRequest, db: Session = Depends(get_db)):
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


# --- Campaigns / Broadcast API ---
@app.post("/api/campaigns", response_model=schemas.CampaignResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def create_and_trigger_campaign(
    request: Request,
    payload: schemas.CampaignCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
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
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(models.Campaign).order_by(models.Campaign.created_at.desc()).offset(skip).limit(limit).all()


@app.get("/api/campaigns/{campaign_id}", response_model=schemas.CampaignResponse)
def get_campaign(
    campaign_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


# ==========================================
# 🛡️ WEBHOOK ENDPOINTS (Rate limited & Validated)
# ==========================================

@app.post("/api/webhooks/cart-event", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("60/minute")
def receive_cart_webhook(
    request: Request,
    payload: schemas.CartEventPayload,
    delay_seconds: Optional[int] = 1800,
    db: Session = Depends(get_db)
):
    # Check if user is in opt-out list
    is_opted_out = db.query(models.OptOut).filter(models.OptOut.phone == payload.customer_phone).first()
    if is_opted_out:
        return {"status": "ignored", "reason": "Customer is on Opt-Out / DND list"}

    # Save cart event
    cart_record = models.CartEvent(
        cart_token=payload.cart_token,
        customer_phone=payload.customer_phone,
        cart_value=payload.cart_value,
        items=payload.items,
        status="PENDING"
    )
    db.add(cart_record)
    db.commit()
    db.refresh(cart_record)

    # Schedule the recovery WhatsApp message
    schedule_cart_recovery(cart_event_id=cart_record.id, delay_seconds=delay_seconds)

    return {
        "status": "received",
        "cart_event_id": cart_record.id,
        "scheduled_in_seconds": delay_seconds,
        "message": f"Cart abandonment event recorded. WhatsApp message scheduled in {delay_seconds}s"
    }


@app.post("/api/webhooks/order-completed")
@limiter.limit("60/minute")
def receive_order_completed_webhook(
    request: Request,
    cart_token: str,
    customer_phone: str,
    db: Session = Depends(get_db)
):
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

WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "manubhai_meta_verify_token_123")

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
                        db.commit()
        return {"status": "status_update_acknowledged"}

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

        # Also auto-create contact if not existing yet
        existing_contact = db.query(models.Contact).filter(models.Contact.phone == sender_phone).first()
        if not existing_contact:
            profile_name = value.get("contacts", [{}])[0].get("profile", {}).get("name") or "New WhatsApp Lead"
            new_contact = models.Contact(
                phone=sender_phone,
                name=profile_name,
                total_orders=0,
                tags="Inbound Lead",
                city="WhatsApp"
            )
            db.add(new_contact)

        db.commit()

    return {"status": "message_processed"}


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
    current_user: models.User = Depends(auth.get_current_user),
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
    current_user: models.User = Depends(auth.get_current_user),
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
                    "Valued Customer",
                    "Special Vanela Gathiya",
                    "450",
                    "SAVE10",
                    "Ahmedabad"
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
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Connects to live Meta Graph API using your WABA_ID & ACCESS_TOKEN,
    fetches all approved message templates, and syncs them into your database.
    """
    waba_id = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID")
    access_token = os.getenv("WHATSAPP_API_TOKEN")

    if not waba_id or not access_token:
        raise HTTPException(
            status_code=400,
            detail="Meta WABA ID or Access Token is missing from backend/.env"
        )

    try:
        url = f"https://graph.facebook.com/v19.0/{waba_id}/message_templates?limit=100"
        headers = {"Authorization": f"Bearer {access_token}"}
        resp = httpx.get(url, headers=headers, timeout=10.0)

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

        db.commit()
        return {
            "status": "success",
            "message": f"Successfully synced {synced_count} templates from Meta WhatsApp Business Manager.",
            "synced_count": synced_count
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
    # If database is currently empty but credentials exist, attempt initial auto-sync
    if db.query(models.Template).count() == 0:
        waba_id = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID")
        access_token = os.getenv("WHATSAPP_API_TOKEN")
        if waba_id and access_token:
            try:
                sync_templates_from_meta(current_user=current_user, db=db)
            except Exception as e:
                logger.warning(f"Auto-sync on empty templates failed: {e}")

    query = db.query(models.Template)
    if language and language != "ALL":
        query = query.filter(models.Template.language == language)
    return query.order_by(models.Template.template_name.asc()).all()


@app.post("/api/templates", status_code=status.HTTP_201_CREATED)
def create_template(
    payload: schemas.TemplateCreate,
    current_user: models.User = Depends(auth.get_current_user),
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
        status=status_val
    )
    db.add(new_tmpl)
    db.commit()
    db.refresh(new_tmpl)
    return new_tmpl


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
    current_user: models.User = Depends(auth.get_current_user),
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
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    disc = db.query(models.DiscountCode).filter(models.DiscountCode.id == code_id).first()
    if not disc:
        raise HTTPException(status_code=404, detail="Discount code not found")
    db.delete(disc)
    db.commit()
    return {"status": "success", "message": f"Discount code {disc.code} deleted."}


# ==========================================
# ⚙️ AUTOMATION RULES & SETTINGS API
# ==========================================

@app.get("/api/automation-rules")
def list_automation_rules(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(models.AutomationRule).order_by(models.AutomationRule.id.asc()).all()


@app.post("/api/automation-rules", status_code=status.HTTP_201_CREATED)
def create_automation_rule(
    payload: schemas.AutomationRuleCreate,
    current_user: models.User = Depends(auth.get_current_user),
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
    current_user: models.User = Depends(auth.get_current_user),
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

    db.commit()
    db.refresh(rule)
    return rule


@app.delete("/api/automation-rules/{rule_id}")
def delete_automation_rule(
    rule_id: int,
    current_user: models.User = Depends(auth.get_current_user),
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
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    from scheduler import run_rule_execution
    count = run_rule_execution(rule.id)
    return {"status": "success", "messages_dispatched": count, "rule": rule.rule_name}


@app.get("/api/settings")
def get_system_settings(
    current_user: models.User = Depends(auth.get_current_user)
):
    from email_service import SMTP_USER, ADMIN_ALERT_EMAIL, get_recipient_list
    recipients = get_recipient_list()
    return {
        "daily_limit": int(os.getenv("DAILY_MESSAGE_SEND_LIMIT", "500")),
        "cart_delay_minutes": 30,
        "active_phone_id": os.getenv("WHATSAPP_PHONE_NUMBER_ID", "Not Configured (Simulation Mode)"),
        "webhook_endpoint": "https://api.manubhaigathiyawala.com/api/webhooks/whatsapp",
        "dnd_keywords": ["STOP", "UNSUBSCRIBE", "બંધ કરો", "સંદેશા બંધ કરો", "રોકો", "बंद करो"],
        "smtp_sender": SMTP_USER,
        "admin_alert_emails": recipients,
        "email_alerts_configured": bool(os.getenv("SMTP_PASSWORD")) and len(recipients) > 0
    }


@app.post("/api/admin/test-email")
def send_test_admin_email(
    payload: dict = {},
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Triggers an instant test email to verify Gmail SMTP delivery to all configured ADMIN_ALERT_EMAIL addresses.
    """
    from email_service import send_email_alert, get_recipient_list, SMTP_USER
    target = payload.get("email")
    recipients = [target] if target else get_recipient_list()
    
    if not recipients:
        raise HTTPException(
            status_code=400,
            detail="No alert recipient emails found. Please configure ADMIN_ALERT_EMAIL in Render environment variables."
        )

    now_str = datetime.now().strftime("%d %b %Y, %I:%M %p IST")
    subject = "🧪 [System Test] Manubhai WhatsApp CRM Alert Verification"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; background: #FFFFFF;">
      <div style="background: #111827; padding: 18px 24px; color: white; border-bottom: 3px solid #25D366;">
        <h2 style="margin: 0; font-size: 18px; font-weight: bold;">🧪 Gmail SMTP Verification Successful</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #9CA3AF;">Manubhai Gathiyawala • Alert Pipeline Test</p>
      </div>
      <div style="padding: 24px; color: #1F2937; line-height: 1.6;">
        <p style="margin-top: 0;">This is a test notification confirming that your automated alert system is <strong>operational</strong> and connected to Gmail SMTP.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 13px;">
          <tr style="border-bottom: 1px solid #F3F4F6;">
            <td style="padding: 8px 0; font-weight: bold; color: #4B5563;">Sender Mailbox:</td>
            <td style="padding: 8px 0; font-family: monospace; color: #111827;">{SMTP_USER}</td>
          </tr>
          <tr style="border-bottom: 1px solid #F3F4F6;">
            <td style="padding: 8px 0; font-weight: bold; color: #4B5563;">Configured Recipients:</td>
            <td style="padding: 8px 0; font-family: monospace; color: #25D366; font-weight: bold;">{", ".join(recipients)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #F3F4F6;">
            <td style="padding: 8px 0; font-weight: bold; color: #4B5563;">Triggered By:</td>
            <td style="padding: 8px 0; color: #111827;">{current_user.username} (Admin Portal)</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #4B5563;">Timestamp:</td>
            <td style="padding: 8px 0; color: #111827;">{now_str}</td>
          </tr>
        </table>

        <div style="background: #F0FDF4; padding: 14px; border-radius: 8px; border-left: 4px solid #10B981; margin-top: 20px; font-size: 12px; color: #166534;">
          <strong>Active Monitored Triggers:</strong><br/>
          • 🚨 WhatsApp Delivery Failures (Instant alert with failed phone number)<br/>
          • 🛡️ Server Brute-Force & Security Intrusions<br/>
          • 📊 10-Minute Activity Heartbeat & Summary
        </div>
      </div>
      <div style="background: #F9FAFB; padding: 12px 24px; text-align: center; font-size: 11px; color: #9CA3AF; border-top: 1px solid #F3F4F6;">
        Manubhai Gathiyawala WhatsApp CRM • Powered by Scalifts
      </div>
    </div>
    """

    res = send_email_alert(subject=subject, html_body=html_body, recipients=recipients, priority="high")
    if res.get("status") == "error":
        raise HTTPException(status_code=500, detail=f"SMTP Error: {res.get('error')}")
    if res.get("status") == "skipped":
        raise HTTPException(status_code=400, detail=f"Skipped: {res.get('reason')}")
        
    return {"status": "success", "message": f"Test email dispatched to {recipients}", "details": res}

