"""Idempotent deterministic demonstration data seeding."""

import asyncio
import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.entities import CareGap, CarePlanGoal, Coordinator, Member, Outreach

DEMO_COORDINATORS = (
    ("coordinator@example.com", "Care Coordinator", "coordinator"),
    ("supervisor@example.com", "Care Supervisor", "supervisor"),
    ("auditor@example.com", "Care Auditor", "auditor"),
)


async def seed_database(session: AsyncSession) -> None:
    """Seed known users and twenty synthetic members without duplicating data."""

    for email, full_name, role in DEMO_COORDINATORS:
        existing = await session.scalar(select(Coordinator).where(Coordinator.email == email))
        if existing is None:
            password_hash = await asyncio.to_thread(hash_password, "CareDemo1!")
            session.add(Coordinator(email=email, full_name=full_name, role=role, password_hash=password_hash))
    await session.flush()

    member_total = await session.scalar(select(func.count()).select_from(Member))
    if member_total == 0:
        coordinator = await session.scalar(select(Coordinator).where(Coordinator.email == "coordinator@example.com"))
        if coordinator is None:
            raise RuntimeError("Coordinator seed was not created")
        for number in range(1, 21):
            member = Member(
                member_key=f"MEM-DEMO-{number:03d}",
                first_name=f"Member{number}",
                last_name="Demo",
                date_of_birth=datetime.date(1950 + number, (number % 12) + 1, (number % 27) + 1),
                risk_level="high" if number % 3 == 0 else "moderate",
                sex="female" if number % 2 == 0 else "male",
                phone=f"555-010-{number:04d}",
                address=f"{100 + number} Meridian Way, Harbor City, CA",
                ssn=f"555-22-{1000 + number:04d}",
                mbi=f"1EG4TE5MK{number:03d}",
                plan="Meridian Advantage" if number % 2 == 0 else "Meridian Choice",
                pcp="Dr. Avery Morgan" if number % 2 == 0 else "Dr. Jordan Lee",
                assigned_coordinator_id=coordinator.id,
            )
            session.add(member)
            await session.flush()
            session.add(CarePlanGoal(goal_key=f"GOAL-DEMO-{number:03d}", member_id=member.id, title="Complete preventive care plan", status="not-started", support_goal="Maintain preventive care engagement", interventions="Coordinate annual wellness appointment"))
            session.add(CareGap(gap_key=f"GAP-DEMO-{number:03d}", member_id=member.id, category="Annual wellness visit", status="open"))
            session.add(Outreach(outreach_key=f"OUT-DEMO-{number:03d}", member_id=member.id, coordinator_id=coordinator.id, channel="phone", outcome="no answer", notes="Initial outreach scheduled."))
    await session.commit()
