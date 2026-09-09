"""SQLAlchemy entities for coordinator access and care-management seed data."""

import datetime
import uuid

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def new_business_key(prefix: str) -> str:
    """Create a readable stable-format business key for seeded records."""

    return f"{prefix}-{uuid.uuid4().hex[:12].upper()}"


class Coordinator(Base):
    """A credentialed internal coordinator, supervisor, or auditor."""

    __tablename__ = "coordinators"

    id: Mapped[int] = mapped_column(primary_key=True)
    coordinator_key: Mapped[str] = mapped_column(String(32), unique=True, index=True, default=lambda: new_business_key("COO"))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(32), index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.UTC))


class Member(Base):
    """A synthetic care-program member with a stable member business key."""

    __tablename__ = "members"
    __table_args__ = (Index("ix_members_last_name_first_name", "last_name", "first_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    member_key: Mapped[str] = mapped_column(String(32), unique=True, index=True, default=lambda: new_business_key("MEM"))
    first_name: Mapped[str] = mapped_column(String(80))
    last_name: Mapped[str] = mapped_column(String(80))
    date_of_birth: Mapped[datetime.date] = mapped_column(Date)
    risk_level: Mapped[str] = mapped_column(String(24), index=True)
    assigned_coordinator_id: Mapped[int | None] = mapped_column(ForeignKey("coordinators.id"), index=True)


class CarePlanGoal(Base):
    """A care objective associated with one member."""

    __tablename__ = "care_plan_goals"
    __table_args__ = (Index("ix_care_plan_goals_member_status", "member_id", "status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    goal_key: Mapped[str] = mapped_column(String(32), unique=True, index=True, default=lambda: new_business_key("GOAL"))
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), index=True)
    target_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)


class CareGap(Base):
    """An open or resolved preventive-care gap for a member."""

    __tablename__ = "care_gaps"
    __table_args__ = (Index("ix_care_gaps_member_status", "member_id", "status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    gap_key: Mapped[str] = mapped_column(String(32), unique=True, index=True, default=lambda: new_business_key("GAP"))
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), index=True)
    category: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(32), index=True)
    due_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)


class Outreach(Base):
    """A documented member outreach attempt."""

    __tablename__ = "outreach"
    __table_args__ = (Index("ix_outreach_member_occurred_at", "member_id", "occurred_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    outreach_key: Mapped[str] = mapped_column(String(32), unique=True, index=True, default=lambda: new_business_key("OUT"))
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), index=True)
    coordinator_id: Mapped[int | None] = mapped_column(ForeignKey("coordinators.id"), index=True)
    channel: Mapped[str] = mapped_column(String(32))
    outcome: Mapped[str] = mapped_column(String(64))
    occurred_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.UTC), index=True)


class AuditLog(Base):
    """An immutable-style audit entry for sensitive application actions."""

    __tablename__ = "audit_log"
    __table_args__ = (Index("ix_audit_log_actor_created_at", "actor_email", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    audit_key: Mapped[str] = mapped_column(String(32), unique=True, index=True, default=lambda: new_business_key("AUD"))
    actor_email: Mapped[str] = mapped_column(String(255), index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)
    detail: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.UTC), index=True)
