"""
Contacts Router
Handles contact listing, creation, updates, deletion, and CSV import.
"""

import csv
import io
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import get_db

logger = logging.getLogger("contacts_router")

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.post("", response_model=schemas.ContactResponse, status_code=status.HTTP_201_CREATED)
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


@router.put("/{contact_id}", response_model=schemas.ContactResponse)
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


@router.delete("/{contact_id}")
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


@router.get("", response_model=List[schemas.ContactResponse])
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


@router.post("/import-csv")
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
