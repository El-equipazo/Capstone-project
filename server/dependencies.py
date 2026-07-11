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


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise _UNAUTHORIZED
    except JWTError:
        raise _UNAUTHORIZED

    user = await user_model.find(int(user_id))
    if user is None or not user["is_active"]:
        raise _UNAUTHORIZED
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
