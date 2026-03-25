from typing import List
from pydantic import BaseModel, Field

class RegisterStudentRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str = Field(min_length=6, max_length=256)

class RegisterTutorRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str = Field(min_length=6, max_length=256)
    hourly_gbp: int
    subjects: List[str]
    bio: str

class LoginRequest(BaseModel):
    email: str
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class CanBookRequest(BaseModel):
    tutor_id: int
    start_ts: int
    end_ts: int

class BookRequest(BaseModel):
    tutor_id: int
    start_ts: int
    end_ts: int
    notes: str = ""

class StatusPatch(BaseModel):
    status: str

class HoursRequest(BaseModel):
    start_s: int
    end_s: int
    weekday: int

class OffTimeRequest(BaseModel):
    start_ts: int
    end_ts: int

class RescheduleRequest(BaseModel):
    start_ts: int
    end_ts: int

class TutorPatchRequest(BaseModel):
    hourly_gbp: int | None = None
    bio: str | None = None

class TutorSubjectsRequest(BaseModel):
    subjects: list[str]

class ReviewRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = None

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=6, max_length=256)

class SendMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
