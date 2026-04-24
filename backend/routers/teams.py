from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from models.models import Team, Worker
from core.config import AVAILABLE_MODELS
from pydantic import BaseModel
from typing import List, Optional
import uuid

router = APIRouter(prefix="/api/teams", tags=["teams"])

VALID_MODEL_IDS = {m["id"] for m in AVAILABLE_MODELS}

def normalize_model_id(model_id: str) -> str:
    if not model_id or model_id in VALID_MODEL_IDS:
        return model_id
    lower = model_id.lower()
    if "llama" in lower and not model_id.startswith("meta-llama/"):
        if "3.3" in model_id or "70b" in lower:
            return "meta-llama/Llama-3.3-70B-Instruct-Turbo"
        if "scout" in lower or "4" in model_id:
            return "meta-llama/Llama-4-Scout-17B-16E-Instruct"
        if "8b" in lower or "3.1" in model_id:
            return "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"
    return model_id if model_id in VALID_MODEL_IDS else "gemini-2.5-flash"

VALID_TOOLS = {"shell_tool", "db_tool", "file_tool", "image_tool"}
IMAGE_MODELS = {m["id"] for m in AVAILABLE_MODELS if m.get("type") == "image"}
TEXT_MODELS = {m["id"] for m in AVAILABLE_MODELS if m.get("type") != "image"}
DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image"

def enforce_model_capability(model_id: str, capabilities: list) -> str:
    """ถ้า worker มี image_tool ต้องใช้ image model เท่านั้น"""
    if "image_tool" in capabilities:
        if model_id not in IMAGE_MODELS:
            return DEFAULT_IMAGE_MODEL
    else:
        if model_id in IMAGE_MODELS:
            return "gemini-2.5-flash"
    return model_id

class WorkerCreate(BaseModel):
    name: str
    role: str
    llm_model: str = "gemini-2.5-flash"
    capabilities: Optional[List[str]] = []
    avatar: Optional[str] = None
    personality: Optional[str] = None
    speech_style: Optional[str] = None

class TeamApprove(BaseModel):
    team_name: str
    description: str
    workers: List[WorkerCreate]

@router.get("/")
async def get_teams(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Team).order_by(Team.created_at.desc()))
    teams = result.scalars().all()
    response = []
    for t in teams:
        workers_result = await db.execute(select(Worker).where(Worker.team_id == t.id))
        workers = workers_result.scalars().all()
        response.append({
            "id": str(t.id), "name": t.name, "description": t.description,
            "status": t.status, "llm_model": t.llm_model,
            "created_at": t.created_at.isoformat(),
            "workers": [{
                "id": str(w.id), "name": w.name, "role": w.role,
                "llm_model": w.llm_model, "status": w.status,
                "capabilities": w.capabilities or [],
                "avatar": w.avatar, "personality": w.personality, "speech_style": w.speech_style
            } for w in workers]
        })
    return response

@router.post("/approve")
async def approve_team(data: TeamApprove, db: AsyncSession = Depends(get_db)):
    first_model = normalize_model_id(data.workers[0].llm_model) if data.workers else "gemini-2.5-flash"
    team = Team(
        name=data.team_name,
        description=data.description,
        llm_model=first_model
    )
    db.add(team)
    await db.flush()

    for w in data.workers:
        caps = [c for c in (w.capabilities or []) if c in VALID_TOOLS]
        model = enforce_model_capability(normalize_model_id(w.llm_model), caps)
        worker = Worker(
            team_id=team.id,
            name=w.name,
            role=w.role,
            llm_model=model,
            capabilities=caps,
            avatar=w.avatar,
            personality=w.personality,
            speech_style=w.speech_style,
        )
        db.add(worker)

    await db.commit()
    return {"success": True, "team_id": str(team.id), "team_name": team.name}

@router.delete("/{team_id}")
async def delete_team(team_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Team).where(Team.id == uuid.UUID(team_id)))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    await db.delete(team)
    await db.commit()
    return {"success": True}

class WorkerUpdate(BaseModel):
    llm_model: Optional[str] = None
    capabilities: Optional[List[str]] = None
    avatar: Optional[str] = None
    personality: Optional[str] = None
    speech_style: Optional[str] = None

@router.patch("/workers/{worker_id}")
async def update_worker(worker_id: str, data: WorkerUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Worker).where(Worker.id == uuid.UUID(worker_id)))
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    if data.capabilities is not None:
        worker.capabilities = [c for c in data.capabilities if c in VALID_TOOLS]
    if data.llm_model is not None:
        worker.llm_model = enforce_model_capability(
            normalize_model_id(data.llm_model),
            worker.capabilities or []
        )
    elif data.capabilities is not None:
        worker.llm_model = enforce_model_capability(worker.llm_model or "gemini-2.5-flash", worker.capabilities or [])
    if data.avatar is not None:
        worker.avatar = data.avatar
    if data.personality is not None:
        worker.personality = data.personality
    if data.speech_style is not None:
        worker.speech_style = data.speech_style
    await db.commit()
    return {
        "success": True,
        "id": str(worker.id),
        "name": worker.name,
        "llm_model": worker.llm_model,
        "capabilities": worker.capabilities or [],
        "avatar": worker.avatar,
        "personality": worker.personality,
        "speech_style": worker.speech_style,
    }

@router.delete("/workers/{worker_id}")
async def delete_worker(worker_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Worker).where(Worker.id == uuid.UUID(worker_id)))
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    await db.delete(worker)
    await db.commit()
    return {"success": True}
