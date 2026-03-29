from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from core.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    section = Column(String(20), nullable=False)  # 'general' or 'in_and_out'
    icon = Column(String(50), nullable=True)
    color = Column(String(7), nullable=True)
    sort_order = Column(Integer, nullable=True, default=0)

    mappings = relationship("CategoryMapping", back_populates="category", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("owner_id", "name", name="uq_category_owner_name"),
    )


class CategoryMapping(Base):
    __tablename__ = "category_mappings"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    keyword = Column(String(255), nullable=False)
    match_type = Column(String(20), default="substring")  # substring, regex, exact

    category = relationship("Category", back_populates="mappings")

    __table_args__ = (
        UniqueConstraint("owner_id", "keyword", name="uq_mapping_owner_keyword"),
    )
