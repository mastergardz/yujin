import json
import re
import asyncio
from services.llm import call_llm_with_usage
from services.worker_tools import TOOLS, shell_tool, db_tool, file_tool, image_tool
from models.models import WorkspaceMessage, Worker, Team
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

# pending recruit approvals: team_id -> asyncio.Future
_recruit_pending: dict[str, asyncio.Future] = {}

async def wait_recruit_approval(team_id: str, timeout: float = 120.0) -> dict | None:
    """รอพี่ approve/decline recruit request, return worker data or None"""
    loop = asyncio.get_event_loop()
    fut = loop.create_future()
    _recruit_pending[str(team_id)] = fut
    try:
        return await asyncio.wait_for(asyncio.shield(fut), timeout=timeout)
    except asyncio.TimeoutError:
        return None
    finally:
        _recruit_pending.pop(str(team_id), None)

def resolve_recruit(team_id: str, worker_data: dict | None):
    """เรียกจาก router เมื่อพี่ approve หรือ decline"""
    fut = _recruit_pending.get(str(team_id))
    if fut and not fut.done():
        fut.set_result(worker_data)

async def save_ws_msg(db: AsyncSession, team_id, sender: str, sender_type: str, content: str):
    msg = WorkspaceMessage(team_id=team_id, sender=sender, sender_type=sender_type, content=content)
    db.add(msg)
    await db.commit()
    return msg

def format_cost_summary(usage_list: list) -> str:
    if not usage_list:
        return ""
    total_input = sum(u["input_tokens"] for u in usage_list)
    total_output = sum(u["output_tokens"] for u in usage_list)
    total_cost = sum(u["cost_usd"] for u in usage_list)

    by_model = {}
    for u in usage_list:
        m = u["model"]
        if m not in by_model:
            by_model[m] = {"input": 0, "output": 0, "cost": 0, "calls": 0}
        by_model[m]["input"] += u["input_tokens"]
        by_model[m]["output"] += u["output_tokens"]
        by_model[m]["cost"] += u["cost_usd"]
        by_model[m]["calls"] += 1

    MODEL_SHORT = {
        "gemini-2.5-flash": "Gemini 2.5 Flash",
        "gemini-2.5-pro": "Gemini 2.5 Pro",
        "gemini-2.5-flash-8b": "Gemini 2.5 Flash-8B",
        "meta-llama/Llama-3.3-70B-Instruct-Turbo": "Llama 3.3 70B",
        "meta-llama/Llama-4-Scout-17B-16E-Instruct": "Llama 4 Scout",
        "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": "Llama 3.1 8B",
    }

    lines = ["---", "💰 **ค่าใช้จ่าย API งานนี้**"]
    for model_id, data in by_model.items():
        name = MODEL_SHORT.get(model_id, model_id.split("/")[-1])
        cost_thb = data["cost"] * 35
        lines.append(f"• {name}: {data['input']:,}+{data['output']:,} tokens = ${data['cost']:.5f} (~฿{cost_thb:.3f})")

    total_thb = total_cost * 35
    lines.append(f"**รวม: ${total_cost:.5f} (~฿{total_thb:.3f})** | {total_input+total_output:,} tokens")
    return "\n".join(lines)


def parse_tool_call(text: str) -> tuple[str, dict] | None:
    """Parse JSON tool_call block from LLM response"""
    patterns = [
        r'```tool_call\s*([\s\S]*?)```',
        r'<tool_call>([\s\S]*?)</tool_call>',
        r'\{"tool":\s*"(\w+)"[^}]*\}',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            try:
                blob = match.group(1) if '```' in pattern or '<' in pattern else match.group(0)
                data = json.loads(blob)
                if "tool" in data:
                    return data["tool"], data.get("params", data.get("args", {}))
            except Exception:
                pass
    return None


def build_tool_instructions(capabilities: list) -> str:
    """Build tool-use instructions block for worker system prompt"""
    if not capabilities:
        return ""
    
    tool_docs = []
    for cap in capabilities:
        if cap in TOOLS:
            t = TOOLS[cap]
            tool_docs.append(f'- **{cap}**: {t["description"]}\n  params: {json.dumps(t["params"], ensure_ascii=False)}')
    
    if not tool_docs:
        return ""
    
    has_image = "image_tool" in capabilities
    has_file = "file_tool" in capabilities

    mandatory = ""
    if has_image:
        mandatory += "\n⚠️ ถ้างานเกี่ยวกับการสร้างรูป ต้องเรียก image_tool จริงๆ เท่านั้น ห้าม hallucinate URL หรืออธิบายว่าภาพหน้าตายังไง"
    if has_file:
        mandatory += "\n⚠️ ถ้างานต้องการไฟล์ ต้องเรียก file_tool จริงๆ แล้วส่ง download_url ที่ได้มาให้พี่"

    return """
คุณมี tools ต่อไปนี้ใช้งานได้:
""" + "\n".join(tool_docs) + """

วิธีใช้ tool: ตอบด้วย JSON block นี้ (ใส่ใน ```tool_call ... ```) แล้วรอผลลัพธ์:
```tool_call
{"tool": "ชื่อ_tool", "params": {...}}
```
หลังได้ผล tool แล้ว วิเคราะห์และส่งผลงานต่อ
ถ้าสร้างไฟล์หรือรูปได้ให้ระบุ download_url ที่ได้จาก tool result ด้วย อย่าแต่งลิงก์เองเด็ดขาด
""" + mandatory


IMAGE_MODEL_IDS = {"gemini-2.5-flash-image", "gemini-3.1-flash-image-preview", "gemini-3-pro-image-preview"}


async def run_worker_with_tools(
    worker: Worker,
    worker_task: str,
    big_task: str,
    usage_log: list,
    broadcast_fn=None,
    broadcast_typing_fn=None,
    db: AsyncSession = None,
) -> str:
    """Run a single worker, with tool-use loop support"""

    capabilities = getattr(worker, 'capabilities', None) or []

    # Image model workers: skip LLM loop, call image_tool directly with task as prompt
    if worker.llm_model in IMAGE_MODEL_IDS and "image_tool" in capabilities:
        if broadcast_typing_fn:
            await broadcast_typing_fn(worker.name, "worker")
        if broadcast_fn:
            await broadcast_fn(worker.name, "worker", "🔧 กำลังใช้ `image_tool`...")
        tool_result = await image_tool(
            prompt=worker_task,
            filename="image",
            model=worker.llm_model,
            db=db,
        )
        if tool_result.get("success") and tool_result.get("download_url"):
            img_url = tool_result["download_url"]
            return "สร้างรูปเสร็จแล้วค่ะ\n![ภาพที่สร้าง](" + img_url + ")"
        return "ขออภัยค่ะ สร้างรูปไม่สำเร็จ: " + tool_result.get("error", "unknown error")

    tool_instructions = build_tool_instructions(capabilities)
    
    # extra mandate ถ้า worker มี image_tool — ต้อง call tool จริงทุกครั้งที่งานเกี่ยวกับรูป
    image_mandate = ""
    if "image_tool" in capabilities:
        image_mandate = (
            "\n🚨 คุณมี image_tool — ถ้างานเกี่ยวกับรูปภาพ ต้อง call image_tool ก่อนตอบเสมอ "
            "ห้าม hallucinate ลิงก์รูปหรืออธิบายภาพแทนการสร้างจริงๆ "
            "ใช้ tool_call block ทันทีแล้วรอผล"
        )

    system_prompt = (
        f"คุณชื่อ {worker.name} เป็นผู้หญิง ทำหน้าที่ {worker.role} "
        f"บุคลิก: สุภาพ ฉลาด ทำงานเป็น เรียกตัวเองว่าหนู ใช้คำลงท้าย คะ ค่ะ ขา ค่า จ๊ะ "
        f"ส่งผลงานจริงๆ ไม่ใช่อธิบายว่าจะทำอะไร"
        + (f"\n{worker.system_prompt}" if worker.system_prompt else "")
        + tool_instructions
        + image_mandate
    )

    task_mandate = ""
    if "image_tool" in capabilities:
        task_mandate = "\n\n⚠️ ถ้างานนี้เกี่ยวกับรูปภาพ ให้ call image_tool ทันทีเป็นขั้นตอนแรก ก่อนตอบอะไรทั้งนั้น"

    user_prompt = (
        f"บทบาทของคุณ: {worker.role}\n"
        f"งานที่ได้รับ: {worker_task}\n"
        f"บริบท: เป็นส่วนหนึ่งของงานใหญ่: {big_task}\n\n"
        f"สำคัญมาก: ส่งมอบผลงานจริงๆ เลย อย่าแค่บอกว่าจะทำอะไร"
        + task_mandate
    )

    history = [{"role": "user", "content": user_prompt}]
    final_reply = ""

    for _iteration in range(5):  # max 5 tool-call rounds
        await broadcast_typing_fn(worker.name, "worker")
        
        resp, usage = await call_llm_with_usage(
            history[-1]["content"] if len(history) == 1 else json.dumps(history),
            system_prompt,
            model=worker.llm_model,
            db=db
        )
        usage_log.append(usage)

        tool_call = parse_tool_call(resp)
        if not tool_call:
            final_reply = resp
            break

        tool_name, params = tool_call
        
        # Show worker thinking + calling tool
        clean_resp = re.sub(r'```tool_call[\s\S]*?```', '', resp).strip()
        if clean_resp:
            if broadcast_fn:
                await broadcast_fn(worker.name, "worker", clean_resp)

        if broadcast_fn:
            await broadcast_fn(worker.name, "worker", f"🔧 กำลังใช้ `{tool_name}`...")

        # Execute tool
        tool_result = {"error": f"ไม่รู้จัก tool: {tool_name}"}
        if tool_name == "shell_tool":
            tool_result = await shell_tool(**params)
        elif tool_name == "db_tool":
            tool_result = await db_tool(**params)
        elif tool_name == "file_tool":
            tool_result = await file_tool(**params)
        elif tool_name == "image_tool":
            tool_result = await image_tool(**params, db=db)
            if tool_result.get("success") and tool_result.get("download_url"):
                img_url = tool_result["download_url"]
                final_reply = "สร้างรูปเสร็จแล้วค่ะ\n![ภาพที่สร้าง](" + img_url + ")"
                break

        result_str = json.dumps(tool_result, ensure_ascii=False)
        history.append({"role": "assistant", "content": resp})
        history.append({"role": "user", "content": f"ผลลัพธ์จาก {tool_name}:\n{result_str}\n\nสรุปและส่งผลงานให้พี่เลยค่ะ ถ้ามี download_url ให้ใส่ใน reply ด้วยในรูปแบบ markdown image: ![ชื่อ](url)"})
        final_reply = f"[ผลจาก {tool_name}]\n{result_str}"

    return final_reply or resp


async def run_team_task(task: str, team_id, db: AsyncSession, broadcast_fn=None):
    import uuid

    usage_log = []

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

    async def broadcast_typing(sender, sender_type):
        if broadcast_fn:
            await broadcast_fn({
                "type": "typing",
                "sender": sender,
                "sender_type": sender_type
            })

    async def broadcast_msg(sender, sender_type, content):
        await broadcast(sender, sender_type, content)

    workers_info = "\n".join([
        f"- {w.name}: {w.role}" + (f" [tools: {', '.join(getattr(w, 'capabilities', None) or [])}]" if getattr(w, 'capabilities', None) else "")
        for w in workers
    ])

    FEMALE_NAMES = ["มายด์", "ฝน", "เจน", "โบว์", "นิว", "แพร", "มิ้นท์", "พลอย", "ออม", "เฟิร์น", "ปิ่น", "ขิม"]
    used_names = [w.name for w in workers]
    available_names = [n for n in FEMALE_NAMES if n not in used_names]

    plan_prompt = f"""งานที่ได้รับ: {task}

ทีมงานปัจจุบัน:
{workers_info}

วิเคราะห์งานและมอบหมาย subtask ให้แต่ละคน
ถ้างานต้องการ skill ที่ทีมปัจจุบันไม่มี ให้เสนอ recruit worker เพิ่มได้ 1 คน (ไม่บังคับ)

ตอบในรูปแบบ JSON:
{{
  "summary": "สรุปแผนงานสั้นๆ",
  "assignments": [
    {{"worker": "ชื่อ worker", "task": "งานที่มอบหมาย"}}
  ],
  "recruit": {{
    "needed": true,
    "name": "ชื่อผู้หญิงไทยจากรายการ: {', '.join(available_names[:5])}",
    "role": "บทบาทที่ต้องการ",
    "llm_model": "gemini-2.5-flash",
    "capabilities": [],
    "reason": "เหตุผลสั้นๆ ว่าทำไมต้องการ"
  }}
}}

หมายเหตุ: ถ้าทีมปัจจุบันทำได้ครบ ให้ "recruit": {{"needed": false}}"""

    await broadcast_typing("Yujin", "yujin")
    plan_text, usage = await call_llm_with_usage(
        plan_prompt,
        "คุณชื่อ ยูจิน เป็นเลขา AI ผู้หญิง กำลังวางแผนงาน ตอบเป็น JSON เท่านั้น ห้ามมี text อื่น",
        db=db
    )
    usage_log.append(usage)

    try:
        start = plan_text.index("{")
        end = plan_text.rindex("}") + 1
        plan = json.loads(plan_text[start:end])
    except Exception:
        plan = {"summary": plan_text, "assignments": [{"worker": workers[0].name if workers else "Worker", "task": task}], "recruit": {"needed": False}}

    await broadcast("Yujin", "yujin", f"รับงานแล้วค่ะ — {plan.get('summary', task)}\n\nกำลังมอบหมายงานให้ทีม...")

    # ── Recruit flow ────────────────────────────────────────
    recruit = plan.get("recruit", {})
    if recruit.get("needed"):
        recruit_name = recruit.get("name", "นิว")
        recruit_role = recruit.get("role", "")
        recruit_reason = recruit.get("reason", "")
        recruit_model = recruit.get("llm_model", "gemini-2.5-flash")
        recruit_caps = recruit.get("capabilities", [])

        await broadcast("Yujin", "yujin",
            f"⚠️ หนูอยากเพิ่ม **{recruit_name}** เข้าทีมด้วยค่ะ\n"
            f"บทบาท: {recruit_role}\n"
            f"เหตุผล: {recruit_reason}"
        )
        if broadcast_fn:
            await broadcast_fn({
                "type": "recruit_request",
                "worker": {
                    "name": recruit_name,
                    "role": recruit_role,
                    "llm_model": recruit_model,
                    "capabilities": recruit_caps,
                    "reason": recruit_reason,
                }
            })

        approved_worker = await wait_recruit_approval(str(team.id))
        if approved_worker:
            import uuid as _uuid
            new_worker = Worker(
                team_id=team.id,
                name=approved_worker["name"],
                role=approved_worker["role"],
                llm_model=approved_worker["llm_model"],
                capabilities=approved_worker.get("capabilities", []),
            )
            db.add(new_worker)
            await db.commit()
            await db.refresh(new_worker)
            workers = list(workers) + [new_worker]
            await broadcast("Yujin", "yujin", f"✅ เพิ่ม **{new_worker.name}** เข้าทีมแล้วค่ะ พี่")
            if broadcast_fn:
                await broadcast_fn({"type": "team_updated"})
        else:
            await broadcast("Yujin", "yujin", "โอเคค่ะ ดำเนินงานกับทีมเดิมนะคะ")
    # ────────────────────────────────────────────────────────

    results = []
    for assignment in plan.get("assignments", []):
        worker_name = assignment["worker"]
        worker_task = assignment["task"]

        worker = next((w for w in workers if w.name == worker_name), workers[0] if workers else None)
        if not worker:
            continue

        await broadcast("Yujin", "yujin", f"@{worker_name} — {worker_task}")

        worker_result = await run_worker_with_tools(
            worker=worker,
            worker_task=worker_task,
            big_task=task,
            usage_log=usage_log,
            broadcast_fn=broadcast_msg,
            broadcast_typing_fn=broadcast_typing,
            db=db,
        )
        await broadcast(worker_name, "worker", worker_result)
        results.append({"worker": worker_name, "result": worker_result})

    if results:
        summary_parts = "\n\n".join([f"**{r['worker']}:** {r['result']}" for r in results])
        summary_prompt = f"""งานต้นฉบับที่พี่สั่ง: {task}

ผลงานจากทีม:
{summary_parts}

ตอนนี้ส่งงานให้พี่เลย — ขึ้นต้นว่า "ส่งงานค่ะ พี่" หรือ "พี่คะ งานเสร็จแล้วค่ะ" แล้วนำเสนอผลงานจริงๆ จากทีม
ถ้าทีมเขียนบทความมา ให้คัดเอาบทความที่ดีที่สุดมาส่งเลย ไม่ต้องสรุปว่าใครทำอะไร
เน้นส่งเนื้อหาจริงๆ ที่พี่ใช้งานได้เลย
ถ้ามี download URL ในผลงาน ให้ระบุให้ชัดเจนด้วยค่ะ"""

        await broadcast_typing("Yujin", "yujin")
        final, usage = await call_llm_with_usage(
            summary_prompt,
            "คุณชื่อ ยูจิน เป็นเลขา AI ผู้หญิง เรียกตัวเองว่าหนู เรียกผู้ใช้ว่าพี่ ใช้คำลงท้าย คะ ค่ะ ขา ค่า ห้ามเป็นทางการ ห้ามขึ้นต้นว่าเรียน ห้ามเรียกผู้ใช้ว่า CEO หรือผู้บริหาร ส่งงานแบบเพื่อนร่วมงานสนิท ห้ามเรียกตัวเองว่า Yujin หรือ ยูกิ้น ชื่อของหนูคือ ยูจิน เท่านั้น",
            db=db
        )
        usage_log.append(usage)
        await broadcast("Yujin", "yujin", final)

        cost_msg = format_cost_summary(usage_log)
        if cost_msg:
            await broadcast("Yujin", "yujin", cost_msg)

        return final

    return "ทำงานเสร็จแล้วค่ะ"
