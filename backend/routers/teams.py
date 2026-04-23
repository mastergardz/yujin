from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from models.models import Team, Worker
from pydantic import BaseModel
from typing import List, Optional
import uuid

router = APIRouter(prefix="/api/teams", tags=["teams"])

class WorkerCreate(BaseModel):
    name: str
    role: str
    llm_model: str = "gemini-2.0-flash-exp"

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
            "workers": [{"id": str(w.id), "name": w.name, "role": w.role,
                         "llm_model": w.llm_model, "status": w.status} for w in workers]
        })
    return response

@router.post("/approve")
async def approve_team(data: TeamApprove, db: AsyncSession = Depends(get_db)):
    team = Team(
        name=data.team_name,
        description=data.description,
        llm_model=data.workers[0].llm_model if data.workers else "gemini-2.0-flash-exp"
    )
    db.add(team)
    await db.flush()

    for w in data.workers:
        worker = Worker(
            team_id=team.id,
            name=w.name,
            role=w.role,
            llm_model=w.llm_model
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
