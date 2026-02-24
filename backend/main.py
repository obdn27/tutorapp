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
        path="/",
        max_age=REFRESH_DAYS * 24 * 3600
    )
    
    return {
        "message": "login ok",
        "access_token": access,
        # "refresh token": refresh,
        "token_type": "bearer",
    }

@app.post('/auth/register')
async def register(data: RegisterRequest):
    print("received register data:", data, pwd_context.hash(data.password))
    user_id = db.create_user(data.first_name, data.last_name, data.email, data.role, pwd_context.hash(data.password))
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
    print("refresh:", refresh_token)

    if refresh_token is None:
        raise HTTPException(status_code=401, detail="No refresh token")

    refresh_hash = hash_refresh_token(refresh_token)
    ts = now_ts()

    row = db.get_session(refresh_hash)
    print("got row for refresh token:", row)

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
    return {
        "message": "ok"
    }

@app.get('/auth/sessions')
def sessions(user_id: str = Depends(verify_access_token)):
    print("user_id", user_id)
    return {
        
    }