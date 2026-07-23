from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from server.config import settings
from server.models import user_model

security = HTTPBearer()

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail={"error": {"code": "UNAUTHORIZED", "message": "Missing or invalid token"}},
    headers={"WWW-Authenticate": "Bearer"},
)


def decode_access_token(token: str) -> dict:
    """
    Decode + validate a JWT, raising _UNAUTHORIZED (401) on any failure.
    Shared by the HTTP Bearer path (get_current_user) and the websocket
    query-param path (get_current_user_ws) so JWT error handling doesn't
    diverge between the two transports.
    """
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise _UNAUTHORIZED
    if payload.get("sub") is None:
        raise _UNAUTHORIZED
    return payload


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    payload = decode_access_token(credentials.credentials)
    user = await user_model.find(int(payload["sub"]))
    if user is None or not user["is_active"]:
        raise _UNAUTHORIZED
    return user


async def get_current_user_ws(token: str):
    """
    Websocket equivalent of get_current_user. Returns the user dict on
    success, or None on any failure -- raising HTTPException here wouldn't
    map cleanly onto a websocket handshake, so the caller (the websocket
    route) is responsible for closing the socket with an app close code.
    """
    try:
        payload = decode_access_token(token)
    except HTTPException:
        return None
    user = await user_model.find(int(payload["sub"]))
    if user is None or not user["is_active"]:
        return None
    return user


def require_role(*roles: str):
    """Factory that returns a dependency enforcing one of the given roles."""
    async def check(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN", "message": "Insufficient permissions"}},
            )
        return user
    return check
