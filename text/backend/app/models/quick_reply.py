import uuid
from sqlalchemy import String, JSON, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base, TimestampMixin

class QuickReply(TimestampMixin, Base):
    __tablename__ = 'quick_replies'

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True)
    abbreviation: Mapped[str] = mapped_column(String, nullable=False)
    expansions: Mapped[dict] = mapped_column(JSON, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint('user_id', 'abbreviation', name='uq_quick_reply_user_abbr'),
    )

    user: Mapped['User'] = relationship("User", back_populates="quick_replies")
