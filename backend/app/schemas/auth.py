"""Pydantic request and response contracts for authentication."""

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    """Credentials submitted by an internal user to begin a session."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class LoginResponse(BaseModel):
    """Public session details returned after successful authentication."""

    access_token: str
    token_type: str = "bearer"
    role: str
    name: str

    model_config = ConfigDict(frozen=True)
