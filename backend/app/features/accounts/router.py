from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from core.database import get_db
from features.auth.models import User
from features.accounts.schemas import (
    AccountCreate, AccountUpdate, AccountResponse,
)
from features.accounts.service import AccountService

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("/", response_model=list[AccountResponse])
async def list_accounts(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await AccountService.get_all(db, owner_id=user.id)


@router.post("/", response_model=AccountResponse)
async def create_account(
    body: AccountCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await AccountService.create(
        db, owner_id=user.id, data=body.model_dump()
    )


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await AccountService.get_by_id(db, owner_id=user.id, account_id=account_id)


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    body: AccountUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await AccountService.update(
        db, owner_id=user.id, account_id=account_id,
        data=body.model_dump(exclude_unset=True),
    )


@router.delete("/{account_id}")
async def delete_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await AccountService.delete(db, owner_id=user.id, account_id=account_id)
    return {"message": "Account deleted"}
