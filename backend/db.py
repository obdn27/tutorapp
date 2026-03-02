import sqlite3, time, threading
from contextlib import contextmanager
from collections import defaultdict
import datetime

from typing import Optional, Tuple

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
    CONSTRAINT dup_tutor_subject UNIQUE(tutor_id, subject)
)
""")

c.execute("""
CREATE TABLE IF NOT EXISTS userHours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    weekday INTEGER,
    start_s INTEGER NOT NULL,
    end_s INTEGER NOT NULL,
    CONSTRAINT valid_weekday CHECK (weekday BETWEEN 0 AND 6),
    CONSTRAINT dup_user_weekday_hours UNIQUE (user_id, weekday)
)
""")

c.execute("""
CREATE TABLE IF NOT EXISTS offTimes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    start_ts INTEGER NOT NULL,
    end_ts INTEGER NOT NULL,
    CONSTRAINT valid_range CHECK (end_ts > start_ts)
)
""")

ACTIVE_BOOKING_STATUSES = ("requested", "confirmed")
TUTOR_ACTIONABLE_STATUSES = ("requested", "confirmed")
SECONDS_PER_DAY = 24 * 3600

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

def get_user_role(user_id: int) -> int | None:
    with locked_db():
        c.execute("SELECT role FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        return row["role"] if row else None

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

def has_overlap_offtimes(user_id: int, start_ts: int, end_ts: int) -> bool:
    with locked_db():
        row = c.execute(
            """
            SELECT 1
            FROM offTimes
            WHERE user_id = ?
              AND start_ts < ?
              AND end_ts > ?
            LIMIT 1
            """,
            (user_id, end_ts, start_ts),
        ).fetchone()
    return row is not None

def can_book_slot(*, tutor_id: int, student_id: int, start_ts: int, end_ts: int) -> tuple[bool, str]:
    if start_ts <= 0 or end_ts <= 0:
        return (False, "invalid_ts")
    if end_ts <= start_ts:
        return (False, "invalid_range")

    import datetime
    dt_start = datetime.datetime.fromtimestamp(start_ts, tz=datetime.timezone.utc)
    dt_end = datetime.datetime.fromtimestamp(end_ts, tz=datetime.timezone.utc)

    if dt_end.date() != dt_start.date():
        return (False, "crosses_midnight")

    weekday = dt_start.weekday()  # 0=Mon..6=Sun
    day_start = dt_start.replace(hour=0, minute=0, second=0, microsecond=0)
    start_s = int((dt_start - day_start).total_seconds())
    end_s = start_s + int((dt_end - dt_start).total_seconds())

    if not (0 <= start_s < SECONDS_PER_DAY and 0 < end_s <= SECONDS_PER_DAY and end_s > start_s):
        return (False, "invalid_time_of_day")

    hours = get_hours_for_weekday(tutor_id, weekday)
    if not hours:
        return (False, "tutor_no_hours")

    wh_start, wh_end = hours
    if start_s < wh_start or end_s > wh_end:
        return (False, "outside_working_hours")

    if has_overlap_offtimes(tutor_id, start_ts, end_ts):
        return (False, "tutor_off_time")

    if has_overlap_in_bookings("tutor_id", start_ts, end_ts):
        return (False, "tutor_clash")

    if has_overlap_in_bookings("student_id", start_ts, end_ts):
        return (False, "student_clash")

    return (True, "ok")

def set_hours(user_id, start_s, end_s, weekday):
    with locked_db():
        c.execute("""
            INSERT INTO userHours (user_id, start_s, end_s, weekday) 
            VALUES (?, ?, ?, ?) ON CONFLICT (user_id, weekday)
            DO UPDATE SET 
                start_s = excluded.start_s,
                end_s   = excluded.end_s
        """, (user_id, start_s, end_s, weekday,))
        conn.commit()

def get_user_hours(user_id: int) -> list[dict]:
    with locked_db():
        c.execute("""
            SELECT id, weekday, start_s, end_s
            FROM userHours
            WHERE user_id = ?
            ORDER BY weekday ASC
        """, (user_id,))
        return [dict(r) for r in c.fetchall()]

def set_off_time(user_id, start_ts, end_ts):
    with locked_db():
        c.execute("""
            INSERT INTO offTimes (user_id, start_ts, end_ts)
            VALUES (?, ?, ?)
        """, (user_id, start_ts, end_ts))
        conn.commit()

def get_off_times(user_id: int, start_ts: int, end_ts: int) -> list[dict]:
    with locked_db():
        c.execute("""
            SELECT id, start_ts, end_ts
            FROM offTimes
            WHERE user_id = ?
              AND start_ts < ?
              AND end_ts > ?
            ORDER BY start_ts ASC
        """, (user_id, end_ts, start_ts))
        return [dict(r) for r in c.fetchall()]
    
def get_off_time_by_id(off_id: int) -> dict | None:
    with locked_db():
        row = c.execute("""
            SELECT id, user_id, start_ts, end_ts
            FROM offTimes
            WHERE id = ?
        """, (off_id,)).fetchone()
    return dict(row) if row else None

def delete_off_time(off_id: int) -> None:
    with locked_db():
        c.execute("DELETE FROM offTimes WHERE id = ?", (off_id,))
        conn.commit()

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
    
def get_hours_by_weekday(user_id: int) -> dict[int, tuple[int, int]]:
    with locked_db():
        c.execute(
            "SELECT weekday, start_s, end_s FROM userHours WHERE user_id = ?",
            (user_id,),
        )
        rows = c.fetchall()
    return {int(wd): (int(ss), int(es)) for (wd, ss, es) in rows}


def get_tutor_bookings_in_window(tutor_id: int, start_ts: int, end_ts: int) -> list[tuple[int, int]]:
    with locked_db():
        rows = c.execute(
            """
            SELECT start_ts, end_ts
            FROM bookings
            WHERE tutor_id = ?
              AND status IN ('requested', 'confirmed')
              AND start_ts < ?
              AND end_ts > ?
            """,
            (tutor_id, end_ts, start_ts),
        ).fetchall()
    return [(int(r["start_ts"]), int(r["end_ts"])) for r in rows]


def get_off_times_in_window(user_id: int, start_ts: int, end_ts: int) -> list[tuple[int, int]]:
    with locked_db():
        c.execute(
            """
            SELECT start_ts, end_ts
            FROM offTimes
            WHERE user_id = ?
              AND start_ts < ?
              AND end_ts > ?
            """,
            (user_id, end_ts, start_ts),
        )
        rows = c.fetchall()
    return [(int(s), int(e)) for (s, e) in rows]

def get_hours_for_weekday(user_id: int, weekday: int) -> Optional[Tuple[int, int]]:
    with locked_db():
        row = c.execute(
            "SELECT start_s, end_s FROM userHours WHERE user_id = ? AND weekday = ?",
            (user_id, weekday),
        ).fetchone()
    if not row:
        return None
    return (int(row["start_s"]), int(row["end_s"]))

def has_overlap_in_bookings(user_id_field: str, user_id: int, start_ts: int, end_ts: int) -> bool:
    # user_id_field is "tutor_id" or "student_id"
    with locked_db():
        row = c.execute(
            f"""
            SELECT 1
            FROM bookings
            WHERE {user_id_field} = ?
              AND status IN ('requested', 'confirmed')
              AND start_ts < ?
              AND end_ts > ?
            LIMIT 1
            """,
            (user_id, end_ts, start_ts),
        ).fetchone()
    return row is not None

def has_overlap_in_offtimes(user_id: int, start_ts: int, end_ts: int) -> bool:
    with locked_db():
        row = c.execute(
            """
            SELECT 1
            FROM offTimes
            WHERE user_id = ?
              AND start_ts < ?
              AND end_ts > ?
            LIMIT 1
            """,
            (user_id, end_ts, start_ts),
        ).fetchone()
    return row is not None

def create_booking_checked(*, tutor_id: int, student_id: int, start_ts: int, end_ts: int, notes: str) -> tuple[bool, str, Optional[int]]:
    ok, reason = can_book_slot(tutor_id=tutor_id, student_id=student_id, start_ts=start_ts, end_ts=end_ts)
    if not ok:
        return (False, reason, None)

    with locked_db():
        c.execute(
            """
            INSERT INTO bookings (tutor_id, student_id, start_ts, end_ts, created_at, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, 'requested')
            """,
            (tutor_id, student_id, start_ts, end_ts, int(time.time()), notes or ""),
        )
        conn.commit()
        return (True, "ok", c.lastrowid)


def get_booking_by_id(booking_id: int) -> Optional[dict]:
    with locked_db():
        row = c.execute(
            """
            SELECT id, tutor_id, student_id, start_ts, end_ts, status, notes, created_at
            FROM bookings
            WHERE id = ?
            """,
            (booking_id,),
        ).fetchone()
    return dict(row) if row else None


def update_booking_status(booking_id: int, new_status: str) -> None:
    with locked_db():
        c.execute(
            "UPDATE bookings SET status = ? WHERE id = ?",
            (new_status, booking_id),
        )
        conn.commit()

def get_booking_detail(booking_id: int) -> dict | None:
    with locked_db():
        row = c.execute(
            """
            SELECT
                b.id,
                b.tutor_id,
                t.first_name AS tutor_first_name,
                t.last_name  AS tutor_last_name,
                t.email      AS tutor_email,

                b.student_id,
                s.first_name AS student_first_name,
                s.last_name  AS student_last_name,
                s.email      AS student_email,

                b.start_ts,
                b.end_ts,
                b.notes,
                b.status,
                b.created_at
            FROM bookings b
            JOIN users t ON t.id = b.tutor_id
            JOIN users s ON s.id = b.student_id
            WHERE b.id = ?
            """,
            (booking_id,),
        ).fetchone()

    return dict(row) if row else None