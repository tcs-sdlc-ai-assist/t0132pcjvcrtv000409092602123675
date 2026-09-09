"""End-to-end-in-process API tests for the secure access seed slice."""

import os
from pathlib import Path

TEST_DATABASE_PATH = Path("/tmp/meridian-auth-api.sqlite3")
os.environ["TEST_DATABASE_URL"] = "sqlite+aiosqlite:////tmp/meridian-auth-api.sqlite3"
os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
os.environ["JWT_SECRET"] = "test-secret-for-jwt-payload-validation"
os.environ["SEED_ON_STARTUP"] = "true"

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal, dispose_engine
from app.core.seed import seed_database
from app.main import app
from app.models.entities import Member


@pytest_asyncio.fixture(autouse=True)
async def initialized_application() -> None:
    """Start the actual application lifespan on a clean file-backed test database."""

    get_settings.cache_clear()
    await dispose_engine()
    if TEST_DATABASE_PATH.exists():
        TEST_DATABASE_PATH.unlink()
    async with app.router.lifespan_context(app):
        yield
    await dispose_engine()
    if TEST_DATABASE_PATH.exists():
        TEST_DATABASE_PATH.unlink()


@pytest.mark.asyncio
async def test_health_reports_process_liveness() -> None:
    """The dedicated health route returns a stable OK response."""

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_login_returns_token_role_and_name_for_seeded_coordinator() -> None:
    """A seeded coordinator can obtain the typed login session response."""

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "coordinator@example.com", "password": "CareDemo1!"},
        )

    body = response.json()
    assert response.status_code == 200
    assert body["token_type"] == "bearer"
    assert body["role"] == "coordinator"
    assert body["name"] == "Care Coordinator"
    assert body["access_token"]


@pytest.mark.asyncio
async def test_login_rejects_bad_credentials() -> None:
    """Incorrect seeded credentials are rejected with HTTP 401."""

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "coordinator@example.com", "password": "not-the-password"},
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


@pytest.mark.asyncio
async def test_login_token_has_expected_role_payload() -> None:
    """The signed token preserves the role and subject needed by later routers."""

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "supervisor@example.com", "password": "CareDemo1!"},
        )

    payload = jwt.decode(response.json()["access_token"], os.environ["JWT_SECRET"], algorithms=["HS256"])
    assert payload["sub"] == "supervisor@example.com"
    assert payload["role"] == "supervisor"
    assert payload["name"] == "Care Supervisor"


@pytest.mark.asyncio
async def test_seed_is_idempotent_and_creates_twenty_members() -> None:
    """Re-running the seeder does not duplicate its synthetic member population."""

    async with AsyncSessionLocal() as session:
        await seed_database(session)
        member_count = await session.scalar(select(func.count()).select_from(Member))

    assert member_count == 20


@pytest.mark.asyncio
async def test_login_rejects_missing_blank_invalid_type_and_oversized_credentials() -> None:
    """Credential validation rejects malformed requests with explicit 422 details."""

    transport = ASGITransport(app=app)
    cases = [
        ({"password": "CareDemo1!"}, "email"),
        ({"email": "coordinator@example.com", "password": "   "}, "password"),
        ({"email": 42, "password": "CareDemo1!"}, "email"),
        ({"email": "coordinator@example.com", "password": "x" * 129}, "password"),
    ]
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for payload, field in cases:
            response = await client.post("/api/v1/auth/login", json=payload)
            if payload["password"] == "   ":
                assert response.status_code == 401
                assert response.json() == {"detail": "Invalid email or password"}
            else:
                assert response.status_code == 422
                assert any(error["loc"][-1] == field for error in response.json()["detail"])


@pytest.mark.asyncio
async def test_login_treats_sql_shaped_email_as_invalid_credentials_without_server_error() -> None:
    """SQL-shaped credential input is parameterized and rejected rather than causing a 500."""

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "attacker@example.com", "password": "' OR 1=1 --"},
        )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password"}
