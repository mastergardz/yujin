from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from models.models import Room, ChatMessage
from pydantic import BaseModel
import uuid

router = APIRouter(prefix="/api/rooms", tags=["rooms"])

class RoomCreate(BaseModel):
    name: str = "ห้องใหม่"

@router.get("/")
async def get_rooms(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Room).order_by(Room.created_at))
    rooms = result.scalars().all()
    return [{"id": str(r.id), "name": r.name, "created_at": r.created_at.isoformat()} for r in rooms]

@router.post("/")
async def create_room(data: RoomCreate, db: AsyncSession = Depends(get_db)):
    room = Room(name=data.name)
    db.add(room)
    await db.commit()
    return {"id": str(room.id), "name": room.name}

@router.patch("/{room_id}")
async def rename_room(room_id: str, data: RoomCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Room).where(Room.id == uuid.UUID(room_id)))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    room.name = data.name
    await db.commit()
    return {"success": True}

@router.delete("/{room_id}")
async def delete_room(room_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Room).where(Room.id == uuid.UUID(room_id)))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    await db.delete(room)
    await db.commit()
    return {"success": True}
