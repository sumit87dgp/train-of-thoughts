from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ThoughtCreate(BaseModel):
    title: str = Field(..., max_length=500)
    body: str = ""
    tags: list[str] = Field(default_factory=list)


class ThoughtUpdate(BaseModel):
    title: str = Field(..., max_length=500)
    body: str = ""
    tags: list[str] = Field(default_factory=list)


class ThoughtResponse(BaseModel):
    id: UUID
    title: str
    body: str
    created_at: datetime
    updated_at: datetime
    tags: list[str]


class ThoughtListResponse(BaseModel):
    items: list[ThoughtResponse]
    limit: int
    offset: int
