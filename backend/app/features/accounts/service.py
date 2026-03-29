from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from features.accounts.models import Account


class AccountService:
    @staticmethod
    async def get_all(db: AsyncSession, owner_id: int) -> list[Account]:
        result = await db.execute(
            select(Account)
            .where(Account.owner_id == owner_id)
            .order_by(Account.is_default.desc(), Account.created_at)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(
        db: AsyncSession, owner_id: int, account_id: int
    ) -> Account:
        result = await db.execute(
            select(Account).where(
                Account.id == account_id,
                Account.owner_id == owner_id,
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        return account

    @staticmethod
    async def create(
        db: AsyncSession, owner_id: int, data: dict
    ) -> Account:
        account = Account(owner_id=owner_id, **data)
        db.add(account)
        await db.flush()

        if account.is_default:
            await AccountService._ensure_single_default(
                db, owner_id, account.id
            )

        await db.refresh(account)
        return account

    @staticmethod
    async def update(
        db: AsyncSession, owner_id: int, account_id: int, data: dict
    ) -> Account:
        account = await AccountService.get_by_id(db, owner_id, account_id)

        for key, value in data.items():
            if value is not None:
                setattr(account, key, value)

        await db.flush()

        if data.get("is_default"):
            await AccountService._ensure_single_default(
                db, owner_id, account.id
            )

        await db.refresh(account)
        return account

    @staticmethod
    async def delete(
        db: AsyncSession, owner_id: int, account_id: int
    ) -> bool:
        account = await AccountService.get_by_id(db, owner_id, account_id)
        await db.delete(account)
        await db.flush()
        return True

    @staticmethod
    async def _ensure_single_default(
        db: AsyncSession, owner_id: int, new_default_id: int
    ) -> None:
        """Ensure only one account is marked as default per owner."""
        result = await db.execute(
            select(Account).where(
                Account.owner_id == owner_id,
                Account.is_default == True,  # noqa: E712
                Account.id != new_default_id,
            )
        )
        for account in result.scalars().all():
            account.is_default = False
        await db.flush()
