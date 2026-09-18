import os
from datetime import datetime, timedelta
from typing import Callable, Optional
from dotenv import load_dotenv
import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
import models

import config

SECRET_KEY = config.SECRET_KEY
ALGORITHM = config.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = config.ACCESS_TOKEN_EXPIRE_MINUTES

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_temp_2fa_token(username: str) -> str:
    """
    Creates a temporary 5-minute token used exclusively for the 2FA verification step.
    Cannot be used to access regular protected endpoints.
    """
    to_encode = {
        "sub": username,
        "type": "2fa_pending",
        "exp": datetime.utcnow() + timedelta(minutes=5)
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_temp_2fa_token(temp_token: str) -> str:
    """
    Validates a temp_token and returns the username if valid.
    """
    try:
        payload = jwt.decode(temp_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "2fa_pending":
            raise HTTPException(status_code=401, detail="Invalid token type for 2FA verification")
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="2FA session expired. Please log in again.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid 2FA challenge token")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Disallow temporary 2fa tokens from accessing regular authenticated APIs
        if payload.get("type") == "2fa_pending":
            raise credentials_exception
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user account")
    return user


def require_roles(*allowed_roles: str) -> Callable:
    def role_guard(current_user: models.User = Depends(get_current_user)) -> models.User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account does not have permission to perform this action.",
            )
        return current_user

    return role_guard


def verify_user_stepup_auth(user: models.User, password: Optional[str], two_factor_code: Optional[str], db: Session):
    """
    🔐 Step-Up Authentication Guard for Critical & High-Volume Operations:
    Validates user password and (if 2FA enabled or code provided) verifies 6-digit TOTP / Email OTP.
    """
    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account password is required to authorize this high-impact action."
        )

    if not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect account password. Authorization denied."
        )

    # If user has 2FA enabled, 2FA code is mandatory
    if user.is_2fa_enabled or two_factor_code:
        code = (two_factor_code or "").strip().replace(" ", "")
        if not code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA verification code is required to authorize this action."
            )

        verified = False
        # 1. TOTP code
        if user.totp_secret:
            try:
                import pyotp
                totp = pyotp.TOTP(user.totp_secret)
                if totp.verify(code, valid_window=1):
                    verified = True
            except Exception as e:
                pass

        # 2. Email recovery OTP
        if not verified and user.email_recovery_code and user.email_recovery_code_expires:
            if datetime.utcnow() <= user.email_recovery_code_expires and user.email_recovery_code == code:
                verified = True
                user.email_recovery_code = None
                user.email_recovery_code_expires = None
                db.commit()

        if not verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired 2FA verification code."
            )

    return True
