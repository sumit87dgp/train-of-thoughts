from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user
from app.db.pool import get_pool
from app.db import thoughts as thoughts_db
from app.schemas.thought import ThoughtCreate, ThoughtListResponse, ThoughtResponse, ThoughtUpdate

router = APIRouter(
    prefix="/api/thoughts",
    tags=["thoughts"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=ThoughtListResponse)
async def list_thoughts(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    tag: str | None = Query(None),
) -> ThoughtListResponse:
    pool = get_pool()
    return await thoughts_db.list_thoughts(pool, limit=limit, offset=offset, tag=tag)


@router.get("/search", response_model=ThoughtListResponse)
async def search_thoughts(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> ThoughtListResponse:
    pool = get_pool()
    return await thoughts_db.search_thoughts(pool, query=q, limit=limit, offset=offset)


@router.post("", response_model=ThoughtResponse, status_code=status.HTTP_201_CREATED)
async def create_thought(body: ThoughtCreate) -> ThoughtResponse:
    pool = get_pool()
    return await thoughts_db.create_thought(pool, body)


@router.get("/{thought_id}", response_model=ThoughtResponse)
async def get_thought(thought_id: UUID) -> ThoughtResponse:
    pool = get_pool()
    thought = await thoughts_db.get_thought(pool, thought_id)
    if thought is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thought not found")
    return thought


@router.put("/{thought_id}", response_model=ThoughtResponse)
async def update_thought(thought_id: UUID, body: ThoughtUpdate) -> ThoughtResponse:
    pool = get_pool()
    thought = await thoughts_db.update_thought(pool, thought_id, body)
    if thought is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thought not found")
    return thought


@router.delete("/{thought_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thought(thought_id: UUID) -> None:
    pool = get_pool()
    deleted = await thoughts_db.delete_thought(pool, thought_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thought not found")
