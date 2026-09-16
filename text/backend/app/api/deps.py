import uuid
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.core.exceptions import UnauthorizedException
from app.services.auth_service import get_user_by_id
from app.models.user import User

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except ValueError:
        raise UnauthorizedException(detail="Invalid token")
        
    if payload.get("type") != "access":
        raise UnauthorizedException(detail="Invalid token type")
        
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise UnauthorizedException(detail="Token payload invalid")
        
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise UnauthorizedException(detail="Invalid user id format")
        
    user = await get_user_by_id(db, user_id)
    if not user:
        raise UnauthorizedException(detail="User not found")
        
    if not getattr(user, "is_active", True):
        raise UnauthorizedException(detail="Inactive user")
        
    return user
