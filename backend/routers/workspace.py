from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from models.models import ProjectMessage, Project, ProjectMember
from services.project_executor import run_project_task
import json, uuid

router = APIRouter(prefix="/api/workspace", tags=["workspace"])

connections: dict[str, list[WebSocket]] = {}

@router.get("/{project_id}/history")
async def get_history(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProjectMessage)
        .where(ProjectMessage.project_id == uuid.UUID(project_id))
        .order_by(ProjectMessage.created_at)
    )
    msgs = result.scalars().all()
    return [{"id": str(m.id), "sender": m.sender, "sender_type": m.sender_type,
             "content": m.content, "created_at": m.created_at.isoformat()} for m in msgs]

@router.websocket("/{project_id}/ws")
async def workspace_ws(websocket: WebSocket, project_id: str, db: AsyncSession = Depends(get_db)):
    await websocket.accept()
    if project_id not in connections:
        connections[project_id] = []
    connections[project_id].append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            task = payload.get("task", "")
            file_context = payload.get("file_context", "")
            if file_context:
                task = (task.strip() + "\n\n" + file_context).strip() if task.strip() else file_context
            if not task:
                continue

            async def broadcast(msg_data):
                dead = []
                for ws in connections.get(project_id, []):
                    try:
                        await ws.send_text(json.dumps(msg_data))
                    except Exception:
                        dead.append(ws)
                for ws in dead:
                    connections[project_id].remove(ws)

            display_task = payload.get("task", "") or "(แนบไฟล์)"
            user_msg = ProjectMessage(
                project_id=uuid.UUID(project_id),
                sender="พี่การ์ด",
                sender_type="user",
                content=display_task
            )
            db.add(user_msg)
            await db.commit()
            await broadcast({
                "id": str(user_msg.id),
                "sender": "พี่การ์ด",
                "sender_type": "user",
                "content": display_task,
                "created_at": user_msg.created_at.isoformat()
            })

            await run_project_task(task, uuid.UUID(project_id), db, broadcast)

    except WebSocketDisconnect:
        if project_id in connections:
            connections[project_id] = [c for c in connections[project_id] if c != websocket]
