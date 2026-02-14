from pydantic import BaseModel

class DetailsRequest(BaseModel):
    fName: str
    lName: str
    email: str
    roleStudent: bool
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str