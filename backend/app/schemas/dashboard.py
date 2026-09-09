"""Pydantic response models for the scoped operational dashboard."""

import datetime

from pydantic import BaseModel


class DashboardMetrics(BaseModel):
    """Summarize the operational measures for an authorized member scope."""

    members_assigned: int
    open_care_gaps: int
    outreach_this_week: int
    high_risk_members: int
    gap_closure_rate_percent: float


class GapSeriesPoint(BaseModel):
    """Represent the open care-gap count for one category."""

    category: str
    count: int


class DashboardActivity(BaseModel):
    """Represent a recent non-sensitive care-work audit event."""

    action: str
    detail: str
    created_at: datetime.datetime


class AttentionMember(BaseModel):
    """Identify a high-risk member with an overdue open care gap."""

    member_id: int
    member_key: str
    first_name: str
    last_name: str
    overdue_gap_count: int


class DashboardResponse(BaseModel):
    """Return all scoped dashboard information in one typed payload."""

    metrics: DashboardMetrics
    gaps_by_type: list[GapSeriesPoint]
    recent_activity: list[DashboardActivity]
    attention_needed: list[AttentionMember]
