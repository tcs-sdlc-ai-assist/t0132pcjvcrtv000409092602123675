"""API coverage for scoped member panels and care-work authorization."""

from collections.abc import Iterator
import asyncio
import os
from pathlib import Path
import sqlite3

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:////tmp/member_workspace_test.db"
os.environ["JWT_SECRET"] = "member-api-test-secret"
os.environ["SEED_ON_STARTUP"] = "true"
TEST_DATABASE_PATH = Path("/tmp/member_workspace_test.db")

import pytest
from fastapi.testclient import TestClient

from app.core.database import AsyncSessionLocal
from app.main import app
from app.models.entities import Coordinator
from sqlalchemy.exc import IntegrityError


@pytest.fixture()
def client() -> Iterator[TestClient]:
    """Provide a clean file-backed client with the application lifespan and deterministic seed enabled."""

    TEST_DATABASE_PATH.unlink(missing_ok=True)
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


def member_with_open_gap(client: TestClient, headers: dict[str, str]) -> tuple[int, int]:
    """Return a visible member and an open gap, independent of earlier mutations."""

    panel = client.get("/api/v1/members", headers=headers, params={"limit": 100})
    assert panel.status_code == 200
    for item in panel.json()["items"]:
        detail = client.get(f"/api/v1/members/{item['id']}", headers=headers)
        assert detail.status_code == 200
        for gap in detail.json()["gaps"]:
            if gap["status"] == "open":
                return item["id"], gap["id"]
    pytest.fail("Expected seeded file-backed database to contain an open care gap")


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


def test_panel_rows_include_real_pcp_and_newest_persisted_outreach_timestamp(client: TestClient) -> None:
    """Return each visible member's stored PCP and newest outreach occurrence in the panel."""

    headers = login_headers(client, "coordinator@example.com")
    member_id = first_member_id(client, headers)
    detail = client.get(f"/api/v1/members/{member_id}", headers=headers)
    assert detail.status_code == 200
    older = client.post(
        f"/api/v1/members/{member_id}/outreach",
        headers=headers,
        json={"channel": "phone", "outcome": "reached", "occurred_at": "2029-01-01T12:00:00Z", "notes": "Earlier panel outreach."},
    )
    newer = client.post(
        f"/api/v1/members/{member_id}/outreach",
        headers=headers,
        json={"channel": "SMS", "outcome": "left message", "occurred_at": "2030-01-01T12:00:00Z", "notes": "Newest panel outreach."},
    )
    panel = client.get("/api/v1/members", headers=headers, params={"limit": 100})

    assert older.status_code == 201
    assert newer.status_code == 201
    assert panel.status_code == 200
    row = next(item for item in panel.json()["items"] if item["id"] == member_id)
    assert row["pcp"] == detail.json()["pcp"]
    assert row["last_outreach_at"] == newer.json()["occurred_at"]


def test_panel_sorts_by_pcp_and_latest_outreach_without_duplicate_members(client: TestClient) -> None:
    """Order PCPs and aggregate newest outreach timestamps while retaining one row per member."""

    headers = login_headers(client, "supervisor@example.com")
    panel = client.get("/api/v1/members", headers=headers, params={"limit": 100})
    assert panel.status_code == 200
    first_member_id, second_member_id = [item["id"] for item in panel.json()["items"][:2]]
    for member_id, occurred_at in ((first_member_id, "2030-01-01T12:00:00Z"), (second_member_id, "2031-01-01T12:00:00Z")):
        created = client.post(
            f"/api/v1/members/{member_id}/outreach",
            headers=headers,
            json={"channel": "phone", "outcome": "reached", "occurred_at": occurred_at, "notes": "Sorting coverage."},
        )
        assert created.status_code == 201

    pcp_sorted = client.get("/api/v1/members", headers=headers, params={"sort_by": "pcp", "sort_order": "asc", "limit": 100})
    outreach_sorted = client.get("/api/v1/members", headers=headers, params={"sort_by": "last_outreach", "sort_order": "desc", "limit": 100})

    assert pcp_sorted.status_code == 200
    assert outreach_sorted.status_code == 200
    pcp_items = pcp_sorted.json()["items"]
    outreach_items = outreach_sorted.json()["items"]
    assert [item["pcp"] for item in pcp_items] == sorted(item["pcp"] for item in pcp_items)
    assert len({item["id"] for item in outreach_items}) == len(outreach_items)
    assert outreach_items[0]["id"] == second_member_id
    assert outreach_items[1]["id"] == first_member_id


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


async def _create_second_coordinator() -> int:
    """Create a valid assignment target through the application's active async session."""

    async with AsyncSessionLocal() as session:
        coordinator = Coordinator(
            coordinator_key="COO-TEST-SECOND",
            email="second.coordinator@example.com",
            full_name="Second Care Coordinator",
            role="coordinator",
            password_hash="not-used-for-login",
        )
        session.add(coordinator)
        await session.commit()
        await session.refresh(coordinator)
        return coordinator.id


def real_second_coordinator_id() -> int:
    """Return a real coordinator ID connected to the application under test."""

    return asyncio.run(_create_second_coordinator())


def test_supervisor_coordinator_filter_returns_only_members_assigned_to_that_real_coordinator(client: TestClient) -> None:
    """Allow supervisor panels to filter by an actual assigned coordinator ID."""

    supervisor_headers = login_headers(client, "supervisor@example.com")
    coordinator_headers = login_headers(client, "coordinator@example.com")
    assigned_coordinator_id = first_member_id(client, coordinator_headers)
    assigned_member = client.get(f"/api/v1/members/{assigned_coordinator_id}", headers=supervisor_headers)
    assert assigned_member.status_code == 200
    coordinator_id = assigned_member.json()["assigned_coordinator_id"]
    assert coordinator_id is not None

    response = client.get("/api/v1/members", headers=supervisor_headers, params={"coordinator_id": coordinator_id, "limit": 100})

    assert response.status_code == 200
    assert response.json()["total"] > 0
    assert all(item["assigned_coordinator_id"] == coordinator_id for item in response.json()["items"])


def test_coordinator_assignment_is_forbidden_and_supervisor_reassignment_to_real_coordinator_persists(client: TestClient) -> None:
    """Enforce supervisor-only assignments and persist reassignment to a valid coordinator."""

    coordinator_headers = login_headers(client, "coordinator@example.com")
    supervisor_headers = login_headers(client, "supervisor@example.com")
    member_id = first_member_id(client, coordinator_headers)
    second_coordinator_id = real_second_coordinator_id()

    forbidden = client.patch(
        f"/api/v1/members/{member_id}/assignment",
        headers=coordinator_headers,
        json={"coordinator_id": second_coordinator_id},
    )
    reassigned = client.patch(
        f"/api/v1/members/{member_id}/assignment",
        headers=supervisor_headers,
        json={"coordinator_id": second_coordinator_id},
    )
    reread = client.get(f"/api/v1/members/{member_id}", headers=supervisor_headers)

    assert forbidden.status_code == 403
    assert forbidden.json() == {"detail": "Supervisor access is required"}
    assert reassigned.status_code == 200
    assert reassigned.json()["assigned_coordinator_id"] == second_coordinator_id
    assert reread.status_code == 200
    assert reread.json()["assigned_coordinator_id"] == second_coordinator_id
    assert reread.json()["assigned_coordinator_id"] == second_coordinator_id


def test_cross_member_gap_and_goal_operations_return_documented_404(client: TestClient) -> None:
    """Do not allow a nested gap or goal from one member to be addressed through another."""

    supervisor_headers = login_headers(client, "supervisor@example.com")
    panel = client.get("/api/v1/members", headers=supervisor_headers, params={"limit": 100})
    assert panel.status_code == 200
    first_member_id = panel.json()["items"][0]["id"]
    second_member_id = panel.json()["items"][1]["id"]
    second_detail = client.get(f"/api/v1/members/{second_member_id}", headers=supervisor_headers)
    assert second_detail.status_code == 200
    second_gap_id = second_detail.json()["gaps"][0]["id"]
    second_goal_id = second_detail.json()["care_plan_goals"][0]["id"]

    wrong_member_gap = client.post(
        f"/api/v1/members/{first_member_id}/gaps/{second_gap_id}/close",
        headers=supervisor_headers,
        json={"reason": "Wrong member must not close this gap"},
    )
    wrong_member_goal = client.patch(
        f"/api/v1/members/{first_member_id}/care-plan/{second_goal_id}",
        headers=supervisor_headers,
        json={"status": "in-progress"},
    )

    assert wrong_member_gap.status_code == 404
    assert wrong_member_gap.json() == {"detail": "Care gap was not found"}
    assert wrong_member_goal.status_code == 404
    assert wrong_member_goal.json() == {"detail": "Care-plan goal was not found"}


def test_supervisor_assignment_of_missing_member_returns_documented_404(client: TestClient) -> None:
    """Exercise assignment's missing-member branch before assignee validation."""

    supervisor_headers = login_headers(client, "supervisor@example.com")
    response = client.patch(
        "/api/v1/members/999999/assignment",
        headers=supervisor_headers,
        json={"coordinator_id": None},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Member was not found"}


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
    member_id, gap_id = member_with_open_gap(client, headers)
    detail = client.get(f"/api/v1/members/{member_id}", headers=headers).json()
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


def test_member_list_rejects_invalid_filters_sorts_types_and_oversized_search(client: TestClient) -> None:
    """List contract rejects unsupported enum-like controls and bounded-input violations."""

    headers = login_headers(client, "coordinator@example.com")
    cases = [
        ({"sort_by": "drop table"}, "sort_by"),
        ({"sort_order": "sideways"}, "sort_order"),
        ({"limit": "many"}, "limit"),
        ({"query": "x" * 121}, "query"),
    ]
    for params, field in cases:
        response = client.get("/api/v1/members", headers=headers, params=params)
        assert response.status_code == 422
        assert any(error["loc"][-1] == field for error in response.json()["detail"])


def test_member_filters_sorting_and_sql_shaped_search_have_safe_deterministic_results(client: TestClient) -> None:
    """Supported filters/sorts work while hostile search text yields an empty safe response."""

    headers = login_headers(client, "coordinator@example.com")
    sorted_response = client.get(
        "/api/v1/members",
        headers=headers,
        params={"risk_level": "high", "sort_by": "date_of_birth", "sort_order": "desc"},
    )
    assert sorted_response.status_code == 200
    sorted_items = sorted_response.json()["items"]
    assert all(item["risk_level"] == "high" for item in sorted_items)
    assert [item["date_of_birth"] for item in sorted_items] == sorted(
        (item["date_of_birth"] for item in sorted_items), reverse=True
    )

    hostile = client.get("/api/v1/members", headers=headers, params={"query": "' OR 1=1 --"})
    assert hostile.status_code == 200
    assert hostile.json()["items"] == []
    assert hostile.json()["total"] == 0


def test_member_and_nested_resource_absence_return_explicit_404_bodies(client: TestClient) -> None:
    """Absent members, gaps, and goals fail with their documented not-found responses."""

    headers = login_headers(client, "coordinator@example.com")
    member_id = first_member_id(client, headers)
    missing_member = client.get("/api/v1/members/999999", headers=headers)
    missing_gap = client.post(f"/api/v1/members/{member_id}/gaps/999999/close", headers=headers, json={"reason": "Documented reason"})
    missing_goal = client.patch(f"/api/v1/members/{member_id}/care-plan/999999", headers=headers, json={"status": "met"})

    assert missing_member.status_code == 404
    assert missing_member.json() == {"detail": "Member was not found"}
    assert missing_gap.status_code == 404
    assert missing_gap.json() == {"detail": "Care gap was not found"}
    assert missing_goal.status_code == 404
    assert missing_goal.json() == {"detail": "Care-plan goal was not found"}


def test_mutation_requests_reject_missing_blank_wrong_type_invalid_enum_and_oversized_values(client: TestClient) -> None:
    """Care-work request models reject malformed bodies before any state is changed."""

    headers = login_headers(client, "coordinator@example.com")
    member_id, gap_id = member_with_open_gap(client, headers)
    detail = client.get(f"/api/v1/members/{member_id}", headers=headers).json()
    goal_id = detail["care_plan_goals"][0]["id"]
    cases = [
        ("post", f"/api/v1/members/{member_id}/gaps/{gap_id}/close", {}, "reason"),
        ("post", f"/api/v1/members/{member_id}/gaps/{gap_id}/close", {"reason": "   "}, "reason"),
        ("post", f"/api/v1/members/{member_id}/gaps/{gap_id}/close", {"reason": 7}, "reason"),
        ("post", f"/api/v1/members/{member_id}/gaps/{gap_id}/close", {"reason": "r" * 501}, "reason"),
        ("post", f"/api/v1/members/{member_id}/outreach", {"channel": "pager", "outcome": "reached", "occurred_at": "2030-01-01T00:00:00Z", "notes": "note"}, "channel"),
        ("post", f"/api/v1/members/{member_id}/outreach", {"channel": "SMS", "outcome": "unknown", "occurred_at": "2030-01-01T00:00:00Z", "notes": "note"}, "outcome"),
        ("post", f"/api/v1/members/{member_id}/outreach", {"channel": "mail", "outcome": "reached", "occurred_at": "2030-01-01T00:00:00Z", "notes": " "}, "notes"),
        ("patch", f"/api/v1/members/{member_id}/care-plan/{goal_id}", {"status": "complete"}, "status"),
    ]
    for method, url, payload, field in cases:
        response = getattr(client, method)(url, headers=headers, json=payload)
        assert response.status_code == 422
        assert any(error["loc"][-1] == field for error in response.json()["detail"])


def test_state_transitions_reread_detail_and_preserve_hostile_text_as_data(client: TestClient) -> None:
    """Close, outreach, and goal actions persist exact safe data and are visible on re-read."""

    headers = login_headers(client, "coordinator@example.com")
    member_id, gap_id = member_with_open_gap(client, headers)
    detail = client.get(f"/api/v1/members/{member_id}", headers=headers).json()
    goal_id = detail["care_plan_goals"][0]["id"]
    hostile_reason = "<script>alert('x')</script> ' OR 1=1 --"
    hostile_notes = "<img src=x onerror=alert(1)>; DROP TABLE outreach;"

    closed = client.post(f"/api/v1/members/{member_id}/gaps/{gap_id}/close", headers=headers, json={"reason": hostile_reason})
    outreach = client.post(f"/api/v1/members/{member_id}/outreach", headers=headers, json={"channel": "member portal", "outcome": "left message", "occurred_at": "2030-03-01T12:00:00Z", "notes": hostile_notes})
    goal = client.patch(f"/api/v1/members/{member_id}/care-plan/{goal_id}", headers=headers, json={"status": "in-progress"})
    reread = client.get(f"/api/v1/members/{member_id}", headers=headers)

    assert closed.status_code == 200
    assert outreach.status_code == 201
    assert goal.status_code == 200
    assert reread.status_code == 200
    payload = reread.json()
    assert next(gap for gap in payload["gaps"] if gap["id"] == gap_id)["closed_reason"] == hostile_reason
    assert any(item["id"] == outreach.json()["id"] and item["notes"] == hostile_notes for item in payload["outreach"])
    assert next(item for item in payload["care_plan_goals"] if item["id"] == goal_id)["status"] == "in-progress"


def test_duplicate_business_key_and_invalid_foreign_key_are_rejected_by_file_sqlite(client: TestClient) -> None:
    """Assert actual SQLite key and foreign-key constraints through the active app session."""

    headers = login_headers(client, "coordinator@example.com")
    member_id = first_member_id(client, headers)

    async def assert_constraints() -> None:
        """Exercise the active SQLAlchemy engine rather than a hardcoded database path."""

        async with AsyncSessionLocal() as session:
            with pytest.raises(IntegrityError):
                await session.execute(
                    __import__("sqlalchemy").text("INSERT INTO outreach (outreach_key, member_id, channel, outcome, occurred_at, notes) VALUES (:key, :member_id, :channel, :outcome, :occurred_at, :notes)"),
                    {"key": "OUT-DEMO-001", "member_id": member_id, "channel": "phone", "outcome": "reached", "occurred_at": "2030-01-01 00:00:00", "notes": "duplicate key"},
                )
                await session.commit()
            await session.rollback()
            with pytest.raises(IntegrityError):
                await session.execute(
                    __import__("sqlalchemy").text("INSERT INTO outreach (outreach_key, member_id, channel, outcome, occurred_at, notes) VALUES (:key, :member_id, :channel, :outcome, :occurred_at, :notes)"),
                    {"key": "OUT-FK-REJECT", "member_id": 999999, "channel": "phone", "outcome": "reached", "occurred_at": "2030-01-01 00:00:00", "notes": "invalid member"},
                )
                await session.commit()
            await session.rollback()

    asyncio.run(assert_constraints())


def test_assignment_rejects_invalid_coordinator_foreign_key_and_duplicate_close_conflict(client: TestClient) -> None:
    """Business mutation branches reject invalid assignees and already-closed gaps."""

    coordinator_headers = login_headers(client, "coordinator@example.com")
    supervisor_headers = login_headers(client, "supervisor@example.com")
    member_id, gap_id = member_with_open_gap(client, coordinator_headers)
    invalid_assignment = client.patch(f"/api/v1/members/{member_id}/assignment", headers=supervisor_headers, json={"coordinator_id": 999999})
    first_close = client.post(f"/api/v1/members/{member_id}/gaps/{gap_id}/close", headers=coordinator_headers, json={"reason": "Completed visit"})
    duplicate_close = client.post(f"/api/v1/members/{member_id}/gaps/{gap_id}/close", headers=coordinator_headers, json={"reason": "Completed visit"})

    assert invalid_assignment.status_code == 422
    assert invalid_assignment.json() == {"detail": "Assigned coordinator is invalid"}
    assert first_close.status_code == 200
    assert duplicate_close.status_code == 409
    assert duplicate_close.json() == {"detail": "Care gap is already closed"}
