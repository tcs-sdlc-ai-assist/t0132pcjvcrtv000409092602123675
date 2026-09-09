"""API coverage for role-scoped dashboard aggregation and attention signals."""

import os
from pathlib import Path

TEST_DATABASE_PATH = Path("/tmp/meridian-dashboard-api.sqlite3")
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:////tmp/meridian-dashboard-api.sqlite3"
os.environ["JWT_SECRET"] = "dashboard-test-secret"
os.environ["SEED_ON_STARTUP"] = "true"

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal, dispose_engine
from app.main import app
from app.models.entities import CareGap, Member


@pytest_asyncio.fixture(autouse=True)
async def initialized_application() -> None:
    """Run each API test against a clean file-backed async SQLite database."""

    get_settings.cache_clear()
    await dispose_engine()
    if TEST_DATABASE_PATH.exists():
        TEST_DATABASE_PATH.unlink()
    async with app.router.lifespan_context(app):
        yield
    await dispose_engine()
    if TEST_DATABASE_PATH.exists():
        TEST_DATABASE_PATH.unlink()


async def login_headers(client: AsyncClient, email: str) -> dict[str, str]:
    """Authenticate a seeded staff account for a protected request."""

    response = await client.post("/api/v1/auth/login", json={"email": email, "password": "CareDemo1!"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.mark.asyncio
async def test_dashboard_requires_authentication_and_returns_all_kpi_fields() -> None:
    """Reject anonymous access and expose the five promised metrics when signed in."""

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        assert (await client.get("/api/v1/dashboard")).status_code == 401
        headers = await login_headers(client, "coordinator@example.com")
        response = await client.get("/api/v1/dashboard", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert set(payload["metrics"]) == {
        "members_assigned",
        "open_care_gaps",
        "outreach_this_week",
        "high_risk_members",
        "gap_closure_rate_percent",
    }
    assert payload["metrics"]["members_assigned"] == 20
    assert payload["metrics"]["open_care_gaps"] == 20
    assert payload["gaps_by_type"] == [{"category": "Annual wellness visit", "count": 20}]


@pytest.mark.asyncio
async def test_dashboard_scope_is_limited_for_coordinator_and_allows_supervisor_and_auditor() -> None:
    """Apply panel scope to coordinators while privileged dashboard roles see all members."""

    async with AsyncSessionLocal() as session:
        member = await session.scalar(select(Member).where(Member.member_key == "MEM-DEMO-001"))
        assert member is not None
        member.assigned_coordinator_id = None
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        coordinator = await client.get("/api/v1/dashboard", headers=await login_headers(client, "coordinator@example.com"))
        supervisor = await client.get("/api/v1/dashboard", headers=await login_headers(client, "supervisor@example.com"))
        auditor = await client.get("/api/v1/dashboard", headers=await login_headers(client, "auditor@example.com"))

    assert coordinator.json()["metrics"]["members_assigned"] == 19
    assert supervisor.json()["metrics"]["members_assigned"] == 20
    assert auditor.json()["metrics"]["members_assigned"] == 20


@pytest.mark.asyncio
async def test_dashboard_lists_high_risk_members_with_overdue_open_gaps() -> None:
    """Surface high-risk members only when their open care gap is overdue."""

    async with AsyncSessionLocal() as session:
        member = await session.scalar(select(Member).where(Member.member_key == "MEM-DEMO-003"))
        gap = await session.scalar(select(CareGap).where(CareGap.member_id == member.id))
        assert gap is not None
        gap.due_date = __import__("datetime").date(2020, 1, 1)
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/dashboard", headers=await login_headers(client, "coordinator@example.com"))

    assert response.status_code == 200
    attention = response.json()["attention_needed"]
    assert any(item["member_id"] == member.id and item["member_key"] == "MEM-DEMO-003" for item in attention)
    assert all(item["overdue_gap_count"] >= 1 for item in attention)


@pytest.mark.asyncio
async def test_dashboard_rejects_malformed_authorization_without_server_error() -> None:
    """A malformed bearer token fails authentication rather than leaking dashboard data."""

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/dashboard", headers={"Authorization": "Bearer not.a.jwt"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid access token"}
