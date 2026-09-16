from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any

from app.api.deps import get_db, get_current_user
from app.schemas.auth import (
    UserRegister, UserLogin, TokenResponse, 
    TokenRefresh, UserResponse, UserUpdate
)
from app.services import auth_service
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.core.exceptions import UnauthorizedException
from app.models.user import User

router = APIRouter()

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)) -> Any:
    user = await auth_service.register_user(db, data)
    
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)) -> Any:
    user = await auth_service.authenticate_user(db, data)
    
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: TokenRefresh, db: AsyncSession = Depends(get_db)) -> Any:
    try:
        payload = decode_token(data.refresh_token)
    except ValueError:
        raise UnauthorizedException(detail="Invalid refresh token")
        
    if payload.get("type") != "refresh":
        raise UnauthorizedException(detail="Invalid token type")
        
    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedException(detail="Token payload invalid")
        
    access_token = create_access_token(data={"sub": user_id})
    new_refresh_token = create_refresh_token(data={"sub": user_id})
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> Any:
    return current_user

@router.put("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    if data.display_name is not None:
        current_user.display_name = data.display_name
    if data.language_preference is not None:
        current_user.language_preference = data.language_preference
        
    await db.commit()
    await db.refresh(current_user)
    return current_user
