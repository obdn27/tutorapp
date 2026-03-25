import hashlib, os
from passlib.context import CryptContext
from db import get_user

import time
from datetime import datetime, timedelta, timezone
from jose import jwt, ExpiredSignatureError, JWSError, JWTError
import secrets

from fastapi import Header, HTTPException

PEPPER = os.getenv("PEPPER")
JWT_SECRET = os.getenv("JWT_SECRET")

if not PEPPER:
    raise RuntimeError("Missing PEPPER env var")
if not JWT_SECRET:
    raise RuntimeError("Missing JWT_SECRET env var")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
refresh_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def authenticate_user(givenEmail, givenPassword):
    user = get_user(givenEmail)
    if not user:
        return None
    
    if not verify_password(givenPassword, user["pwd_hash"]):
        return None
    
    return user

JWT_ALG = "HS256"
ACCESS_MINUTES = 1
REFRESH_DAYS = 30


def create_refresh_token():
    return secrets.token_urlsafe(32)

def hash_refresh_token(token):
    return hashlib.sha256((PEPPER + token).encode("utf-8")).hexdigest()

def now_ts():
    return int(time.time())

def create_access_token(user_id):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_MINUTES)).timestamp())
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def verify_access_token(authorization: str = Header(None)):
    if authorization is None:
        raise HTTPException(401, detail="Missing Authorization header")

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1]:
        raise HTTPException(401, detail="Invalid Authorization header")

    token = parts[1]

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return int(payload["sub"])
    except ExpiredSignatureError:
        raise HTTPException(401, detail="Session expired")
    except (JWSError, JWTError):
        raise HTTPException(401, detail="Invalid bearer token")
    
