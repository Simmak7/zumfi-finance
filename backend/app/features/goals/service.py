from decimal import Decimal
from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from features.goals.models import Goal, GoalContribution, GoalSnapshot
from features.statements.models import Transaction


class GoalService:
    @staticmethod
    def _month_cutoff(month: str) -> datetime:
        """First day of the month AFTER the given month (for created_at filtering)."""
        year, mon = int(month.split("-")[0]), int(month.split("-")[1])
        if mon == 12:
            return datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        return datetime(year, mon + 1, 1, tzinfo=timezone.utc)

    @staticmethod
    async def get_all(db: AsyncSession, owner_id: int) -> list[Goal]:
        result = await db.execute(
            select(Goal)
            .where(Goal.owner_id == owner_id, Goal.status != "archived")
            .order_by(Goal.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create(
        db: AsyncSession, owner_id: int, name: str, target_amount: Decimal,
        current_amount: Decimal = Decimal("0"), color: str | None = None,
        deadline: date | None = None,
    ) -> Goal:
        goal = Goal(
            owner_id=owner_id,
            name=name,
            target_amount=target_amount,
            current_amount=current_amount,
            color=color,
            deadline=deadline,
        )
        db.add(goal)
        await db.flush()
        await db.refresh(goal)
        return goal

    @staticmethod
    async def update(
        db: AsyncSession, owner_id: int, goal_id: int, **kwargs
    ) -> Goal:
        result = await db.execute(
            select(Goal).where(Goal.id == goal_id, Goal.owner_id == owner_id)
        )
        goal = result.scalar_one_or_none()
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")

        for key, value in kwargs.items():
            if value is not None:
                setattr(goal, key, value)

        await db.flush()
        await db.refresh(goal)
        return goal

    @staticmethod
    async def delete(db: AsyncSession, owner_id: int, goal_id: int) -> bool:
        result = await db.execute(
            select(Goal).where(Goal.id == goal_id, Goal.owner_id == owner_id)
        )
        goal = result.scalar_one_or_none()
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")

        await db.delete(goal)
        await db.flush()
        return True

    # ── Allocation Methods ──

    @staticmethod
    async def get_surplus(db: AsyncSession, owner_id: int, month: str) -> dict:
        """Calculate available surplus for a given month."""
        year, mon = month.split("-")

        # Total income
        income_q = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.owner_id == owner_id,
                Transaction.type == "income",
                Transaction.section != "in_and_out",
                extract("year", Transaction.date) == int(year),
                extract("month", Transaction.date) == int(mon),
            )
        )
        total_income = Decimal(str(income_q.scalar()))

        # Total expenses
        expense_q = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.owner_id == owner_id,
                Transaction.type == "expense",
                Transaction.section != "in_and_out",
                extract("year", Transaction.date) == int(year),
                extract("month", Transaction.date) == int(mon),
            )
        )
        total_expenses = Decimal(str(expense_q.scalar()))

        # Already allocated this month
        alloc_q = await db.execute(
            select(func.coalesce(func.sum(GoalContribution.amount), 0)).where(
                GoalContribution.owner_id == owner_id,
                GoalContribution.month == month,
            )
        )
        already_allocated = Decimal(str(alloc_q.scalar()))

        available = max(total_income - total_expenses - already_allocated, Decimal("0"))

        return {
            "month": month,
            "total_income": total_income,
            "total_expenses": total_expenses,
            "already_allocated": already_allocated,
            "available_surplus": available,
        }

    @staticmethod
    async def suggest_allocation(db: AsyncSession, owner_id: int, month: str) -> list[dict]:
        """Suggest allocation amounts proportional to remaining target."""
        surplus_data = await GoalService.get_surplus(db, owner_id, month)
        available = surplus_data["available_surplus"]

        if available <= 0:
            return []

        # Get all active goals
        result = await db.execute(
            select(Goal).where(
                Goal.owner_id == owner_id,
                Goal.status == "active",
            )
        )
        goals = list(result.scalars().all())
        if not goals:
            return []

        # Calculate remaining for each goal
        goal_remaining = []
        total_remaining = Decimal("0")
        for g in goals:
            remaining = max(g.target_amount - g.current_amount, Decimal("0"))
            if remaining > 0:
                goal_remaining.append((g, remaining))
                total_remaining += remaining

        if total_remaining == 0:
            return []

        # Proportional distribution
        suggestions = []
        for g, remaining in goal_remaining:
            proportion = remaining / total_remaining
            suggested = min(round(available * proportion, 2), remaining)
            suggestions.append({
                "goal_id": g.id,
                "goal_name": g.name,
                "suggested_amount": suggested,
                "remaining": remaining,
            })

        return suggestions

    @staticmethod
    async def allocate(
        db: AsyncSession, owner_id: int, month: str, allocations: list[dict],
    ) -> list[Goal]:
        """Execute allocation: create contributions and update goal amounts."""
        # Validate surplus
        surplus_data = await GoalService.get_surplus(db, owner_id, month)
        total_alloc = sum(Decimal(str(a["amount"])) for a in allocations)
        if total_alloc > surplus_data["available_surplus"]:
            raise HTTPException(
                status_code=400,
                detail=f"Total allocation ({total_alloc}) exceeds available surplus ({surplus_data['available_surplus']})",
            )

        updated_goals = []
        for alloc in allocations:
            if Decimal(str(alloc["amount"])) <= 0:
                continue

            # Find goal
            result = await db.execute(
                select(Goal).where(
                    Goal.id == alloc["goal_id"],
                    Goal.owner_id == owner_id,
                )
            )
            goal = result.scalar_one_or_none()
            if not goal:
                continue

            # Create contribution
            contribution = GoalContribution(
                goal_id=goal.id,
                owner_id=owner_id,
                month=month,
                amount=Decimal(str(alloc["amount"])),
                source="surplus",
            )
            db.add(contribution)

            # Update goal current_amount
            goal.current_amount = goal.current_amount + Decimal(str(alloc["amount"]))

            # Auto-complete if target reached
            if goal.current_amount >= goal.target_amount:
                goal.status = "completed"

            updated_goals.append(goal)

        await db.flush()
        for g in updated_goals:
            await db.refresh(g)

        return updated_goals

    @staticmethod
    async def get_allocation_details(
        db: AsyncSession, owner_id: int, month: str,
    ) -> dict:
        """Return per-goal allocation breakdown for a given month."""
        result = await db.execute(
            select(Goal.name, GoalContribution.amount)
            .join(Goal, GoalContribution.goal_id == Goal.id)
            .where(
                GoalContribution.owner_id == owner_id,
                GoalContribution.month == month,
            )
        )
        items = [{"goal_name": r.name, "amount": r.amount} for r in result.all()]
        total = sum(Decimal(str(i["amount"])) for i in items)
        return {"month": month, "allocations": items, "total": total}

    # ── Snapshot / History Methods ──

    @staticmethod
    async def record_goal_snapshots(db: AsyncSession, owner_id: int) -> None:
        """Upsert snapshot for current month for every active goal."""
        today = date.today()
        month_str = f"{today.year}-{today.month:02d}"

        goals = await GoalService.get_all(db, owner_id)
        for goal in goals:
            result = await db.execute(
                select(GoalSnapshot).where(
                    GoalSnapshot.owner_id == owner_id,
                    GoalSnapshot.goal_id == goal.id,
                    GoalSnapshot.snapshot_month == month_str,
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                existing.current_amount = goal.current_amount
                existing.target_amount = goal.target_amount
            else:
                db.add(GoalSnapshot(
                    owner_id=owner_id,
                    goal_id=goal.id,
                    snapshot_month=month_str,
                    current_amount=goal.current_amount,
                    target_amount=goal.target_amount,
                ))
        await db.flush()

    @staticmethod
    async def get_goal_history(
        db: AsyncSession, owner_id: int, goal_id: int, months: int = 12,
    ) -> list[dict]:
        """Return monthly snapshots for a specific goal."""
        today = date.today()
        points = []
        for i in range(months - 1, -1, -1):
            y = today.year
            m = today.month - i
            while m <= 0:
                m += 12
                y -= 1
            month_str = f"{y}-{m:02d}"
            result = await db.execute(
                select(GoalSnapshot).where(
                    GoalSnapshot.owner_id == owner_id,
                    GoalSnapshot.goal_id == goal_id,
                    GoalSnapshot.snapshot_month == month_str,
                )
            )
            snap = result.scalar_one_or_none()
            points.append({
                "month": month_str,
                "current_amount": float(snap.current_amount) if snap else None,
                "target_amount": float(snap.target_amount) if snap else None,
            })
        return points

    @staticmethod
    async def get_goals_with_deltas(db: AsyncSession, owner_id: int) -> list[dict]:
        """Return all goals enriched with previous month's amount for delta."""
        goals = await GoalService.get_all(db, owner_id)

        today = date.today()
        prev_m = today.month - 1
        prev_y = today.year
        if prev_m <= 0:
            prev_m += 12
            prev_y -= 1
        prev_month_str = f"{prev_y}-{prev_m:02d}"

        result = await db.execute(
            select(GoalSnapshot).where(
                GoalSnapshot.owner_id == owner_id,
                GoalSnapshot.snapshot_month == prev_month_str,
            )
        )
        prev_snaps = {s.goal_id: s for s in result.scalars().all()}

        enriched = []
        for goal in goals:
            prev = prev_snaps.get(goal.id)
            enriched.append({
                "id": goal.id,
                "name": goal.name,
                "target_amount": str(goal.target_amount),
                "current_amount": str(goal.current_amount),
                "monthly_allocation": str(goal.monthly_allocation) if goal.monthly_allocation else None,
                "color": goal.color,
                "deadline": goal.deadline.isoformat() if goal.deadline else None,
                "status": goal.status,
                "created_at": goal.created_at.isoformat() if goal.created_at else None,
                "previous_amount": float(prev.current_amount) if prev else None,
            })
        return enriched
