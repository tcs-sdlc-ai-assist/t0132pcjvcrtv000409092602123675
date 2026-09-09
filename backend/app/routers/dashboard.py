"""Authenticated HTTP route for operational dashboard oversight."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_coordinator
from app.models.entities import Coordinator
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard_service import get_dashboard

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])

SessionDependency = Annotated[AsyncSession, Depends(get_session)]
ActorDependency = Annotated[Coordinator, Depends(get_current_coordinator)]


@router.get("", response_model=DashboardResponse, status_code=status.HTTP_200_OK, summary="Get scoped operational dashboard")
async def read_dashboard(session: SessionDependency, actor: ActorDependency) -> DashboardResponse:
    """Return dashboard oversight data limited to the actor's authorized scope."""

    return await get_dashboard(session, actor)
