import math
import secrets
import smtplib
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.constants import DEMO_PATIENT_EMAIL
from app.database import get_db
from app.email_utils import send_otp_email
from app.models import OtpCode, User
from app.schemas import (
    AuthOut,
    ForgotPasswordIn,
    LoginIn,
    MessageOut,
    RegisterIn,
    ResendOtpIn,
    ResetPasswordIn,
    UserOut,
    VerifyOtpIn,
)
from app.security import check_password, create_token, get_current_user, hash_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

OTP_VALID_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
RESEND_WAIT_SECONDS = 60


def find_user(db, email):
    return db.scalar(select(User).where(User.email == email))


def seconds_until_resend(db, email, purpose):
    latest = db.scalar(
        select(OtpCode)
        .where(OtpCode.email == email, OtpCode.purpose == purpose)
        .order_by(OtpCode.created_at.desc())
        .limit(1)
    )
    if latest is None:
        return 0
    passed = (datetime.now() - latest.created_at).total_seconds()
    return max(0, math.ceil(RESEND_WAIT_SECONDS - passed))


def send_new_otp(db, email, purpose):
    wait = seconds_until_resend(db, email, purpose)
    if wait > 0:
        raise HTTPException(
            status_code=429, detail=f"Please wait {wait} seconds before asking for a new code"
        )

    # Only the newest code should work, so older unused ones are retired
    db.execute(
        update(OtpCode)
        .where(OtpCode.email == email, OtpCode.purpose == purpose, OtpCode.used.is_(False))
        .values(used=True)
    )
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        OtpCode(
            email=email,
            code=code,
            purpose=purpose,
            expires_at=datetime.now() + timedelta(minutes=OTP_VALID_MINUTES),
        )
    )

    # Commit only after the email goes out, so a failed send doesn't leave a half-made sign up
    try:
        send_otp_email(email, code, purpose)
    except (smtplib.SMTPException, OSError):
        db.rollback()
        raise HTTPException(
            status_code=503, detail="We could not send the email right now. Please try again"
        )
    db.commit()


def use_otp(db, email, purpose, code):
    otp = db.scalar(
        select(OtpCode)
        .where(OtpCode.email == email, OtpCode.purpose == purpose, OtpCode.used.is_(False))
        .order_by(OtpCode.created_at.desc())
        .limit(1)
    )
    if otp is None or otp.expires_at < datetime.now():
        raise HTTPException(
            status_code=400, detail="This code is no longer valid. Please request a new one"
        )
    if otp.attempts >= OTP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=400, detail="Too many wrong attempts. Please request a new code"
        )

    if not secrets.compare_digest(otp.code, code):
        otp.attempts += 1
        db.commit()
        left = OTP_MAX_ATTEMPTS - otp.attempts
        if left == 0:
            raise HTTPException(
                status_code=400, detail="Too many wrong attempts. Please request a new code"
            )
        word = "attempt" if left == 1 else "attempts"
        raise HTTPException(status_code=400, detail=f"Incorrect code. {left} {word} left")

    otp.used = True


@router.post("/register", status_code=201, response_model=MessageOut)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if find_user(db, data.email):
        raise HTTPException(
            status_code=400, detail="An account with this email already exists. Please log in"
        )

    db.add(
        User(
            full_name=data.full_name,
            email=data.email,
            password_hash=hash_password(data.password),
            role=data.role,
        )
    )
    send_new_otp(db, data.email, "verify")
    return {"message": "We sent a 6-digit code to your email"}


@router.post("/verify-otp", response_model=AuthOut)
def verify_otp(data: VerifyOtpIn, db: Session = Depends(get_db)):
    user = find_user(db, data.email)
    if user is None:
        raise HTTPException(status_code=400, detail="No account found with this email")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="This email is already verified. Please log in")

    use_otp(db, data.email, "verify", data.code)
    user.is_verified = True
    db.commit()
    return {"token": create_token(user), "user": user}


@router.post("/resend-otp", response_model=MessageOut)
def resend_otp(data: ResendOtpIn, db: Session = Depends(get_db)):
    user = find_user(db, data.email)
    # Same reply either way, so this can't be used to check which emails are registered
    if user and not (data.purpose == "verify" and user.is_verified):
        send_new_otp(db, data.email, data.purpose)
    return {"message": "We sent a new code to your email"}


@router.post("/login", response_model=AuthOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = find_user(db, data.email)
    if user is None or not check_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_verified:
        # The old code has probably expired, so send a fresh one unless we just did
        if seconds_until_resend(db, user.email, "verify") == 0:
            send_new_otp(db, user.email, "verify")
        raise HTTPException(
            status_code=403,
            detail={"message": "Please verify your email to continue", "needs_verification": True},
        )

    return {"token": create_token(user), "user": user}


@router.post("/forgot-password", response_model=MessageOut)
def forgot_password(data: ForgotPasswordIn, db: Session = Depends(get_db)):
    if find_user(db, data.email):
        send_new_otp(db, data.email, "reset")
    return {"message": "If this email is registered, we sent a code to it"}


@router.post("/reset-password", response_model=MessageOut)
def reset_password(data: ResetPasswordIn, db: Session = Depends(get_db)):
    use_otp(db, data.email, "reset", data.code)
    user = find_user(db, data.email)
    if user is None:
        raise HTTPException(status_code=400, detail="No account found with this email")

    user.password_hash = hash_password(data.new_password)
    # The code proves they own the email, so an unverified account counts as verified now
    user.is_verified = True
    db.commit()
    return {"message": "Your password has been updated. Please log in"}


@router.post("/demo", response_model=AuthOut)
def demo_login(db: Session = Depends(get_db)):
    user = find_user(db, DEMO_PATIENT_EMAIL) if settings.demo_mode else None
    if user is None:
        raise HTTPException(status_code=404, detail="The patient demo is not available right now")
    return {"token": create_token(user), "user": user}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
