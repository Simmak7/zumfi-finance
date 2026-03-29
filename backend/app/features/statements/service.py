import os
import logging
from datetime import date
from decimal import Decimal

logger = logging.getLogger(__name__)

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from features.statements.models import Statement, Transaction
from features.statements.parsers.detector import detect_bank, detect_statement_type
from features.statements.parsers.balance_extractor import extract_closing_balance, extract_statement_period
from features.categories.service import CategoryService


def _derive_section(category_section: str, transaction_type: str) -> str:
    """Derive transaction section from category section and transaction type."""
    if category_section == "in_and_out":
        return "in_and_out"
    return transaction_type  # "income" or "expense"


class StatementService:
    @staticmethod
    async def upload_and_parse(
        db: AsyncSession, owner_id: int, filename: str, file_path: str
    ) -> tuple[Statement, int]:
        """Upload a PDF, parse transactions, classify, and save."""
        # Create statement record
        statement = Statement(
            owner_id=owner_id,
            filename=filename,
            status="processing",
        )
        db.add(statement)
        await db.flush()
        await db.refresh(statement)

        # Detect bank and parse document (single detection pass)
        try:
            parser = detect_bank(file_path)
            statement.bank_name = parser.BANK_NAME
            raw_transactions = parser.parse(file_path)
            logger.info(
                f"Parsed {len(raw_transactions)} transactions from "
                f"{filename} (bank: {statement.bank_name})"
            )
        except Exception as e:
            logger.error(f"Failed to parse {filename}: {e}")
            statement.status = "failed"
            await db.flush()
            raise e

        # Keep the file for later viewing — rename from temp to permanent
        ext = os.path.splitext(file_path)[1]
        permanent_path = os.path.join(
            os.path.dirname(file_path),
            f"stmt_{owner_id}_{statement.id}{ext}",
        )
        try:
            os.rename(file_path, permanent_path)
            statement.file_path = permanent_path
        except OSError:
            statement.file_path = file_path

        # Detect statement type early to skip transaction parsing for stock statements
        actual_path = statement.file_path or file_path
        statement.statement_type = detect_statement_type(actual_path)

        new_count = 0

        if statement.statement_type == "stock":
            # Stock statements don't contain bank transactions — link holdings directly
            from features.statements.linkers import link_stock_holdings
            new_count = await link_stock_holdings(
                db, owner_id, actual_path, statement,
            )
        elif statement.statement_type == "stock_pnl":
            # P&L statements contain realized trades and dividends
            from features.statements.linkers import link_stock_pnl
            new_count = await link_stock_pnl(
                db, owner_id, actual_path, statement,
            )
        elif statement.statement_type == "savings":
            # Savings statements update portfolio only — no transactions
            p_start, p_end = extract_statement_period(actual_path)
            if p_start and p_end:
                statement.period_start = p_start
                statement.period_end = p_end
            else:
                from calendar import monthrange
                today = date.today()
                statement.period_start = date(today.year, today.month, 1)
                _, last_day = monthrange(today.year, today.month)
                statement.period_end = date(today.year, today.month, last_day)

            balance = extract_closing_balance(actual_path)
            if balance is not None:
                statement.closing_balance = balance
                from features.statements.linkers import link_savings_account
                await link_savings_account(
                    db, owner_id, statement.bank_name, balance, statement,
                )
        else:
            # Save transactions with deduplication and track date range
            min_date = None
            max_date = None

            # Batch load existing transactions for dedup (single query instead of N)
            existing_result = await db.execute(
                select(
                    Transaction.original_description,
                    Transaction.date,
                    Transaction.amount,
                    Transaction.type,
                    Transaction.currency,
                ).where(Transaction.owner_id == owner_id)
            )
            existing_keys = {
                (row[0], row[1], float(row[2]), row[3], row[4])
                for row in existing_result.all()
            }

            for tx_data in raw_transactions:
                currency = tx_data.get("currency", "CZK")
                dedup_key = (
                    tx_data["original_description"],
                    tx_data["date"],
                    float(tx_data["amount"]),
                    tx_data["type"],
                    currency,
                )
                if dedup_key in existing_keys:
                    continue
                # Mark as seen so duplicates within the same file are caught
                existing_keys.add(dedup_key)

                cat_section, category_name, confidence, category_id = await CategoryService.classify(
                    db, owner_id=owner_id, description=tx_data["original_description"]
                )
                tx_section = _derive_section(cat_section, tx_data["type"])

                transaction = Transaction(
                    owner_id=owner_id,
                    statement_id=statement.id,
                    date=tx_data["date"],
                    description=tx_data["description"],
                    original_description=tx_data["original_description"],
                    amount=tx_data["amount"],
                    type=tx_data["type"],
                    category_id=category_id,
                    section=tx_section,
                    category_name=category_name,
                    status="classified" if cat_section != "unknown" else "review",
                    confidence=confidence,
                    currency=tx_data.get("currency", "CZK"),
                    original_amount=tx_data.get("original_amount"),
                    original_currency=tx_data.get("original_currency"),
                )
                db.add(transaction)
                new_count += 1

                tx_date = tx_data["date"]
                if min_date is None or tx_date < min_date:
                    min_date = tx_date
                if max_date is None or tx_date > max_date:
                    max_date = tx_date

            # Auto-set period based on transaction dates
            if min_date and max_date:
                statement.period_start = min_date
                statement.period_end = max_date

            # If no period from transactions, try extracting from document text
            if not statement.period_start:
                p_start, p_end = extract_statement_period(actual_path)
                if p_start and p_end:
                    statement.period_start = p_start
                    statement.period_end = p_end

            skipped = len(raw_transactions) - new_count
            if skipped > 0:
                logger.info(f"Skipped {skipped} duplicate transactions from {filename}")

        statement.status = "completed"
        await db.flush()
        await db.refresh(statement)

        return statement, new_count

    @staticmethod
    async def get_statements(db: AsyncSession, owner_id: int) -> list[Statement]:
        # Query statements with transaction counts
        result = await db.execute(
            select(
                Statement,
                func.count(Transaction.id).label("transaction_count")
            )
            .outerjoin(Transaction, Transaction.statement_id == Statement.id)
            .where(Statement.owner_id == owner_id)
            .group_by(Statement.id)
            .order_by(Statement.upload_date.desc())
        )

        # Add transaction count and file availability to each statement object
        statements_with_counts = []
        for stmt, count in result.all():
            stmt.transaction_count = count
            stmt.has_file = bool(stmt.file_path and os.path.exists(stmt.file_path))
            statements_with_counts.append(stmt)

        return statements_with_counts

    @staticmethod
    async def get_transactions(
        db: AsyncSession, owner_id: int, status_filter: str | None = None
    ) -> list[Transaction]:
        query = select(Transaction).where(Transaction.owner_id == owner_id)
        if status_filter:
            query = query.where(Transaction.status == status_filter)
        query = query.order_by(Transaction.date.desc(), Transaction.id.asc())
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def search_transactions(
        db: AsyncSession,
        owner_id: int,
        q: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        min_amount: Decimal | None = None,
        max_amount: Decimal | None = None,
        category_names: list[str] | None = None,
        type_filter: str | None = None,
        status_filter: str | None = None,
        statement_id: int | None = None,
        limit: int = 100,
        offset: int = 0,
        sort_by: str | None = None,
        sort_order: str | None = "desc",
    ) -> tuple[list[Transaction], int]:
        """Search transactions with multiple filters. Returns (results, total_count)."""
        base = select(Transaction).where(Transaction.owner_id == owner_id)

        if q:
            pattern = f"%{q}%"
            base = base.where(
                or_(
                    Transaction.description.ilike(pattern),
                    Transaction.original_description.ilike(pattern),
                )
            )
        if start_date:
            base = base.where(Transaction.date >= start_date)
        if end_date:
            base = base.where(Transaction.date <= end_date)
        if min_amount is not None:
            base = base.where(Transaction.amount >= min_amount)
        if max_amount is not None:
            base = base.where(Transaction.amount <= max_amount)
        if category_names:
            base = base.where(Transaction.category_name.in_(category_names))
        if type_filter:
            base = base.where(Transaction.type == type_filter)
        if status_filter:
            base = base.where(Transaction.status == status_filter)
        if statement_id is not None:
            base = base.where(Transaction.statement_id == statement_id)

        # Total count
        count_q = select(func.count()).select_from(base.subquery())
        total = (await db.execute(count_q)).scalar() or 0

        # Apply sorting (secondary sort by id ASC preserves file order within same date)
        if sort_by == "date":
            order_col = Transaction.date.desc() if sort_order == "desc" else Transaction.date.asc()
            query = base.order_by(order_col, Transaction.id.asc())
        elif sort_by == "amount":
            order_col = Transaction.amount.desc() if sort_order == "desc" else Transaction.amount.asc()
            query = base.order_by(order_col, Transaction.id.asc())
        elif sort_by == "description":
            order_col = Transaction.description.desc() if sort_order == "desc" else Transaction.description.asc()
            query = base.order_by(order_col, Transaction.id.asc())
        else:
            # Default: newest first, file order within same date
            query = base.order_by(Transaction.date.desc(), Transaction.id.asc())

        # Paginated results
        query = query.limit(limit).offset(offset)
        result = await db.execute(query)
        return list(result.scalars().all()), total

    @staticmethod
    async def bulk_update_transactions(
        db: AsyncSession,
        owner_id: int,
        transaction_ids: list[int],
        category_name: str,
        status: str = "classified",
    ) -> int:
        """Update category/status for multiple transactions. Returns count."""
        # Resolve category by name (unique per owner)
        from features.categories.models import Category
        cat_result = await db.execute(
            select(Category).where(
                Category.owner_id == owner_id,
                Category.name == category_name,
            )
        )
        cat = cat_result.scalar_one_or_none()
        cat_id = cat.id if cat else None

        result = await db.execute(
            select(Transaction).where(
                Transaction.owner_id == owner_id,
                Transaction.id.in_(transaction_ids),
                Transaction.status != "confirmed",
            )
        )
        txs = list(result.scalars().all())
        for tx in txs:
            tx.category_id = cat_id
            tx.category_name = category_name
            tx.section = _derive_section(cat.section if cat else "general", tx.type)
            tx.status = status
        await db.flush()

        # Auto-learn from bulk categorization
        seen = set()
        for tx in txs:
            desc = tx.description or tx.original_description
            if desc and desc not in seen:
                seen.add(desc)
                try:
                    await CategoryService.learn_from_confirmation(
                        db, owner_id=owner_id,
                        description=desc,
                        category_name=category_name,
                    )
                except Exception:
                    pass

        return len(txs)

    @staticmethod
    async def categorize_similar(
        db: AsyncSession,
        owner_id: int,
        description: str,
        category_name: str,
    ) -> int:
        """Categorize all transactions with matching description. Returns count."""
        # Resolve category by name (unique per owner)
        from features.categories.models import Category
        cat_result = await db.execute(
            select(Category).where(
                Category.owner_id == owner_id,
                Category.name == category_name,
            )
        )
        cat = cat_result.scalar_one_or_none()
        cat_id = cat.id if cat else None

        result = await db.execute(
            select(Transaction).where(
                Transaction.owner_id == owner_id,
                Transaction.description.ilike(description),
                Transaction.status != "confirmed",
            )
        )
        txs = list(result.scalars().all())
        for tx in txs:
            tx.category_id = cat_id
            tx.category_name = category_name
            tx.section = _derive_section(cat.section if cat else "general", tx.type)
            tx.status = "classified"
        await db.flush()

        # Auto-learn from categorize-similar
        try:
            await CategoryService.learn_from_confirmation(
                db, owner_id=owner_id,
                description=description,
                category_name=category_name,
            )
        except Exception:
            pass

        return len(txs)

    @staticmethod
    async def update_transaction(
        db: AsyncSession, owner_id: int, tx_id: int,
        category_name: str | None = None,
        status: str | None = None,
    ) -> Transaction | None:
        result = await db.execute(
            select(Transaction).where(
                Transaction.id == tx_id,
                Transaction.owner_id == owner_id,
            )
        )
        tx = result.scalar_one_or_none()
        if not tx:
            return None

        # Track if user is manually categorizing (for auto-learning)
        user_categorized = category_name is not None and category_name != tx.category_name
        user_confirmed = (
            status == "confirmed"
            and tx.category_name
            and tx.category_name != "Unknown"
        )
        should_learn = user_categorized or user_confirmed

        if category_name is not None:
            tx.category_name = category_name
            # Resolve category by name (unique per owner)
            from features.categories.models import Category
            cat_result = await db.execute(
                select(Category).where(
                    Category.owner_id == owner_id,
                    Category.name == category_name,
                )
            )
            cat = cat_result.scalar_one_or_none()
            tx.category_id = cat.id if cat else None
            # Derive section from category + transaction type
            tx.section = _derive_section(cat.section if cat else "general", tx.type)
        if status is not None:
            tx.status = status
        # Auto-confirm when user manually changes category
        if user_categorized and status is None:
            tx.status = "confirmed"

        await db.flush()

        # Auto-learn from manual categorization or confirmation
        learn_desc = tx.description or tx.original_description
        if should_learn and learn_desc and tx.category_name:
            try:
                await CategoryService.learn_from_confirmation(
                    db, owner_id=owner_id,
                    description=learn_desc,
                    category_name=tx.category_name,
                )
            except Exception:
                pass  # Learning failure should not block the update

        await db.refresh(tx)
        return tx

    @staticmethod
    async def reclassify_unconfirmed(
        db: AsyncSession, owner_id: int,
    ) -> int:
        """Re-run classification on all non-confirmed transactions."""
        result = await db.execute(
            select(Transaction).where(
                Transaction.owner_id == owner_id,
                Transaction.status != "confirmed",
            )
        )
        txs = list(result.scalars().all())
        updated = 0
        for tx in txs:
            desc = tx.description or tx.original_description
            cat_section, cat_name, confidence, cat_id = await CategoryService.classify(
                db, owner_id=owner_id, description=desc
            )
            if cat_name != tx.category_name:
                tx.category_name = cat_name
                tx.category_id = cat_id
                tx.section = _derive_section(cat_section, tx.type)
                tx.confidence = confidence
                tx.status = "classified" if cat_section != "unknown" else "review"
                updated += 1
        await db.flush()
        return updated

    @staticmethod
    async def reparse_currencies(
        db: AsyncSession, owner_id: int,
    ) -> int:
        """Re-parse all stored statement files and update currency fields.

        Matches parsed transactions to existing DB records by
        (original_description, date, amount, type) and fills in
        original_amount/original_currency where they were missing.
        """
        # Get all completed statements that still have stored files
        result = await db.execute(
            select(Statement).where(
                Statement.owner_id == owner_id,
                Statement.status == "completed",
                Statement.file_path.isnot(None),
            )
        )
        statements = list(result.scalars().all())

        updated = 0
        for stmt in statements:
            if not stmt.file_path or not os.path.exists(stmt.file_path):
                continue

            try:
                parser = detect_bank(stmt.file_path)
                raw_transactions = parser.parse(stmt.file_path)
            except Exception:
                continue

            for tx_data in raw_transactions:
                new_orig_amount = tx_data.get("original_amount")
                new_orig_currency = tx_data.get("original_currency")
                if not new_orig_amount or not new_orig_currency:
                    continue

                # Find matching existing transaction
                currency = tx_data.get("currency", "CZK")
                match_result = await db.execute(
                    select(Transaction).where(
                        Transaction.owner_id == owner_id,
                        Transaction.statement_id == stmt.id,
                        Transaction.date == tx_data["date"],
                        Transaction.amount == tx_data["amount"],
                        Transaction.type == tx_data["type"],
                        Transaction.currency == currency,
                        Transaction.original_currency.is_(None),
                    )
                )
                matches = list(match_result.scalars().all())
                for tx in matches:
                    tx.original_amount = new_orig_amount
                    tx.original_currency = new_orig_currency
                    updated += 1

        await db.flush()
        return updated

    @staticmethod
    async def delete_statement(
        db: AsyncSession, owner_id: int, statement_id: int
    ) -> bool:
        """Delete a statement and all its transactions."""
        # First check if the statement exists and belongs to the user
        result = await db.execute(
            select(Statement).where(
                Statement.id == statement_id,
                Statement.owner_id == owner_id
            )
        )
        statement = result.scalar_one_or_none()
        if not statement:
            return False

        # Delete all transactions associated with this statement
        from sqlalchemy import delete as sql_delete
        await db.execute(
            sql_delete(Transaction).where(Transaction.statement_id == statement_id)
        )

        # Delete P&L records (trades + dividends) linked to this statement
        from features.portfolio.models import StockTrade, StockDividend
        await db.execute(
            sql_delete(StockTrade).where(StockTrade.statement_id == statement_id)
        )
        await db.execute(
            sql_delete(StockDividend).where(StockDividend.statement_id == statement_id)
        )

        # Delete the stored file
        if statement.file_path and os.path.exists(statement.file_path):
            try:
                os.remove(statement.file_path)
            except OSError:
                pass

        # Delete the statement
        await db.delete(statement)
        await db.flush()
        return True

    @staticmethod
    async def update_statement(
        db: AsyncSession,
        owner_id: int,
        statement_id: int,
        period_start: date | None = None,
        period_end: date | None = None,
    ) -> Statement | None:
        """Update statement period (assign to month)."""
        result = await db.execute(
            select(Statement).where(
                Statement.id == statement_id,
                Statement.owner_id == owner_id
            )
        )
        statement = result.scalar_one_or_none()
        if not statement:
            return None

        if period_start is not None:
            statement.period_start = period_start
        if period_end is not None:
            statement.period_end = period_end

        await db.flush()
        await db.refresh(statement)
        return statement


    @staticmethod
    async def update_statement_type(
        db: AsyncSession,
        owner_id: int,
        statement_id: int,
        statement_type: str,
    ) -> Statement | None:
        """Change a statement's type and trigger/remove portfolio linking."""
        result = await db.execute(
            select(Statement).where(
                Statement.id == statement_id,
                Statement.owner_id == owner_id,
            )
        )
        statement = result.scalar_one_or_none()
        if not statement:
            return None

        old_type = statement.statement_type
        statement.statement_type = statement_type

        if statement_type == "savings" and old_type != "savings":
            # Attempt balance extraction and portfolio linking
            if statement.file_path and os.path.exists(statement.file_path):
                balance = extract_closing_balance(statement.file_path)
                if balance is not None:
                    statement.closing_balance = balance
                    from features.statements.linkers import link_savings_account
                    await link_savings_account(
                        db, owner_id, statement.bank_name, balance, statement,
                    )
        elif statement_type == "bank" and old_type == "savings":
            # Unlink from savings account (keep the savings account itself)
            statement.linked_savings_id = None
            statement.closing_balance = None

        await db.flush()
        await db.refresh(statement)

        # Attach computed fields for response
        stmt_count = await db.execute(
            select(func.count(Transaction.id)).where(
                Transaction.statement_id == statement.id
            )
        )
        statement.transaction_count = stmt_count.scalar() or 0
        statement.has_file = bool(
            statement.file_path and os.path.exists(statement.file_path)
        )
        return statement


    # _link_savings_account moved to features.statements.linkers
