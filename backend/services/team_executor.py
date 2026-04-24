import json
from services.llm import call_llm_with_usage
from models.models import WorkspaceMessage, Worker, Team
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

async def save_ws_msg(db: AsyncSession, team_id, sender: str, sender_type: str, content: str):
    msg = WorkspaceMessage(team_id=team_id, sender=sender, sender_type=sender_type, content=content)
    db.add(msg)
    await db.commit()
    return msg

def format_cost_summary(usage_list: list) -> str:
    """สร้าง cost summary จาก usage records"""
    if not usage_list:
        return ""
    
    total_input = sum(u["input_tokens"] for u in usage_list)
    total_output = sum(u["output_tokens"] for u in usage_list)
    total_cost = sum(u["cost_usd"] for u in usage_list)
    
    # จัดกลุ่มตาม model
    by_model = {}
    for u in usage_list:
        m = u["model"]
        if m not in by_model:
            by_model[m] = {"input": 0, "output": 0, "cost": 0, "calls": 0}
        by_model[m]["input"] += u["input_tokens"]
        by_model[m]["output"] += u["output_tokens"]
        by_model[m]["cost"] += u["cost_usd"]
        by_model[m]["calls"] += 1
    
    # ย่อชื่อ model
    MODEL_SHORT = {
        "gemini-2.5-flash": "Gemini 2.5 Flash",
        "gemini-2.5-pro": "Gemini 2.5 Pro",
        "gemini-2.0-flash-lite": "Gemini 2.0 Lite",
        "meta-llama/Llama-3.3-70B-Instruct-Turbo": "Llama 3.3 70B",
        "meta-llama/Llama-4-Scout-17B-16E-Instruct": "Llama 4 Scout",
        "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": "Llama 3.1 8B",
    }
    
    lines = ["---", "💰 **ค่าใช้จ่าย API งานนี้**"]
    for model_id, data in by_model.items():
        name = MODEL_SHORT.get(model_id, model_id.split("/")[-1])
        cost_thb = data["cost"] * 35  # USD to THB approx
        lines.append(f"• {name}: {data['input']:,}+{data['output']:,} tokens = ${data['cost']:.5f} (~฿{cost_thb:.3f})")
    
    total_thb = total_cost * 35
    lines.append(f"**รวม: ${total_cost:.5f} (~฿{total_thb:.3f})** | {total_input+total_output:,} tokens")
    
    return "\n".join(lines)

async def run_team_task(task: str, team_id, db: AsyncSession, broadcast_fn=None):
    """Yujin สั่งงาน workers แล้ว broadcast ผ่าน websocket"""
    import uuid

    usage_log = []  # track all API calls

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

    plan_text, usage = await call_llm_with_usage(plan_prompt, "คุณคือ Yujin เลขา AI ผู้หญิง กำลังมอบหมายงานให้ทีม เรียกชื่อ worker โดยตรง ตอบเป็น JSON เท่านั้น", db=db)
    usage_log.append(usage)

    try:
        start = plan_text.index("{")
        end = plan_text.rindex("}") + 1
        plan = json.loads(plan_text[start:end])
    except:
        plan = {"summary": plan_text, "assignments": [{"worker": workers[0].name if workers else "Worker", "task": task}]}

    await broadcast("Yujin", "yujin", f"รับงานแล้วค่ะ — {plan.get('summary', task)}\n\nกำลังมอบหมายงานให้ทีม...")

    results = []
    for assignment in plan.get("assignments", []):
        worker_name = assignment["worker"]
        worker_task = assignment["task"]

        worker = next((w for w in workers if w.name == worker_name), workers[0] if workers else None)
        if not worker:
            continue

        await broadcast("Yujin", "yujin", f"@{worker_name} — {worker_task}")

        worker_prompt = f"""บทบาทของคุณ: {worker.role}
งานที่ได้รับ: {worker_task}
บริบท: เป็นส่วนหนึ่งของงานใหญ่: {task}

สำคัญมาก: ส่งมอบผลงานจริงๆ เลย อย่าแค่บอกว่าจะทำอะไร
ถ้างานคือเขียนบทความ → เขียนบทความให้เลย
ถ้างานคือวิจัย → ส่งข้อมูลที่ค้นพบมาเลย
ถ้างานคือออกแบบ → ส่งผลงานที่ออกแบบมาเลย"""

        worker_result, usage = await call_llm_with_usage(
            worker_prompt,
            f"คุณชื่อ {worker_name} เป็นผู้หญิง ทำหน้าที่ {worker.role} บุคลิก: สุภาพ ฉลาด ทำงานเป็น เรียกตัวเองว่าหนู ใช้คำลงท้าย คะ ค่ะ ขา ค่า จ๊ะ ส่งผลงานจริงๆ ไม่ใช่อธิบายว่าจะทำอะไร",
            model=worker.llm_model, db=db
        )
        usage_log.append(usage)
        await broadcast(worker_name, "worker", worker_result)
        results.append({"worker": worker_name, "result": worker_result})

    if results:
        summary_parts = "\n\n".join([f"**{r['worker']}:** {r['result']}" for r in results])
        summary_prompt = f"""งานต้นฉบับที่พี่สั่ง: {task}

ผลงานจากทีม:
{summary_parts}

ตอนนี้ส่งงานให้พี่เลย — ขึ้นต้นว่า "ส่งงานค่ะ พี่" หรือ "พี่คะ งานเสร็จแล้วค่ะ" แล้วนำเสนอผลงานจริงๆ จากทีม
ถ้าทีมเขียนบทความมา ให้คัดเอาบทความที่ดีที่สุดมาส่งเลย ไม่ต้องสรุปว่าใครทำอะไร
เน้นส่งเนื้อหาจริงๆ ที่พี่ใช้งานได้เลย"""

        final, usage = await call_llm_with_usage(
            summary_prompt,
            "คุณคือ Yujin เลขา AI ผู้หญิง เรียกตัวเองว่าหนู เรียกผู้ใช้ว่าพี่ ใช้คำลงท้าย คะ ค่ะ ขา ค่า ห้ามเป็นทางการ ห้ามขึ้นต้นว่าเรียน ห้ามเรียกผู้ใช้ว่า CEO หรือผู้บริหาร ส่งงานแบบเพื่อนร่วมงานสนิท",
            db=db
        )
        usage_log.append(usage)

        await broadcast("Yujin", "yujin", final)

        # Cost summary
        cost_msg = format_cost_summary(usage_log)
        if cost_msg:
            await broadcast("Yujin", "yujin", cost_msg)

        return final

    return "ทำงานเสร็จแล้วค่ะ"
