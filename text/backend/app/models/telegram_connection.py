import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, JSON, BigInteger, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from typing import Optional

from app.models.base import Base, TimestampMixin

class TelegramConnection(TimestampMixin, Base):
    __tablename__ = 'telegram_connections'

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    connection_id: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    telegram_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    telegram_username: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    rights: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    connected_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped['User'] = relationship("User", back_populates="telegram_connections")
