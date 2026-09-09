"""Dependency-free process liveness endpoint."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/api/health", summary="Report API liveness")
async def health() -> dict[str, str]:
    """Return a stable liveness response without touching dependencies."""

    return {"status": "ok"}
