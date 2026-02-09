import hashlib
from passlib.context import CryptContext
from db import get_user

import time
from datetime import datetime, timedelta, timezone
from jose import jwt
import secrets

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
refresh_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def authenticate_user(givenUsername, givenPassword):
    user = get_user(givenUsername)
    if not user:
        return None
    
    if not verify_password(givenPassword, user["pwdhash"]):
        return None
    
    return user


PEPPER = "67ydlkgj698q"
JWT_SECRET = "123"
JWT_ALG = "HS256"
ACCESS_MINUTES = 1
REFRESH_DAYS = 30


def create_refresh_token():
    return secrets.token_urlsafe(32)

def hash_refresh_token(token):
    print("peppertoken", PEPPER, token)
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

def verify_access_token(token):
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    return int(payload["sub"])