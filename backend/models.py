from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime

from database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)

    customer = Column(String, nullable=False)

    content = Column(Text, nullable=False)

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )