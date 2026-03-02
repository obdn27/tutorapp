from typing import List
from pydantic import BaseModel

class RegisterStudentRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str

class RegisterTutorRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    hourly_gbp: int
    subjects: List[str]
    bio: str

class LoginRequest(BaseModel):
    email: str
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class BookRequest(BaseModel):
    tutor_id: int
    start_ts: int
    end_ts: int
    notes: str