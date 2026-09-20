# Package marker for backend.services
from services.phone_service import normalize_phone, is_valid_phone, InvalidPhoneNumberError
from services.policy_service import (
    authorize_outbound_message,
    record_consent,
    revoke_consent,
    has_active_consent,
    is_quiet_hours,
    FIXED_DAILY_LIMIT
)
