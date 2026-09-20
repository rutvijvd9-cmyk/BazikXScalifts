import pytest
from services.phone_service import normalize_phone, is_valid_phone, InvalidPhoneNumberError


def test_normalize_phone_indian_variants():
    # 10 digits
    assert normalize_phone("9876543210") == "+919876543210"
    # Leading 0
    assert normalize_phone("09876543210") == "+919876543210"
    # 91 prefix without plus
    assert normalize_phone("919876543210") == "+919876543210"
    # Formatted with spaces and hyphens
    assert normalize_phone("+91 98765-43210") == "+919876543210"
    assert normalize_phone("+91 98765 43210") == "+919876543210"
    assert normalize_phone("+919876543210") == "+919876543210"


def test_normalize_phone_international():
    # US number
    assert normalize_phone("+1 415 555 2671") == "+14155552671"
    # UK number
    assert normalize_phone("+44 7911 123456") == "+447911123456"


def test_normalize_phone_invalid_and_impossible():
    with pytest.raises(InvalidPhoneNumberError):
        normalize_phone("")

    with pytest.raises(InvalidPhoneNumberError):
        normalize_phone("   ")

    with pytest.raises(InvalidPhoneNumberError):
        normalize_phone("123")

    with pytest.raises(InvalidPhoneNumberError):
        normalize_phone("abcdefghij")

    with pytest.raises(InvalidPhoneNumberError):
        normalize_phone("+10000000000")  # Impossible country / number


def test_is_valid_phone():
    assert is_valid_phone("9876543210") is True
    assert is_valid_phone("+919876543210") is True
    assert is_valid_phone("12345") is False
    assert is_valid_phone("invalid") is False
