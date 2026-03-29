from datetime import datetime

from pydantic import BaseModel


class AccountCreate(BaseModel):
    name: str
    bank_name: str
    currency: str = "CZK"
    account_type: str = "checking"
    is_default: bool = False


class AccountUpdate(BaseModel):
    name: str | None = None
    bank_name: str | None = None
    currency: str | None = None
    account_type: str | None = None
    is_default: bool | None = None


class AccountResponse(BaseModel):
    id: int
    name: str
    bank_name: str
    currency: str
    account_type: str
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}
