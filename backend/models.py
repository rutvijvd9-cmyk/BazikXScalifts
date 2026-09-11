from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON
from database import Base


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=True)
    email = Column(String(120), nullable=True)
    total_orders = Column(Integer, default=0)
    last_order_date = Column(DateTime, nullable=True)
    city = Column(String(100), nullable=True)
    tags = Column(String(255), nullable=True)  # Comma-separated tags e.g. "VIP, wholesale, regular"
    birth_day = Column(Integer, nullable=True)  # 1-31
    birth_month = Column(Integer, nullable=True)  # 1-12
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DiscountCode(Base):
    __tablename__ = "discount_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    discount_type = Column(String(20), default="PERCENT")  # PERCENT or FLAT
    discount_value = Column(Float, nullable=False)          # e.g. 15.0 (%) or 100.0 (₹)
    min_order_value = Column(Float, default=0.0)
    max_uses = Column(Integer, default=1000)
    used_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CartEvent(Base):
    __tablename__ = "cart_events"

    id = Column(Integer, primary_key=True, index=True)
    cart_token = Column(String(100), index=True, nullable=False)
    customer_phone = Column(String(20), index=True, nullable=False)
    cart_value = Column(Float, default=0.0)
    items = Column(JSON, default=list)
    status = Column(String(50), default="PENDING")  # PENDING, RECOVERED, EXPIRED
    message_sent = Column(Boolean, default=False)
    message_sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class OptOut(Base):
    __tablename__ = "opt_outs"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(20), unique=True, index=True, nullable=False)
    reason = Column(String(255), default="USER_REQUEST")  # e.g., 'STOP' reply
    created_at = Column(DateTime, default=datetime.utcnow)


class MessageLog(Base):
    __tablename__ = "message_logs"

    id = Column(Integer, primary_key=True, index=True)
    recipient_phone = Column(String(20), index=True, nullable=False)
    template_name = Column(String(100), nullable=False)
    language = Column(String(10), default="en")
    status = Column(String(50), default="QUEUED")  # QUEUED, SENT, DELIVERED, READ, FAILED
    meta_message_id = Column(String(100), nullable=True, index=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    template_name = Column(String(100), nullable=False)
    language = Column(String(10), default="en")
    target_filter = Column(String(50), default="ALL")  # ALL, INACTIVE_30_DAYS, HIGH_VALUE
    status = Column(String(50), default="DRAFT")       # DRAFT, SCHEDULED, IN_PROGRESS, COMPLETED, FAILED
    total_recipients = Column(Integer, default=0)
    successful_sends = Column(Integer, default=0)
    failed_sends = Column(Integer, default=0)
    scheduled_for = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_2fa_enabled = Column(Boolean, default=False)
    totp_secret = Column(String(64), nullable=True)
    email_recovery_code = Column(String(10), nullable=True)
    email_recovery_code_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    template_name = Column(String(100), index=True, nullable=False)
    category = Column(String(50), default="MARKETING")  # MARKETING or UTILITY
    language = Column(String(10), default="en")        # en, gu, hi
    header_text = Column(String(150), nullable=True)
    body_text = Column(Text, nullable=False)
    footer_text = Column(String(100), nullable=True)
    status = Column(String(50), default="APPROVED")     # APPROVED, PENDING, REJECTED
    created_at = Column(DateTime, default=datetime.utcnow)

class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String(100), nullable=False)
    rule_type = Column(String(50), nullable=False) # INACTIVE_DAYS, ORDER_COUNT_VIP, CART_RECOVERY
    trigger_condition = Column(String(100), nullable=False) # e.g. "days > 15", "orders >= 2", "cart_delay = 30m"
    threshold_value = Column(Integer, default=30)
    template_name = Column(String(100), nullable=False)
    coupon_code = Column(String(50), nullable=True)
    dedup_days = Column(Integer, default=7)
    is_active = Column(Boolean, default=True)
    total_triggered = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    customer_phone = Column(String(20), index=True, nullable=False)
    sender_type = Column(String(20), default="CUSTOMER")  # "CUSTOMER" (inbound) or "AGENT" (outbound)
    message_type = Column(String(20), default="text")      # text, template, image, document
    text = Column(Text, nullable=True)
    meta_message_id = Column(String(100), nullable=True, index=True)
    status = Column(String(30), default="DELIVERED")      # RECEIVED, SENT, DELIVERED, READ, FAILED
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

