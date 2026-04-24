from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from models.models import WorkspaceMessage, Team, Worker
from services.team_executor import run_team_task
from pydantic import BaseModel
import json, uuid, asyncio
from datetime import datetime, timezone

router = APIRouter(prefix="/api/workspace", tags=["workspace"])

connections: dict[str, list[WebSocket]] = {}

class RunTask(BaseModel):
    task: str

@router.get("/{team_id}/history")
async def get_history(team_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WorkspaceMessage)
        .where(WorkspaceMessage.team_id == uuid.UUID(team_id))
        .order_by(WorkspaceMessage.created_at)
    )
    msgs = result.scalars().all()
    return [{"id": str(m.id), "sender": m.sender, "sender_type": m.sender_type,
             "content": m.content, "created_at": m.created_at.isoformat()} for m in msgs]

@router.websocket("/{team_id}/ws")
async def workspace_ws(websocket: WebSocket, team_id: str, db: AsyncSession = Depends(get_db)):
    await websocket.accept()
    if team_id not in connections:
        connections[team_id] = []
    connections[team_id].append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            task = payload.get("task", "")
            if not task:
                continue

            async def broadcast(msg_data):
                dead = []
                for ws in connections.get(team_id, []):
                    try:
                        await ws.send_text(json.dumps(msg_data))
                    except:
                        dead.append(ws)
                for ws in dead:
                    connections[team_id].remove(ws)

            # Save & broadcast user message first
            user_msg = WorkspaceMessage(
                team_id=uuid.UUID(team_id),
                sender="พี่การ์ด",
                sender_type="user",
                content=task
            )
            db.add(user_msg)
            await db.commit()
            await broadcast({
                "id": str(user_msg.id),
                "sender": "พี่การ์ด",
                "sender_type": "user",
                "content": task,
                "created_at": user_msg.created_at.isoformat()
            })

            await run_team_task(task, uuid.UUID(team_id), db, broadcast)

    except WebSocketDisconnect:
        if team_id in connections:
            connections[team_id] = [c for c in connections[team_id] if c != websocket]
