import uuid

import pytest


@pytest.mark.asyncio
async def test_list_thoughts_requires_auth(client):
    response = await client.get("/api/thoughts")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_thoughts_crud_and_search(client, auth_headers):
    suffix = uuid.uuid4().hex[:8]
    needle = f"needle-{suffix}"
    tag = f"api-tag-{suffix}"

    create_response = await client.post(
        "/api/thoughts",
        headers=auth_headers,
        json={
            "title": f"API thought {suffix}",
            "body": f"search for {needle} here",
            "tags": [tag, "shared"],
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()
    thought_id = created["id"]
    assert created["title"] == f"API thought {suffix}"
    assert tag in created["tags"]

    get_response = await client.get(f"/api/thoughts/{thought_id}", headers=auth_headers)
    assert get_response.status_code == 200
    assert get_response.json()["id"] == thought_id

    list_response = await client.get(
        "/api/thoughts",
        headers=auth_headers,
        params={"tag": tag, "limit": 50},
    )
    assert list_response.status_code == 200
    list_data = list_response.json()
    assert any(item["id"] == thought_id for item in list_data["items"])

    search_response = await client.get(
        "/api/thoughts/search",
        headers=auth_headers,
        params={"q": needle, "limit": 20},
    )
    assert search_response.status_code == 200
    assert any(item["id"] == thought_id for item in search_response.json()["items"])

    update_response = await client.put(
        f"/api/thoughts/{thought_id}",
        headers=auth_headers,
        json={
            "title": f"API thought updated {suffix}",
            "body": "updated body",
            "tags": [tag],
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["title"] == f"API thought updated {suffix}"
    assert update_response.json()["tags"] == [tag]

    delete_response = await client.delete(
        f"/api/thoughts/{thought_id}",
        headers=auth_headers,
    )
    assert delete_response.status_code == 204

    missing_response = await client.get(f"/api/thoughts/{thought_id}", headers=auth_headers)
    assert missing_response.status_code == 404


@pytest.mark.asyncio
async def test_get_thought_not_found(client, auth_headers):
    response = await client.get(
        f"/api/thoughts/{uuid.uuid4()}",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_tags(client, auth_headers):
    suffix = uuid.uuid4().hex[:8]
    tag = f"tags-endpoint-{suffix}"

    await client.post(
        "/api/thoughts",
        headers=auth_headers,
        json={"title": f"Tag seed {suffix}", "body": "", "tags": [tag]},
    )

    response = await client.get("/api/tags", headers=auth_headers)
    assert response.status_code == 200
    names = {item["name"] for item in response.json()["items"]}
    assert tag in names
