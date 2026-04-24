from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from core.database import get_db
from pydantic import BaseModel
from typing import Optional
import uuid

router = APIRouter(prefix="/api/skills", tags=["skills"])

class SkillCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    content: str

class SkillUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None

@router.get("/")
async def list_skills(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT id, name, description, created_at FROM yujin_skills ORDER BY created_at DESC"))
    rows = result.fetchall()
    return [{"id": str(r.id), "name": r.name, "description": r.description, "created_at": r.created_at.isoformat()} for r in rows]

@router.get("/{skill_id}")
async def get_skill(skill_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM yujin_skills WHERE id = :id"), {"id": skill_id})
    r = result.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Skill not found")
    return {"id": str(r.id), "name": r.name, "description": r.description, "content": r.content, "created_at": r.created_at.isoformat()}

@router.post("/")
async def create_skill(data: SkillCreate, db: AsyncSession = Depends(get_db)):
    skill_id = str(uuid.uuid4())
    await db.execute(text(
        "INSERT INTO yujin_skills (id, name, description, content) VALUES (:id, :name, :desc, :content)"
    ), {"id": skill_id, "name": data.name, "desc": data.description, "content": data.content})
    await db.commit()
    return {"success": True, "id": skill_id, "name": data.name}

@router.patch("/{skill_id}")
async def update_skill(skill_id: str, data: SkillUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT id FROM yujin_skills WHERE id = :id"), {"id": skill_id})
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Skill not found")
    if data.name is not None:
        await db.execute(text("UPDATE yujin_skills SET name = :v WHERE id = :id"), {"v": data.name, "id": skill_id})
    if data.description is not None:
        await db.execute(text("UPDATE yujin_skills SET description = :v WHERE id = :id"), {"v": data.description, "id": skill_id})
    if data.content is not None:
        await db.execute(text("UPDATE yujin_skills SET content = :v WHERE id = :id"), {"v": data.content, "id": skill_id})
    await db.commit()
    return {"success": True}

@router.delete("/{skill_id}")
async def delete_skill(skill_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM yujin_skills WHERE id = :id"), {"id": skill_id})
    await db.commit()
    return {"success": True}
