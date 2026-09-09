"""Scoped data access and transactional care-work operations for members."""

import datetime

from fastapi import HTTPException, status
from sqlalchemy import Select, and_, asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import AuditLog, CareGap, CarePlanGoal, Coordinator, Member, Outreach
from app.schemas.members import (
    AssignmentRequest,
    CareGapResponse,
    CarePlanGoalResponse,
    GoalStatusRequest,
    MemberDetailResponse,
    MemberPanelResponse,
    OutreachCreateRequest,
    OutreachResponse,
    PanelMemberResponse,
)

SUPERVISOR_ROLE = "supervisor"
AUDITOR_ROLE = "auditor"
WRITER_ROLES = {"coordinator", SUPERVISOR_ROLE}
SORT_FIELDS = {
    "last_name": Member.last_name,
    "risk_level": Member.risk_level,
    "plan": Member.plan,
    "date_of_birth": Member.date_of_birth,
    "pcp": Member.pcp,
}


def mask_ssn(raw_ssn: str) -> str:
    """Return only the final four digits of an SSN in the required display format."""

    digits = "".join(character for character in raw_ssn if character.isdigit())
    return f"***-**-{digits[-4:]}"


def mask_mbi(raw_mbi: str) -> str:
    """Return only the final four characters of an MBI in the required display format."""

    return f"****{raw_mbi[-4:]}"


def _is_scoped_member(member: Member, actor: Coordinator) -> bool:
    """Determine whether an actor may access a member's records."""

    return actor.role in {SUPERVISOR_ROLE, AUDITOR_ROLE} or member.assigned_coordinator_id == actor.id


def _require_write_scope(member: Member, actor: Coordinator) -> None:
    """Reject read-only roles and access attempts outside the actor's panel.

    Raises:
        HTTPException: If the actor cannot perform work on the member.
    """

    if actor.role not in WRITER_ROLES or not _is_scoped_member(member, actor):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Member access is not authorized")


async def list_members(
    session: AsyncSession,
    actor: Coordinator,
    query: str | None,
    risk_level: str | None,
    plan: str | None,
    coordinator_id: int | None,
    sort_by: str,
    sort_order: str,
    limit: int,
    offset: int,
) -> MemberPanelResponse:
    """Return an authorized, filtered, sorted, and bounded member panel."""

    filters: list[object] = []
    if actor.role == "coordinator":
        filters.append(Member.assigned_coordinator_id == actor.id)
    if query:
        term = f"%{query.strip()}%"
        filters.append(or_(Member.first_name.ilike(term), Member.last_name.ilike(term), Member.member_key.ilike(term)))
    if risk_level:
        filters.append(Member.risk_level == risk_level)
    if plan:
        filters.append(Member.plan == plan)
    if coordinator_id is not None and actor.role != "coordinator":
        filters.append(Member.assigned_coordinator_id == coordinator_id)

    predicate = and_(*filters) if filters else None
    latest_outreach = (
        select(
            Outreach.member_id.label("member_id"),
            func.max(Outreach.occurred_at).label("last_outreach_at"),
        )
        .group_by(Outreach.member_id)
        .subquery()
    )
    statement: Select[tuple[Member]] = select(Member).outerjoin(latest_outreach, Member.id == latest_outreach.c.member_id)
    count_statement = select(func.count()).select_from(Member)
    if predicate is not None:
        statement = statement.where(predicate)
        count_statement = count_statement.where(predicate)

    direction = desc if sort_order == "desc" else asc
    sort_field = latest_outreach.c.last_outreach_at if sort_by == "last_outreach" else SORT_FIELDS.get(sort_by, Member.last_name)
    ordering = direction(sort_field)
    if sort_by == "last_outreach":
        ordering = ordering.nulls_last()
    members = (
        await session.scalars(
            statement.order_by(ordering, asc(Member.last_name), asc(Member.first_name), asc(Member.id)).offset(offset).limit(limit)
        )
    ).all()
    total = int((await session.scalar(count_statement)) or 0)

    member_ids = [member.id for member in members]
    gap_counts: dict[int, int] = {}
    last_outreach_at: dict[int, datetime.datetime] = {}
    if member_ids:
        gap_rows = await session.execute(
            select(CareGap.member_id, func.count())
            .where(CareGap.member_id.in_(member_ids), CareGap.status == "open")
            .group_by(CareGap.member_id)
        )
        gap_counts = {member_id: int(count) for member_id, count in gap_rows.all()}
        outreach_rows = await session.execute(
            select(Outreach.member_id, func.max(Outreach.occurred_at))
            .where(Outreach.member_id.in_(member_ids))
            .group_by(Outreach.member_id)
        )
        last_outreach_at = {member_id: occurred_at for member_id, occurred_at in outreach_rows.all() if occurred_at is not None}

    return MemberPanelResponse(
        items=[
            PanelMemberResponse(
                id=member.id,
                member_key=member.member_key,
                first_name=member.first_name,
                last_name=member.last_name,
                date_of_birth=member.date_of_birth,
                risk_level=member.risk_level,
                plan=member.plan,
                pcp=member.pcp,
                assigned_coordinator_id=member.assigned_coordinator_id,
                open_gap_count=gap_counts.get(member.id, 0),
                last_outreach_at=last_outreach_at.get(member.id),
            )
            for member in members
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


async def get_authorized_member(session: AsyncSession, actor: Coordinator, member_id: int) -> Member:
    """Load a member and fail closed with 403 when it is outside the actor scope."""

    member = await session.get(Member, member_id)
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member was not found")
    if not _is_scoped_member(member, actor):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Member access is not authorized")
    return member


async def get_member_detail(session: AsyncSession, actor: Coordinator, member_id: int) -> MemberDetailResponse:
    """Return a masked member detail view and record a non-sensitive access audit."""

    member = await get_authorized_member(session, actor, member_id)
    gaps = (await session.scalars(select(CareGap).where(CareGap.member_id == member.id).order_by(CareGap.due_date))).all()
    outreach = (await session.scalars(select(Outreach).where(Outreach.member_id == member.id).order_by(desc(Outreach.occurred_at)))).all()
    goals = (await session.scalars(select(CarePlanGoal).where(CarePlanGoal.member_id == member.id).order_by(CarePlanGoal.target_date))).all()
    session.add(AuditLog(actor_email=actor.email, action="member_viewed", detail=f"member_id={member.id}"))
    await session.commit()

    return MemberDetailResponse(
        id=member.id,
        member_key=member.member_key,
        first_name=member.first_name,
        last_name=member.last_name,
        date_of_birth=member.date_of_birth,
        sex=member.sex,
        phone=member.phone,
        address=member.address,
        ssn_masked=mask_ssn(member.ssn),
        mbi_masked=mask_mbi(member.mbi),
        plan=member.plan,
        pcp=member.pcp,
        risk_level=member.risk_level,
        assigned_coordinator_id=member.assigned_coordinator_id,
        gaps=[CareGapResponse.model_validate(gap) for gap in gaps],
        outreach=[OutreachResponse.model_validate(item) for item in outreach],
        care_plan_goals=[CarePlanGoalResponse.model_validate(goal) for goal in goals],
    )


async def assign_member(session: AsyncSession, actor: Coordinator, member_id: int, request: AssignmentRequest) -> MemberDetailResponse:
    """Assign a member when requested by a supervisor.

    Raises:
        HTTPException: If the actor is not a supervisor or the coordinator does not exist.
    """

    if actor.role != SUPERVISOR_ROLE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Supervisor access is required")
    member = await get_authorized_member(session, actor, member_id)
    if request.coordinator_id is not None:
        assignee = await session.get(Coordinator, request.coordinator_id)
        if assignee is None or assignee.role != "coordinator":
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Assigned coordinator is invalid")
    member.assigned_coordinator_id = request.coordinator_id
    session.add(AuditLog(actor_email=actor.email, action="member_assigned", detail=f"member_id={member.id}"))
    await session.commit()
    return await get_member_detail(session, actor, member_id)


async def close_gap(session: AsyncSession, actor: Coordinator, member_id: int, gap_id: int, reason: str) -> CareGapResponse:
    """Close an authorized member's open care gap with its reason and accountable actor."""

    member = await get_authorized_member(session, actor, member_id)
    _require_write_scope(member, actor)
    gap = await session.get(CareGap, gap_id)
    if gap is None or gap.member_id != member.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Care gap was not found")
    if gap.status != "open":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Care gap is already closed")
    gap.status = "closed"
    gap.closed_reason = reason
    gap.closed_by = actor.email
    gap.closed_at = datetime.datetime.now(datetime.UTC)
    session.add(AuditLog(actor_email=actor.email, action="care_gap_closed", detail=f"member_id={member.id};gap_id={gap.id}"))
    await session.commit()
    await session.refresh(gap)
    return CareGapResponse.model_validate(gap)


async def create_outreach(session: AsyncSession, actor: Coordinator, member_id: int, request: OutreachCreateRequest) -> OutreachResponse:
    """Persist a validated outreach record for a member within the actor scope."""

    member = await get_authorized_member(session, actor, member_id)
    _require_write_scope(member, actor)
    outreach = Outreach(
        member_id=member.id,
        coordinator_id=actor.id,
        channel=request.channel,
        outcome=request.outcome,
        occurred_at=request.occurred_at,
        notes=request.notes,
    )
    session.add(outreach)
    session.add(AuditLog(actor_email=actor.email, action="outreach_logged", detail=f"member_id={member.id}"))
    await session.commit()
    await session.refresh(outreach)
    return OutreachResponse.model_validate(outreach)


async def update_goal_status(session: AsyncSession, actor: Coordinator, member_id: int, goal_id: int, request: GoalStatusRequest) -> CarePlanGoalResponse:
    """Update a permitted care-plan goal status and its lifecycle timestamp."""

    member = await get_authorized_member(session, actor, member_id)
    _require_write_scope(member, actor)
    goal = await session.get(CarePlanGoal, goal_id)
    if goal is None or goal.member_id != member.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Care-plan goal was not found")
    goal.status = request.status
    goal.updated_at = datetime.datetime.now(datetime.UTC)
    session.add(AuditLog(actor_email=actor.email, action="care_goal_updated", detail=f"member_id={member.id};goal_id={goal.id}"))
    await session.commit()
    await session.refresh(goal)
    return CarePlanGoalResponse.model_validate(goal)
