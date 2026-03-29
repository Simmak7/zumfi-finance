from typing import Literal

from pydantic import BaseModel

SectionType = Literal['general', 'in_and_out', 'fixed']


class CategoryCreate(BaseModel):
    name: str
    section: SectionType
    icon: str | None = None
    color: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    section: SectionType | None = None
    icon: str | None = None
    color: str | None = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    section: str
    icon: str | None
    color: str | None
    mapping_count: int = 0

    model_config = {"from_attributes": True}


class MappingCreate(BaseModel):
    category_id: int
    keyword: str
    match_type: str = "substring"


class MappingUpdate(BaseModel):
    keyword: str | None = None
    match_type: str | None = None


class MappingResponse(BaseModel):
    id: int
    category_id: int
    keyword: str
    match_type: str

    model_config = {"from_attributes": True}


class ReorderRequest(BaseModel):
    category_ids: list[int]


class ClassifyRequest(BaseModel):
    description: str


class ClassifyResponse(BaseModel):
    section: str
    category: str
    confidence: float
