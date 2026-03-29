import os

from fastapi import APIRouter, Depends, File, Query, UploadFile, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from core.database import get_db
from features.auth.models import User
from features.imports.schemas import (
    ImportUploadResponse, ImportPreviewRequest, ImportPreviewResponse,
    ImportExecuteRequest, ImportExecuteResponse,
)
from features.imports.service import ImportService
from features.imports.excel_parser import parse_finance_excel

router = APIRouter(prefix="/imports", tags=["imports"])

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".webp", ".heic"}
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".pdf", ".docx", ".doc"} | IMAGE_EXTENSIONS


@router.post("/upload", response_model=ImportUploadResponse)
async def upload_import_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    # Handle PDF/Word/Image documents (use statement parser with bank detection)
    if ext in {".pdf", ".docx", ".doc"} | IMAGE_EXTENSIONS:
        from features.statements.service import StatementService
        import shutil

        temp_path = ImportService.get_temp_path(user.id, file.filename)
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        try:
            statement, new_count = await StatementService.upload_and_parse(
                db, owner_id=user.id, filename=file.filename, file_path=temp_path
            )
            await db.commit()  # Ensure statement is committed

            stmt_type = statement.statement_type or "bank"
            msg = None
            if new_count == 0 and stmt_type == "bank":
                bank = statement.bank_name or "unknown"
                msg = (
                    f"No transactions could be extracted from this file "
                    f"(detected as: {bank}). Try importing as CSV instead."
                )

            return ImportUploadResponse(
                filename=file.filename,
                columns=[],
                total_rows=new_count,
                sample_rows=[],
                is_statement=True,
                statement_id=statement.id,
                statement_type=stmt_type,
                period_start=statement.period_start,
                period_end=statement.period_end,
                message=msg,
            )
        except Exception as e:
            raise HTTPException(400, f"Failed to parse document: {str(e)}")

    # Save to temp location
    temp_path = ImportService.get_temp_path(user.id, file.filename)
    content = await file.read()
    with open(temp_path, "wb") as f:
        f.write(content)

    try:
        columns, rows = ImportService.parse_file(temp_path)
    except Exception as e:
        ImportService.cleanup_temp(temp_path)
        raise HTTPException(400, f"Failed to parse file: {str(e)}")

    sample = rows[:5]
    # Convert sample rows to JSON-serializable dicts
    safe_sample = []
    for row in sample:
        safe_sample.append({k: str(v) if v is not None else "" for k, v in row.items()})

    return ImportUploadResponse(
        filename=os.path.basename(temp_path),
        columns=columns,
        total_rows=len(rows),
        sample_rows=safe_sample,
    )


@router.post("/preview", response_model=ImportPreviewResponse)
async def preview_import(
    body: ImportPreviewRequest,
    user: User = Depends(get_current_user),
):
    temp_path = os.path.join("/app/uploads", body.filename)
    if not os.path.exists(temp_path):
        raise HTTPException(404, "File not found. Upload again.")

    result = ImportService.preview_import(
        file_path=temp_path,
        mapping=body.mapping.model_dump(),
        date_format=body.date_format,
        decimal_separator=body.decimal_separator,
    )

    return ImportPreviewResponse(**result)


@router.post("/execute", response_model=ImportExecuteResponse)
async def execute_import(
    body: ImportExecuteRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    temp_path = os.path.join("/app/uploads", body.filename)
    if not os.path.exists(temp_path):
        raise HTTPException(404, "File not found. Upload again.")

    statement, imported, skipped = await ImportService.execute_import(
        db=db,
        owner_id=user.id,
        file_path=temp_path,
        mapping=body.mapping.model_dump(),
        date_format=body.date_format,
        decimal_separator=body.decimal_separator,
        account_id=body.account_id,
        default_currency=body.default_currency,
    )

    # Clean up temp file after import
    ImportService.cleanup_temp(temp_path)

    return ImportExecuteResponse(
        statement_id=statement.id,
        transactions_imported=imported,
        transactions_skipped=skipped,
        message=f"Imported {imported} transactions, skipped {skipped} duplicates.",
    )


@router.delete("/temp/{filename}")
async def cleanup_temp_file(
    filename: str,
    user: User = Depends(get_current_user),
):
    temp_path = os.path.join("/app/uploads", filename)
    if ImportService.cleanup_temp(temp_path):
        return {"message": "Temp file cleaned up"}
    raise HTTPException(404, "File not found")


@router.post("/excel-history", response_model=ImportExecuteResponse)
async def import_excel_history(
    file: UploadFile = File(...),
    year: int = Query(..., ge=2020, le=2030),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Import historical data from Finance.xlsx with monthly sheets."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in {".xlsx", ".xls"}:
        raise HTTPException(400, "Excel file required (.xlsx or .xls)")

    temp_path = ImportService.get_temp_path(user.id, file.filename)
    content = await file.read()
    with open(temp_path, "wb") as f:
        f.write(content)

    try:
        transactions = parse_finance_excel(temp_path, year)
    except Exception as e:
        ImportService.cleanup_temp(temp_path)
        raise HTTPException(400, f"Failed to parse Excel: {str(e)}")

    if not transactions:
        ImportService.cleanup_temp(temp_path)
        raise HTTPException(400, "No monthly sheets found in file")

    statement, imported, skipped = await ImportService.execute_excel_history(
        db=db,
        owner_id=user.id,
        transactions=transactions,
        filename=os.path.basename(temp_path),
    )

    ImportService.cleanup_temp(temp_path)

    return ImportExecuteResponse(
        statement_id=statement.id,
        transactions_imported=imported,
        transactions_skipped=skipped,
        message=f"Imported {imported} historical transactions from {year}, skipped {skipped} duplicates.",
    )
