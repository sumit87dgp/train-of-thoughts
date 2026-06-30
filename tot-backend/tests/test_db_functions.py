"""Direct asyncpg calls to app.* functions as tot_api (Phase 1)."""

import uuid

import asyncpg
import pytest


async def _create_thought(conn, *, title: str, body: str = "", tags: list[str] | None = None):
    return await conn.fetchrow(
        "SELECT * FROM app.create_thought($1, $2, $3)",
        title,
        body,
        tags or [],
    )


@pytest.mark.asyncio
async def test_create_thought_with_tags(db_pool):
    suffix = uuid.uuid4().hex[:8]
    title = f"phase1-create-{suffix}"
    tags = [f"tag-a-{suffix}", f"tag-b-{suffix}"]

    async with db_pool.acquire() as conn:
        row = await _create_thought(
            conn,
            title=title,
            body="Body from Phase 1 test",
            tags=tags,
        )

    assert row is not None
    assert row["title"] == title
    assert row["body"] == "Body from Phase 1 test"
    assert sorted(row["tags"]) == sorted(tags)
    assert row["id"] is not None
    assert row["created_at"] is not None
    assert row["updated_at"] is not None

    async with db_pool.acquire() as conn:
        deleted = await conn.fetchval("SELECT app.delete_thought($1)", row["id"])
    assert deleted is True


@pytest.mark.asyncio
async def test_get_thought(db_pool):
    suffix = uuid.uuid4().hex[:8]
    title = f"phase1-get-{suffix}"

    async with db_pool.acquire() as conn:
        created = await _create_thought(conn, title=title, body="get test")
        fetched = await conn.fetchrow("SELECT * FROM app.get_thought($1)", created["id"])

    assert fetched["id"] == created["id"]
    assert fetched["title"] == title

    async with db_pool.acquire() as conn:
        await conn.fetchval("SELECT app.delete_thought($1)", created["id"])


@pytest.mark.asyncio
async def test_list_thoughts_filter_by_tag(db_pool):
    suffix = uuid.uuid4().hex[:8]
    tag = f"list-filter-{suffix}"
    title = f"phase1-list-{suffix}"

    async with db_pool.acquire() as conn:
        created = await _create_thought(conn, title=title, tags=[tag])
        rows = await conn.fetch(
            "SELECT * FROM app.list_thoughts($1, $2, $3)",
            50,
            0,
            tag,
        )

    ids = {row["id"] for row in rows}
    assert created["id"] in ids

    async with db_pool.acquire() as conn:
        await conn.fetchval("SELECT app.delete_thought($1)", created["id"])


@pytest.mark.asyncio
async def test_update_thought(db_pool):
    suffix = uuid.uuid4().hex[:8]
    title = f"phase1-update-{suffix}"
    new_tag = f"updated-{suffix}"

    async with db_pool.acquire() as conn:
        created = await _create_thought(conn, title=title, body="before", tags=["old"])
        updated = await conn.fetchrow(
            "SELECT * FROM app.update_thought($1, $2, $3, $4)",
            created["id"],
            f"{title}-revised",
            "after",
            [new_tag],
        )

    assert updated["title"] == f"{title}-revised"
    assert updated["body"] == "after"
    assert updated["tags"] == [new_tag]
    assert updated["updated_at"] >= created["updated_at"]

    async with db_pool.acquire() as conn:
        await conn.fetchval("SELECT app.delete_thought($1)", created["id"])


@pytest.mark.asyncio
async def test_delete_thought(db_pool):
    suffix = uuid.uuid4().hex[:8]
    title = f"phase1-delete-{suffix}"

    async with db_pool.acquire() as conn:
        created = await _create_thought(conn, title=title)
        deleted = await conn.fetchval("SELECT app.delete_thought($1)", created["id"])
        with pytest.raises(asyncpg.PostgresError, match="thought not found"):
            await conn.fetchrow("SELECT * FROM app.get_thought($1)", created["id"])

    assert deleted is True


@pytest.mark.asyncio
async def test_search_thoughts(db_pool):
    suffix = uuid.uuid4().hex[:8]
    needle = f"needle-{suffix}"
    title = f"phase1-search-{suffix}"

    async with db_pool.acquire() as conn:
        created = await _create_thought(conn, title=title, body=f"find the {needle} here")
        rows = await conn.fetch(
            "SELECT * FROM app.search_thoughts($1, $2, $3)",
            needle,
            20,
            0,
        )

    assert any(row["id"] == created["id"] for row in rows)

    async with db_pool.acquire() as conn:
        await conn.fetchval("SELECT app.delete_thought($1)", created["id"])


@pytest.mark.asyncio
async def test_list_tags(db_pool):
    suffix = uuid.uuid4().hex[:8]
    tag = f"list-tags-{suffix}"

    async with db_pool.acquire() as conn:
        created = await _create_thought(conn, title=f"phase1-tags-{suffix}", tags=[tag])
        rows = await conn.fetch("SELECT * FROM app.list_tags()")

    names = {row["name"] for row in rows}
    assert tag in names

    async with db_pool.acquire() as conn:
        await conn.fetchval("SELECT app.delete_thought($1)", created["id"])
