"""Business logic for credential verification and session creation."""

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, verify_password
from app.models.entities import Coordinator
from app.schemas.auth import LoginResponse


async def authenticate_coordinator(session: AsyncSession, email: str, password: str) -> LoginResponse | None:
    """Validate credentials and return a signed session response when valid."""

    result = await session.execute(select(Coordinator).where(Coordinator.email == email.lower()))
    coordinator = result.scalar_one_or_none()
    if coordinator is None or not coordinator.is_active:
        return None
    password_is_valid = await asyncio.to_thread(verify_password, password, coordinator.password_hash)
    if not password_is_valid:
        return None
    return LoginResponse(
        access_token=create_access_token(coordinator.email, coordinator.role, coordinator.full_name),
        role=coordinator.role,
        name=coordinator.full_name,
    )
