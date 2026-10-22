from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def check_password(password, password_hash):
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_token(user):
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(user.id), "role": user.role, "exp": expires}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Please log in to continue")

    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Your session has expired. Please log in again")

    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=401, detail="Your session has expired. Please log in again")
    return user


def require_role(role):
    def checker(user: User = Depends(get_current_user)):
        if user.role != role:
            raise HTTPException(status_code=403, detail="You do not have access to this page")
        return user

    return checker
