from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from models.models import ChatMessage, Team, Worker, YujinConfig
from services.yujin_agent import process_message
import json
from datetime import datetime

router = APIRouter(prefix="/api/chat", tags=["chat"])

@router.get("/history")
async def get_history(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChatMessage).order_by(ChatMessage.created_at))
    messages = result.scalars().all()
    return [{"id": str(m.id), "role": m.role, "content": m.content,
             "metadata": m.extra_data, "created_at": m.created_at.isoformat()} for m in messages]

@router.websocket("/ws")
async def websocket_chat(websocket: WebSocket, db: AsyncSession = Depends(get_db)):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            user_msg = payload.get("message", "")

            # save user message
            user_record = ChatMessage(role="user", content=user_msg)
            db.add(user_record)
            await db.commit()

            # get existing teams
            teams_result = await db.execute(select(Team).where(Team.status == "active"))
            teams = teams_result.scalars().all()
            teams_data = []
            for t in teams:
                workers_result = await db.execute(select(Worker).where(Worker.team_id == t.id))
                workers = workers_result.scalars().all()
                teams_data.append({
                    "name": t.name,
                    "description": t.description,
                    "workers": [{"name": w.name, "role": w.role} for w in workers]
                })

            # get yujin model config
            config_result = await db.execute(select(YujinConfig).where(YujinConfig.id == 1))
            config = config_result.scalar_one_or_none()
            yujin_model = config.llm_model if config else None

            # process with yujin agent
            result = await process_message(user_msg, teams_data, yujin_model, db)

            # save yujin response
            yujin_record = ChatMessage(
                role="yujin",
                content=result["text"],
                extra_data={"proposal": result["proposal"]}
            )
            db.add(yujin_record)
            await db.commit()

            await websocket.send_text(json.dumps({
                "role": "yujin",
                "content": result["text"],
                "proposal": result["proposal"],
                "message_id": str(yujin_record.id)
            }))

    except WebSocketDisconnect:
        pass
