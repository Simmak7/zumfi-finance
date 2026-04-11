import re
import difflib

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from features.categories.models import Category, CategoryMapping


class CategoryService:
    @staticmethod
    async def get_all(db: AsyncSession, owner_id: int) -> list[Category]:
        result = await db.execute(
            select(Category)
            .where(Category.owner_id == owner_id)
            .options(selectinload(Category.mappings))
            .order_by(Category.sort_order.asc(), Category.id.asc())
        )
        categories = list(result.scalars().all())
        # Attach mapping_count for the response schema
        for cat in categories:
            cat.mapping_count = len(cat.mappings)
        return categories

    @staticmethod
    async def create(db: AsyncSession, owner_id: int, name: str, section: str, icon: str | None = None, color: str | None = None) -> Category:
        category = Category(owner_id=owner_id, name=name, section=section, icon=icon, color=color)
        db.add(category)
        await db.flush()
        await db.refresh(category)
        return category

    @staticmethod
    async def get_mappings(db: AsyncSession, owner_id: int) -> list[CategoryMapping]:
        result = await db.execute(
            select(CategoryMapping)
            .where(CategoryMapping.owner_id == owner_id)
            .options(selectinload(CategoryMapping.category))
        )
        return list(result.scalars().all())

    @staticmethod
    async def add_mapping(db: AsyncSession, owner_id: int, category_id: int, keyword: str, match_type: str = "substring") -> CategoryMapping:
        mapping = CategoryMapping(
            owner_id=owner_id,
            category_id=category_id,
            keyword=keyword.lower(),
            match_type=match_type,
        )
        db.add(mapping)
        await db.flush()
        await db.refresh(mapping)
        return mapping

    @staticmethod
    async def classify(db: AsyncSession, owner_id: int, description: str) -> tuple[str, str, float, int | None]:
        """Classify a transaction description. Returns (section, category_name, confidence, category_id)."""
        desc_lower = description.lower()

        # Load all categories with mappings
        result = await db.execute(
            select(Category)
            .where(Category.owner_id == owner_id)
            .options(selectinload(Category.mappings))
        )
        categories = list(result.scalars().all())

        # 1. Regex match (highest confidence)
        for cat in categories:
            for mapping in cat.mappings:
                if mapping.match_type == "regex":
                    try:
                        if re.search(mapping.keyword, description, re.IGNORECASE):
                            return cat.section, cat.name, 1.0, cat.id
                    except re.error:
                        continue

        # 2. Exact/substring match (high confidence) — longest match wins
        matches = []
        for cat in categories:
            for mapping in cat.mappings:
                if mapping.match_type in ("substring", "exact", "learned"):
                    if mapping.keyword in desc_lower:
                        matches.append((len(mapping.keyword), cat))

        if matches:
            matches.sort(key=lambda x: x[0], reverse=True)
            best_cat = matches[0][1]
            return best_cat.section, best_cat.name, 0.9, best_cat.id

        # 3. Fuzzy match (medium confidence)
        best_ratio = 0.0
        best_section = "unknown"
        best_name = "Unknown"
        best_id = None

        for cat in categories:
            for mapping in cat.mappings:
                ratio = difflib.SequenceMatcher(None, mapping.keyword, desc_lower).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_section = cat.section
                    best_name = cat.name
                    best_id = cat.id

        if best_ratio > 0.6:
            return best_section, best_name, round(best_ratio, 2), best_id

        return "unknown", "Unknown", 0.0, None

    # Words to skip when learning keywords from descriptions
    STOP_WORDS = {
        # English generic
        "the", "and", "for", "from", "with", "this", "that",
        # Banking terms
        "payment", "card", "transfer", "platba", "kartou", "prevod",
        "incoming", "outgoing", "credit", "debit", "apple", "pay",
        "google", "samsung", "garmin",
        # Currencies
        "czk", "eur", "usd", "kc", "gbp",
        # Czech locations (cause cross-category conflicts)
        "praha", "prague", "brno", "ostrava", "plzen", "liberec",
        "olomouc", "ceske", "budejovice", "hradec", "kralove",
        "mlada", "boleslav", "karlovy", "vary", "usti", "nad", "labem",
        "pardubice", "zlin", "jihlava", "kladno", "most", "opava",
        "frydek", "mistek", "kolin", "tabor",
        # Generic store/location terms
        "ulice", "street", "nam", "namesti", "obchodni", "centrum",
        "retail", "store", "shop", "market", "center", "centro",
        "novy", "stary", "velky", "maly",
        # Date/number related
        "jan", "feb", "mar", "apr", "may", "jun",
        "jul", "aug", "sep", "oct", "nov", "dec",
    }

    @staticmethod
    async def learn_from_confirmation(
        db: AsyncSession, owner_id: int, description: str, category_name: str,
    ) -> int:
        """Extract keywords from a confirmed transaction and auto-create mappings.
        Returns count of new mappings created."""
        # Find category by name (unique per owner after unification)
        result = await db.execute(
            select(Category).where(
                Category.owner_id == owner_id,
                Category.name == category_name,
            )
        )
        category = result.scalar_one_or_none()
        if not category:
            return 0

        # Load existing mappings for this owner to avoid duplicates
        existing_result = await db.execute(
            select(CategoryMapping.keyword).where(
                CategoryMapping.owner_id == owner_id,
            )
        )
        existing_keywords = {row[0] for row in existing_result.all()}

        # Extract candidate keywords from description
        words = description.lower().split()
        candidates = []
        for word in words:
            cleaned = word.strip(".,;:!?()[]{}\"'/-#*")
            if len(cleaned) < 3:
                continue
            if cleaned in CategoryService.STOP_WORDS:
                continue
            if cleaned.isdigit():
                continue
            candidates.append(cleaned)

        created = 0

        # Learn full cleaned description as a single keyword (highest-value match)
        full_cleaned = " ".join(candidates)
        if len(full_cleaned) >= 3:
            if full_cleaned in existing_keywords:
                # Update if it points to a different category
                em_result = await db.execute(
                    select(CategoryMapping).where(
                        CategoryMapping.owner_id == owner_id,
                        CategoryMapping.keyword == full_cleaned,
                    )
                )
                em = em_result.scalar_one_or_none()
                if em and em.category_id != category.id:
                    em.category_id = category.id
            else:
                mapping = CategoryMapping(
                    owner_id=owner_id,
                    category_id=category.id,
                    keyword=full_cleaned,
                    match_type="learned",
                )
                db.add(mapping)
                existing_keywords.add(full_cleaned)
                created += 1

        # Learn individual words (lower-value, but helps with partial matches)
        for keyword in candidates:
            if keyword in existing_keywords:
                # Update if it points to a different category
                em_result = await db.execute(
                    select(CategoryMapping).where(
                        CategoryMapping.owner_id == owner_id,
                        CategoryMapping.keyword == keyword,
                    )
                )
                em = em_result.scalar_one_or_none()
                if em and em.category_id != category.id:
                    em.category_id = category.id
                continue
            mapping = CategoryMapping(
                owner_id=owner_id,
                category_id=category.id,
                keyword=keyword,
                match_type="learned",
            )
            db.add(mapping)
            existing_keywords.add(keyword)
            created += 1

        if created > 0:
            await db.flush()
        return created

    @staticmethod
    async def seed_defaults(db: AsyncSession, owner_id: int):
        """Seed default categories with general, fixed, and in_and_out sections."""
        general_defaults = {
            "Salary": ["salary", "wages", "payroll"],
            "Other Income": ["refund", "cashback", "reimbursement"],
            "Groceries": ["tesco", "albert", "lidl", "billa", "rohlik", "kaufland"],
            "Restaurants": ["starbucks", "mcdonald", "kfc", "restaurant", "cafe"],
            "Entertainment": ["netflix", "spotify", "cinema", "steam", "playstation"],
            "Health & Medical": ["pharmacy", "doctor", "hospital", "dentist"],
            "Home": ["furniture", "ikea", "household"],
            "Clothes": ["zara", "h&m", "clothes", "shoes"],
            "Cosmetics/supplements": ["cosmetics", "dm drogerie", "supplements"],
            "Travelling": ["booking", "airbnb", "hotel", "flight"],
            "Gifts": ["gift", "present"],
            "Investments": ["investment", "etoro", "trading", "xtb", "degiro", "portu"],
        }

        fixed_defaults = {
            "Fixed Bills": ["fixed bills"],
            "Mortgage": ["mortgage", "hypotéka"],
        }

        in_and_out_defaults = {
            "Between Accounts": ["between accounts", "own account"],
            "Saving account": ["spořicí", "spoření", "saving account"],
        }

        for section, cats in [
            ("general", general_defaults),
            ("fixed", fixed_defaults),
            ("in_and_out", in_and_out_defaults),
        ]:
            for cat_name, keywords in cats.items():
                category = Category(
                    owner_id=owner_id, name=cat_name, section=section,
                )
                db.add(category)
                await db.flush()
                await db.refresh(category)

                for kw in keywords:
                    mapping = CategoryMapping(
                        owner_id=owner_id,
                        category_id=category.id,
                        keyword=kw.lower(),
                        match_type="substring",
                    )
                    db.add(mapping)

        await db.flush()

    @staticmethod
    async def update(
        db: AsyncSession,
        owner_id: int,
        category_id: int,
        name: str | None = None,
        section: str | None = None,
        icon: str | None = None,
        color: str | None = None,
    ) -> Category | None:
        """Update a category."""
        result = await db.execute(
            select(Category).where(
                Category.id == category_id,
                Category.owner_id == owner_id,
            )
        )
        category = result.scalar_one_or_none()
        if not category:
            return None

        if name is not None:
            category.name = name
        if section is not None:
            category.section = section
        if icon is not None:
            category.icon = icon
        if color is not None:
            category.color = color

        await db.flush()
        await db.refresh(category)
        return category

    @staticmethod
    async def delete(db: AsyncSession, owner_id: int, category_id: int) -> bool:
        """Delete a category (cascade handled by FK)."""
        result = await db.execute(
            select(Category).where(
                Category.id == category_id,
                Category.owner_id == owner_id,
            )
        )
        category = result.scalar_one_or_none()
        if not category:
            return False

        await db.delete(category)
        await db.flush()
        return True

    @staticmethod
    async def reorder(db: AsyncSession, owner_id: int, category_ids: list[int]) -> bool:
        """Set sort_order for categories based on the provided ID order."""
        from sqlalchemy import update, case
        if not category_ids:
            return True
        # Single bulk UPDATE instead of N individual queries
        await db.execute(
            update(Category)
            .where(Category.owner_id == owner_id, Category.id.in_(category_ids))
            .values(sort_order=case(
                *[(Category.id == cat_id, idx) for idx, cat_id in enumerate(category_ids)],
                else_=Category.sort_order,
            ))
        )
        await db.flush()
        return True

    @staticmethod
    async def get_category_mappings(
        db: AsyncSession,
        owner_id: int,
        category_id: int,
    ) -> list[CategoryMapping]:
        """Get all mappings for a category."""
        result = await db.execute(
            select(CategoryMapping).where(
                CategoryMapping.category_id == category_id,
                CategoryMapping.owner_id == owner_id,
            ).order_by(CategoryMapping.match_type, CategoryMapping.keyword)
        )
        return list(result.scalars().all())

    @staticmethod
    async def update_mapping(
        db: AsyncSession,
        owner_id: int,
        mapping_id: int,
        keyword: str | None = None,
        match_type: str | None = None,
    ) -> CategoryMapping | None:
        """Update a mapping."""
        result = await db.execute(
            select(CategoryMapping).where(
                CategoryMapping.id == mapping_id,
                CategoryMapping.owner_id == owner_id,
            )
        )
        mapping = result.scalar_one_or_none()
        if not mapping:
            return None

        if keyword is not None:
            mapping.keyword = keyword.lower()
        if match_type is not None:
            mapping.match_type = match_type

        await db.flush()
        await db.refresh(mapping)
        return mapping

    @staticmethod
    async def delete_mapping(db: AsyncSession, owner_id: int, mapping_id: int) -> bool:
        """Delete a mapping."""
        result = await db.execute(
            select(CategoryMapping).where(
                CategoryMapping.id == mapping_id,
                CategoryMapping.owner_id == owner_id,
            )
        )
        mapping = result.scalar_one_or_none()
        if not mapping:
            return False

        await db.delete(mapping)
        await db.flush()
        return True
