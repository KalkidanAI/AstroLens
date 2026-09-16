from sqlalchemy import String, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List, Optional

from app.models.base import Base, TimestampMixin

class User(TimestampMixin, Base):
    __tablename__ = 'users'

    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ai_personality: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    language_preference: Mapped[str] = mapped_column(String, default='en')
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    telegram_connections: Mapped[List['TelegramConnection']] = relationship("TelegramConnection", back_populates="user")
    contacts: Mapped[List['Contact']] = relationship("Contact", back_populates="user")
    conversations: Mapped[List['Conversation']] = relationship("Conversation", back_populates="user")
    quick_replies: Mapped[List['QuickReply']] = relationship("QuickReply", back_populates="user")
