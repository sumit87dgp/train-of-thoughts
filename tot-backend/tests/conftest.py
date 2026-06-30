import os

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.pool import close_pool, create_pool, get_pool
from app.main import app

_DEFAULT_DATABASE_URL_API = "postgres://tot_api:tot_api_dev@localhost:5433/tot"


@pytest.fixture(scope="session", autouse=True)
def _database_url():
    os.environ.setdefault("DATABASE_URL_API", _DEFAULT_DATABASE_URL_API)


@pytest.fixture
async def db_pool():
    await create_pool()
    yield get_pool()
    await close_pool()


@pytest.fixture
async def client(db_pool):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
