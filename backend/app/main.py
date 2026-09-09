"""FastAPI application factory and lifecycle wiring."""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal, create_tables, dispose_engine
from app.core.seed import seed_database
from app.routers.auth import router as auth_router
from app.routers.health import router as health_router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Create the local schema, seed data, and release engine resources."""

    await create_tables()
    if get_settings().seed_on_startup:
        async with AsyncSessionLocal() as session:
            await seed_database(session)
    yield
    await dispose_engine()


app = FastAPI(
    title="Meridian Care API",
    version="0.1.0",
    description="Secure access seed for internal care coordination.",
    lifespan=lifespan,
)
app.include_router(health_router)
app.include_router(auth_router)
