"""Async role-scoped operational dashboard aggregation queries."""

import datetime

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import AuditLog, CareGap, Coordinator, Member, Outreach
from app.schemas.dashboard import AttentionMember, DashboardActivity, DashboardMetrics, DashboardResponse, GapSeriesPoint

PRIVILEGED_ROLES = {"supervisor", "auditor"}


def _member_scope(actor: Coordinator) -> list[object]:
    """Return the member scope predicate for the authenticated staff role."""

    if actor.role in PRIVILEGED_ROLES:
        return []
    return [Member.assigned_coordinator_id == actor.id]


def _scoped_members(actor: Coordinator) -> Select[tuple[Member]]:
    """Build a reusable select for the actor's authorized member set."""

    statement: Select[tuple[Member]] = select(Member)
    predicates = _member_scope(actor)
    if predicates:
        statement = statement.where(*predicates)
    return statement


async def get_dashboard(session: AsyncSession, actor: Coordinator) -> DashboardResponse:
    """Calculate dashboard measures using the real asynchronous SQLite session."""

    member_scope = _scoped_members(actor).subquery()
    member_ids = select(member_scope.c.id)
    today = datetime.datetime.now(datetime.UTC).date()
    week_start = today - datetime.timedelta(days=today.weekday())

    members_assigned = int((await session.scalar(select(func.count()).select_from(member_scope))) or 0)
    open_care_gaps = int(
        (await session.scalar(select(func.count()).select_from(CareGap).where(CareGap.member_id.in_(member_ids), CareGap.status == "open"))) or 0
    )
    closed_gaps = int(
        (await session.scalar(select(func.count()).select_from(CareGap).where(CareGap.member_id.in_(member_ids), CareGap.status == "closed"))) or 0
    )
    high_risk_members = int(
        (await session.scalar(select(func.count()).select_from(member_scope).where(member_scope.c.risk_level == "high"))) or 0
    )
    outreach_this_week = int(
        (await session.scalar(select(func.count()).select_from(Outreach).where(Outreach.member_id.in_(member_ids), Outreach.occurred_at >= week_start))) or 0
    )
    total_gaps = open_care_gaps + closed_gaps
    closure_rate = round((closed_gaps / total_gaps * 100) if total_gaps else 0, 1)

    gap_rows = await session.execute(
        select(CareGap.category, func.count())
        .where(CareGap.member_id.in_(member_ids), CareGap.status == "open")
        .group_by(CareGap.category)
        .order_by(func.count().desc(), CareGap.category)
    )
    attention_rows = await session.execute(
        select(Member, func.count(CareGap.id).label("overdue_count"))
        .join(CareGap, CareGap.member_id == Member.id)
        .where(
            Member.id.in_(member_ids),
            Member.risk_level == "high",
            CareGap.status == "open",
            CareGap.due_date.is_not(None),
            CareGap.due_date < today,
        )
        .group_by(Member.id)
        .order_by(func.count(CareGap.id).desc(), Member.last_name, Member.first_name)
    )

    activity_statement = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(10)
    if actor.role == "coordinator":
        activity_statement = activity_statement.where(AuditLog.actor_email == actor.email)
    activities = (await session.scalars(activity_statement)).all()

    return DashboardResponse(
        metrics=DashboardMetrics(
            members_assigned=members_assigned,
            open_care_gaps=open_care_gaps,
            outreach_this_week=outreach_this_week,
            high_risk_members=high_risk_members,
            gap_closure_rate_percent=closure_rate,
        ),
        gaps_by_type=[GapSeriesPoint(category=category, count=int(count)) for category, count in gap_rows.all()],
        recent_activity=[DashboardActivity(action=item.action, detail=item.detail, created_at=item.created_at) for item in activities],
        attention_needed=[
            AttentionMember(member_id=member.id, member_key=member.member_key, first_name=member.first_name, last_name=member.last_name, overdue_gap_count=int(count))
            for member, count in attention_rows.all()
        ],
    )
