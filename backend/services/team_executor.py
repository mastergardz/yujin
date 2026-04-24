import json
from services.llm import call_llm
from models.models import WorkspaceMessage, Worker, Team
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

async def save_ws_msg(db: AsyncSession, team_id, sender: str, sender_type: str, content: str):
    msg = WorkspaceMessage(team_id=team_id, sender=sender, sender_type=sender_type, content=content)
    db.add(msg)
    await db.commit()
    return msg

async def run_team_task(task: str, team_id, db: AsyncSession, broadcast_fn=None):
    """Yujin สั่งงาน workers แล้ว broadcast ผ่าน websocket"""
    import uuid

    # ดึง team + workers
    team_result = await db.execute(select(Team).where(Team.id == uuid.UUID(str(team_id))))
    team = team_result.scalar_one_or_none()
    if not team:
        return "ไม่พบทีม"

    workers_result = await db.execute(select(Worker).where(Worker.team_id == team.id))
    workers = workers_result.scalars().all()

    async def broadcast(sender, sender_type, content):
        msg = await save_ws_msg(db, team.id, sender, sender_type, content)
        if broadcast_fn:
            await broadcast_fn({
                "id": str(msg.id),
                "sender": sender,
                "sender_type": sender_type,
                "content": content,
                "created_at": msg.created_at.isoformat()
            })

    # Yujin วิเคราะห์งานและแบ่ง subtasks ให้ workers
    workers_info = "\n".join([f"- {w.name}: {w.role}" for w in workers])
    plan_prompt = f"""งานที่ได้รับ: {task}

ทีมงาน:
{workers_info}

วิเคราะห์งานและมอบหมาย subtask ให้แต่ละคน ตอบในรูปแบบ JSON:
{{
  "summary": "สรุปแผนงานสั้นๆ",
  "assignments": [
    {{"worker": "ชื่อ worker", "task": "งานที่มอบหมาย"}}
  ]
}}"""

    plan_text = await call_llm(plan_prompt, "คุณคือ Yujin เลขา AI กำลังมอบหมายงานให้ทีม ตอบเป็น JSON เท่านั้น", db=db)
    try:
        start = plan_text.index("{")
        end = plan_text.rindex("}") + 1
        plan = json.loads(plan_text[start:end])
    except:
        plan = {"summary": plan_text, "assignments": [{"worker": workers[0].name if workers else "Worker", "task": task}]}

    await broadcast("Yujin", "yujin", f"รับงานแล้วค่ะ — {plan.get('summary', task)}\n\nกำลังมอบหมายงานให้ทีม...")

    # แต่ละ worker รับงานและทำ
    results = []
    for assignment in plan.get("assignments", []):
        worker_name = assignment["worker"]
        worker_task = assignment["task"]

        # หา worker object
        worker = next((w for w in workers if w.name == worker_name), workers[0] if workers else None)
        if not worker:
            continue

        await broadcast("Yujin", "yujin", f"@{worker_name} — {worker_task}")

        worker_prompt = f"""บทบาทของคุณ: {worker.role}
งานที่ได้รับ: {worker_task}
บริบท: เป็นส่วนหนึ่งของงานใหญ่: {task}

ทำงานที่ได้รับและรายงานผล"""

        worker_result = await call_llm(worker_prompt, f"คุณคือ {worker_name} ทำหน้าที่ {worker.role} รายงานผลงานเป็นภาษาไทย", model=worker.llm_model, db=db)
        await broadcast(worker_name, "worker", worker_result)
        results.append({"worker": worker_name, "result": worker_result})

    # Yujin สรุปผล
    if results:
        summary_parts = "\n\n".join([f"**{r['worker']}:** {r['result']}" for r in results])
        summary_prompt = f"""งานต้นฉบับ: {task}

ผลงานจากทีม:
{summary_parts}

สรุปผลรวมให้กระชับและนำเสนอต่อ CEO"""

        final = await call_llm(summary_prompt, "คุณคือ Yujin สรุปผลงานทีมให้ boss ฟัง", db=db)
        await broadcast("Yujin", "yujin", f"📋 สรุปผล:\n{final}")
        return final

    return "ทำงานเสร็จแล้วค่ะ"
