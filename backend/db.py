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
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role INTEGER NOT NULL CHECK(role IN (0, 1, 2)),
    pwd_hash TEXT NOT NULL
)
""")

c.execute("""
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    refresh_token_hash TEXT UNIQUE,
    expires_at INTEGER,
    revoked BIT,
    created_at INTEGER
)
""")

c.execute("""
CREATE TABLE IF NOT EXISTS tutorDetails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tutor_id INTEGER REFERENCES users(id),
    rating_sum INTEGER NOT NULL,
    no_ratings INTEGER NOT NULL,
    hourly_gbp INTEGER NOT NULL,
    subjects TEXT NOT NULL,
    bio TEXT NOT NULL
)
""")

c.execute("""
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tutor_id INTEGER REFERENCES users(id),
    student_id INTEGER REFERENCES users(id),
    start_ts INTEGER NOT NULL,
    end_ts INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested'
          CHECK(status IN ('requested', 'confirmed', 'canceled', 'rejected', 'completed')),
    created_at INTEGER NOT NULL,
    CHECK (end_ts > start_ts)
)
""")

def create_user(fName: str, lName: str, email: str, role: int, pwdHash: str):
    try:
        with locked_db():
            c.execute(
                "INSERT INTO users (first_name, last_name, email, pwd_hash, role) VALUES (?, ?, ?, ?, ?)",
                (fName, lName, email, pwdHash, role),
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

    