from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in {"organization", "expert"}:
            raise ValueError("role must be organization or expert")
        return v

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        return v


class RegisterResponse(BaseModel):
    user_id: int
    email: str
    role: str
    is_email_verified: bool
    created_at: datetime


class VerifyEmailRequest(BaseModel):
    token: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserInToken(BaseModel):
    user_id: int
    email: str
    role: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    user: UserInToken


class RefreshRequest(BaseModel):
    refresh_token: str


class UpdateMeRequest(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    current_password: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        return v
