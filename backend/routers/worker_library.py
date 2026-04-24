from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from models.models import WorkerTemplate, Worker, Team
from pydantic import BaseModel
from typing import Optional, List
import uuid

router = APIRouter(prefix="/api/worker-library", tags=["worker-library"])

class TemplateCreate(BaseModel):
    name: str
    role: str
    llm_model: str = "gemini-2.5-flash"
    capabilities: Optional[List[str]] = []
    avatar: Optional[str] = None
    personality: Optional[str] = None
    speech_style: Optional[str] = None
    skills: Optional[List[str]] = []
    system_prompt: Optional[str] = None

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    llm_model: Optional[str] = None
    capabilities: Optional[List[str]] = None
    avatar: Optional[str] = None
    personality: Optional[str] = None
    speech_style: Optional[str] = None
    skills: Optional[List[str]] = None
    system_prompt: Optional[str] = None

class AssignToTeam(BaseModel):
    team_id: str

def template_to_dict(t):
    return {
        "id": str(t.id), "name": t.name, "role": t.role,
        "llm_model": t.llm_model, "capabilities": t.capabilities or [],
        "avatar": t.avatar, "personality": t.personality, "speech_style": t.speech_style,
        "skills": t.skills or [], "system_prompt": t.system_prompt,
        "created_at": t.created_at.isoformat()
    }

@router.get("/")
async def list_templates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WorkerTemplate).order_by(WorkerTemplate.created_at.desc()))
    return [template_to_dict(t) for t in result.scalars().all()]

@router.post("/")
async def create_template(data: TemplateCreate, db: AsyncSession = Depends(get_db)):
    t = WorkerTemplate(
        name=data.name, role=data.role, llm_model=data.llm_model,
        capabilities=data.capabilities or [], avatar=data.avatar,
        personality=data.personality, speech_style=data.speech_style,
        skills=data.skills or [], system_prompt=data.system_prompt,
    )
    db.add(t)
    await db.commit()
    return {"success": True, "id": str(t.id), "name": t.name}

@router.patch("/{template_id}")
async def update_template(template_id: str, data: TemplateUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WorkerTemplate).where(WorkerTemplate.id == uuid.UUID(template_id)))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    for field in ["name", "role", "llm_model", "capabilities", "avatar", "personality", "speech_style", "skills", "system_prompt"]:
        v = getattr(data, field)
        if v is not None:
            setattr(t, field, v)
    await db.commit()
    return template_to_dict(t)

@router.delete("/{template_id}")
async def delete_template(template_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WorkerTemplate).where(WorkerTemplate.id == uuid.UUID(template_id)))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(t)
    await db.commit()
    return {"success": True}

@router.post("/{template_id}/assign")
async def assign_to_team(template_id: str, data: AssignToTeam, db: AsyncSession = Depends(get_db)):
    """Copy template into a team as a Worker"""
    result = await db.execute(select(WorkerTemplate).where(WorkerTemplate.id == uuid.UUID(template_id)))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    team_result = await db.execute(select(Team).where(Team.id == uuid.UUID(data.team_id)))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    worker = Worker(
        team_id=team.id, name=t.name, role=t.role, llm_model=t.llm_model,
        capabilities=t.capabilities or [], avatar=t.avatar,
        personality=t.personality, speech_style=t.speech_style,
        skills=t.skills or [], system_prompt=t.system_prompt,
    )
    db.add(worker)
    await db.commit()
    return {
        "success": True,
        "worker_id": str(worker.id),
        "name": worker.name,
        "team_id": str(team.id),
    }
