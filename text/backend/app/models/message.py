import uuid
from datetime import datetime
from sqlalchemy import String, Text, BigInteger, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from typing import List, Optional

from app.models.base import Base, TimestampMixin

class Message(TimestampMixin, Base):
    __tablename__ = 'messages'

    conversation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('conversations.id'), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String, default='telegram')
    telegram_message_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    telegram_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    conversation: Mapped['Conversation'] = relationship("Conversation", back_populates="messages")
    suggestions: Mapped[List['ReplySuggestion']] = relationship("ReplySuggestion", back_populates="message")
