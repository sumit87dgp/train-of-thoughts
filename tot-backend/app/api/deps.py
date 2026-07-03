import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.services.auth import decode_token
from app.services.errors import (
    raise_invalid_token,
    raise_invalid_token_payload,
    raise_not_authenticated,
)

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise_not_authenticated()
    try:
        payload = decode_token(credentials.credentials)
    except jwt.InvalidTokenError:
        raise_invalid_token()
    subject = payload.get("sub")
    if not subject:
        raise_invalid_token_payload()
    return subject
