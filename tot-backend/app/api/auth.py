from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.services.auth import create_access_token, verify_credentials
from app.services.errors import raise_invalid_credentials

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    if not verify_credentials(body.username, body.password):
        raise_invalid_credentials()
    access_token = create_access_token(body.username)
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: str = Depends(get_current_user)) -> UserResponse:
    return UserResponse(username=current_user)
