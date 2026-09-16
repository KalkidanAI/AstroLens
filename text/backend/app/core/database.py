"""Async database engine and session management."""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
import redis.asyncio as aioredis
from typing import AsyncGenerator

from app.config import get_settings


def _create_engine():
    """Create async engine lazily (not at import time)."""
    settings = get_settings()
    return create_async_engine(
        settings.database_url,
        echo=settings.debug,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )


def _create_session_maker():
    """Create session factory lazily."""
    engine = _create_engine()
    return async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


# Lazy singleton — created on first call
_session_maker = None


def _get_session_maker():
    global _session_maker
    if _session_maker is None:
        _session_maker = _create_session_maker()
    return _session_maker


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields an async database session."""
    session_maker = _get_session_maker()
    async with session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


def get_redis() -> aioredis.Redis:
    """Create a Redis async connection."""
    settings = get_settings()
    return aioredis.from_url(
        settings.redis_url,
        decode_responses=True,
    )
