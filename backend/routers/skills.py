from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from core.database import get_db
from pydantic import BaseModel
from typing import Optional, List
import uuid, json, io, zipfile, urllib.parse

router = APIRouter(prefix="/api/skills", tags=["skills"])

class SkillRef(BaseModel):
    path: str
    content: str

class SkillCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    category: Optional[str] = "general"
    tags: Optional[List[str]] = []
    content: str
    refs: Optional[List[SkillRef]] = []

class SkillUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    content: Optional[str] = None
    refs: Optional[List[SkillRef]] = None

async def get_refs(skill_id: str, db: AsyncSession):
    result = await db.execute(
        text("SELECT id, path, content FROM yujin_skill_refs WHERE skill_id = :sid ORDER BY path"),
        {"sid": skill_id}
    )
    return [{"id": str(r.id), "path": r.path, "content": r.content} for r in result.fetchall()]

async def save_refs(skill_id: str, refs: List[SkillRef], db: AsyncSession):
    await db.execute(text("DELETE FROM yujin_skill_refs WHERE skill_id = :sid"), {"sid": skill_id})
    for ref in refs:
        await db.execute(
            text("INSERT INTO yujin_skill_refs (id, skill_id, path, content) VALUES (:id, :sid, :path, :content)"),
            {"id": str(uuid.uuid4()), "sid": skill_id, "path": ref.path, "content": ref.content}
        )

@router.get("/")
async def list_skills(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT id, name, description, category, tags, created_at FROM yujin_skills ORDER BY created_at DESC"))
    rows = result.fetchall()
    return [{"id": str(r.id), "name": r.name, "description": r.description, "category": r.category or "general", "tags": r.tags or [], "created_at": r.created_at.isoformat()} for r in rows]

@router.get("/{skill_id}/export")
async def export_skill(skill_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM yujin_skills WHERE id = :id"), {"id": skill_id})
    r = result.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Skill not found")
    refs = await get_refs(skill_id, db)

    if not refs:
        filename = r.name.replace(" ", "_").replace("/", "-") + ".md"
        encoded = urllib.parse.quote(filename, safe="")
        return Response(
            content=r.content.encode("utf-8"),
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8\'\'{encoded}"}
        )

    buf = io.BytesIO()
    folder = r.name.replace(" ", "_").replace("/", "-")
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{folder}/SKILL.md", r.content.encode("utf-8"))
        for ref in refs:
            zf.writestr(f"{folder}/{ref['path']}", ref["content"].encode("utf-8"))
    buf.seek(0)

    zip_name = folder + ".skill"
    encoded = urllib.parse.quote(zip_name, safe="")
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8\'\'{encoded}"}
    )

@router.get("/{skill_id}")
async def get_skill(skill_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM yujin_skills WHERE id = :id"), {"id": skill_id})
    r = result.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Skill not found")
    refs = await get_refs(skill_id, db)
    return {"id": str(r.id), "name": r.name, "description": r.description, "category": r.category or "general", "tags": r.tags or [], "content": r.content, "refs": refs, "created_at": r.created_at.isoformat()}

@router.post("/")
async def create_skill(data: SkillCreate, db: AsyncSession = Depends(get_db)):
    skill_id = str(uuid.uuid4())
    await db.execute(text(
        "INSERT INTO yujin_skills (id, name, description, category, tags, content) VALUES (:id, :name, :desc, :cat, cast(:tags as jsonb), :content)"
    ), {"id": skill_id, "name": data.name, "desc": data.description, "cat": data.category or "general", "tags": json.dumps(data.tags or []), "content": data.content})
    await db.flush()
    if data.refs:
        await save_refs(skill_id, data.refs, db)
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
    if data.category is not None:
        await db.execute(text("UPDATE yujin_skills SET category = :v WHERE id = :id"), {"v": data.category, "id": skill_id})
    if data.tags is not None:
        await db.execute(text("UPDATE yujin_skills SET tags = cast(:v as jsonb) WHERE id = :id"), {"v": json.dumps(data.tags), "id": skill_id})
    if data.refs is not None:
        await save_refs(skill_id, data.refs, db)
    await db.commit()
    return {"success": True}

@router.delete("/{skill_id}")
async def delete_skill(skill_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM yujin_skills WHERE id = :id"), {"id": skill_id})
    await db.commit()
    return {"success": True}
