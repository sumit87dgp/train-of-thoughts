import uuid

import pytest

from app.request_context import REQUEST_ID_HEADER


@pytest.mark.asyncio
async def test_health_returns_request_id_header(client):
    response = await client.get("/health")
    assert response.status_code == 200
    request_id = response.headers.get(REQUEST_ID_HEADER)
    assert request_id is not None
    uuid.UUID(request_id)


@pytest.mark.asyncio
async def test_client_request_id_is_echoed(client):
    sent_id = str(uuid.uuid4())
    response = await client.get("/health", headers={REQUEST_ID_HEADER: sent_id})
    assert response.status_code == 200
    assert response.headers.get(REQUEST_ID_HEADER) == sent_id


@pytest.mark.asyncio
async def test_error_response_includes_request_id(client):
    response = await client.get("/api/thoughts")
    assert response.status_code == 401
    request_id = response.headers.get(REQUEST_ID_HEADER)
    assert request_id is not None
    uuid.UUID(request_id)
