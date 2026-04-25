from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, JSON, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from core.database import Base
from datetime import datetime
import uuid

# ─── Worker Library (permanent employees) ────────────────────────────────────
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

# ─── Project ──────────────────────────────────────────────────────────────────
class Project(Base):
    __tablename__ = "yujin_projects"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    messages = relationship("ProjectMessage", back_populates="project", cascade="all, delete-orphan")

class ProjectMember(Base):
    """Worker assigned to a project — copied from WorkerTemplate at assign time"""
    __tablename__ = "yujin_project_members"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("yujin_projects.id", ondelete="CASCADE"), nullable=False)
    # reference back to library (nullable — new hires won't have one)
    template_id = Column(UUID(as_uuid=True), ForeignKey("yujin_worker_templates.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(100), nullable=False)
    role = Column(String(200))
    llm_model = Column(String(100))
    capabilities = Column(JSON, default=list)
    avatar = Column(Text, nullable=True)
    personality = Column(Text, nullable=True)
    speech_style = Column(Text, nullable=True)
    skills = Column(JSON, default=list)
    system_prompt = Column(Text, nullable=True)
    status = Column(String(20), default="idle")
    created_at = Column(DateTime, default=datetime.utcnow)
    project = relationship("Project", back_populates="members")

class ProjectMessage(Base):
    __tablename__ = "yujin_project_messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("yujin_projects.id", ondelete="CASCADE"), nullable=False)
    sender = Column(String(100), nullable=False)
    sender_type = Column(String(20), nullable=False)  # user, yujin, worker
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    project = relationship("Project", back_populates="messages")

# ─── Chat (single channel, no rooms) ─────────────────────────────────────────
class ChatMessage(Base):
    __tablename__ = "yujin_chat_messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), nullable=True)   # kept for compat, ignored
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    model_used = Column(String(100), nullable=True)
    extra_data = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

# ─── Config ───────────────────────────────────────────────────────────────────
class YujinConfig(Base):
    __tablename__ = "yujin_config"
    id = Column(Integer, primary_key=True, default=1)
    llm_model = Column(String(100), default="gemini-2.0-flash")
    api_key = Column(String(200), nullable=True)
    deepinfra_api_key = Column(String(200), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ─── Legacy (kept so existing data doesn't break, not used in new flow) ───────
class Team(Base):
    __tablename__ = "yujin_teams"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    status = Column(String(20), default="active")
    llm_model = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

class Worker(Base):
    __tablename__ = "yujin_workers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id = Column(UUID(as_uuid=True), ForeignKey("yujin_teams.id"), nullable=True)
    name = Column(String(100), nullable=False)
    role = Column(String(200))
    system_prompt = Column(Text)
    llm_model = Column(String(100))
    status = Column(String(20), default="idle")
    capabilities = Column(JSON, default=list)
    avatar = Column(Text, nullable=True)
    personality = Column(Text, nullable=True)
    speech_style = Column(Text, nullable=True)
    skills = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

class Room(Base):
    __tablename__ = "yujin_rooms"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, default="ห้องใหม่")
    created_at = Column(DateTime, default=datetime.utcnow)

class WorkspaceMessage(Base):
    __tablename__ = "yujin_workspace_messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id = Column(UUID(as_uuid=True), nullable=True)
    sender = Column(String(100), nullable=False)
    sender_type = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
