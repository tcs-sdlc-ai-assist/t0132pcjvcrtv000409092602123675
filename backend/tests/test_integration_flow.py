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
from app.core.database import dispose_engine
from app.main import app


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
