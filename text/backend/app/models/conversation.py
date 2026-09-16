import uuid
from datetime import datetime
from sqlalchemy import String, BigInteger, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from typing import List, Optional

from app.models.base import Base, TimestampMixin

class Conversation(TimestampMixin, Base):
    __tablename__ = 'conversations'

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True)
    contact_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('contacts.id'), nullable=False)
    telegram_chat_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[str] = mapped_column(String, default='active')
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped['User'] = relationship("User", back_populates="conversations")
    contact: Mapped['Contact'] = relationship("Contact", back_populates="conversations")
    messages: Mapped[List['Message']] = relationship("Message", back_populates="conversation", order_by="Message.created_at")
