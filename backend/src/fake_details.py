# fake_db.py
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

fake_users_db = {
    "abc": {
        "username": "abc",
        "password_hash": hash_password("12345"),
    },
    "john": {
        "username": "john",
        "password_hash": hash_password("password"),
    },
}
