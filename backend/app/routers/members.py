"""HTTP routes for scoped member panel and care-work operations."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_coordinator
from app.models.entities import Coordinator
from app.schemas.members import (
    AssignmentRequest,
    CareGapResponse,
    CarePlanGoalResponse,
    CloseGapRequest,
    GoalStatusRequest,
    MemberDetailResponse,
    MemberPanelResponse,
    OutreachCreateRequest,
    OutreachResponse,
)
from app.services.member_service import assign_member, close_gap, create_outreach, get_member_detail, list_members, update_goal_status

router = APIRouter(prefix="/api/v1/members", tags=["members"])

SessionDependency = Annotated[AsyncSession, Depends(get_session)]
ActorDependency = Annotated[Coordinator, Depends(get_current_coordinator)]


@router.get("", response_model=MemberPanelResponse, summary="List an authorized member panel")
async def get_members(
    session: SessionDependency,
    actor: ActorDependency,
    query: Annotated[str | None, Query(max_length=120)] = None,
    risk_level: Annotated[str | None, Query(max_length=24)] = None,
    plan: Annotated[str | None, Query(max_length=120)] = None,
    coordinator_id: int | None = None,
    sort_by: Literal["last_name", "risk_level", "plan", "date_of_birth"] = "last_name",
    sort_order: Literal["asc", "desc"] = "asc",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> MemberPanelResponse:
    """Return a role-scoped page of members with filters and ordering."""

    return await list_members(session, actor, query, risk_level, plan, coordinator_id, sort_by, sort_order, limit, offset)


@router.get("/{member_id}", response_model=MemberDetailResponse, summary="View an authorized member detail")
async def get_member(member_id: int, session: SessionDependency, actor: ActorDependency) -> MemberDetailResponse:
    """Return one masked member profile and record the view audit."""

    return await get_member_detail(session, actor, member_id)


@router.patch("/{member_id}/assignment", response_model=MemberDetailResponse, summary="Assign a member")
async def patch_assignment(
    member_id: int,
    request: AssignmentRequest,
    session: SessionDependency,
    actor: ActorDependency,
) -> MemberDetailResponse:
    """Assign a member when the signed-in supervisor is authorized."""

    return await assign_member(session, actor, member_id, request)


@router.post("/{member_id}/gaps/{gap_id}/close", response_model=CareGapResponse, summary="Close an open care gap")
async def post_close_gap(
    member_id: int,
    gap_id: int,
    request: CloseGapRequest,
    session: SessionDependency,
    actor: ActorDependency,
) -> CareGapResponse:
    """Close an open member care gap with a required reason."""

    return await close_gap(session, actor, member_id, gap_id, request.reason)


@router.post("/{member_id}/outreach", response_model=OutreachResponse, status_code=status.HTTP_201_CREATED, summary="Log outreach")
async def post_outreach(
    member_id: int,
    request: OutreachCreateRequest,
    session: SessionDependency,
    actor: ActorDependency,
) -> OutreachResponse:
    """Create a validated member outreach record."""

    return await create_outreach(session, actor, member_id, request)


@router.patch("/{member_id}/care-plan/{goal_id}", response_model=CarePlanGoalResponse, summary="Update a care-plan goal")
async def patch_care_plan_goal(
    member_id: int,
    goal_id: int,
    request: GoalStatusRequest,
    session: SessionDependency,
    actor: ActorDependency,
) -> CarePlanGoalResponse:
    """Update an authorized member goal to an allowed status."""

    return await update_goal_status(session, actor, member_id, goal_id, request)
