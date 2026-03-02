import hashlib
from passlib.context import CryptContext
from db import get_user

import time
from datetime import datetime, timedelta, timezone
from jose import jwt, ExpiredSignatureError
import secrets

from fastapi import Header, HTTPException

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

def verify_access_token(authorization: str = Header(None)):
    print("authorization:", authorization)
    if authorization is None:
        return "No header found"
    
    authorization = authorization.split(' ')[1]

    try:
        payload = jwt.decode(authorization, JWT_SECRET, algorithms=[JWT_ALG])
    except ExpiredSignatureError:
        raise HTTPException(401, detail="Session expired")
    
    return int(payload["sub"])