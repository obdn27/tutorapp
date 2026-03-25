from fastapi import FastAPI, HTTPException, Response, Cookie, Depends
from fastapi.middleware.cors import CORSMiddleware
import db, os, sqlite3, time
from availability import compute_availability

from dotenv import load_dotenv
load_dotenv()

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
SLOT_LENGTH = 30 * 60
IS_PROD = os.getenv("APP_ENV") == "production"

app = FastAPI()

def get_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    return origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),   # empty list = blocks all (good fail-closed)
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
        secure=IS_PROD,
        samesite="none" if IS_PROD else "lax",
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

    user_id = int(row["user_id"])
    expires_at = int(row["expires_at"])
    revoked = bool(row["revoked"])
    if revoked or expires_at < ts:
        raise HTTPException(status_code=401, detail="Refresh token expired/revoked")

    return {"access_token": create_access_token(user_id), "token_type": "bearer"}

@app.post("/auth/signout")
def logout(response: Response, refresh_token: str | None = Cookie(default=None)):
    if refresh_token:
        db.delete_session(hash_refresh_token(refresh_token))
    response.delete_cookie(key="refresh_token", path="/auth/refresh")
    return {"message": "ok"}

@app.post("/auth/change_password")
def change_password(payload: ChangePasswordRequest, user_id: int = Depends(verify_access_token)):
    # basic rule (you can add more later)
    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=400, detail="New password must be different")

    existing = db.get_pwd_hash(user_id)
    if not existing:
        raise HTTPException(status_code=401, detail="Invalid user")

    if not pwd_context.verify(payload.current_password, existing):
        # 403 fits your pattern: authed but not allowed because wrong current password
        raise HTTPException(status_code=403, detail="Current password incorrect")

    new_hash = pwd_context.hash(payload.new_password)
    db.set_pwd_hash(user_id, new_hash)

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
    res = db.get_my_info(user_id)
    res['slot_length'] = SLOT_LENGTH
    return res

@app.get("/data/bookings")
def list_bookings(
    user_id: int = Depends(verify_access_token),
    status: str | None = None,
    from_ts: int | None = None,
    to_ts: int | None = None,
    kind: str | None = None,  # "upcoming" | "past"
):
    role = db.get_user_role(user_id)
    if role is None:
        raise HTTPException(status_code=401, detail="Invalid user")

    if role == 0:
        bookings = db.get_bookings_for_student(user_id)
    elif role == 1:
        bookings = db.get_bookings_for_tutor(user_id)
    else:
        raise HTTPException(status_code=403, detail="Not allowed")

    # validate filters
    if status is not None:
        allowed = {"requested", "confirmed", "canceled", "rejected", "completed"}
        if status not in allowed:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        bookings = [b for b in bookings if b["status"] == status]

    if from_ts is not None:
        bookings = [b for b in bookings if b["end_ts"] > from_ts]

    if to_ts is not None:
        bookings = [b for b in bookings if b["start_ts"] < to_ts]

    if kind is not None:
        if kind not in ("upcoming", "past"):
            raise HTTPException(status_code=400, detail="Invalid kind filter")
        now = int(time.time())
        if kind == "upcoming":
            bookings = [b for b in bookings if b["end_ts"] > now]
        else:
            bookings = [b for b in bookings if b["end_ts"] <= now]

    return bookings

@app.get("/data/bookings/{booking_id}")
def get_booking(booking_id: int, user_id: int = Depends(authed_user_id)):
    b = db.get_booking_detail(booking_id)
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user_id != b["tutor_id"] and user_id != b["student_id"]:
        raise HTTPException(status_code=404, detail="Booking not found")
    return b

@app.get("/data/bookings/requests")
def tutor_requests(user_id: int = Depends(verify_access_token)):
    role = db.get_user_role(user_id)
    if role != 1:
        raise HTTPException(status_code=403, detail="Tutors only")

    bookings = db.get_bookings_for_tutor(user_id)
    return [b for b in bookings if b["status"] == "requested"]

@app.post("/data/can_book")
def can_book(payload: CanBookRequest, user_id: int = Depends(authed_user_id)):
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

# ---------- tutor data management ---------

@app.get("/data/tutor/me")
def get_tutor_me(user_id: int = Depends(verify_access_token)):
    role = db.get_user_role(user_id)
    if role != 1:
        raise HTTPException(status_code=403, detail="Tutors only")

    prof = db.get_tutor_profile(user_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    return prof

@app.patch("/data/tutor/me")
def patch_tutor_me(payload: TutorPatchRequest, user_id: int = Depends(verify_access_token)):
    role = db.get_user_role(user_id)
    if role != 1:
        raise HTTPException(status_code=403, detail="Tutors only")

    if payload.hourly_gbp is not None and payload.hourly_gbp <= 0:
        raise HTTPException(status_code=400, detail="hourly_gbp must be > 0")

    if payload.bio is not None and len(payload.bio) > 2000:
        raise HTTPException(status_code=400, detail="bio too long")

    db.update_tutor_profile(user_id, payload.hourly_gbp, payload.bio)
    return {"message": "ok"}

@app.put("/data/tutor/me/subjects")
def put_tutor_subjects(payload: TutorSubjectsRequest, user_id: int = Depends(verify_access_token)):
    role = db.get_user_role(user_id)
    if role != 1:
        raise HTTPException(status_code=403, detail="Tutors only")

    if not isinstance(payload.subjects, list) or len(payload.subjects) > 50:
        raise HTTPException(status_code=400, detail="Invalid subjects")

    db.replace_tutor_subjects(user_id, payload.subjects)
    return {"message": "ok"}

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
    print(start_ts, end_ts, user_id)
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

# ---------- student only endpoints ----------

@app.post("/data/bookings/{booking_id}/review")
def leave_review(booking_id: int, payload: ReviewRequest, user_id: int = Depends(verify_access_token)):
    role = db.get_user_role(user_id)
    if role != 0:
        raise HTTPException(status_code=403, detail="Students only")

    ok, reason = db.create_review(
        booking_id=booking_id,
        student_id=user_id,
        rating=payload.rating,
        comment=payload.comment,
    )

    if ok:
        return {"message": "ok"}

    if reason == "not_found":
        raise HTTPException(status_code=404, detail="Booking not found")
    if reason == "not_allowed":
        raise HTTPException(status_code=403, detail="Forbidden")
    if reason == "not_completed":
        raise HTTPException(status_code=409, detail="Booking not completed")
    if reason == "already_reviewed":
        raise HTTPException(status_code=409, detail="Already reviewed")

    raise HTTPException(status_code=500, detail="Failed to create review")

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

@app.post("/data/bookings/{booking_id}/reschedule")
def reschedule_booking(
    booking_id: int,
    payload: RescheduleRequest,  # start_ts, end_ts
    user_id: int = Depends(verify_access_token),
):
    b = db.get_booking_by_id(booking_id)

    print("payload, b: ", payload, b)

    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")

    if user_id != b["tutor_id"] and user_id != b["student_id"]:
        raise HTTPException(status_code=404, detail="Booking not found")

    if b["status"] in ("canceled", "rejected", "completed"):
        raise HTTPException(status_code=409, detail="Booking is not reschedulable")

    ok, reason = db.can_book_slot(
        tutor_id=b["tutor_id"],
        student_id=b["student_id"],
        start_ts=payload.start_ts,
        end_ts=payload.end_ts,
        exclude_booking_id=booking_id,
    )

    if not ok:
        if reason in ("tutor_clash", "student_clash", "tutor_off_time"):
            raise HTTPException(status_code=409, detail=reason)
        raise HTTPException(status_code=400, detail=reason)

    db.update_booking_time(booking_id, payload.start_ts, payload.end_ts)
    db.update_booking_status(booking_id, "requested")

    return {"message": "ok"}

# ---------- booking messages ----------

@app.get("/data/bookings/{booking_id}/messages")
def get_booking_messages(
    booking_id: int,
    after_id: int | None = None,
    limit: int = 50,
    user_id: int = Depends(authed_user_id),
):
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=400, detail="Invalid limit")

    b = db.get_booking_by_id(booking_id)
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")

    if user_id != b["tutor_id"] and user_id != b["student_id"]:
        # hide existence
        raise HTTPException(status_code=404, detail="Booking not found")

    msgs = db.get_messages_for_booking(booking_id, limit=limit, after_id=after_id)
    return {"messages": msgs}


@app.post("/data/bookings/{booking_id}/messages")
def send_booking_message(
    booking_id: int,
    payload: SendMessageRequest,
    user_id: int = Depends(authed_user_id),
):
    msg = (payload.message or "").strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Empty message")

    b = db.get_booking_by_id(booking_id)
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")

    if user_id != b["tutor_id"] and user_id != b["student_id"]:
        raise HTTPException(status_code=404, detail="Booking not found")

    created_at = int(time.time())
    msg_id = db.create_message(booking_id, user_id, msg, created_at)

    return {"message": "ok", "id": msg_id, "created_at": created_at}
