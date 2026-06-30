import os

import pytest
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("DATABASE_URL_API", "postgres://tot_api:tot_api_dev@localhost:5433/tot")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-pytest")
os.environ.setdefault("TOT_USER", "admin")
os.environ.setdefault("TOT_PASSWORD", "admin")

from app.db.pool import close_pool, create_pool, get_pool
from app.main import app


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


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    response = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin"},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
