"""Cross-feature login, member-care action, and dashboard consistency coverage."""

import os
from pathlib import Path

TEST_DATABASE_PATH = Path("/tmp/meridian-dashboard-integration.sqlite3")
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:////tmp/meridian-dashboard-integration.sqlite3"
os.environ["JWT_SECRET"] = "dashboard-integration-secret"
os.environ["SEED_ON_STARTUP"] = "true"

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from sqlalchemy import func, select

from app.core.database import AsyncSessionLocal, dispose_engine
from app.main import app
from app.models.entities import AuditLog, CareGap, Outreach


@pytest_asyncio.fixture(autouse=True)
async def initialized_application() -> None:
    """Run the complete multi-route flow against a clean persistent SQLite file."""

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
async def test_gap_closure_changes_scoped_dashboard_open_count_and_rate() -> None:
    """Chain login, member read, gap closure, and dashboard refresh through real routes."""

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post("/api/v1/auth/login", json={"email": "coordinator@example.com", "password": "CareDemo1!"})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        before = await client.get("/api/v1/dashboard", headers=headers)
        assert before.status_code == 200
        member_panel = await client.get("/api/v1/members?limit=1", headers=headers)
        assert member_panel.status_code == 200
        member_id = member_panel.json()["items"][0]["id"]
        member = await client.get(f"/api/v1/members/{member_id}", headers=headers)
        assert member.status_code == 200
        gap_id = next(gap["id"] for gap in member.json()["gaps"] if gap["status"] == "open")
        closed = await client.post(
            f"/api/v1/members/{member_id}/gaps/{gap_id}/close",
            headers=headers,
            json={"reason": "Confirmed preventive visit completion"},
        )
        assert closed.status_code == 200
        after = await client.get("/api/v1/dashboard", headers=headers)

    assert after.status_code == 200
    assert after.json()["metrics"]["open_care_gaps"] == before.json()["metrics"]["open_care_gaps"] - 1
    assert after.json()["metrics"]["gap_closure_rate_percent"] > before.json()["metrics"]["gap_closure_rate_percent"]


@pytest.mark.asyncio
async def test_failed_duplicate_gap_action_keeps_dashboard_database_and_audit_consistent() -> None:
    """A rejected already-closed action leaves care data and audit state unchanged after failure."""

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post("/api/v1/auth/login", json={"email": "coordinator@example.com", "password": "CareDemo1!"})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        panel = await client.get("/api/v1/members?limit=100", headers=headers)
        assert panel.status_code == 200
        member_id = None
        gap_id = None
        for item in panel.json()["items"]:
            detail = await client.get(f"/api/v1/members/{item['id']}", headers=headers)
            assert detail.status_code == 200
            open_gap = next((gap for gap in detail.json()["gaps"] if gap["status"] == "open"), None)
            if open_gap is not None:
                member_id = item["id"]
                gap_id = open_gap["id"]
                break
        assert member_id is not None
        assert gap_id is not None
        baseline_dashboard = await client.get("/api/v1/dashboard", headers=headers)
        assert baseline_dashboard.status_code == 200
        first_close = await client.post(f"/api/v1/members/{member_id}/gaps/{gap_id}/close", headers=headers, json={"reason": "Verified completed care"})
        assert first_close.status_code == 200
        after_close_dashboard = await client.get("/api/v1/dashboard", headers=headers)
        assert after_close_dashboard.status_code == 200

        async with AsyncSessionLocal() as session:
            audit_before_failure = await session.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "care_gap_closed"))
            gap_before_failure = await session.get(CareGap, gap_id)
            assert gap_before_failure is not None
            assert gap_before_failure.status == "closed"
            outreach_before_failure = await session.scalar(select(func.count()).select_from(Outreach).where(Outreach.member_id == member_id))

        rejected = await client.post(f"/api/v1/members/{member_id}/gaps/{gap_id}/close", headers=headers, json={"reason": "Second closure attempt"})
        after_failure_dashboard = await client.get("/api/v1/dashboard", headers=headers)
        reread = await client.get(f"/api/v1/members/{member_id}", headers=headers)

    assert rejected.status_code == 409
    assert rejected.json() == {"detail": "Care gap is already closed"}
    assert after_failure_dashboard.status_code == 200
    assert after_failure_dashboard.json()["metrics"] == after_close_dashboard.json()["metrics"]
    assert reread.status_code == 200
    assert next(gap for gap in reread.json()["gaps"] if gap["id"] == gap_id)["status"] == "closed"

    async with AsyncSessionLocal() as session:
        audit_after_failure = await session.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "care_gap_closed"))
        gap_after_failure = await session.get(CareGap, gap_id)
        outreach_after_failure = await session.scalar(select(func.count()).select_from(Outreach).where(Outreach.member_id == member_id))

    assert audit_after_failure == audit_before_failure
    assert gap_after_failure is not None
    assert gap_after_failure.status == "closed"
    assert outreach_after_failure == outreach_before_failure
    assert after_close_dashboard.json()["metrics"]["open_care_gaps"] == baseline_dashboard.json()["metrics"]["open_care_gaps"] - 1
