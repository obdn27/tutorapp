from fastapi import FastAPI, HTTPException, Response, Cookie, Depends
from fastapi.middleware.cors import CORSMiddleware
import sqlite3, time

import db
from availability import compute_availability
from auth import (
    authenticate_user,
    pwd_context,
    create_access_token,
    create_refresh_token,
    hash_refresh_token,
    now_ts,
    verify_access_token,
    REFRESH_DAYS,
)
from req_schemas import *

SECONDS_PER_DAY = 24 * 3600

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- helpers ----------

def require_role(user_id: int, role: int):
    r = db.get_user_role(user_id)
    if r is None:
        raise HTTPException(status_code=401, detail="Invalid user")
    if r != role:
        raise HTTPException(status_code=403, detail="Forbidden")

def require_tutor(user_id: int):
    require_role(user_id, 1)

def require_student(user_id: int):
    require_role(user_id, 0)

def validate_window(start_ts: int, end_ts: int, max_days: int, label="window"):
    if start_ts <= 0 or end_ts <= 0 or end_ts <= start_ts:
        raise HTTPException(status_code=400, detail=f"Invalid {label}")
    if end_ts - start_ts > max_days * 24 * 3600:
        raise HTTPException(status_code=400, detail=f"{label} too large (max {max_days} days)")

# Make dependency type consistent everywhere
def authed_user_id(user_id: int = Depends(verify_access_token)) -> int:
    return int(user_id)

# ---------- auth ----------

@app.post("/auth/signin")
async def signin(req: LoginRequest, response: Response):
    user = authenticate_user(req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    refresh_token = create_refresh_token()
    refresh_hash = hash_refresh_token(refresh_token)

    created = now_ts()
    expires = created + REFRESH_DAYS * SECONDS_PER_DAY
    db.create_session(user["id"], refresh_hash, expires, created)

    access = create_access_token(user["id"])

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # TODO true in prod (HTTPS)
        samesite="lax",
        path="/auth/refresh",
        max_age=REFRESH_DAYS * SECONDS_PER_DAY,
    )

    return {"message": "login ok", "access_token": access, "token_type": "bearer"}

@app.post("/auth/register_student")
async def register_student(data: RegisterStudentRequest):
    user_id = db.create_user(
        data.first_name, data.last_name, data.email, 0, pwd_context.hash(data.password)
    )
    if user_id == -1:
        raise HTTPException(status_code=409, detail="Email already exists")
    return {"message": "register ok", "id": user_id}

@app.post("/auth/register_tutor")
async def register_tutor(data: RegisterTutorRequest):
    user_id = db.create_user(
        data.first_name, data.last_name, data.email, 1, pwd_context.hash(data.password)
    )
    if user_id == -1:
        raise HTTPException(status_code=409, detail="Email already exists")

    db.set_tutor_details(user_id, data.subjects, data.hourly_gbp, data.bio)
    return {"message": "register ok", "id": user_id}

@app.post("/auth/refresh")
def refresh(refresh_token: str | None = Cookie(default=None)):
    if refresh_token is None:
        raise HTTPException(status_code=401, detail="No refresh token")

    refresh_hash = hash_refresh_token(refresh_token)
    ts = now_ts()

    row = db.get_session(refresh_hash)
    if not row:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id, expires_at, revoked = row
    if revoked or expires_at < ts:
        raise HTTPException(status_code=401, detail="Refresh token expired/revoked")

    return {"access_token": create_access_token(user_id), "token_type": "bearer"}

@app.post("/auth/signout")
def logout(response: Response, refresh_token: str | None = Cookie(default=None)):
    if refresh_token:
        db.delete_session(hash_refresh_token(refresh_token))
    response.delete_cookie(key="refresh_token", path="/auth/refresh")
    return {"message": "ok"}

# ---------- public data ----------

@app.get("/data/tutors")
def tutors():
    return db.get_all_tutors()

@app.get("/data/availability")
def get_tutor_availability(
    tutor_id: int,
    start_ts: int,
    end_ts: int,
    slot_s: int | None = None,
):
    validate_window(start_ts, end_ts, max_days=31, label="window")
    if slot_s is not None and slot_s <= 0:
        raise HTTPException(status_code=400, detail="slot_s must be > 0")

    hours = db.get_hours_by_weekday(tutor_id)
    if not hours:
        return {"intervals": []}

    bookings = db.get_tutor_bookings_in_window(tutor_id, start_ts, end_ts)
    off_times = db.get_off_times_in_window(tutor_id, start_ts, end_ts)

    free = compute_availability(
        window=(start_ts, end_ts),
        hours_by_weekday=hours,
        bookings=bookings,
        off_times=off_times,
        slot_s=slot_s,
    )
    return {"intervals": [{"start_ts": s, "end_ts": e} for (s, e) in free]}

# ---------- authed user ----------

@app.get("/data/me")
def get_my_info(user_id: int = Depends(authed_user_id)):
    return db.get_my_info(user_id)

@app.get("/data/bookings")
def list_bookings(user_id: int = Depends(authed_user_id)):
    role = db.get_user_role(user_id)
    if role is None:
        raise HTTPException(status_code=401, detail="Invalid user")

    if role == 0:
        return db.get_bookings_for_student(user_id)
    if role == 1:
        return db.get_bookings_for_tutor(user_id)

    raise HTTPException(status_code=403, detail="Not allowed")

@app.get("/data/bookings/{booking_id}")
def get_booking(booking_id: int, user_id: int = Depends(authed_user_id)):
    b = db.get_booking_detail(booking_id)
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user_id != b["tutor_id"] and user_id != b["student_id"]:
        raise HTTPException(status_code=404, detail="Booking not found")
    return b

@app.post("/data/can_book")
def can_book(payload: CanBookRequest, user_id: int = Depends(authed_user_id)):
    # if you only allow students to book:
    require_student(user_id)

    ok, reason = db.can_book_slot(
        tutor_id=payload.tutor_id,
        student_id=user_id,
        start_ts=payload.start_ts,
        end_ts=payload.end_ts,
    )
    return {"ok": ok, "reason": reason}

@app.post("/data/book")
def create_booking(payload: BookRequest, user_id: int = Depends(authed_user_id)):
    require_student(user_id)

    ok, reason, booking_id = db.create_booking_checked(
        tutor_id=payload.tutor_id,
        student_id=user_id,
        start_ts=payload.start_ts,
        end_ts=payload.end_ts,
        notes=payload.notes or "",
    )

    if ok:
        return {"id": booking_id, "message": "ok"}

    if reason in ("tutor_clash", "student_clash", "tutor_off_time"):
        raise HTTPException(status_code=409, detail=reason)

    raise HTTPException(status_code=400, detail=reason)

# ---------- tutor schedule management ----------

@app.post("/data/hours")
def set_hours(payload: HoursRequest, user_id: int = Depends(authed_user_id)):
    require_tutor(user_id)

    if payload.weekday < 0 or payload.weekday > 6:
        raise HTTPException(status_code=400, detail="weekday must be between 0 and 6")
    if payload.start_s < 0 or payload.start_s >= SECONDS_PER_DAY:
        raise HTTPException(status_code=400, detail="start_s must be between 0 and 86399")
    if payload.end_s <= 0 or payload.end_s > SECONDS_PER_DAY:
        raise HTTPException(status_code=400, detail="end_s must be between 1 and 86400")
    if payload.end_s <= payload.start_s:
        raise HTTPException(status_code=400, detail="end_s must be greater than start_s")

    try:
        db.set_hours(user_id, payload.start_s, payload.end_s, payload.weekday)
    except sqlite3.IntegrityError as e:
        raise HTTPException(status_code=400, detail="Invalid hours payload") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to set hours") from e

    return {"message": "ok"}

@app.get("/data/hours")
def get_my_hours(user_id: int = Depends(authed_user_id)):
    require_tutor(user_id)
    return db.get_user_hours(user_id)

@app.post("/data/off_time")
def add_off_time(payload: OffTimeRequest, user_id: int = Depends(authed_user_id)):
    require_tutor(user_id)  # off-times are for tutor availability in your model

    if payload.start_ts <= 0 or payload.end_ts <= 0:
        raise HTTPException(status_code=400, detail="Timestamps must be positive epoch seconds")
    if payload.end_ts <= payload.start_ts:
        raise HTTPException(status_code=400, detail="end_ts must be greater than start_ts")

    now = int(time.time())
    if payload.end_ts <= now:
        raise HTTPException(status_code=400, detail="Cannot block time entirely in the past")

    try:
        # IMPORTANT: ensure your db function name matches
        db.set_off_time(user_id, payload.start_ts, payload.end_ts)
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Invalid off-time range")
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to add off-time")

    return {"message": "ok"}

@app.get("/data/off_time")
def get_my_off_times(start_ts: int, end_ts: int, user_id: int = Depends(authed_user_id)):
    require_tutor(user_id)
    validate_window(start_ts, end_ts, max_days=90, label="window")
    return db.get_off_times(user_id, start_ts, end_ts)

@app.delete("/data/off_time/{off_id}")
def delete_my_off_time(off_id: int, user_id: int = Depends(authed_user_id)):
    require_tutor(user_id)

    row = db.get_off_time_by_id(off_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    if row["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Not found")  # hide existence

    db.delete_off_time(off_id)
    return {"message": "ok"}

# ---------- booking status ----------

@app.patch("/data/bookings/{booking_id}/status")
def patch_booking_status(booking_id: int, payload: StatusPatch, user_id: int = Depends(authed_user_id)):
    role = db.get_user_role(user_id)
    if role is None:
        raise HTTPException(status_code=401, detail="Invalid user")

    b = db.get_booking_by_id(booking_id)
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user_id != b["tutor_id"] and user_id != b["student_id"]:
        raise HTTPException(status_code=404, detail="Booking not found")

    new_status = payload.status
    if new_status not in ("requested", "confirmed", "canceled", "rejected", "completed"):
        raise HTTPException(status_code=400, detail="Invalid status")

    current = b["status"]
    allowed = set()
    if current == "requested":
        allowed = {"confirmed", "rejected", "canceled"}
    elif current == "confirmed":
        allowed = {"completed", "canceled"}

    if new_status == current:
        return {"message": "ok"}
    if new_status not in allowed:
        raise HTTPException(status_code=409, detail=f"Cannot change status from {current} to {new_status}")

    if user_id == b["student_id"] and new_status != "canceled":
        raise HTTPException(status_code=403, detail="Students can only cancel")

    if user_id == b["tutor_id"] and new_status not in ("confirmed", "rejected", "completed", "canceled"):
        raise HTTPException(status_code=403, detail="Tutors cannot set that status")

    db.update_booking_status(booking_id, new_status)
    return {"message": "ok"}