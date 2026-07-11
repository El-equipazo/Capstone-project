from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from jose import JWTError, jwt

from server.config import settings
from server.dependencies import get_current_user
from server.models import user_model
from server.models.errors import AuthenticationError, DeactivatedError
from server.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    UpdateMeRequest,
    UserInToken,
    VerifyEmailRequest,
)

router = APIRouter(tags=["auth"])


# --- Token helpers ---

def _access_token(user_id: int, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": str(user_id), "role": role, "exp": exp},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def _refresh_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    return jwt.encode(
        {"sub": str(user_id), "type": "refresh", "exp": exp},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def _token_pair(user_id: int, role: str) -> tuple[str, str]:
    return _access_token(user_id, role), _refresh_token(user_id)


# --- Routes ---

@router.post("/auth/register", status_code=201, response_model=RegisterResponse)
async def register(body: RegisterRequest):
    row = await user_model.create(body.email, body.password, body.role)
    return dict(row)


@router.post("/auth/verify-email")
async def verify_email(body: VerifyEmailRequest):
    # Expects user_model.verify_email(token) -> sets is_email_verified = true.
    # Teammate implementing user_model should add this function.
    await user_model.verify_email(body.token)
    return {"is_email_verified": True}


@router.post("/auth/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    try:
        user = await user_model.validate_password(body.email, body.password)
    except AuthenticationError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid email or password"}},
        )
    except DeactivatedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Account is deactivated"}},
        )
    await user_model.touch_last_login(user["user_id"])
    access, refresh = _token_pair(user["user_id"], user["role"])
    return LoginResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserInToken(**user),
    )


@router.post("/auth/refresh", response_model=LoginResponse)
async def refresh(body: RefreshRequest):
    _invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid or expired refresh token"}},
    )
    try:
        payload = jwt.decode(
            body.refresh_token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        if payload.get("type") != "refresh":
            raise _invalid
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise _invalid

    user = await user_model.find(user_id)
    if user is None or not user["is_active"]:
        raise _invalid

    access, new_refresh = _token_pair(user["user_id"], user["role"])
    return LoginResponse(
        access_token=access,
        refresh_token=new_refresh,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserInToken(user_id=user["user_id"], email=user["email"], role=user["role"]),
    )


@router.post("/auth/logout", status_code=204)
async def logout(current_user=Depends(get_current_user)):
    # Refresh tokens are self-expiring JWTs; the client discards both tokens on
    # logout. True server-side invalidation would require a token blocklist
    # (e.g. a DB table or Redis set) — add that if revocation before expiry matters.
    return Response(status_code=204)


@router.get("/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    profile = None
    role = current_user["role"]
    if role == "organization":
        try:
            from server.models import organization_model
            profile = await organization_model.find_by_user(current_user["user_id"])
        except ImportError:
            pass
    elif role == "expert":
        try:
            from server.models import expert_model
            profile = await expert_model.find_by_user(current_user["user_id"])
        except ImportError:
            pass
    return {**dict(current_user), "profile": dict(profile) if profile else None}


@router.patch("/auth/me")
async def update_me(body: UpdateMeRequest, current_user=Depends(get_current_user)):
    if body.password and not body.current_password:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "current_password is required when setting a new password",
                    "details": [{"field": "current_password", "issue": "required"}],
                }
            },
        )
    # Expects user_model.update(user_id, fields_dict) -> updated row.
    # Teammate implementing user_model should add this function.
    updated = await user_model.update(current_user["user_id"], body.model_dump(exclude_none=True))
    return dict(updated)


@router.delete("/auth/me", status_code=204)
async def delete_me(current_user=Depends(get_current_user)):
    await user_model.deactivate(current_user["user_id"])
    return Response(status_code=204)
