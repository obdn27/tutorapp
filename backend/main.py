from fastapi import FastAPI, HTTPException, Response, Cookie, Depends
from fastapi.middleware.cors import CORSMiddleware
from auth import authenticate_user, pwd_context, create_access_token, create_refresh_token, hash_refresh_token, now_ts, verify_access_token
from auth import REFRESH_DAYS
from req_schemas import *
import db

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post('/auth/login')
async def login(req: LoginRequest, response: Response):
    user = authenticate_user(req.email, req.password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    refresh_token = create_refresh_token()
    refresh_hash = hash_refresh_token(refresh_token)

    created = now_ts()
    expires = created + REFRESH_DAYS * 24 * 3600

    db.create_session(user["id"], refresh_hash, expires, created)

    access = create_access_token(user["id"])

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,    # TODO: set to True when deploying
        samesite="lax",
        path="/auth/refresh",
        max_age=REFRESH_DAYS * 24 * 3600
    )
    
    return {
        "message": "login ok",
        "access_token": access,
        "token_type": "bearer",
    }

@app.post('/auth/register_student')
async def register_student(data: RegisterStudentRequest):
    user_id = db.create_user(data.first_name, data.last_name, data.email, 0, pwd_context.hash(data.password))
    print(user_id)
    if user_id == -1:
        raise HTTPException(status_code=401, detail="Email or name not unique")
    else:
        return {
            "message": "register ok",
            "id": user_id
        }
    
@app.post('/auth/register_tutor')
async def register_tutor(data: RegisterTutorRequest):
    user_id = db.create_user(data.first_name, data.last_name, data.email, 1, pwd_context.hash(data.password))
    db.set_tutor_details(user_id, data.subjects, data.hourly_gbp, data.bio)
    print(user_id)
    if user_id == -1:
        raise HTTPException(status_code=401, detail="Email or name not unique")
    else:
        return {
            "message": "register ok",
            "id": user_id
        }
    
@app.post('/auth/refresh')
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

    new_access = create_access_token(user_id)
    return {"access_token": new_access, "token_type": "bearer"}

@app.post('/auth/logout')
def logout(response: Response, refresh_token: str | None = Cookie(default=None)):
    print("logout received token", refresh_token)
    if refresh_token:
        db.delete_session(hash_refresh_token(refresh_token))

    response.delete_cookie(key="refresh_token", path="/auth/refresh")

    return {"message": "ok"}

@app.get('/data/sessions')
def sessions(response: Response, user_id: str | None = Depends(verify_access_token)):
    return {"message": "not implemented yet"}

@app.get('/data/tutors')
def tutors(response: Response, user_id: str | None = Depends(verify_access_token)):
    return db.get_all_tutors()

@app.post('/data/book')
def book(payload: BookRequest, response: Response, user_id: str | None = Depends(verify_access_token)):
    print("booking request received, here is info:")
    print(user_id)
    db.add_new_booking(payload.tutor_id, user_id, payload.start_ts, payload.end_ts, payload.notes)
    return {"message": "ok"}

@app.get("/data/bookings")
def list_bookings(user_id: int = Depends(verify_access_token)):
    role = db.get_user_role(user_id)
    if role is None:
        raise HTTPException(status_code=401, detail="Invalid user")

    if role == 0:
        res = db.get_bookings_for_student(user_id)
        print("student bookings", res)
        return res

    if role == 1:
        res = db.get_bookings_for_tutor(user_id)
        print(res)
        return res

    raise HTTPException(status_code=403, detail="Not allowed")

@app.get("/data/me")
def get_my_info(user_id: int = Depends(verify_access_token)):
    print("getting info of user_id:", user_id)
    return db.get_my_info(user_id)