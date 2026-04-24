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
    status = Column(String(20), default="active")
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
    status = Column(String(20), default="idle")
    capabilities = Column(JSON, default=list)
    avatar = Column(Text, nullable=True)        # emoji or initials override
    personality = Column(Text, nullable=True)   # นิสัย เช่น "ขยัน ละเอียด ชอบตรวจสอบซ้ำ"
    speech_style = Column(Text, nullable=True)
    skills = Column(JSON, default=list)     # list of skill IDs
    created_at = Column(DateTime, default=datetime.utcnow)
    team = relationship("Team", back_populates="workers")

class WorkerTemplate(Base):
    __tablename__ = "yujin_worker_templates"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    role = Column(String(200))
    llm_model = Column(String(100), default="gemini-2.5-flash")
    capabilities = Column(JSON, default=list)
    avatar = Column(Text, nullable=True)
    personality = Column(Text, nullable=True)
    speech_style = Column(Text, nullable=True)
    skills = Column(JSON, default=list)
    system_prompt = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ChatMessage(Base):
    __tablename__ = "yujin_chat_messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("yujin_rooms.id", ondelete="CASCADE"), nullable=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    model_used = Column(String(100), nullable=True)
    extra_data = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    room = relationship("Room", back_populates="messages")

class YujinConfig(Base):
    __tablename__ = "yujin_config"
    id = Column(Integer, primary_key=True, default=1)
    llm_model = Column(String(100), default="gemini-2.0-flash")
    api_key = Column(String(200), nullable=True)
    deepinfra_api_key = Column(String(200), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
class Room(Base):
    __tablename__ = "yujin_rooms"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, default="ห้องใหม่")
    created_at = Column(DateTime, default=datetime.utcnow)
    messages = relationship("ChatMessage", back_populates="room", cascade="all, delete-orphan")
class WorkspaceMessage(Base):
    __tablename__ = "yujin_workspace_messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id = Column(UUID(as_uuid=True), ForeignKey("yujin_teams.id", ondelete="CASCADE"), nullable=False)
    sender = Column(String(100), nullable=False)
    sender_type = Column(String(20), nullable=False)  # yujin, worker
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
