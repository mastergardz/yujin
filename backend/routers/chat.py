from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from models.models import ChatMessage, Team, Worker, YujinConfig, Room
from services.yujin_agent import process_message
from core.config import settings
import json, uuid

router = APIRouter(prefix="/api/chat", tags=["chat"])

@router.get("/history/{room_id}")
async def get_history(room_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.room_id == uuid.UUID(room_id))
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    return [{"id": str(m.id), "role": m.role, "content": m.content,
             "model_used": m.model_used, "metadata": m.extra_data,
             "created_at": m.created_at.isoformat()} for m in messages]

@router.websocket("/ws/{room_id}")
async def websocket_chat(websocket: WebSocket, room_id: str, db: AsyncSession = Depends(get_db)):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            user_msg = payload.get("message", "")

            # save user message
            user_record = ChatMessage(role="user", content=user_msg, room_id=uuid.UUID(room_id))
            db.add(user_record)
            await db.commit()

            # ดึง chat history ของห้องนี้ (ล่าสุด 20 ข้อความ)
            history_result = await db.execute(
                select(ChatMessage)
                .where(ChatMessage.room_id == uuid.UUID(room_id))
                .order_by(ChatMessage.created_at.desc())
                .limit(20)
            )
            history = list(reversed(history_result.scalars().all()))
            chat_history = [{"role": m.role, "content": m.content} for m in history]

            # existing teams
            teams_result = await db.execute(select(Team).where(Team.status == "active"))
            teams = teams_result.scalars().all()
            teams_data = []
            for t in teams:
                workers_result = await db.execute(select(Worker).where(Worker.team_id == t.id))
                workers = workers_result.scalars().all()
                teams_data.append({
                    "name": t.name, "description": t.description,
                    "workers": [{"name": w.name, "role": w.role} for w in workers]
                })

            config_result = await db.execute(select(YujinConfig).where(YujinConfig.id == 1))
            config = config_result.scalar_one_or_none()
            yujin_model = config.llm_model if config else settings.yujin_llm_model

            result = await process_message(user_msg, chat_history, teams_data, yujin_model, db)

            yujin_record = ChatMessage(
                role="yujin", content=result["text"],
                model_used=yujin_model, room_id=uuid.UUID(room_id),
                extra_data={"proposal": result["proposal"]}
            )
            db.add(yujin_record)
            await db.commit()

            await websocket.send_text(json.dumps({
                "role": "yujin", "content": result["text"],
                "model_used": yujin_model,
                "proposal": result["proposal"],
                "message_id": str(yujin_record.id)
            }))

    except WebSocketDisconnect:
        pass
