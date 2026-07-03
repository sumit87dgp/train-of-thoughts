import uuid

import pytest


@pytest.mark.asyncio
async def test_thought_not_found_error_shape(client, auth_headers):
    response = await client.get(
        f"/api/thoughts/{uuid.uuid4()}",
        headers=auth_headers,
    )
    assert response.status_code == 404
    assert response.json() == {
        "detail": "Thought not found",
        "code": "THOUGHT_NOT_FOUND",
    }


@pytest.mark.asyncio
async def test_invalid_credentials_error_shape(client):
    response = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrong"},
    )
    assert response.status_code == 401
    body = response.json()
    assert body["detail"] == "Incorrect username or password"
    assert body["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_not_authenticated_error_shape(client):
    response = await client.get("/api/thoughts")
    assert response.status_code == 401
    body = response.json()
    assert body["detail"] == "Not authenticated"
    assert body["code"] == "NOT_AUTHENTICATED"


@pytest.mark.asyncio
async def test_validation_error_shape(client, auth_headers):
    response = await client.post(
        "/api/thoughts",
        headers=auth_headers,
        json={},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["detail"] == "Validation failed"
    assert body["code"] == "VALIDATION_ERROR"
