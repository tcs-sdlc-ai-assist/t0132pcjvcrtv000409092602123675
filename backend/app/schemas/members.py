"""Pydantic DTOs for the member care workspace API."""

import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


GoalStatus = Literal["not-started", "in-progress", "met"]


class PanelMemberResponse(BaseModel):
    """Describe a member row returned in an authorized panel."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    member_key: str
    first_name: str
    last_name: str
    date_of_birth: datetime.date
    risk_level: str
    plan: str
    assigned_coordinator_id: int | None
    open_gap_count: int


class MemberPanelResponse(BaseModel):
    """Wrap a bounded page of members and its pagination metadata."""

    items: list[PanelMemberResponse]
    total: int
    limit: int
    offset: int


class CareGapResponse(BaseModel):
    """Describe one preventive-care gap without internal database fields."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    gap_key: str
    category: str
    status: str
    due_date: datetime.date | None
    closed_reason: str | None
    closed_by: str | None
    closed_at: datetime.datetime | None


class OutreachResponse(BaseModel):
    """Describe a documented outreach event."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    outreach_key: str
    channel: str
    outcome: str
    occurred_at: datetime.datetime
    notes: str | None


class CarePlanGoalResponse(BaseModel):
    """Describe a member care-plan goal and its supporting work."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    goal_key: str
    title: str
    status: GoalStatus
    target_date: datetime.date | None
    support_goal: str | None
    interventions: str | None
    updated_at: datetime.datetime


class MemberDetailResponse(BaseModel):
    """Describe a member profile with only masked sensitive identifiers."""

    id: int
    member_key: str
    first_name: str
    last_name: str
    date_of_birth: datetime.date
    sex: str
    phone: str
    address: str
    ssn_masked: str
    mbi_masked: str
    plan: str
    pcp: str
    risk_level: str
    assigned_coordinator_id: int | None
    gaps: list[CareGapResponse]
    outreach: list[OutreachResponse]
    care_plan_goals: list[CarePlanGoalResponse]


class AssignmentRequest(BaseModel):
    """Request a supervisor assign a member to a coordinator."""

    coordinator_id: int | None


class CloseGapRequest(BaseModel):
    """Request closure of an open care gap with an accountable reason."""

    reason: str = Field(min_length=3, max_length=500)

    @field_validator("reason")
    @classmethod
    def require_non_blank_reason(cls, value: str) -> str:
        """Reject whitespace-only closure documentation."""

        normalized = value.strip()
        if not normalized:
            raise ValueError("reason is required")
        return normalized


class OutreachCreateRequest(BaseModel):
    """Request a validated outreach record for an authorized member."""

    channel: Literal["phone", "SMS", "mail", "member portal"]
    outcome: Literal["reached", "left message", "no answer", "wrong number"]
    occurred_at: datetime.datetime
    notes: str = Field(min_length=1, max_length=2000)

    @field_validator("notes")
    @classmethod
    def require_non_blank_notes(cls, value: str) -> str:
        """Reject blank outreach documentation."""

        normalized = value.strip()
        if not normalized:
            raise ValueError("notes are required")
        return normalized


class GoalStatusRequest(BaseModel):
    """Request an allowed care-plan goal status transition."""

    status: GoalStatus
