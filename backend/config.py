import os
import logging
import warnings
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("config")

# ── Environment & Application Settings ──
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
APP_NAME = os.getenv("APP_NAME", "WhatsApp CRM")
BRAND_NAME = os.getenv("BRAND_NAME", "Manubhai Gathiyawala")
DEFAULT_LOCALE = os.getenv("DEFAULT_LOCALE", "en")
TIMEZONE = os.getenv("TIMEZONE", "Asia/Kolkata")
ALLOWED_ORIGINS_RAW = os.getenv("ALLOWED_ORIGINS", "")

# ── Security & Authentication ──
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if ENVIRONMENT == "production":
        raise RuntimeError("FATAL: SECRET_KEY environment variable is mandatory in production!")
    warnings.warn(
        "SECRET_KEY is not set in environment. Falling back to an ephemeral dev key. "
        "Set SECRET_KEY in your .env or host dashboard for production."
    )
    SECRET_KEY = "dev_secret_key_change_in_production_environment"

ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))

# Webhook secret for HMAC / API Key verification of external e-commerce requests
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")

META_APP_SECRET = os.getenv("META_APP_SECRET", "")

# Meta Inbound Webhook Verify Token
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "")

# ── Business Logic Limits & Constants ──
# Subscription / Multi-tenant user limit (e.g. maximum 5 team members)
MAX_USERS_LIMIT = int(os.getenv("MAX_USERS_LIMIT", "5"))

# Daily guardrail on maximum outbound WhatsApp message sends (fixed to 200 per day)
DAILY_MESSAGE_SEND_LIMIT = 200

# Default promo coupon code and discount terms
DEFAULT_COUPON_CODE = os.getenv("DEFAULT_COUPON_CODE", "WELCOME")
DEFAULT_DISCOUNT_PERCENT = int(os.getenv("DEFAULT_DISCOUNT_PERCENT", "10"))
DEFAULT_EXPIRY_DAYS = int(os.getenv("DEFAULT_EXPIRY_DAYS", "30"))

# External HTTP client timeout (in seconds)
HTTP_TIMEOUT_SECONDS = float(os.getenv("HTTP_TIMEOUT_SECONDS", "15.0"))
SCHEDULER_ENABLED = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"

# ── Database Connection ──
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/whatsapp_crm"
)

# ── Meta WhatsApp Cloud API ──
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_BUSINESS_ACCOUNT_ID = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
WHATSAPP_API_TOKEN = os.getenv("WHATSAPP_API_TOKEN", "")
WHATSAPP_WEBHOOK_URL = os.getenv("WHATSAPP_WEBHOOK_URL", "")

META_GRAPH_BASE_URL = os.getenv("META_GRAPH_BASE_URL", "https://graph.facebook.com").rstrip("/")
META_GRAPH_VERSION = os.getenv("META_GRAPH_VERSION", "v19.0")

# ── Store Integration & Feeds ──
MANUBHAI_STORE_INACTIVE_FEED_URL = os.getenv("MANUBHAI_STORE_INACTIVE_FEED_URL", "")
STORE_SUPPORT_PHONE = os.getenv("STORE_SUPPORT_PHONE", "")
STORE_LOCATION = os.getenv("STORE_LOCATION", "")

# ── Initial Admin & Service Account Credentials ──
INITIAL_ADMIN_USERNAME = os.getenv("INITIAL_ADMIN_USERNAME", "admin").strip()
INITIAL_ADMIN_PASSWORD = os.getenv("INITIAL_ADMIN_PASSWORD")
INITIAL_ADMIN_EMAIL = os.getenv("INITIAL_ADMIN_EMAIL", "admin@manubhaigathiyawala.com").strip()

ECOM_SERVICE_USERNAME = os.getenv("ECOM_SERVICE_USERNAME", "ecom_service").strip()
ECOM_SERVICE_PASSWORD = os.getenv("ECOM_SERVICE_PASSWORD")
ECOM_SERVICE_EMAIL = os.getenv("ECOM_SERVICE_EMAIL", "ecommerce@manubhaigathiyawala.com").strip()

# ── Integration Gateway & Secret Storage ──
INTEGRATION_ALLOWED_HOSTS_RAW = os.getenv("INTEGRATION_ALLOWED_HOSTS", "")
INTEGRATION_ALLOWED_HOSTS = [
    h.strip().lower() for h in INTEGRATION_ALLOWED_HOSTS_RAW.split(",") if h.strip()
]

APP_ENCRYPTION_KEY = os.getenv("APP_ENCRYPTION_KEY")
if not APP_ENCRYPTION_KEY:
    if ENVIRONMENT == "production":
        raise RuntimeError("FATAL: APP_ENCRYPTION_KEY environment variable is mandatory in production!")
    APP_ENCRYPTION_KEY = SECRET_KEY  # Ephemeral development fallback

if ENVIRONMENT == "production":
    required_secrets = {
        "WEBHOOK_SECRET": WEBHOOK_SECRET,
        "WHATSAPP_VERIFY_TOKEN": WHATSAPP_VERIFY_TOKEN,
        "META_APP_SECRET": META_APP_SECRET,
        "APP_ENCRYPTION_KEY": APP_ENCRYPTION_KEY,
    }
    missing_secrets = [name for name, value in required_secrets.items() if not value]
    if missing_secrets:
        raise RuntimeError(f"FATAL: Missing required production secrets: {', '.join(missing_secrets)}")
    if not INTEGRATION_ALLOWED_HOSTS:
        raise RuntimeError("FATAL: INTEGRATION_ALLOWED_HOSTS environment variable is mandatory in production!")
