import json
import re
import asyncio
from services.llm import call_llm_with_usage
from services.worker_tools import TOOLS, shell_tool, db_tool, file_tool, image_tool
from models.models import ProjectMessage, ProjectMember, Project
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

async def save_proj_msg(db: AsyncSession, project_id, sender: str, sender_type: str, content: str):
    msg = ProjectMessage(project_id=project_id, sender=sender, sender_type=sender_type, content=content)
    db.add(msg)
    await db.commit()
    return msg

def format_cost_summary(usage_list: list) -> str:
    if not usage_list:
        return ""
    total_cost = sum(u["cost_usd"] for u in usage_list)
    total_tokens = sum(u["input_tokens"] + u["output_tokens"] for u in usage_list)
    by_model = {}
    for u in usage_list:
        m = u["model"]
        if m not in by_model:
            by_model[m] = {"input": 0, "output": 0, "cost": 0}
        by_model[m]["input"] += u["input_tokens"]
        by_model[m]["output"] += u["output_tokens"]
        by_model[m]["cost"] += u["cost_usd"]
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
        cost_thb = data["cost"] * 35
        lines.append(f"• {name}: {data['input']:,}+{data['output']:,} tokens = ${data['cost']:.5f} (~฿{cost_thb:.3f})")
    total_thb = total_cost * 35
    lines.append(f"**รวม: ${total_cost:.5f} (~฿{total_thb:.3f})** | {total_tokens:,} tokens")
    return "\n".join(lines)

def parse_tool_call(text: str):
    patterns = [
        r'```tool_call\s*([\s\S]*?)```',
        r'<tool_call>([\s\S]*?)</tool_call>',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            try:
                data = json.loads(match.group(1))
                if "tool" in data:
                    return data["tool"], data.get("params", data.get("args", {}))
            except Exception:
                pass
    return None

def build_tool_instructions(capabilities: list) -> str:
    if not capabilities:
        return ""
    tool_docs = []
    for cap in capabilities:
        if cap in TOOLS:
            t = TOOLS[cap]
            tool_docs.append(f'- **{cap}**: {t["description"]}\n  params: {json.dumps(t["params"], ensure_ascii=False)}')
    if not tool_docs:
        return ""
    return (
        "\n\nคุณมี tools ต่อไปนี้:\n" + "\n".join(tool_docs) +
        "\n\nวิธีใช้: ตอบด้วย ```tool_call\n{\"tool\": \"ชื่อ\", \"params\": {...}}\n``` แล้วรอผล"
    )

IMAGE_MODEL_IDS = {"gemini-2.5-flash-image", "gemini-3.1-flash-image-preview", "gemini-3-pro-image-preview"}

async def run_worker_with_tools(member: ProjectMember, worker_task: str, big_task: str,
                                 usage_log: list, broadcast_fn=None, broadcast_typing_fn=None,
                                 db=None, prior_results: dict = None) -> str:
    capabilities = member.capabilities or []

    # ถ้ามี prior_results (ผลงานจาก worker ที่ตัวเองต้อง depends on) ให้ inject เข้า task
    task_with_context = worker_task
    if prior_results:
        context_block = "\n\n## ผลงานจากเพื่อนร่วมทีมที่ส่งมาให้คุณใช้:\n"
        for name, result in prior_results.items():
            context_block += f"### {name}:\n{result}\n\n"
        task_with_context = worker_task + context_block

    if member.llm_model in IMAGE_MODEL_IDS and "image_tool" in capabilities:
        if broadcast_typing_fn:
            await broadcast_typing_fn(member.name, "worker")
        if broadcast_fn:
            await broadcast_fn(member.name, "worker", "🔧 กำลังสร้างรูปค่ะ...")
        async def keep_typing():
            while True:
                await asyncio.sleep(3)
                if broadcast_typing_fn:
                    await broadcast_typing_fn(member.name, "worker")
        t = asyncio.create_task(keep_typing())
        try:
            tool_result = await image_tool(prompt=task_with_context, filename="image", model=member.llm_model, db=db)
        finally:
            t.cancel()
        if tool_result.get("success") and tool_result.get("download_url"):
            return "สร้างรูปเสร็จแล้วค่ะ\n![ภาพที่สร้าง](" + tool_result["download_url"] + ")"
        return "ขออภัยค่ะ สร้างรูปไม่สำเร็จ: " + tool_result.get("error", "unknown")

    tool_instructions = build_tool_instructions(capabilities)
    personality_line = f"นิสัย: {member.personality}" if member.personality else "บุคลิก: สุภาพ ฉลาด ทำงานเป็น"
    speech_line = f"สไตล์การพูด: {member.speech_style}" if member.speech_style else "ใช้คำลงท้าย คะ ค่ะ ขา ค่า"

    skill_block = ""
    if member.skills and db:
        from sqlalchemy import text as sa_text
        try:
            result = await db.execute(
                sa_text("SELECT name, content FROM yujin_skills WHERE id = ANY(:ids)"),
                {"ids": member.skills}
            )
            rows = result.fetchall()
            if rows:
                skill_block = "\n\n## Skills\n" + "\n\n".join(f"### {r.name}\n{r.content}" for r in rows)
        except Exception:
            pass

    system_prompt = (
        f"คุณชื่อ {member.name} เป็นผู้หญิง ทำหน้าที่ {member.role}\n"
        f"{personality_line}\n{speech_line}\n"
        f"เรียกตัวเองว่าหนู ส่งผลงานจริงๆ ไม่ใช่อธิบายว่าจะทำอะไร"
        + (f"\n{member.system_prompt}" if member.system_prompt else "")
        + skill_block + tool_instructions
    )

    user_prompt = (
        f"บทบาทของคุณ: {member.role}\nงานที่ได้รับ: {task_with_context}\n"
        f"บริบท: เป็นส่วนหนึ่งของงานใหญ่: {big_task}\n\n"
        f"สำคัญมาก: ส่งมอบผลงานจริงๆ เลย อย่าแค่บอกว่าจะทำอะไร"
    )

    history = [{"role": "user", "content": user_prompt}]
    final_reply = ""

    for _ in range(5):
        await broadcast_typing_fn(member.name, "worker")
        resp, usage = await call_llm_with_usage(
            history[-1]["content"] if len(history) == 1 else json.dumps(history),
            system_prompt, model=member.llm_model, db=db
        )
        usage_log.append(usage)
        tool_call = parse_tool_call(resp)
        if not tool_call:
            final_reply = resp
            break
        tool_name, params = tool_call
        clean = re.sub(r'```tool_call[\s\S]*?```', '', resp).strip()
        if clean and broadcast_fn:
            await broadcast_fn(member.name, "worker", clean)
        if broadcast_fn:
            await broadcast_fn(member.name, "worker", f"🔧 กำลังใช้ `{tool_name}`...")
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
                final_reply = "สร้างรูปเสร็จแล้วค่ะ\n![ภาพที่สร้าง](" + tool_result["download_url"] + ")"
                break
        result_str = json.dumps(tool_result, ensure_ascii=False)
        history.append({"role": "assistant", "content": resp})
        history.append({"role": "user", "content": f"ผลจาก {tool_name}:\n{result_str}\n\nสรุปและส่งผลงาน"})
        final_reply = f"[ผลจาก {tool_name}]\n{result_str}"

    return final_reply or resp


async def run_project_task(task: str, project_id, db: AsyncSession, broadcast_fn=None):
    import uuid as _uuid
    usage_log = []

    proj_result = await db.execute(select(Project).where(Project.id == _uuid.UUID(str(project_id))))
    project = proj_result.scalar_one_or_none()
    if not project:
        return "ไม่พบ project"

    members_result = await db.execute(select(ProjectMember).where(ProjectMember.project_id == project.id))
    members = members_result.scalars().all()

    async def broadcast(sender, sender_type, content):
        msg = await save_proj_msg(db, project.id, sender, sender_type, content)
        if broadcast_fn:
            await broadcast_fn({"id": str(msg.id), "sender": sender, "sender_type": sender_type,
                                 "content": content, "created_at": msg.created_at.isoformat()})

    async def broadcast_typing(sender, sender_type):
        if broadcast_fn:
            await broadcast_fn({"type": "typing", "sender": sender, "sender_type": sender_type})

    async def broadcast_msg(sender, sender_type, content):
        await broadcast(sender, sender_type, content)

    members_info = "\n".join([
        f"- {m.name}: {m.role}" + (f" [tools: {', '.join(m.capabilities)}]" if m.capabilities else "")
        for m in members
    ])

    plan_prompt = f"""งานที่ได้รับ: {task}

สมาชิกใน project:
{members_info}

วิเคราะห์งานแล้วมอบหมาย subtask ให้แต่ละคน พร้อมระบุว่างานใดต้องรอผลจากใครก่อน (dependency)

ตัวอย่าง:
- งาน parallel: researcher หลายคนค้นคนละเรื่อง, แปลหลายภาษาพร้อมกัน → depends_on: null
- งาน sequential: writer เขียนก่อน แล้ว designer สร้างภาพประกอบ → depends_on: "ชื่อ writer"

ตอบในรูปแบบ JSON เท่านั้น:
{{
  "summary": "สรุปแผนงานและอธิบายว่างานไหน parallel ไหน sequential",
  "assignments": [
    {{"worker": "ชื่อ", "task": "งานที่มอบหมาย", "depends_on": null}},
    {{"worker": "ชื่อ", "task": "งานที่ต้องรอผลจากคนอื่น", "depends_on": "ชื่อ worker ที่ต้องรอ"}}
  ]
}}"""

    await broadcast_typing("ยูจิน", "yujin")
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
        plan = {"summary": plan_text, "assignments": [{"worker": members[0].name if members else "Worker", "task": task, "depends_on": None}]}

    summary = plan.get('summary', task)
    await broadcast("ยูจิน", "yujin", f"รับงานแล้วค่ะ — {summary}\n\nกำลังมอบหมายงานให้ทีม...")

    assignments = plan.get("assignments", [])

    # ── Dependency-aware execution ──────────────────────────────────────────
    # completed: worker_name -> result string
    completed: dict[str, str] = {}

    # รัน assignments โดยใช้ topological order ตาม depends_on
    # งานที่ depends_on null หรือ depends_on worker ที่เสร็จแล้ว → รันได้
    # ถ้ามีหลายงานพร้อมกัน → รัน parallel

    remaining = list(assignments)
    results = []

    while remaining:
        # หางานที่ ready (depends_on เป็น null หรือ depends_on อยู่ใน completed แล้ว)
        ready = []
        waiting = []
        for a in remaining:
            dep = a.get("depends_on")
            if dep is None or dep in completed:
                ready.append(a)
            else:
                waiting.append(a)

        if not ready:
            # circular dependency หรือ depends_on ชื่อผิด — รัน remaining ทั้งหมดเลย
            ready = remaining
            waiting = []

        # แจ้งการมอบหมายงาน
        for a in ready:
            dep = a.get("depends_on")
            dep_note = f" (ใช้ผลงานจาก {dep})" if dep and dep in completed else ""
            await broadcast("ยูจิน", "yujin", f"@{a['worker']} — {a['task']}{dep_note}")

        # รัน ready assignments — parallel ถ้ามีหลายคน
        async def run_one(assignment):
            worker_name = assignment["worker"]
            worker_task = assignment["task"]
            dep = assignment.get("depends_on")

            member = next((m for m in members if m.name == worker_name), members[0] if members else None)
            if not member:
                return worker_name, worker_task, f"ไม่พบ member: {worker_name}"

            # ส่ง prior result เป็น context ถ้า depends_on มีผลแล้ว
            prior = {dep: completed[dep]} if dep and dep in completed else None

            result = await run_worker_with_tools(
                member=member, worker_task=worker_task, big_task=task,
                usage_log=usage_log, broadcast_fn=broadcast_msg,
                broadcast_typing_fn=broadcast_typing, db=db,
                prior_results=prior,
            )
            return worker_name, worker_task, result

        if len(ready) == 1:
            worker_name, worker_task, worker_result = await run_one(ready[0])
            await broadcast(worker_name, "worker", worker_result)
            completed[worker_name] = worker_result
            results.append({"worker": worker_name, "task": worker_task, "result": worker_result})
        else:
            # parallel — รันพร้อมกัน แต่ broadcast แยกกัน
            tasks = [run_one(a) for a in ready]
            batch = await asyncio.gather(*tasks)
            for worker_name, worker_task, worker_result in batch:
                await broadcast(worker_name, "worker", worker_result)
                completed[worker_name] = worker_result
                results.append({"worker": worker_name, "task": worker_task, "result": worker_result})

        remaining = waiting
    # ────────────────────────────────────────────────────────────────────────

    if results:
        all_images = all("![" in r["result"] or "/api/files/download/" in r["result"] for r in results)
        if all_images:
            cost_msg = format_cost_summary(usage_log)
            if cost_msg:
                await broadcast("ยูจิน", "yujin", cost_msg)
            return results[0]["result"]

        summary_parts = "\n\n".join([f"**{r['worker']}:** {r['result']}" for r in results])
        summary_prompt = f"""งานต้นฉบับ: {task}

ผลงาน:
{summary_parts}

ส่งงานให้พี่เลยค่ะ ขึ้นต้นว่า "ส่งงานค่ะ พี่" แล้วนำเสนอผลงานจริงๆ"""

        await broadcast_typing("ยูจิน", "yujin")
        final, usage = await call_llm_with_usage(
            summary_prompt,
            "คุณชื่อ ยูจิน เลขา AI ผู้หญิง เรียกตัวเองว่าหนู เรียกผู้ใช้ว่าพี่ พูดสั้นกระชับ",
            db=db
        )
        usage_log.append(usage)
        await broadcast("ยูจิน", "yujin", final)

        cost_msg = format_cost_summary(usage_log)
        if cost_msg:
            await broadcast("ยูจิน", "yujin", cost_msg)

        review_parts = "\n".join([f"- **{r['worker']}**: {r['task']} | {r['result'][:200]}" for r in results])
        review_prompt = f"""งาน: {task}\n\nผลงาน:\n{review_parts}\n\nประเมินผล:\n📊 **ประเมินผลรอบนี้**\n| Worker | ⭐ | Workload | ความเห็น |\n|--------|-----|----------|---------|"""

        await broadcast_typing("ยูจิน", "yujin")
        review, usage = await call_llm_with_usage(
            review_prompt,
            "คุณชื่อ ยูจิน ประเมินผลงานตรงไปตรงมา ไม่อวย ถ้าไม่ดีบอกตรงๆ",
            db=db
        )
        usage_log.append(usage)
        await broadcast("ยูจิน", "yujin", review)
        return final

    return "ทำงานเสร็จแล้วค่ะ"
