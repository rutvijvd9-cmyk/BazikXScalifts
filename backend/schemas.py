from typing import List, Optional
from pydantic import BaseModel, Field


class ContactCreate(BaseModel):
    phone: str = Field(..., description="Customer phone in international format e.g. +919876543210")
    name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=120)


class ContactResponse(BaseModel):
    id: int
    phone: str
    name: Optional[str]
    email: Optional[str]
    total_orders: int
    is_active: bool

    class Config:
        from_attributes = True


class CartEventPayload(BaseModel):
    cart_token: str = Field(..., max_length=100)
    customer_phone: str = Field(..., description="Customer phone number")
    cart_value: float = Field(default=0.0, ge=0)
    items: List[dict] = Field(default_factory=list)


class OptOutRequest(BaseModel):
    phone: str = Field(...)
    reason: Optional[str] = "USER_REQUEST"

class CampaignCreate(BaseModel):
    title: str = Field(..., max_length=150)
    template_name: str = Field(..., max_length=100)
    language: Optional[str] = "en"
    target_filter: Optional[str] = "ALL"  # ALL, INACTIVE_30_DAYS
    custom_phones: Optional[List[str]] = None  # Optional list of explicit phone numbers


class CampaignResponse(BaseModel):
    id: int
    title: str
    template_name: str
    language: str
    target_filter: str
    status: str
    total_recipients: int
    successful_sends: int
    failed_sends: int

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., max_length=120)
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool

    class Config:
        from_attributes = True

class AutomationRuleCreate(BaseModel):
    rule_name: str = Field(..., max_length=100)
    rule_type: str = Field(...) # INACTIVE_DAYS, ORDER_COUNT_VIP, CART_RECOVERY
    trigger_condition: str = Field(...)
    threshold_value: int = Field(default=30, ge=1)
    template_name: str = Field(...)
    coupon_code: Optional[str] = None
    dedup_days: int = Field(default=7, ge=1)
    is_active: bool = True

class AutomationRuleUpdate(BaseModel):
    is_active: Optional[bool] = None
    threshold_value: Optional[int] = None
    coupon_code: Optional[str] = None
    dedup_days: Optional[int] = None
