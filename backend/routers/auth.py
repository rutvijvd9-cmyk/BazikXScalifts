"""
Auth & User Management Router
Handles user registration, login, 2FA setup/enable/disable/verify, profile me,
registration status, and administrative user CRUD operations.
"""

import base64
import io
import logging
import secrets
from datetime import datetime
from typing import List, Optional

import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

import auth
import config
import models
import schemas
from database import get_db
from rate_limiter import limiter

logger = logging.getLogger("auth_router")

router = APIRouter(tags=["auth"])

FAILED_LOGIN_ATTEMPTS = {}


@router.post("/api/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register_user(
    request: Request,
    payload: schemas.UserCreate,
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    max_users = config.MAX_USERS_LIMIT
    current_user_count = db.query(models.User).count()
    if current_user_count >= max_users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User registration limit reached ({max_users}/{max_users} users created). No more user accounts can be registered."
        )

    existing = db.query(models.User).filter(
        (models.User.username == payload.username) | (models.User.email == payload.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already registered")

    user = models.User(
        username=payload.username.strip(),
        email=payload.email.strip().lower(),
        hashed_password=auth.get_password_hash(payload.password),
        is_active=True,
        role="agent"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/api/auth/login", response_model=schemas.Token)
@limiter.limit("10/minute")
def login(request: Request, payload: schemas.UserLogin, db: Session = Depends(get_db)):
    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if not user or not auth.verify_password(payload.password, user.hashed_password):
        attempts = FAILED_LOGIN_ATTEMPTS.get(client_ip, 0) + 1
        FAILED_LOGIN_ATTEMPTS[client_ip] = attempts

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    FAILED_LOGIN_ATTEMPTS.pop(client_ip, None)

    if user.is_2fa_enabled:
        temp_token = auth.create_temp_2fa_token(user.username)
        return {
            "access_token": "",
            "token_type": "bearer",
            "username": user.username,
            "requires_2fa": True,
            "temp_token": temp_token
        }

    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer", "username": user.username, "requires_2fa": False}


@router.post("/api/auth/2fa/verify", response_model=schemas.Token)
@limiter.limit("10/minute")
def verify_two_factor_code(
    request: Request,
    payload: schemas.TwoFactorVerifyRequest,
    db: Session = Depends(get_db)
):
    """
    Verifies a 6-digit TOTP Google Authenticator code OR an emergency email recovery code.
    Issues the full 24-hour access token upon success.
    """
    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
    
    if not payload.temp_token:
        raise HTTPException(status_code=400, detail="Missing 2FA temporary session token")
    
    username = auth.verify_temp_2fa_token(payload.temp_token)
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or deactivated")

    code = payload.code.strip().replace(" ", "")
    verified = False

    if user.totp_secret:
        try:
            totp = pyotp.TOTP(user.totp_secret)
            if totp.verify(code, valid_window=1):
                verified = True
        except Exception as e:
            logger.warning(f"Error in TOTP verification: {e}")

    if not verified and user.email_recovery_code and user.email_recovery_code_expires:
        if datetime.utcnow() <= user.email_recovery_code_expires and user.email_recovery_code == code:
            verified = True
            user.email_recovery_code = None
            user.email_recovery_code_expires = None
            db.commit()

    if not verified:
        attempts = FAILED_LOGIN_ATTEMPTS.get(f"2fa_{client_ip}", 0) + 1
        FAILED_LOGIN_ATTEMPTS[f"2fa_{client_ip}"] = attempts
        raise HTTPException(status_code=400, detail="Invalid 2FA code or expired recovery code")

    FAILED_LOGIN_ATTEMPTS.pop(f"2fa_{client_ip}", None)

    access_token = auth.create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username,
        "requires_2fa": False
    }


@router.get("/api/auth/2fa/setup", response_model=schemas.TwoFactorSetupResponse)
def setup_two_factor_auth(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    new_secret = pyotp.random_base32()
    current_user.totp_secret = new_secret
    db.commit()

    issuer = "Manubhai Gathiyawala"
    otpauth_url = pyotp.totp.TOTP(new_secret).provisioning_uri(
        name=current_user.username,
        issuer_name=issuer
    )

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=3,
    )
    qr.add_data(otpauth_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#111827", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    qr_data_uri = f"data:image/png;base64,{qr_b64}"

    return {
        "secret": new_secret,
        "otpauth_url": otpauth_url,
        "qr_code_base64": qr_data_uri
    }


@router.post("/api/auth/2fa/enable")
def enable_two_factor_auth(
    payload: schemas.TwoFactorVerifyRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA setup not initiated. Please request /api/auth/2fa/setup first.")

    totp = pyotp.TOTP(current_user.totp_secret)
    code = payload.code.strip().replace(" ", "")
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid 6-digit verification code. Please check Google Authenticator time and try again.")

    current_user.is_2fa_enabled = True
    db.commit()

    return {
        "status": "success",
        "message": "Two-Factor Authentication (2FA) successfully activated for your account!"
    }


@router.post("/api/auth/2fa/disable")
def disable_two_factor_auth(
    payload: schemas.TwoFactorDisableRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if not auth.verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password. Cannot disable 2FA.")

    current_user.is_2fa_enabled = False
    current_user.totp_secret = None
    current_user.email_recovery_code = None
    current_user.email_recovery_code_expires = None
    db.commit()

    return {
        "status": "success",
        "message": "Two-Factor Authentication (2FA) has been disabled for your account."
    }


@router.get("/api/auth/me", response_model=schemas.UserResponse)
def get_current_user_profile(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


@router.get("/api/auth/registration-status")
def get_registration_status(db: Session = Depends(get_db)):
    max_users = config.MAX_USERS_LIMIT
    count = db.query(models.User).count()
    return {
        "current_users": count,
        "max_users": max_users,
        "can_register": count < max_users
    }


@router.get("/api/users", response_model=List[schemas.UserResponse])
def list_system_users(
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    return db.query(models.User).order_by(models.User.id.asc()).all()


@router.post("/api/users", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def create_system_user(
    payload: schemas.UserCreate,
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    max_users = config.MAX_USERS_LIMIT
    current_user_count = db.query(models.User).count()
    if current_user_count >= max_users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User limit reached ({max_users}/{max_users} users created). Cannot register more accounts."
        )

    existing = db.query(models.User).filter(
        (models.User.username == payload.username) | (models.User.email == payload.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already registered")

    user = models.User(
        username=payload.username.strip(),
        email=payload.email.strip().lower(),
        hashed_password=auth.get_password_hash(payload.password),
        is_active=True,
        role=payload.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/api/users/{user_id}/role", response_model=schemas.UserResponse)
def update_user_role(
    user_id: int,
    payload: schemas.UserRoleUpdate,
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User account not found")

    if target_user.id == current_user.id and payload.role != "admin":
        admin_count = db.query(models.User).filter(models.User.role == "admin", models.User.is_active == True).count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot demote yourself: system requires at least one active Admin."
            )

    target_user.role = payload.role
    db.commit()
    db.refresh(target_user)
    return target_user


@router.put("/api/users/{user_id}/password")
def admin_reset_user_password(
    user_id: int,
    payload: schemas.AdminUserPasswordReset,
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User account not found")

    target_user.hashed_password = auth.get_password_hash(payload.new_password)
    db.commit()
    return {
        "status": "success",
        "message": f"Password for {target_user.username} has been successfully updated by Admin."
    }


@router.put("/api/users/{user_id}/2fa")
def admin_toggle_user_2fa(
    user_id: int,
    payload: schemas.AdminToggle2FARequest,
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User account not found")

    target_user.is_2fa_enabled = payload.enabled
    if not payload.enabled:
        target_user.totp_secret = None
        target_user.email_recovery_code = None
        target_user.email_recovery_code_expires = None

    db.commit()
    action = "enabled" if payload.enabled else "disabled"
    return {
        "status": "success",
        "message": f"2FA has been {action} for {target_user.username}.",
        "is_2fa_enabled": target_user.is_2fa_enabled
    }


@router.delete("/api/users/{user_id}")
def delete_user_account(
    user_id: int,
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User account not found")

    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own admin account. Please ask another administrator if you wish to remove your account."
        )

    if target_user.role == "admin":
        raise HTTPException(
            status_code=400,
            detail=f"Security Policy: Admins cannot delete other Admin accounts ({target_user.username}). To delete, demote them to a Team Member first."
        )

    target_username = target_user.username
    db.delete(target_user)
    db.commit()

    return {
        "status": "success",
        "message": f"User account '{target_username}' was deleted successfully."
    }


# ============================================================================
# Permanent API Token Management (E-Commerce Webhooks & External Systems)
# ============================================================================

@router.get("/api/auth/api-token")
def get_current_user_api_token(
    current_user: models.User = Depends(auth.get_current_user)
):
    """Retrieve the current user's non-expiring API token."""
    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "api_token": current_user.api_token,
        "api_token_created_at": current_user.api_token_created_at
    }


@router.post("/api/auth/api-token")
def generate_current_user_api_token(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate or regenerate a permanent, non-expiring API token.
    Generating a new token automatically invalidates and deletes the old token.
    """
    new_token = f"mb_live_{secrets.token_urlsafe(32)}"
    current_user.api_token = new_token
    current_user.api_token_created_at = datetime.utcnow()
    db.commit()

    logger.info(f"Generated new non-expiring API token for user '{current_user.username}'. Old token invalidated.")
    return {
        "status": "success",
        "message": "Permanent API token generated successfully. Any previous token has been invalidated.",
        "user_id": current_user.id,
        "username": current_user.username,
        "api_token": new_token,
        "api_token_created_at": current_user.api_token_created_at
    }


@router.delete("/api/auth/api-token")
def revoke_current_user_api_token(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke/delete the current user's API token."""
    current_user.api_token = None
    current_user.api_token_created_at = None
    db.commit()

    logger.info(f"Revoked API token for user '{current_user.username}'.")
    return {
        "status": "success",
        "message": "API token has been revoked."
    }


@router.post("/api/users/{user_id}/api-token")
def generate_user_api_token_by_admin(
    user_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Admin (or user themselves) can generate/regenerate a permanent API token for target user."""
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Admin permissions required to generate API tokens for other users.")

    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User account not found")

    new_token = f"mb_live_{secrets.token_urlsafe(32)}"
    target_user.api_token = new_token
    target_user.api_token_created_at = datetime.utcnow()
    db.commit()

    logger.info(f"API token generated for user '{target_user.username}' by '{current_user.username}'. Old token invalidated.")
    return {
        "status": "success",
        "message": f"Permanent API token generated for '{target_user.username}'. Any previous token has been invalidated.",
        "user_id": target_user.id,
        "username": target_user.username,
        "api_token": new_token,
        "api_token_created_at": target_user.api_token_created_at
    }


@router.delete("/api/users/{user_id}/api-token")
def revoke_user_api_token_by_admin(
    user_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Admin (or user themselves) can revoke the permanent API token for target user."""
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Admin permissions required to revoke API tokens.")

    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User account not found")

    target_user.api_token = None
    target_user.api_token_created_at = None
    db.commit()

    logger.info(f"API token revoked for user '{target_user.username}' by '{current_user.username}'.")
    return {
        "status": "success",
        "message": f"API token for '{target_user.username}' was revoked."
    }

