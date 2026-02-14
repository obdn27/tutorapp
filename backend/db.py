import sqlite3
import threading
from contextlib import contextmanager

conn = sqlite3.connect("users.db", check_same_thread=False)
conn.row_factory = sqlite3.Row
c = conn.cursor()
lock = threading.Lock()

@contextmanager
def locked_db():
    with lock:
        yield

c.execute("""
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fName TEXT NOT NULL,
    lName TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    roleStudent BIT NOT NULL,
    pwdhash TEXT NOT NULL
)
""")

c.execute("""
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    refresh_token_hash TEXT UNIQUE,
    expires_at INTEGER,
    revoked BIT,
    created_at INTEGER
)
""")

def create_user(fName: str, lName: str, email: str, roleStudent: bool, pwdhash: str):
    try:
        with locked_db():
            c.execute(
                "INSERT INTO users (fName, lName, email, pwdhash, roleStudent) VALUES (?, ?, ?, ?, ?)",
                (fName, lName, email, pwdhash, roleStudent),
            )
            conn.commit()
            return c.lastrowid
    except sqlite3.IntegrityError as e:
        print(e)
        return -1

def get_user(email: str):
    with locked_db():
        row = c.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,),
        ).fetchone()

    row = None if row is None else dict(row)
    print(f"db retrieved data for user email {email}: {row}")
    return row

def create_session(user_id, refresh_hash, expires, created):
    with locked_db():
        c.execute(
            "INSERT INTO sessions (user_id, refresh_token_hash, expires_at, created_at) "
            "VALUES (?, ?, ?, ?)",
            (user_id, refresh_hash, expires, created),
        )
        conn.commit()

def get_session(refresh_hash):
    with locked_db():
        row = c.execute(
            "SELECT user_id, expires_at, revoked FROM sessions "
            "WHERE refresh_token_hash = ?",
            (refresh_hash,),
        ).fetchone()
    return row

def delete_session(refresh_hash):
    with locked_db():
        c.execute(
            "UPDATE sessions SET revoked = 1 WHERE refresh_token_hash = ?",
            (refresh_hash,),
        )
        conn.commit()

    