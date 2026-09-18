"""
Rate Limiter Module
Shared slowapi Limiter instance for backend routers and application.
"""
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
