import uuid
from sqlalchemy import String, Text, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from typing import Optional

from app.models.base import Base, TimestampMixin

class ReplySuggestion(TimestampMixin, Base):
    __tablename__ = 'reply_suggestions'

    message_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('messages.id'), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    suggestion_text: Mapped[str] = mapped_column(Text, nullable=False)
    tone: Mapped[str] = mapped_column(String, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, default='pending')
    edited_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    generation_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    message: Mapped['Message'] = relationship("Message", back_populates="suggestions")
    user: Mapped['User'] = relationship("User")
