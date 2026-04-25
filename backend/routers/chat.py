from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from core.database import get_db
from models.models import ChatMessage, Project, YujinConfig
from services.yujin_agent import process_message
from core.config import settings
import json

router = APIRouter(prefix="/api/chat", tags=["chat"])

@router.get("/history")
async def get_history(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatMessage).where(ChatMessage.room_id.is_(None)).order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    return [{"id": str(m.id), "role": m.role, "content": m.content,
             "model_used": m.model_used, "metadata": m.extra_data,
             "created_at": m.created_at.isoformat()} for m in messages]

@router.delete("/clear")
async def clear_history(db: AsyncSession = Depends(get_db)):
    await db.execute(delete(ChatMessage).where(ChatMessage.room_id.is_(None)))
    await db.commit()
    return {"success": True}

@router.websocket("/ws")
async def websocket_chat(websocket: WebSocket, db: AsyncSession = Depends(get_db)):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            user_msg = payload.get("message", "")

            user_record = ChatMessage(role="user", content=user_msg, room_id=None)
            db.add(user_record)
            await db.commit()

            history_result = await db.execute(
                select(ChatMessage)
                .where(ChatMessage.room_id.is_(None))
                .order_by(ChatMessage.created_at.desc())
                .limit(20)
            )
            history = list(reversed(history_result.scalars().all()))
            chat_history = [{"role": m.role, "content": m.content} for m in history]

            # existing projects for context
            proj_result = await db.execute(select(Project).where(Project.status == "active"))
            projects = proj_result.scalars().all()
            projects_data = [{"name": p.name, "description": p.description} for p in projects]

            config_result = await db.execute(select(YujinConfig).where(YujinConfig.id == 1))
            config = config_result.scalar_one_or_none()
            yujin_model = config.llm_model if config else settings.yujin_llm_model

            result = await process_message(user_msg, chat_history, projects_data, yujin_model, db)

            yujin_record = ChatMessage(
                role="yujin", content=result["text"],
                model_used=yujin_model, room_id=None,
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
