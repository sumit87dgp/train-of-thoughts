from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.db.pool import get_pool
from app.db import tags as tags_db
from app.schemas.tag import TagListResponse

router = APIRouter(
    prefix="/api/tags",
    tags=["tags"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=TagListResponse)
async def list_tags() -> TagListResponse:
    pool = get_pool()
    return await tags_db.list_tags(pool)
