import datetime
import os
import threading
import time
from collections import defaultdict
from contextlib import contextmanager
from typing import Optional, Tuple

import psycopg
from dotenv import load_dotenv
from psycopg import errors
from schema import SCHEMA_STATEMENTS

load_dotenv()

lock = threading.Lock()
DB_URL = os.environ.get("SUPABASE_DB_URL")
SSL_ROOT_CERT = "/etc/ssl/certs/supabase-ca.crt"
_conn = None
_cursor = None


def _new_connection():
    return psycopg.connect(
        DB_URL,
        sslmode="require",
        sslrootcert=SSL_ROOT_CERT,
        row_factory=psycopg.rows.dict_row,
    )


def _reset_connection():
    global _conn, _cursor
    try:
        if _cursor is not None:
            _cursor.close()
    except Exception:
        pass
    try:
        if _conn is not None:
            _conn.close()
    except Exception:
        pass

    _conn = _new_connection()
    _cursor = _conn.cursor()


def _ensure_connection():
    global _conn, _cursor
    with lock:
        if _conn is None or _conn.closed or _cursor is None or _cursor.closed:
            _reset_connection()
        return _conn, _cursor


class CursorProxy:
    def execute(self, query, params=None):
        try:
            _, cursor = _ensure_connection()
            if params is None:
                return cursor.execute(query)
            return cursor.execute(query, params)
        except psycopg.OperationalError:
            with lock:
                _reset_connection()
                cursor = _cursor
                if params is None:
                    return cursor.execute(query)
                return cursor.execute(query, params)


class ConnectionProxy:
    def commit(self):
        try:
            conn, _ = _ensure_connection()
            conn.commit()
        except psycopg.OperationalError:
            with lock:
                _reset_connection()

    def rollback(self):
        try:
            conn, _ = _ensure_connection()
            conn.rollback()
        except psycopg.OperationalError:
            with lock:
                _reset_connection()

    def cursor(self):
        _, cursor = _ensure_connection()
        return cursor


conn = ConnectionProxy()
c = CursorProxy()

SECONDS_PER_DAY = 24 * 3600
ACTIVE_BOOKING_STATUSES = ("requested", "confirmed")

# ---------- schema ----------

for statement in SCHEMA_STATEMENTS:
    c.execute(statement)

conn.commit()

# ---------- users ----------

def create_user(fName: str, lName: str, email: str, role: int, pwdHash: str) -> int:
    try:
        c.execute(
            "INSERT INTO users (first_name, last_name, email, pwd_hash, role) \
            VALUES (%s, %s, %s, %s, %s) \
            RETURNING id",
            (fName, lName, email, pwdHash, role),
        )
        conn.commit()
        return int(c.fetchone()["id"])
    except errors.IntegrityError:
        conn.rollback()
        return -1


def get_user(email: str) -> dict | None:
    row = c.execute("SELECT * FROM users WHERE email = %s", (email,)).fetchone()
    return dict(row) if row else None


def get_user_role(user_id: int) -> int | None:
    row = c.execute("SELECT role FROM users WHERE id = %s", (user_id,)).fetchone()
    return int(row["role"]) if row else None


def get_my_info(user_id: int) -> dict:
    row = c.execute(
        "SELECT id, role, first_name, last_name, email FROM users WHERE id = %s",
        (user_id,),
    ).fetchone()
    return dict(row)


def get_pwd_hash(user_id: int) -> str | None:
    row = c.execute(
        "SELECT pwd_hash FROM users WHERE id = %s",
        (user_id,),
    ).fetchone()
    return row["pwd_hash"] if row else None


def set_pwd_hash(user_id: int, new_hash: str) -> None:
    c.execute(
        "UPDATE users SET pwd_hash = %s WHERE id = %s",
        (new_hash, user_id),
    )
    conn.commit()


# ---------- sessions ----------

def create_session(user_id: int, refresh_hash: str, expires: int, created: int) -> None:
    c.execute(
        "INSERT INTO sessions (user_id, refresh_token_hash, expires_at, created_at) VALUES (%s, %s, %s, %s)",
        (user_id, refresh_hash, expires, created),
    )
    conn.commit()


def get_session(refresh_hash: str) -> dict | None:
    row = c.execute(
        "SELECT user_id, expires_at, revoked FROM sessions WHERE refresh_token_hash = %s",
        (refresh_hash,),
    ).fetchone()
    return dict(row) if row else None


def delete_session(refresh_hash: str) -> None:
    c.execute(
        "UPDATE sessions SET revoked = 1 WHERE refresh_token_hash = %s",
        (refresh_hash,),
    )
    conn.commit()


# ---------- tutors ----------

def set_tutor_details(
    tutor_id: int, subjects: list[str], hourly_gbp: int, bio: str
) -> None:
    c.execute(
        "INSERT INTO tutorDetails (tutor_id, rating_sum, no_ratings, hourly_gbp, bio) VALUES (%s, 0, 0, %s, %s)",
        (tutor_id, hourly_gbp, bio),
    )
    for subject in subjects:
        c.execute(
            "INSERT INTO tutorSubjects (tutor_id, subject) VALUES (%s, %s)",
            (tutor_id, subject),
        )
    conn.commit()


def get_all_tutors() -> list[dict]:
    tutors = c.execute(
        """
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
    """
    ).fetchall()

    tutors = [dict(r) for r in tutors]
    if not tutors:
        return []

    tutor_ids = [t["id"] for t in tutors]
    placeholders = ",".join(["%s"] * len(tutor_ids))

    rows = c.execute(
        f"""
        SELECT tutor_id, subject
        FROM tutorSubjects
        WHERE tutor_id IN ({placeholders})
        ORDER BY tutor_id
    """,
        tutor_ids,
    ).fetchall()

    subjects_by_tutor = defaultdict(list)
    for r in rows:
        subjects_by_tutor[int(r["tutor_id"])].append(r["subject"])

    for t in tutors:
        t["subjects"] = subjects_by_tutor.get(t["id"], [])

    return tutors


def get_tutor_profile(tutor_id: int) -> dict | None:
    tutor = c.execute(
        """
        SELECT u.id, u.first_name, u.last_name, u.email,
               td.hourly_gbp, td.bio, td.rating_sum, td.no_ratings
        FROM users u
        JOIN tutorDetails td ON td.tutor_id = u.id
        WHERE u.id = %s AND u.role = 1
    """,
        (tutor_id,),
    ).fetchone()

    if not tutor:
        return None

    subjects = c.execute(
        """
        SELECT subject
        FROM tutorSubjects
        WHERE tutor_id = %s
        ORDER BY subject
    """,
        (tutor_id,),
    ).fetchall()

    out = dict(tutor)
    out["subjects"] = [r["subject"] for r in subjects]
    return out


def update_tutor_profile(
    tutor_id: int, hourly_gbp: int | None, bio: str | None
) -> None:
    row = c.execute(
        "SELECT 1 FROM tutorDetails WHERE tutor_id = %s",
        (tutor_id,),
    ).fetchone()

    if not row:
        c.execute(
            """
            INSERT INTO tutorDetails (tutor_id, rating_sum, no_ratings, hourly_gbp, bio)
            VALUES (%s, 0, 0, %s, %s)
            """,
            (tutor_id, hourly_gbp if hourly_gbp is not None else 1, bio if bio is not None else ""),
        )
        conn.commit()
        return

    sets = []
    params = []
    if hourly_gbp is not None:
        sets.append("hourly_gbp = %s")
        params.append(hourly_gbp)
    if bio is not None:
        sets.append("bio = %s")
        params.append(bio)

    if not sets:
        return

    params.append(tutor_id)

    c.execute(
        f"""
        UPDATE tutorDetails
        SET {", ".join(sets)}
        WHERE tutor_id = %s
    """,
        params,
    )
    conn.commit()


def replace_tutor_subjects(tutor_id: int, subjects: list[str]) -> None:
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

    c.execute("DELETE FROM tutorSubjects WHERE tutor_id = %s", (tutor_id,))
    for s in cleaned:
        c.execute(
            "INSERT INTO tutorSubjects (tutor_id, subject) VALUES (%s, %s)",
            (tutor_id, s),
        )
    conn.commit()


def create_review(
    booking_id: int, student_id: int, rating: int, comment: str | None
) -> tuple[bool, str]:
    b = c.execute(
        """
        SELECT id, tutor_id, student_id, status
        FROM bookings
        WHERE id = %s
    """,
        (booking_id,),
    ).fetchone()

    if not b:
        return (False, "not_found")

    if int(b["student_id"]) != student_id:
        return (False, "not_allowed")

    if b["status"] != "completed":
        return (False, "not_completed")

    tutor_id = int(b["tutor_id"])

    try:
        c.execute(
            """
            INSERT INTO reviews (booking_id, tutor_id, student_id, rating, comment, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """,
            (booking_id, tutor_id, student_id, rating, comment, int(time.time())),
        )
    except errors.IntegrityError:
        conn.rollback()
        return (False, "already_reviewed")

    c.execute(
        """
        UPDATE tutorDetails
        SET rating_sum = rating_sum + %s,
            no_ratings = no_ratings + 1
        WHERE tutor_id = %s
    """,
        (rating, tutor_id),
    )

    conn.commit()
    return (True, "ok")


# ---------- hours + offTimes ----------

def set_hours(user_id: int, start_s: int, end_s: int, weekday: int) -> None:
    c.execute(
        """
        INSERT INTO userHours (user_id, start_s, end_s, weekday)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT(user_id, weekday)
        DO UPDATE SET
            start_s = excluded.start_s,
            end_s   = excluded.end_s
    """,
        (user_id, start_s, end_s, weekday),
    )
    conn.commit()


def get_user_hours(user_id: int) -> list[dict]:
    rows = c.execute(
        """
        SELECT id, weekday, start_s, end_s
        FROM userHours
        WHERE user_id = %s
        ORDER BY weekday ASC
    """,
        (user_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_hours_by_weekday(user_id: int) -> dict[int, tuple[int, int]]:
    rows = c.execute(
        "SELECT weekday, start_s, end_s FROM userHours WHERE user_id = %s",
        (user_id,),
    ).fetchall()
    return {
        int(r["weekday"]): (int(r["start_s"]), int(r["end_s"])) for r in rows
    }


def get_hours_for_weekday(user_id: int, weekday: int) -> Optional[Tuple[int, int]]:
    row = c.execute(
        "SELECT start_s, end_s FROM userHours WHERE user_id = %s AND weekday = %s",
        (user_id, weekday),
    ).fetchone()
    if not row:
        return None
    return (int(row["start_s"]), int(row["end_s"]))


def set_off_time(user_id: int, start_ts: int, end_ts: int) -> None:
    c.execute(
        "INSERT INTO offTimes (user_id, start_ts, end_ts) VALUES (%s, %s, %s)",
        (user_id, start_ts, end_ts),
    )
    conn.commit()


def get_off_times(user_id: int, start_ts: int, end_ts: int) -> list[dict]:
    rows = c.execute(
        """
        SELECT id, start_ts, end_ts
        FROM offTimes
        WHERE user_id = %s
          AND start_ts < %s
          AND end_ts > %s
        ORDER BY start_ts ASC
    """,
        (user_id, end_ts, start_ts),
    ).fetchall()
    return [dict(r) for r in rows]


def get_off_time_by_id(off_id: int) -> dict | None:
    row = c.execute(
        """
        SELECT id, user_id, start_ts, end_ts
        FROM offTimes
        WHERE id = %s
    """,
        (off_id,),
    ).fetchone()
    return dict(row) if row else None


def delete_off_time(off_id: int) -> None:
    c.execute("DELETE FROM offTimes WHERE id = %s", (off_id,))
    conn.commit()


def get_off_times_in_window(
    user_id: int, start_ts: int, end_ts: int
) -> list[tuple[int, int]]:
    rows = c.execute(
        """
        SELECT start_ts, end_ts
        FROM offTimes
        WHERE user_id = %s
          AND start_ts < %s
          AND end_ts > %s
    """,
        (user_id, end_ts, start_ts),
    ).fetchall()
    return [(int(r["start_ts"]), int(r["end_ts"])) for r in rows]


# ---------- bookings ----------

def has_overlap_in_bookings(
    user_id_field: str,
    user_id: int,
    start_ts: int,
    end_ts: int,
    exclude_booking_id: int | None = None,
) -> bool:
    if exclude_booking_id is None:
        row = c.execute(
            f"""
            SELECT 1
            FROM bookings
            WHERE {user_id_field} = %s
              AND status IN ('requested', 'confirmed')
              AND start_ts < %s
              AND end_ts > %s
            LIMIT 1
            """,
            (user_id, end_ts, start_ts),
        ).fetchone()
    else:
        row = c.execute(
            f"""
            SELECT 1
            FROM bookings
            WHERE {user_id_field} = %s
              AND id != %s
              AND status IN ('requested', 'confirmed')
              AND start_ts < %s
              AND end_ts > %s
            LIMIT 1
            """,
            (user_id, exclude_booking_id, end_ts, start_ts),
        ).fetchone()
    return row is not None


def has_overlap_in_offtimes(user_id: int, start_ts: int, end_ts: int) -> bool:
    row = c.execute(
        """
        SELECT 1
        FROM offTimes
        WHERE user_id = %s
          AND start_ts < %s
          AND end_ts > %s
        LIMIT 1
    """,
        (user_id, end_ts, start_ts),
    ).fetchone()
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

    if not (
        0 <= start_s < SECONDS_PER_DAY
        and 0 < end_s <= SECONDS_PER_DAY
        and end_s > start_s
    ):
        return (False, "invalid_time_of_day")

    hours = get_hours_for_weekday(tutor_id, weekday)
    if not hours:
        return (False, "tutor_no_hours")

    wh_start, wh_end = hours
    if start_s < wh_start or end_s > wh_end:
        return (False, "outside_working_hours")

    if has_overlap_in_offtimes(tutor_id, start_ts, end_ts):
        return (False, "tutor_off_time")

    if has_overlap_in_bookings(
        "tutor_id", tutor_id, start_ts, end_ts, exclude_booking_id
    ):
        return (False, "tutor_clash")

    if has_overlap_in_bookings(
        "student_id", student_id, start_ts, end_ts, exclude_booking_id
    ):
        return (False, "student_clash")

    return (True, "ok")


def create_booking_checked(
    *, tutor_id: int, student_id: int, start_ts: int, end_ts: int, notes: str
) -> tuple[bool, str, Optional[int]]:
    ok, reason = can_book_slot(
        tutor_id=tutor_id,
        student_id=student_id,
        start_ts=start_ts,
        end_ts=end_ts,
    )
    if not ok:
        return (False, reason, None)

    c.execute(
        """
        INSERT INTO bookings (tutor_id, student_id, start_ts, end_ts, created_at, notes, status)
        VALUES (%s, %s, %s, %s, %s, %s, 'requested')
        RETURNING id
    """,
        (tutor_id, student_id, start_ts, end_ts, int(time.time()), notes or ""),
    )
    conn.commit()
    return (True, "ok", int(c.fetchone()["id"]))


def get_bookings_for_student(student_id: int) -> list[dict]:
    rows = c.execute(
        """
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
        WHERE b.student_id = %s
        ORDER BY b.start_ts DESC
    """,
        (student_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_bookings_for_tutor(tutor_id: int) -> list[dict]:
    rows = c.execute(
        """
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
        WHERE b.tutor_id = %s
        ORDER BY b.start_ts DESC
    """,
        (tutor_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_booking_by_id(booking_id: int) -> Optional[dict]:
    row = c.execute(
        """
        SELECT id, tutor_id, student_id, start_ts, end_ts, status, notes, created_at
        FROM bookings
        WHERE id = %s
    """,
        (booking_id,),
    ).fetchone()
    return dict(row) if row else None


def update_booking_status(booking_id: int, new_status: str) -> None:
    c.execute("UPDATE bookings SET status = %s WHERE id = %s", (new_status, booking_id))
    conn.commit()


def get_booking_detail(booking_id: int) -> dict | None:
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
        WHERE b.id = %s
    """,
        (booking_id,),
    ).fetchone()
    return dict(row) if row else None


def get_tutor_bookings_in_window(
    tutor_id: int, start_ts: int, end_ts: int
) -> list[tuple[int, int]]:
    rows = c.execute(
        """
        SELECT start_ts, end_ts
        FROM bookings
        WHERE tutor_id = %s
          AND status IN ('requested', 'confirmed')
          AND start_ts < %s
          AND end_ts > %s
    """,
        (tutor_id, end_ts, start_ts),
    ).fetchall()
    return [(int(r["start_ts"]), int(r["end_ts"])) for r in rows]


def update_booking_time(booking_id: int, start_ts: int, end_ts: int) -> None:
    c.execute(
        "UPDATE bookings SET start_ts = %s, end_ts = %s WHERE id = %s",
        (start_ts, end_ts, booking_id),
    )
    conn.commit()


def user_can_access_booking(user_id: int, booking_id: int) -> bool:
    row = c.execute(
        """
        SELECT 1
        FROM bookings
        WHERE id = %s
          AND (student_id = %s OR tutor_id = %s)
        LIMIT 1
        """,
        (booking_id, user_id, user_id),
    ).fetchone()
    return row is not None


def create_message(booking_id: int, user_id: int, message: str, created_at: int) -> int:
    c.execute(
        """
        INSERT INTO messages (booking_id, user_id, message, created_at)
        VALUES (%s, %s, %s, %s)
        RETURNING id
        """,
        (booking_id, user_id, message, created_at),
    )
    conn.commit()
    return int(c.fetchone()["id"])


def get_messages_for_booking(
    booking_id: int,
    limit: int = 50,
    after_id: int | None = None,
) -> list[dict]:
    if limit < 1:
        limit = 1
    if limit > 200:
        limit = 200

    if after_id is None:
        rows = c.execute(
            """
            SELECT
                m.id, m.booking_id, m.user_id, m.message, m.created_at,
                u.first_name AS user_first_name,
                u.last_name  AS user_last_name,
                u.role       AS user_role
            FROM messages m
            JOIN users u ON u.id = m.user_id
            WHERE m.booking_id = %s
            ORDER BY m.id DESC
            LIMIT %s
            """,
            (booking_id, limit),
        ).fetchall()

        return [dict(r) for r in rows][::-1]

    rows = c.execute(
        """
        SELECT
            m.id, m.booking_id, m.user_id, m.message, m.created_at,
            u.first_name AS user_first_name,
            u.last_name  AS user_last_name,
            u.role       AS user_role
        FROM messages m
        JOIN users u ON u.id = m.user_id
        WHERE m.booking_id = %s
          AND m.id > %s
        ORDER BY m.id ASC
        LIMIT %s
        """,
        (booking_id, int(after_id), limit),
    ).fetchall()

    return [dict(r) for r in rows]
