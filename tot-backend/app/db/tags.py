import asyncpg

from app.schemas.tag import TagListResponse, TagResponse


async def list_tags(pool: asyncpg.Pool) -> TagListResponse:
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM app.list_tags()")
    return TagListResponse(
        items=[TagResponse(id=row["id"], name=row["name"]) for row in rows],
    )
