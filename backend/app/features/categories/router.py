from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.auth import get_current_user
from features.auth.models import User
from features.statements.models import Transaction
from features.categories.schemas import (
    CategoryCreate, CategoryUpdate, CategoryResponse,
    MappingCreate, MappingUpdate, MappingResponse,
    ClassifyRequest, ClassifyResponse, ReorderRequest,
)
from features.categories.service import CategoryService

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=list[CategoryResponse])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all categories for the current user."""
    return await CategoryService.get_all(db, owner_id=user.id)


@router.post("/", response_model=CategoryResponse)
async def create_category(
    request: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new category."""
    return await CategoryService.create(
        db, owner_id=user.id, name=request.name, section=request.section,
        icon=request.icon, color=request.color,
    )


@router.get("/mappings", response_model=list[MappingResponse])
async def list_mappings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all keyword mappings."""
    return await CategoryService.get_mappings(db, owner_id=user.id)


@router.post("/mappings", response_model=MappingResponse)
async def add_mapping(
    request: MappingCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add a keyword mapping to a category."""
    return await CategoryService.add_mapping(
        db, owner_id=user.id, category_id=request.category_id,
        keyword=request.keyword, match_type=request.match_type,
    )


@router.post("/classify", response_model=ClassifyResponse)
async def classify_description(
    request: ClassifyRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Classify a transaction description."""
    section, category, confidence, _cat_id = await CategoryService.classify(
        db, owner_id=user.id, description=request.description
    )
    return ClassifyResponse(section=section, category=category, confidence=confidence)


@router.post("/learn")
async def learn_categorization(
    request: ClassifyRequest,
    category_name: str = "",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Learn keyword mappings from a confirmed categorization."""
    count = await CategoryService.learn_from_confirmation(
        db, owner_id=user.id,
        description=request.description,
        category_name=category_name,
    )
    return {"learned": count}


@router.post("/seed-defaults")
async def seed_defaults(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Seed default categories and mappings for a new user."""
    await CategoryService.seed_defaults(db, owner_id=user.id)
    return {"message": "Default categories seeded successfully"}


@router.put("/reorder")
async def reorder_categories(
    request: ReorderRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Reorder categories by setting sort_order based on provided ID list."""
    await CategoryService.reorder(db, owner_id=user.id, category_ids=request.category_ids)
    return {"message": "Categories reordered"}


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    category_update: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a category (name, icon, color, section)."""
    category = await CategoryService.update(
        db, owner_id=user.id, category_id=category_id,
        name=category_update.name,
        section=category_update.section,
        icon=category_update.icon,
        color=category_update.color,
    )
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Update denormalized fields in transactions
    if category_update.name:
        await db.execute(
            update(Transaction)
            .where(Transaction.category_id == category_id)
            .values(category_name=category_update.name)
        )
    if category_update.section:
        if category_update.section == "in_and_out":
            await db.execute(
                update(Transaction)
                .where(Transaction.category_id == category_id)
                .values(section="in_and_out")
            )
        else:
            # section is "general" or "fixed" — set each tx's section to its type
            await db.execute(
                update(Transaction)
                .where(Transaction.category_id == category_id)
                .values(section=Transaction.type)
            )
    if category_update.name or category_update.section:
        await db.commit()

    return category


@router.delete("/{category_id}")
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a category (cascade delete mappings)."""
    success = await CategoryService.delete(db, owner_id=user.id, category_id=category_id)
    if not success:
        raise HTTPException(status_code=404, detail="Category not found or already deleted")

    # Set transactions to Unknown
    await db.execute(
        update(Transaction)
        .where(Transaction.category_id == category_id)
        .values(category_id=None, category_name="Unknown", section=Transaction.type)
    )
    await db.commit()

    return {"success": True, "message": "Category deleted"}


@router.get("/{category_id}/mappings", response_model=list[MappingResponse])
async def get_category_mappings(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all mappings for a specific category."""
    return await CategoryService.get_category_mappings(db, owner_id=user.id, category_id=category_id)


@router.put("/mappings/{mapping_id}", response_model=MappingResponse)
async def update_mapping(
    mapping_id: int,
    mapping_update: MappingUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a category mapping (keyword or match_type)."""
    mapping = await CategoryService.update_mapping(
        db, owner_id=user.id, mapping_id=mapping_id,
        keyword=mapping_update.keyword,
        match_type=mapping_update.match_type,
    )
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return mapping


@router.delete("/mappings/{mapping_id}")
async def delete_mapping(
    mapping_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a category mapping."""
    success = await CategoryService.delete_mapping(db, owner_id=user.id, mapping_id=mapping_id)
    if not success:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return {"success": True}
