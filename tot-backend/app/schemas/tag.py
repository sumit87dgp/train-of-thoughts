from uuid import UUID

from pydantic import BaseModel


class TagResponse(BaseModel):
    id: UUID
    name: str


class TagListResponse(BaseModel):
    items: list[TagResponse]
