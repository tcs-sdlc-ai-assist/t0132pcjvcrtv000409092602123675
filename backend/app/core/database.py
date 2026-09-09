"""Async SQLAlchemy engine and session lifecycle helpers."""

from collections.abc import AsyncGenerator
from pathlib import Path
from urllib.parse import unquote

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


def create_database_parent(database_url: str) -> None:
    """Create the parent directory for a file-backed SQLite database URL."""

    if not database_url.startswith("sqlite") or ":memory:" in database_url:
        return
    database_path = unquote(database_url.split("///", maxsplit=1)[-1])
    if database_path and database_path != database_url:
        Path(database_path).parent.mkdir(parents=True, exist_ok=True)


settings = get_settings()
create_database_parent(settings.database_url)
engine = create_async_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    """Declarative base class for Meridian database entities."""


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session and ensure it closes afterward."""

    async with AsyncSessionLocal() as session:
        yield session


async def create_tables() -> None:
    """Create the SQLite schema used by the local application lifecycle."""

    from app.models.entities import AuditLog, CareGap, CarePlanGoal, Coordinator, Member, Outreach

    _ = (AuditLog, CareGap, CarePlanGoal, Coordinator, Member, Outreach)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)


async def dispose_engine() -> None:
    """Dispose pooled database resources during application shutdown."""

    await engine.dispose()
