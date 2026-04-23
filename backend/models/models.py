from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from core.database import Base
from datetime import datetime
import uuid

class Team(Base):
    __tablename__ = "yujin_teams"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    status = Column(String(20), default="active")  # active, paused
    llm_model = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    workers = relationship("Worker", back_populates="team", cascade="all, delete-orphan")

class Worker(Base):
    __tablename__ = "yujin_workers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id = Column(UUID(as_uuid=True), ForeignKey("yujin_teams.id"), nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(String(200))
    system_prompt = Column(Text)
    llm_model = Column(String(100))
    status = Column(String(20), default="idle")  # idle, working, done
    created_at = Column(DateTime, default=datetime.utcnow)
    team = relationship("Team", back_populates="workers")

class ChatMessage(Base):
    __tablename__ = "yujin_chat_messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role = Column(String(20), nullable=False)  # user, yujin
    content = Column(Text, nullable=False)
    extra_data = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

class YujinConfig(Base):
    __tablename__ = "yujin_config"
    id = Column(Integer, primary_key=True, default=1)
    llm_model = Column(String(100), default="gemini-2.0-flash-exp")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
