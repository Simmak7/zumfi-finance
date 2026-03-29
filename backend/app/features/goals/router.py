from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.auth import get_current_user
from features.auth.models import User
from features.goals.models import Goal
from features.goals.schemas import (
    GoalCreate, GoalUpdate, GoalResponse,
    AllocateRequest, SurplusResponse, AllocationSuggestion,
    AllocationDetailsResponse, GoalHistoryResponse,
)
from features.goals.service import GoalService

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("/", response_model=list[GoalResponse])
async def list_goals(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all active goals."""
    return await GoalService.get_all(db, owner_id=user.id)


@router.get("/surplus", response_model=SurplusResponse)
async def get_surplus(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get available surplus for a given month."""
    return await GoalService.get_surplus(db, owner_id=user.id, month=month)


@router.get("/allocation-suggestions", response_model=list[AllocationSuggestion])
async def get_allocation_suggestions(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get AI-suggested allocation amounts per goal."""
    return await GoalService.suggest_allocation(db, owner_id=user.id, month=month)


@router.get("/allocation-details", response_model=AllocationDetailsResponse)
async def get_allocation_details(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get per-goal allocation breakdown for a given month."""
    return await GoalService.get_allocation_details(db, owner_id=user.id, month=month)


@router.get("/with-deltas")
async def list_goals_with_deltas(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all goals with previous month delta data."""
    return await GoalService.get_goals_with_deltas(db, owner_id=user.id)


@router.get("/{goal_id}/history", response_model=GoalHistoryResponse)
async def get_goal_history(
    goal_id: int,
    months: int = Query(default=12, ge=2, le=36),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get monthly history for a specific goal."""
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.owner_id == user.id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    history = await GoalService.get_goal_history(
        db, owner_id=user.id, goal_id=goal_id, months=months,
    )
    return {
        "goal_id": goal.id,
        "goal_name": goal.name,
        "color": goal.color,
        "history": history,
    }


@router.post("/allocate", response_model=list[GoalResponse])
async def allocate_to_goals(
    request: AllocateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Allocate surplus to goals. Creates contribution records."""
    allocations = [{"goal_id": a.goal_id, "amount": a.amount} for a in request.allocations]
    result = await GoalService.allocate(
        db, owner_id=user.id, month=request.month, allocations=allocations,
    )
    await GoalService.record_goal_snapshots(db, owner_id=user.id)
    return result


@router.post("/", response_model=GoalResponse)
async def create_goal(
    request: GoalCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new savings goal."""
    goal = await GoalService.create(
        db, owner_id=user.id,
        name=request.name,
        target_amount=request.target_amount,
        current_amount=request.current_amount,
        color=request.color,
        deadline=request.deadline,
    )
    await GoalService.record_goal_snapshots(db, owner_id=user.id)
    return goal


@router.put("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: int,
    request: GoalUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a savings goal."""
    goal = await GoalService.update(
        db, owner_id=user.id, goal_id=goal_id,
        name=request.name,
        target_amount=request.target_amount,
        current_amount=request.current_amount,
        monthly_allocation=request.monthly_allocation,
        color=request.color,
        deadline=request.deadline,
        status=request.status,
    )
    await GoalService.record_goal_snapshots(db, owner_id=user.id)
    return goal


@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a savings goal."""
    await GoalService.delete(db, owner_id=user.id, goal_id=goal_id)
    await GoalService.record_goal_snapshots(db, owner_id=user.id)
    return {"message": "Goal deleted successfully"}


@router.post("/seed-backdate")
async def seed_backdate_goals(
    request: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Backdate all user's goals created_at to a given date (for demo seeding)."""
    date_str = request.get("created_at", "2025-08-15T10:00:00")
    target_dt = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
    await db.execute(
        update(Goal)
        .where(Goal.owner_id == user.id)
        .values(created_at=target_dt)
    )
    await db.commit()
    return {"backdated_to": date_str}
