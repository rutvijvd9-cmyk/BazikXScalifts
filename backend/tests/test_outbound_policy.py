import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
import models
from services.policy_service import (
    authorize_outbound_message,
    record_consent,
    revoke_consent,
    has_active_consent,
    is_quiet_hours,
)

# In-memory SQLite for testing policy logic
@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_deny_by_default_campaign_without_active_consent(db):
    """
    CRITICAL (B-4): A recipient without active affirmative consent MUST be denied
    for promotional campaigns, even if a contact record exists in the DB.
    """
    phone = "+919876543210"
    # Contact exists, but NO consent record
    contact = models.Contact(phone=phone, name="Test Customer")
    db.add(contact)
    db.commit()

    is_auth, reason = authorize_outbound_message(
        db=db,
        recipient_phone=phone,
        message_type="template",
        template_name="festive_promo",
        campaign_id=1,
        enforce_quiet_hours=False
    )
    assert is_auth is False
    assert "No active marketing consent" in reason


def test_allow_campaign_with_active_consent(db):
    phone = "+919876543210"
    contact = models.Contact(phone=phone, name="Consented Customer")
    db.add(contact)
    record_consent(db, phone, source="store_checkout")
    db.commit()

    is_auth, reason = authorize_outbound_message(
        db=db,
        recipient_phone=phone,
        message_type="template",
        template_name="festive_promo",
        campaign_id=1,
        enforce_quiet_hours=False
    )
    assert is_auth is True
    assert reason == "Authorized"


def test_dnd_opt_out_blocks_all_messages(db):
    phone = "+919876543210"
    record_consent(db, phone, source="store_checkout")
    revoke_consent(db, phone, reason="INBOUND_STOP_COMMAND")
    db.commit()

    is_auth, reason = authorize_outbound_message(
        db=db,
        recipient_phone=phone,
        message_type="template",
        template_name="order_confirmation",
        enforce_quiet_hours=False
    )
    assert is_auth is False
    assert "opted out" in reason.lower() or "revoked" in reason.lower()


def test_quiet_hours_blocks_promotional_during_night(db):
    phone = "+919876543210"
    record_consent(db, phone, source="store_checkout")
    db.commit()

    # 17:00 UTC = 22:30 IST (Quiet hours: 21:00 - 09:00 IST)
    night_utc = datetime(2026, 9, 20, 17, 0, 0)
    assert is_quiet_hours(night_utc) is True

    # 06:00 UTC = 11:30 IST (Daytime)
    day_utc = datetime(2026, 9, 20, 6, 0, 0)
    assert is_quiet_hours(day_utc) is False
