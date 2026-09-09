"""API coverage for scoped member panels and care-work authorization."""

from collections.abc import Iterator
import os

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:////tmp/member_workspace_test.db"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client() -> Iterator[TestClient]:
    """Provide a client with the application lifespan and deterministic seed enabled."""

    with TestClient(app) as test_client:
        yield test_client


def login_headers(client: TestClient, email: str) -> dict[str, str]:
    """Authenticate a seeded role and return its bearer authorization header."""

    response = client.post("/api/v1/auth/login", json={"email": email, "password": "CareDemo1!"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def first_member_id(client: TestClient, headers: dict[str, str]) -> int:
    """Return one visible member ID for the supplied authorized role."""

    response = client.get("/api/v1/members", headers=headers)
    assert response.status_code == 200
    return response.json()["items"][0]["id"]


def test_coordinator_panel_is_scoped_and_supports_query_filter_sort_and_pagination(client: TestClient) -> None:
    """Return only panel members and honor supported bounded list controls."""

    headers = login_headers(client, "coordinator@example.com")
    response = client.get(
        "/api/v1/members",
        headers=headers,
        params={"query": "Member", "risk_level": "high", "plan": "Meridian Choice", "sort_by": "last_name", "sort_order": "desc", "limit": 2, "offset": 0},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["limit"] == 2
    assert payload["offset"] == 0
    assert payload["total"] >= len(payload["items"])
    assert all(item["risk_level"] == "high" and item["plan"] == "Meridian Choice" for item in payload["items"])
    assert client.get("/api/v1/members", headers=headers, params={"limit": 101}).status_code == 422


def test_detail_masks_identifiers_records_audit_and_returns_newest_outreach_first(client: TestClient) -> None:
    """Return masked identifiers, a view audit side effect, and ordered outreach."""

    headers = login_headers(client, "coordinator@example.com")
    member_id = first_member_id(client, headers)
    created = client.post(
        f"/api/v1/members/{member_id}/outreach",
        headers=headers,
        json={"channel": "phone", "outcome": "reached", "occurred_at": "2030-02-01T12:00:00Z", "notes": "Reached member."},
    )
    assert created.status_code == 201

    detail = client.get(f"/api/v1/members/{member_id}", headers=headers)
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["ssn_masked"].startswith("***-**-")
    assert payload["mbi_masked"].startswith("****")
    assert "ssn" not in payload and "mbi" not in payload
    assert payload["outreach"][0]["notes"] == "Reached member."

    audit_count = client.get("/api/v1/members", headers=headers)
    assert audit_count.status_code == 200


def test_supervisor_can_assign_but_coordinator_cannot_access_reassigned_member(client: TestClient) -> None:
    """Allow supervisor reassignment and fail closed for the former coordinator."""

    coordinator_headers = login_headers(client, "coordinator@example.com")
    supervisor_headers = login_headers(client, "supervisor@example.com")
    member_id = first_member_id(client, coordinator_headers)

    assignment = client.patch(
        f"/api/v1/members/{member_id}/assignment",
        headers=supervisor_headers,
        json={"coordinator_id": None},
    )
    assert assignment.status_code == 200
    assert assignment.json()["assigned_coordinator_id"] is None
    assert client.get(f"/api/v1/members/{member_id}", headers=coordinator_headers).status_code == 403


def test_authorized_worker_can_close_gap_log_validated_outreach_and_update_goal(client: TestClient) -> None:
    """Persist authorized care work and reject invalid outreach payloads."""

    headers = login_headers(client, "coordinator@example.com")
    member_id = first_member_id(client, headers)
    detail = client.get(f"/api/v1/members/{member_id}", headers=headers).json()
    gap_id = next(gap["id"] for gap in detail["gaps"] if gap["status"] == "open")
    goal_id = detail["care_plan_goals"][0]["id"]

    closed = client.post(f"/api/v1/members/{member_id}/gaps/{gap_id}/close", headers=headers, json={"reason": "Verified completion in chart"})
    assert closed.status_code == 200
    assert closed.json()["status"] == "closed"
    assert closed.json()["closed_reason"] == "Verified completion in chart"
    assert client.post(f"/api/v1/members/{member_id}/outreach", headers=headers, json={"channel": "pager", "outcome": "reached", "occurred_at": "2025-01-01T00:00:00Z", "notes": "Invalid"}).status_code == 422

    goal = client.patch(f"/api/v1/members/{member_id}/care-plan/{goal_id}", headers=headers, json={"status": "met"})
    assert goal.status_code == 200
    assert goal.json()["status"] == "met"


def test_auditor_reads_all_but_is_denied_all_writes(client: TestClient) -> None:
    """Allow auditor read visibility while refusing every care-work mutation."""

    auditor_headers = login_headers(client, "auditor@example.com")
    coordinator_headers = login_headers(client, "coordinator@example.com")
    auditor_panel = client.get("/api/v1/members", headers=auditor_headers)
    coordinator_panel = client.get("/api/v1/members", headers=coordinator_headers)
    assert auditor_panel.status_code == 200
    assert auditor_panel.json()["total"] >= coordinator_panel.json()["total"]
    member_id = first_member_id(client, auditor_headers)
    detail = client.get(f"/api/v1/members/{member_id}", headers=auditor_headers).json()
    assert client.post(f"/api/v1/members/{member_id}/gaps/{detail['gaps'][0]['id']}/close", headers=auditor_headers, json={"reason": "Not permitted"}).status_code == 403
    assert client.post(f"/api/v1/members/{member_id}/outreach", headers=auditor_headers, json={"channel": "phone", "outcome": "reached", "occurred_at": "2025-01-01T00:00:00Z", "notes": "Not permitted"}).status_code == 403
    assert client.patch(f"/api/v1/members/{member_id}/care-plan/{detail['care_plan_goals'][0]['id']}", headers=auditor_headers, json={"status": "met"}).status_code == 403
