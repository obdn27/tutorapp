import sqlite3, time, threading
from contextlib import contextmanager
from collections import defaultdict

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
    notes TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested'
          CHECK(status IN ('requested', 'confirmed', 'canceled', 'rejected', 'completed')),
    created_at INTEGER NOT NULL,
    CHECK (end_ts > start_ts)
)
""")

c.execute("""
CREATE TABLE IF NOT EXISTS tutorSubjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tutor_id INTEGER REFERENCES users(id) NOT NULL,
    subject TEXT NOT NULL,
    UNIQUE(tutor_id, subject)
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

def get_all_tutors():
    with locked_db():
        # 1) tutors + details
        c.execute("""
            SELECT
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                td.rating_sum,
                td.no_ratings,
                td.hourly_gbp,
                td.bio
            FROM users u
            JOIN tutorDetails td ON td.tutor_id = u.id
            WHERE u.role = 1
            ORDER BY u.id
        """)
        tutors = [dict(r) for r in c.fetchall()]

        if not tutors:
            return []

        tutor_ids = [t["id"] for t in tutors]

        # 2) all subjects for those tutors
        placeholders = ",".join(["?"] * len(tutor_ids))
        c.execute(f"""
            SELECT tutor_id, subject
            FROM tutorSubjects
            WHERE tutor_id IN ({placeholders})
            ORDER BY tutor_id
        """, tutor_ids)

        subjects_by_tutor = defaultdict(list)
        for row in c.fetchall():
            # row can be tuple or sqlite3.Row depending on row_factory
            tutor_id = row["tutor_id"] if isinstance(row, dict) or hasattr(row, "__getitem__") else row[0]
            subject = row["subject"] if isinstance(row, dict) or hasattr(row, "__getitem__") else row[1]
            subjects_by_tutor[tutor_id].append(subject)

        # 3) attach
        for t in tutors:
            t["subjects"] = subjects_by_tutor.get(t["id"], [])

        return tutors

def set_tutor_details(tutor_id, subjects, hourly_gbp, bio):
    with locked_db():
        c.execute(
            "INSERT INTO tutorDetails (tutor_id, rating_sum, no_ratings, hourly_gbp, bio)" \
            "VALUES (?, 0, 0, ?, ?)",
            (tutor_id, hourly_gbp, bio)
        )

        for subject in subjects:
            c.execute(
                "INSERT INTO tutorSubjects (tutor_id, subject) VALUES (?, ?)",
                (tutor_id, subject)
            )
        conn.commit()

def add_new_booking(tutor_id, student_id, start_ts, end_ts, notes):
    with locked_db():
        c.execute(
            "INSERT INTO bookings (tutor_id, student_id, start_ts, end_ts, created_at, notes) VALUES (?, ?, ?, ?, ?, ?)",
            (tutor_id, student_id, start_ts, end_ts, int(time.time()), notes)
        )
        conn.commit()

def get_user_role(user_id: int) -> int | None:
    with locked_db():
        c.execute("SELECT role FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        return row["role"] if row else None

def get_bookings_for_student(student_id: int) -> list[dict]:
    with locked_db():
        c.execute("""
            SELECT
                b.id,
                b.tutor_id,
                u.first_name AS tutor_first_name,
                u.last_name  AS tutor_last_name,
                u.email      AS tutor_email,
                b.start_ts,
                b.end_ts,
                b.status,
                b.created_at,
                b.notes
            FROM bookings b
            JOIN users u ON u.id = b.tutor_id
            WHERE b.student_id = ?
            ORDER BY b.start_ts DESC
        """, (student_id,))
        return [dict(r) for r in c.fetchall()]

def get_bookings_for_tutor(tutor_id: int) -> list[dict]:
    with locked_db():
        c.execute("""
            SELECT
                b.id,
                b.student_id,
                u.first_name AS student_first_name,
                u.last_name  AS student_last_name,
                u.email      AS student_email,
                b.start_ts,
                b.end_ts,
                b.status,
                b.created_at,
                b.notes
            FROM bookings b
            JOIN users u ON u.id = b.student_id
            WHERE b.tutor_id = ?
            ORDER BY b.start_ts DESC
        """, (tutor_id,))
        return [dict(r) for r in c.fetchall()]
    
def get_my_info(user_id: int):
    with locked_db():
        c.execute("""
            SELECT role, first_name, last_name, email
            FROM users WHERE id = ?
        """, (user_id,))
        return dict(c.fetchone())