import sqlite3, time, threading
from contextlib import contextmanager
from collections import defaultdict
import datetime
from typing import Optional, Tuple

conn = sqlite3.connect("users.db", check_same_thread=False)
conn.row_factory = sqlite3.Row
c = conn.cursor()
lock = threading.Lock()

SECONDS_PER_DAY = 24 * 3600
ACTIVE_BOOKING_STATUSES = ("requested", "confirmed")

@contextmanager
def locked_db():
    with lock:
        yield

# ---------- schema ----------

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

c.execute("""
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER UNIQUE REFERENCES bookings(id) NOT NULL,
    tutor_id INTEGER REFERENCES users(id) NOT NULL,
    student_id INTEGER REFERENCES users(id) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at INTEGER NOT NULL
)
""")

# ---------- users ----------

def create_user(fName: str, lName: str, email: str, role: int, pwdHash: str) -> int:
    try:
        with locked_db():
            c.execute(
                "INSERT INTO users (first_name, last_name, email, pwd_hash, role) VALUES (?, ?, ?, ?, ?)",
                (fName, lName, email, pwdHash, role),
            )
            conn.commit()
            return c.lastrowid
    except sqlite3.IntegrityError:
        return -1

def get_user(email: str) -> dict | None:
    with locked_db():
        row = c.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    return dict(row) if row else None

def get_user_role(user_id: int) -> int | None:
    with locked_db():
        row = c.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
    return int(row["role"]) if row else None

def get_my_info(user_id: int) -> dict:
    with locked_db():
        row = c.execute(
            "SELECT role, first_name, last_name, email FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    return dict(row)

# ---------- sessions ----------

def create_session(user_id: int, refresh_hash: str, expires: int, created: int) -> None:
    with locked_db():
        c.execute(
            "INSERT INTO sessions (user_id, refresh_token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (user_id, refresh_hash, expires, created),
        )
        conn.commit()

def get_session(refresh_hash: str):
    with locked_db():
        return c.execute(
            "SELECT user_id, expires_at, revoked FROM sessions WHERE refresh_token_hash = ?",
            (refresh_hash,),
        ).fetchone()

def delete_session(refresh_hash: str) -> None:
    with locked_db():
        c.execute("UPDATE sessions SET revoked = 1 WHERE refresh_token_hash = ?", (refresh_hash,))
        conn.commit()

# ---------- tutors ----------

def set_tutor_details(tutor_id: int, subjects: list[str], hourly_gbp: int, bio: str) -> None:
    with locked_db():
        c.execute(
            "INSERT INTO tutorDetails (tutor_id, rating_sum, no_ratings, hourly_gbp, bio) VALUES (?, 0, 0, ?, ?)",
            (tutor_id, hourly_gbp, bio),
        )
        for subject in subjects:
            c.execute(
                "INSERT INTO tutorSubjects (tutor_id, subject) VALUES (?, ?)",
                (tutor_id, subject),
            )
        conn.commit()

def get_all_tutors() -> list[dict]:
    with locked_db():
        tutors = c.execute("""
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
        """).fetchall()

        tutors = [dict(r) for r in tutors]
        if not tutors:
            return []

        tutor_ids = [t["id"] for t in tutors]
        placeholders = ",".join(["?"] * len(tutor_ids))

        rows = c.execute(f"""
            SELECT tutor_id, subject
            FROM tutorSubjects
            WHERE tutor_id IN ({placeholders})
            ORDER BY tutor_id
        """, tutor_ids).fetchall()

    subjects_by_tutor = defaultdict(list)
    for r in rows:
        subjects_by_tutor[int(r["tutor_id"])].append(r["subject"])

    for t in tutors:
        t["subjects"] = subjects_by_tutor.get(t["id"], [])

    return tutors

def get_tutor_profile(tutor_id: int) -> dict:
    with locked_db():
        tutor = c.execute("""
            SELECT u.id, u.first_name, u.last_name, u.email,
                   td.hourly_gbp, td.bio, td.rating_sum, td.no_ratings
            FROM users u
            JOIN tutorDetails td ON td.tutor_id = u.id
            WHERE u.id = ? AND u.role = 1
        """, (tutor_id,)).fetchone()

        if not tutor:
            return None

        subjects = c.execute("""
            SELECT subject
            FROM tutorSubjects
            WHERE tutor_id = ?
            ORDER BY subject
        """, (tutor_id,)).fetchall()

    out = dict(tutor)
    out["subjects"] = [r["subject"] for r in subjects]
    return out

def update_tutor_profile(tutor_id: int, hourly_gbp: int | None, bio: str | None) -> None:
    sets = []
    params = []
    if hourly_gbp is not None:
        sets.append("hourly_gbp = ?")
        params.append(hourly_gbp)
    if bio is not None:
        sets.append("bio = ?")
        params.append(bio)

    if not sets:
        return

    params.append(tutor_id)

    with locked_db():
        c.execute(f"""
            UPDATE tutorDetails
            SET {", ".join(sets)}
            WHERE tutor_id = ?
        """, params)
        conn.commit()

def replace_tutor_subjects(tutor_id: int, subjects: list[str]) -> None:
    # normalize + dedupe
    cleaned = []
    seen = set()
    for s in subjects:
        s2 = (s or "").strip()
        if not s2:
            continue
        key = s2.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(s2)

    with locked_db():
        c.execute("DELETE FROM tutorSubjects WHERE tutor_id = ?", (tutor_id,))
        for s in cleaned:
            c.execute("INSERT INTO tutorSubjects (tutor_id, subject) VALUES (?, ?)", (tutor_id, s))
        conn.commit()

def create_review(booking_id: int, student_id: int, rating: int, comment: str | None) -> tuple[bool, str]:
    with locked_db():
        b = c.execute("""
            SELECT id, tutor_id, student_id, status
            FROM bookings
            WHERE id = ?
        """, (booking_id,)).fetchone()

        if not b:
            return (False, "not_found")

        if int(b["student_id"]) != student_id:
            return (False, "not_allowed")

        if b["status"] != "completed":
            return (False, "not_completed")

        tutor_id = int(b["tutor_id"])

        # Insert review (1 per booking)
        try:
            c.execute("""
                INSERT INTO reviews (booking_id, tutor_id, student_id, rating, comment, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (booking_id, tutor_id, student_id, rating, comment, int(time.time())))
        except sqlite3.IntegrityError:
            return (False, "already_reviewed")

        # Update tutor aggregate
        c.execute("""
            UPDATE tutorDetails
            SET rating_sum = rating_sum + ?,
                no_ratings = no_ratings + 1
            WHERE tutor_id = ?
        """, (rating, tutor_id))

        conn.commit()

    return (True, "ok")

# ---------- hours + offTimes ----------

def set_hours(user_id: int, start_s: int, end_s: int, weekday: int) -> None:
    with locked_db():
        c.execute("""
            INSERT INTO userHours (user_id, start_s, end_s, weekday)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, weekday)
            DO UPDATE SET
                start_s = excluded.start_s,
                end_s   = excluded.end_s
        """, (user_id, start_s, end_s, weekday))
        conn.commit()

def get_user_hours(user_id: int) -> list[dict]:
    with locked_db():
        rows = c.execute("""
            SELECT id, weekday, start_s, end_s
            FROM userHours
            WHERE user_id = ?
            ORDER BY weekday ASC
        """, (user_id,)).fetchall()
    return [dict(r) for r in rows]

def get_hours_by_weekday(user_id: int) -> dict[int, tuple[int, int]]:
    with locked_db():
        rows = c.execute(
            "SELECT weekday, start_s, end_s FROM userHours WHERE user_id = ?",
            (user_id,),
        ).fetchall()
    return {int(r["weekday"]): (int(r["start_s"]), int(r["end_s"])) for r in rows}

def get_hours_for_weekday(user_id: int, weekday: int) -> Optional[Tuple[int, int]]:
    with locked_db():
        row = c.execute(
            "SELECT start_s, end_s FROM userHours WHERE user_id = ? AND weekday = ?",
            (user_id, weekday),
        ).fetchone()
    if not row:
        return None
    return (int(row["start_s"]), int(row["end_s"]))

def set_off_time(user_id: int, start_ts: int, end_ts: int) -> None:
    with locked_db():
        c.execute(
            "INSERT INTO offTimes (user_id, start_ts, end_ts) VALUES (?, ?, ?)",
            (user_id, start_ts, end_ts),
        )
        conn.commit()

def get_off_times(user_id: int, start_ts: int, end_ts: int) -> list[dict]:
    with locked_db():
        rows = c.execute("""
            SELECT id, start_ts, end_ts
            FROM offTimes
            WHERE user_id = ?
              AND start_ts < ?
              AND end_ts > ?
            ORDER BY start_ts ASC
        """, (user_id, end_ts, start_ts)).fetchall()
    return [dict(r) for r in rows]

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

def get_off_times_in_window(user_id: int, start_ts: int, end_ts: int) -> list[tuple[int, int]]:
    with locked_db():
        rows = c.execute("""
            SELECT start_ts, end_ts
            FROM offTimes
            WHERE user_id = ?
              AND start_ts < ?
              AND end_ts > ?
        """, (user_id, end_ts, start_ts)).fetchall()
    return [(int(r["start_ts"]), int(r["end_ts"])) for r in rows]

# ---------- bookings ----------

def has_overlap_in_bookings(
    user_id_field: str,
    user_id: int,
    start_ts: int,
    end_ts: int,
    exclude_booking_id: int | None = None,
) -> bool:
    with locked_db():
        if exclude_booking_id is None:
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
        else:
            row = c.execute(
                f"""
                SELECT 1
                FROM bookings
                WHERE {user_id_field} = ?
                  AND id != ?
                  AND status IN ('requested', 'confirmed')
                  AND start_ts < ?
                  AND end_ts > ?
                LIMIT 1
                """,
                (user_id, exclude_booking_id, end_ts, start_ts),
            ).fetchone()
    return row is not None

def has_overlap_in_offtimes(user_id: int, start_ts: int, end_ts: int) -> bool:
    with locked_db():
        row = c.execute("""
            SELECT 1
            FROM offTimes
            WHERE user_id = ?
              AND start_ts < ?
              AND end_ts > ?
            LIMIT 1
        """, (user_id, end_ts, start_ts)).fetchone()
    return row is not None

def can_book_slot(
    *,
    tutor_id: int,
    student_id: int,
    start_ts: int,
    end_ts: int,
    exclude_booking_id: int | None = None,
) -> tuple[bool, str]:
    if start_ts <= 0 or end_ts <= 0:
        return (False, "invalid_ts")
    if end_ts <= start_ts:
        return (False, "invalid_range")

    dt_start = datetime.datetime.fromtimestamp(start_ts, tz=datetime.timezone.utc)
    dt_end = datetime.datetime.fromtimestamp(end_ts, tz=datetime.timezone.utc)

    if dt_end.date() != dt_start.date():
        return (False, "crosses_midnight")

    weekday = dt_start.weekday()
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

    if has_overlap_in_offtimes(tutor_id, start_ts, end_ts):
        return (False, "tutor_off_time")

    if has_overlap_in_bookings("tutor_id", tutor_id, start_ts, end_ts, exclude_booking_id):
        return (False, "tutor_clash")

    if has_overlap_in_bookings("student_id", student_id, start_ts, end_ts, exclude_booking_id):
        return (False, "student_clash")

    return (True, "ok")

def create_booking_checked(*, tutor_id: int, student_id: int, start_ts: int, end_ts: int, notes: str) -> tuple[bool, str, Optional[int]]:
    ok, reason = can_book_slot(tutor_id=tutor_id, student_id=student_id, start_ts=start_ts, end_ts=end_ts)
    if not ok:
        return (False, reason, None)

    with locked_db():
        c.execute("""
            INSERT INTO bookings (tutor_id, student_id, start_ts, end_ts, created_at, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, 'requested')
        """, (tutor_id, student_id, start_ts, end_ts, int(time.time()), notes or ""))
        conn.commit()
        return (True, "ok", c.lastrowid)

def get_bookings_for_student(student_id: int) -> list[dict]:
    with locked_db():
        rows = c.execute("""
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
        """, (student_id,)).fetchall()
    return [dict(r) for r in rows]

def get_bookings_for_tutor(tutor_id: int) -> list[dict]:
    with locked_db():
        rows = c.execute("""
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
        """, (tutor_id,)).fetchall()
    return [dict(r) for r in rows]

def get_booking_by_id(booking_id: int) -> Optional[dict]:
    with locked_db():
        row = c.execute("""
            SELECT id, tutor_id, student_id, start_ts, end_ts, status, notes, created_at
            FROM bookings
            WHERE id = ?
        """, (booking_id,)).fetchone()
    return dict(row) if row else None

def update_booking_status(booking_id: int, new_status: str) -> None:
    with locked_db():
        c.execute("UPDATE bookings SET status = ? WHERE id = ?", (new_status, booking_id))
        conn.commit()

def get_booking_detail(booking_id: int) -> dict | None:
    with locked_db():
        row = c.execute("""
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
        """, (booking_id,)).fetchone()
    return dict(row) if row else None

def get_tutor_bookings_in_window(tutor_id: int, start_ts: int, end_ts: int) -> list[tuple[int, int]]:
    with locked_db():
        rows = c.execute("""
            SELECT start_ts, end_ts
            FROM bookings
            WHERE tutor_id = ?
              AND status IN ('requested', 'confirmed')
              AND start_ts < ?
              AND end_ts > ?
        """, (tutor_id, end_ts, start_ts)).fetchall()
    return [(int(r["start_ts"]), int(r["end_ts"])) for r in rows]

def update_booking_time(booking_id: int, start_ts: int, end_ts: int) -> None:
    with locked_db():
        c.execute(
            "UPDATE bookings SET start_ts = ?, end_ts = ? WHERE id = ?",
            (start_ts, end_ts, booking_id),
        )
        conn.commit()