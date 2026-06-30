from uuid import UUID

import asyncpg

from app.schemas.thought import ThoughtCreate, ThoughtListResponse, ThoughtResponse, ThoughtUpdate


def _row_to_thought(row: asyncpg.Record) -> ThoughtResponse:
    tags = list(row["tags"]) if row["tags"] else []
    return ThoughtResponse(
        id=row["id"],
        title=row["title"],
        body=row["body"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        tags=tags,
    )


def _thought_not_found(exc: asyncpg.PostgresError) -> bool:
    return "thought not found" in str(exc).lower()


async def create_thought(pool: asyncpg.Pool, data: ThoughtCreate) -> ThoughtResponse:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM app.create_thought($1, $2, $3)",
            data.title,
            data.body,
            data.tags,
        )
    return _row_to_thought(row)


async def get_thought(pool: asyncpg.Pool, thought_id: UUID) -> ThoughtResponse | None:
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM app.get_thought($1)",
                thought_id,
            )
    except asyncpg.PostgresError as exc:
        if _thought_not_found(exc):
            return None
        raise
    return _row_to_thought(row)


async def list_thoughts(
    pool: asyncpg.Pool,
    *,
    limit: int,
    offset: int,
    tag: str | None = None,
) -> ThoughtListResponse:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM app.list_thoughts($1, $2, $3)",
            limit,
            offset,
            tag,
        )
    return ThoughtListResponse(
        items=[_row_to_thought(row) for row in rows],
        limit=limit,
        offset=offset,
    )


async def search_thoughts(
    pool: asyncpg.Pool,
    *,
    query: str,
    limit: int,
    offset: int,
) -> ThoughtListResponse:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM app.search_thoughts($1, $2, $3)",
            query,
            limit,
            offset,
        )
    return ThoughtListResponse(
        items=[_row_to_thought(row) for row in rows],
        limit=limit,
        offset=offset,
    )


async def update_thought(
    pool: asyncpg.Pool,
    thought_id: UUID,
    data: ThoughtUpdate,
) -> ThoughtResponse | None:
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM app.update_thought($1, $2, $3, $4)",
                thought_id,
                data.title,
                data.body,
                data.tags,
            )
    except asyncpg.PostgresError as exc:
        if _thought_not_found(exc):
            return None
        raise
    return _row_to_thought(row)


async def delete_thought(pool: asyncpg.Pool, thought_id: UUID) -> bool:
    async with pool.acquire() as conn:
        return await conn.fetchval(
            "SELECT app.delete_thought($1)",
            thought_id,
        )
