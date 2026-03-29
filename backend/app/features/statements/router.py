import shutil
import os
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.auth import get_current_user
from features.auth.models import User
from features.statements.schemas import (
    StatementResponse, TransactionResponse, TransactionUpdate, UploadResponse,
    TransactionSearchResponse, BulkUpdateRequest, CategorizeSimilarRequest,
    StatementTypeUpdate,
)
from features.statements.service import StatementService

router = APIRouter(tags=["statements"])

UPLOAD_DIR = "/app/uploads"


@router.post("/upload", response_model=UploadResponse)
async def upload_statement(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload a bank statement (PDF, Word, or image) for parsing and classification.

    Supported formats: .pdf, .docx, .doc, .jpg, .jpeg, .png, .tiff, .bmp, .webp, .heic
    """
    # Validate file extension
    allowed_extensions = {
        '.pdf', '.docx', '.doc',
        '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.webp', '.heic',
    }
    file_ext = os.path.splitext(file.filename.lower())[1]
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    temp_path = os.path.join(UPLOAD_DIR, f"temp_{user.id}_{file.filename}")

    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    statement, new_count = await StatementService.upload_and_parse(
        db, owner_id=user.id, filename=file.filename, file_path=temp_path,
    )

    stmt_type = statement.statement_type or "bank"
    if stmt_type == "savings":
        balance_str = f" (balance: {statement.closing_balance})" if statement.closing_balance else ""
        msg = f"Savings statement processed{balance_str}"
    elif stmt_type in ("stock", "stock_pnl"):
        msg = f"Stock statement processed ({new_count} records)"
    elif new_count == 0:
        bank = statement.bank_name or "unknown"
        msg = (
            f"No transactions could be extracted from this file "
            f"(detected as: {bank}). Try importing as CSV instead."
        )
    else:
        msg = f"Parsed and saved {new_count} new transactions"

    return UploadResponse(
        filename=file.filename,
        statement_id=statement.id,
        transactions_count=new_count,
        message=msg,
        statement_type=stmt_type,
    )


@router.get("/statements", response_model=list[StatementResponse])
async def list_statements(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all uploaded statements."""
    return await StatementService.get_statements(db, owner_id=user.id)


@router.delete("/statements/{statement_id}")
async def delete_statement(
    statement_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a statement and all its transactions."""
    deleted = await StatementService.delete_statement(db, owner_id=user.id, statement_id=statement_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Statement not found")
    return {"message": "Statement deleted successfully"}


@router.put("/statements/{statement_id}")
async def update_statement(
    statement_id: int,
    period_start: date | None = None,
    period_end: date | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update statement period (assign to month)."""
    statement = await StatementService.update_statement(
        db, owner_id=user.id, statement_id=statement_id,
        period_start=period_start, period_end=period_end
    )
    if not statement:
        raise HTTPException(status_code=404, detail="Statement not found")
    return statement


@router.put("/statements/{statement_id}/type", response_model=StatementResponse)
async def update_statement_type(
    statement_id: int,
    request: StatementTypeUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Change statement type (bank/savings) and trigger portfolio sync."""
    if request.statement_type not in ("bank", "savings"):
        raise HTTPException(status_code=400, detail="Type must be 'bank' or 'savings'")

    statement = await StatementService.update_statement_type(
        db, owner_id=user.id, statement_id=statement_id,
        statement_type=request.statement_type,
    )
    if not statement:
        raise HTTPException(status_code=404, detail="Statement not found")
    return statement


@router.get("/statements/{statement_id}/file")
async def download_statement_file(
    statement_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Download/view the original uploaded file for a statement."""
    from features.statements.models import Statement
    result = await db.execute(
        select(Statement).where(
            Statement.id == statement_id,
            Statement.owner_id == user.id,
        )
    )
    stmt = result.scalar_one_or_none()
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")
    if not stmt.file_path or not os.path.exists(stmt.file_path):
        raise HTTPException(status_code=404, detail="File not available")

    # Determine media type for inline viewing
    ext = os.path.splitext(stmt.file_path)[1].lower()
    media_types = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc": "application/msword",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".tiff": "image/tiff",
        ".tif": "image/tiff",
        ".bmp": "image/bmp",
        ".webp": "image/webp",
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        stmt.file_path,
        media_type=media_type,
        filename=stmt.filename,
    )


@router.get("/transactions/search", response_model=TransactionSearchResponse)
async def search_transactions(
    q: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
    category_names: str | None = None,
    type: str | None = None,
    status: str | None = None,
    statement_id: int | None = None,
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    sort_by: str | None = Query(default=None),
    sort_order: str | None = Query(default="desc"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Search transactions with filters and pagination."""
    cat_list = [c.strip() for c in category_names.split(",")] if category_names else None

    transactions, total = await StatementService.search_transactions(
        db, owner_id=user.id, q=q,
        start_date=start_date, end_date=end_date,
        min_amount=min_amount, max_amount=max_amount,
        category_names=cat_list, type_filter=type, status_filter=status,
        statement_id=statement_id,
        limit=limit, offset=offset,
        sort_by=sort_by, sort_order=sort_order,
    )
    return TransactionSearchResponse(
        transactions=transactions, total=total, limit=limit, offset=offset,
    )


@router.get("/transactions", response_model=list[TransactionResponse])
async def list_transactions(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all transactions, optionally filtered by status."""
    return await StatementService.get_transactions(
        db, owner_id=user.id, status_filter=status,
    )


@router.post("/transactions/reclassify")
async def reclassify_transactions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Re-classify all unconfirmed transactions using current mappings."""
    count = await StatementService.reclassify_unconfirmed(db, owner_id=user.id)
    return {"reclassified": count}


@router.post("/statements/reparse-currencies")
async def reparse_currencies(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Re-parse all stored statement files and update foreign currency fields."""
    count = await StatementService.reparse_currencies(db, owner_id=user.id)
    return {"updated": count}


@router.post("/transactions/bulk-update")
async def bulk_update_transactions(
    request: BulkUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update category/status for multiple transactions at once."""
    count = await StatementService.bulk_update_transactions(
        db, owner_id=user.id,
        transaction_ids=request.transaction_ids,
        category_name=request.category_name,
        status=request.status,
    )
    return {"updated": count}


@router.post("/transactions/categorize-similar")
async def categorize_similar(
    request: CategorizeSimilarRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Categorize all transactions with matching description."""
    count = await StatementService.categorize_similar(
        db, owner_id=user.id,
        description=request.description,
        category_name=request.category_name,
    )
    return {"updated": count}


@router.put("/transactions/{tx_id}", response_model=TransactionResponse)
async def update_transaction(
    tx_id: int,
    update: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a transaction's category or status."""
    tx = await StatementService.update_transaction(
        db, owner_id=user.id, tx_id=tx_id,
        category_name=update.category_name,
        status=update.status,
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx
