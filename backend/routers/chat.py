import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from database import get_db
import models
import schemas
import auth
from whatsapp_service import send_whatsapp_free_text

logger = logging.getLogger("chat_router")

router = APIRouter(prefix="/api/chat", tags=["Two-Way Live Chat"])


@router.get("/conversations", response_model=List[schemas.ChatConversationSummary])
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


@router.get("/messages/{phone}", response_model=List[schemas.ChatMessageResponse])
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


@router.post("/send", response_model=schemas.ChatMessageResponse)
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
        sender_user=current_user.username,
        status=status_str,
        meta_message_id=msg_id
    )
    db.add(log_entry)
    db.commit()
    db.refresh(chat_entry)

    return chat_entry
