import uuid
from sqlalchemy import String, BigInteger, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from typing import List, Optional

from app.models.base import Base, TimestampMixin

class Contact(TimestampMixin, Base):
    __tablename__ = 'contacts'

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True)
    telegram_chat_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    relationship: Mapped[str] = mapped_column(String, default='unknown')
    preferred_tone: Mapped[str] = mapped_column(String, default='friendly')
    style_notes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint('user_id', 'telegram_chat_id', name='uq_contact_user_chat'),
    )

    user: Mapped['User'] = relationship("User", back_populates="contacts")
    conversations: Mapped[List['Conversation']] = relationship("Conversation", back_populates="contact")
    memories: Mapped[List['ContactMemory']] = relationship("ContactMemory", back_populates="contact")
