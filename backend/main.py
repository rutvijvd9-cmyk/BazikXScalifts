import os
import io
import csv
import logging
import hmac
import hashlib
from datetime import datetime
from typing import List, Optional
from dotenv import load_dotenv

logger = logging.getLogger("main")
from fastapi import FastAPI, Depends, HTTPException, Header, Request, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
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

# Rate Limiter setup
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app = FastAPI(
    title=os.getenv("APP_NAME", "WhatsApp CRM — Manubhai Gathiyawala"),
    version="1.0.0"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Enable CORS for local Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "dev_secret")


@app.on_event("startup")
def on_startup():
    start_scheduler()
    # Create default admin user if none exists
    db = next(get_db())
    initial_user = os.getenv("INITIAL_ADMIN_USERNAME", "admin")
    initial_pass = os.getenv("INITIAL_ADMIN_PASSWORD")
    initial_email = os.getenv("INITIAL_ADMIN_EMAIL", "admin@manubhaigathiyawala.com")
    
    admin = db.query(models.User).filter(models.User.username == initial_user).first()
    if not admin and initial_pass:
        default_admin = models.User(
            username=initial_user,
            email=initial_email,
            hashed_password=auth.get_password_hash(initial_pass),
            is_active=True
        )
        db.add(default_admin)
        db.commit()
    db.close()


@app.get("/")
def root():
    return {"message": "WhatsApp CRM is running ✅", "client": "Manubhai Gathiyawala"}


@app.get("/health")
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


@app.post("/api/auth/login", response_model=schemas.Token)
@limiter.limit("10/minute")
def login(request: Request, payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if not user or not auth.verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is deactivated")

    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer", "username": user.username}


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
        birth_day=payload.birth_day,
        birth_month=payload.birth_month
    )
    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)
    return new_contact


@app.get("/api/contacts", response_model=List[schemas.ContactResponse])
def list_contacts(
    search: Optional[str] = None,
    tag: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
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

    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    imported_count = 0
    updated_count = 0

    for row in reader:
        # Normalize header keys to lowercase
        norm_row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
        raw_phone = norm_row.get("phone") or norm_row.get("mobile") or norm_row.get("contact")
        if not raw_phone:
            continue

        phone = raw_phone.strip()
        if not phone.startswith("+"):
            phone = "+" + phone

        name = norm_row.get("name") or norm_row.get("full_name")
        email = norm_row.get("email")
        city = norm_row.get("city")
        tags = norm_row.get("tags")
        orders_str = norm_row.get("total_orders") or norm_row.get("orders") or "0"
        try:
            total_orders = int(orders_str)
        except ValueError:
            total_orders = 0

        existing = db.query(models.Contact).filter(models.Contact.phone == phone).first()
        if existing:
            if name:
                existing.name = name
            if email:
                existing.email = email
            if city:
                existing.city = city
            if tags:
                existing.tags = tags
            if total_orders > 0:
                existing.total_orders = total_orders
            updated_count += 1
        else:
            contact = models.Contact(
                phone=phone,
                name=name,
                email=email,
                city=city,
                tags=tags,
                total_orders=total_orders
            )
            db.add(contact)
            imported_count += 1

    db.commit()
    return {
        "status": "success",
        "imported": imported_count,
        "updated": updated_count,
        "message": f"Successfully processed CSV: {imported_count} new contacts added, {updated_count} existing updated."
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
    If the customer types 'STOP', 'બંધ કરો', or 'रोको',
    they are automatically added to the opt_outs DND table.
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
        return {"status": "status_update_acknowledged"}

    for msg in messages:
        sender_phone = "+" + msg.get("from", "").strip("+")
        msg_type = msg.get("type", "")
        body_text = ""

        if msg_type == "text":
            body_text = msg.get("text", {}).get("body", "").strip().lower()

        # Check for opt-out keywords
        is_opt_out = any(keyword in body_text for keyword in OPT_OUT_KEYWORDS)

        if is_opt_out:
            existing_opt = db.query(models.OptOut).filter(models.OptOut.phone == sender_phone).first()
            if not existing_opt:
                opt_record = models.OptOut(phone=sender_phone, reason=f"INBOUND_REPLY: {body_text}")
                db.add(opt_record)
                db.commit()
                print(f"🛑 [AUTO-DND] Customer {sender_phone} texted '{body_text}'. Added to Opt-Out DND list immediately.")
            return {
                "status": "opted_out",
                "phone": sender_phone,
                "action": "Customer unsubscribed successfully"
            }

    return {"status": "message_processed"}

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
    return {
        "daily_limit": int(os.getenv("DAILY_MESSAGE_SEND_LIMIT", "500")),
        "cart_delay_minutes": 30,
        "active_phone_id": os.getenv("WHATSAPP_PHONE_NUMBER_ID", "Not Configured (Simulation Mode)"),
        "webhook_endpoint": "https://api.manubhaigathiyawala.com/api/webhooks/whatsapp",
        "dnd_keywords": ["STOP", "UNSUBSCRIBE", "બંધ કરો", "સંદેશા બંધ કરો", "રોકો", "बंद करो"]
    }
