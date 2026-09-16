import uuid
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from typing import Any, Optional
from pgvector.sqlalchemy import Vector

from app.models.base import Base, TimestampMixin

class ContactMemory(TimestampMixin, Base):
    __tablename__ = 'contact_memories'

    contact_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('contacts.id'), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[Optional[Any]] = mapped_column(Vector(1536), nullable=True)
    category: Mapped[str] = mapped_column(String, default='context')
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    contact: Mapped['Contact'] = relationship("Contact", back_populates="memories")
    user: Mapped['User'] = relationship("User")
