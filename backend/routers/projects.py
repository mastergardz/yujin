from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from models.models import Project, ProjectMember, ProjectMessage, WorkerTemplate
from pydantic import BaseModel
from typing import Optional, List
import uuid

router = APIRouter(prefix="/api/projects", tags=["projects"])

class WorkerSpec(BaseModel):
    name: str
    role: str
    llm_model: str = "gemini-2.5-flash"
    capabilities: Optional[List[str]] = []

class ApproveProposal(BaseModel):
    project_name: str
    description: Optional[str] = ""
    members: List[WorkerSpec]  # all workers (from library + new hires)

def project_to_dict(p: Project, members=None) -> dict:
    d = {
        "id": str(p.id),
        "name": p.name,
        "description": p.description,
        "status": p.status,
        "created_at": p.created_at.isoformat(),
        "members": [],
    }
    if members is not None:
        d["members"] = [member_to_dict(m) for m in members]
    return d

def member_to_dict(m: ProjectMember) -> dict:
    return {
        "id": str(m.id),
        "project_id": str(m.project_id),
        "template_id": str(m.template_id) if m.template_id else None,
        "name": m.name,
        "role": m.role,
        "llm_model": m.llm_model,
        "capabilities": m.capabilities or [],
        "avatar": m.avatar,
        "personality": m.personality,
        "speech_style": m.speech_style,
        "skills": m.skills or [],
        "system_prompt": m.system_prompt,
        "status": m.status,
    }

@router.get("/")
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    projects = result.scalars().all()
    out = []
    for p in projects:
        mem_result = await db.execute(select(ProjectMember).where(ProjectMember.project_id == p.id))
        members = mem_result.scalars().all()
        out.append(project_to_dict(p, members))
    return out

@router.get("/{project_id}")
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == uuid.UUID(project_id)))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    mem_result = await db.execute(select(ProjectMember).where(ProjectMember.project_id == p.id))
    members = mem_result.scalars().all()
    return project_to_dict(p, members)

@router.post("/approve")
async def approve_proposal(data: ApproveProposal, db: AsyncSession = Depends(get_db)):
    """พี่ approve proposal จาก Yujin — สร้าง Project + ProjectMembers"""
    # load full library for template matching
    lib_result = await db.execute(select(WorkerTemplate))
    library = lib_result.scalars().all()
    lib_by_name = {t.name.lower(): t for t in library}

    project = Project(name=data.project_name, description=data.description or "")
    db.add(project)
    await db.flush()  # get project.id

    for spec in data.members:
        template = lib_by_name.get(spec.name.lower())
        member = ProjectMember(
            project_id=project.id,
            template_id=template.id if template else None,
            name=spec.name,
            role=spec.role,
            llm_model=spec.llm_model,
            capabilities=spec.capabilities or [],
            avatar=template.avatar if template else None,
            personality=template.personality if template else None,
            speech_style=template.speech_style if template else None,
            skills=template.skills if template else [],
            system_prompt=template.system_prompt if template else None,
        )
        db.add(member)

    await db.commit()
    await db.refresh(project)

    mem_result = await db.execute(select(ProjectMember).where(ProjectMember.project_id == project.id))
    members = mem_result.scalars().all()
    return project_to_dict(project, members)

@router.delete("/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == uuid.UUID(project_id)))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(p)
    await db.commit()
    return {"success": True}
