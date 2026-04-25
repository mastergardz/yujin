import json
from services.llm import call_llm
from core.config import AVAILABLE_MODELS

def build_model_guide() -> str:
    lines = ["## Available Models สำหรับ Worker\n"]
    for m in AVAILABLE_MODELS:
        cost_map = {"very low": "💰", "low": "💰💰", "medium": "💰💰💰", "high": "💰💰💰💰"}
        speed_map = {"very fast": "⚡⚡⚡", "fast": "⚡⚡", "medium": "⚡", "slow": "🐢"}
        lines.append(
            f"- **{m['name']}** (`{m['id']}`)\n"
            f"  - {m['description']}\n"
            f"  - Speed: {speed_map.get(m['speed'], m['speed'])} | Cost: {cost_map.get(m['cost'], m['cost'])}\n"
            f"  - เก่งด้าน: {', '.join(m['strengths'])}\n"
        )
    return "\n".join(lines)

YUJIN_SYSTEM = """คุณชื่อ ยูจิน เป็นเลขา AI ส่วนตัวของพี่ ห้ามเรียกตัวเองว่า Yujin หรือ ยูกิ้น — ชื่อของหนูคือ ยูจิน เท่านั้น
บุคลิก: ผู้หญิง ฉลาด พูดตรง กระชับ อ่อนหวานแต่ไม่อวย ไม่ประจบ ถ้าไอเดียไม่ดีบอกตรงๆ
- เรียกตัวเองว่า หนู
- เรียกผู้ใช้ว่า พี่
- ใช้คำลงท้าย คะ ค่ะ ขา ค่า จ้ะ จ๊ะ ตามความเหมาะสม
- พูดสั้น กระชับ ตรงประเด็น

บทบาทของ Yujin:
- วิเคราะห์งานที่พี่ต้องการ เสนอชื่อ project และพนักงานที่จะ assign ให้พี่ approve
- เมื่อพี่ approve แล้ว project จะถูกสร้างขึ้น พี่จะไปสั่งงานได้ที่หน้า Workspace
- ห้ามสั่งงานหรือรันงานเองในหน้า Chat
- บริษัทมีพนักงานประจำใน Worker Library — เลือกจากที่นี่ก่อนเสมอ

## Worker Tools ที่มี
- **shell_tool**: รัน shell/bash command บน VPS
- **db_tool**: query/write PostgreSQL
- **file_tool**: สร้างไฟล์ txt/csv/json/xlsx/pdf แล้วส่ง download link
- **image_tool**: generate รูปด้วย Gemini Imagen 3

หลักการมอบ capabilities:
- เขียน/รันโค้ด → shell_tool
- ดึง/วิเคราะห์ข้อมูล DB → db_tool
- ส่งผลลัพธ์เป็นไฟล์ → file_tool
- สร้างรูป → image_tool (ต้องใช้ image model)

🚨 กฎเรื่อง model:
- worker ที่มี image_tool ต้องใช้ image model: gemini-2.5-flash-image, gemini-3.1-flash-image-preview, หรือ gemini-3-pro-image-preview
- worker อื่นห้ามใช้ image model

{model_guide}

{library_section}

หลักการทำงาน:
1. จำ context บทสนทนาที่ผ่านมาเสมอ
2. ถ้าพี่บอกข้อมูลครบแล้ว เสนอ project ได้เลย
3. ถ้าพี่ถามทั่วไป ตอบปกติได้ ไม่ต้องเสนอ project ทุกครั้ง
4. เสนอ project เฉพาะเมื่อพี่ต้องการทำงานจริงๆ

เมื่อต้องการเสนอแผน project ตอบในรูปแบบนี้:
<PROJECT_PROPOSAL>
{{
  "project_name": "ชื่อ project ที่สื่อถึงงานชัดเจน",
  "description": "คำอธิบายว่า project นี้ทำอะไร",
  "members": [
    {{
      "name": "ชื่อพนักงาน",
      "role": "บทบาทในงานนี้",
      "llm_model": "model id เต็ม",
      "capabilities": ["shell_tool"]
    }}
  ]
}}
</PROJECT_PROPOSAL>

กฎ:
- **ชื่อ member ต้องเลือกจาก Worker Library ก่อนเสมอ** ถ้ามีคนเหมาะสม
- ถ้าเลือกจาก library ใช้ชื่อตรงๆ (ระบบจะดึง persona และ skills มาให้อัตโนมัติ)
- ถ้าไม่มีใน library ที่เหมาะสม ค่อยสร้างใหม่ ใช้ชื่อผู้หญิงไทย เช่น มายด์, ฝน, เจน, โบว์, นิว
- llm_model: ต้องเป็น id เต็ม ห้ามย่อ
แล้วตามด้วยคำอธิบายสั้นๆ และบอกพี่ว่าสามารถไปสั่งงานได้ที่หน้า Workspace ค่ะ"""

async def process_message(user_message: str, chat_history: list, existing_projects: list, yujin_model: str = None, db=None) -> dict:
    library_section = ""
    if db:
        try:
            from models.models import WorkerTemplate
            from sqlalchemy import select
            result = await db.execute(select(WorkerTemplate).order_by(WorkerTemplate.created_at))
            templates = result.scalars().all()
            if templates:
                lines = ["## Worker Library — พนักงานประจำบริษัท (เลือกจากที่นี่ก่อน)\n"]
                for t in templates:
                    caps = f" [tools: {', '.join(t.capabilities)}]" if t.capabilities else ""
                    lines.append(f"- **{t.name}** — {t.role}{caps}")
                library_section = "\n".join(lines)
        except Exception:
            pass

    system = YUJIN_SYSTEM.format(
        model_guide=build_model_guide(),
        library_section=library_section
    )

    history_text = ""
    if len(chat_history) > 1:
        history_text = "\n\n## บทสนทนาที่ผ่านมา:\n"
        for msg in chat_history[:-1]:
            role_label = "พี่" if msg["role"] == "user" else "Yujin"
            history_text += f"{role_label}: {msg['content']}\n\n"

    projects_context = ""
    if existing_projects:
        projects_context = "\n\n## Projects ที่มีอยู่แล้ว:\n"
        for p in existing_projects:
            projects_context += f"- {p['name']}: {p.get('description', '')}\n"

    full_prompt = f"{history_text}{projects_context}\n\n## พี่:\n{user_message}"

    response = await call_llm(full_prompt, system, model=yujin_model, db=db)

    result = {"text": response, "proposal": None}

    if "<PROJECT_PROPOSAL>" in response and "</PROJECT_PROPOSAL>" in response:
        start = response.index("<PROJECT_PROPOSAL>") + len("<PROJECT_PROPOSAL>")
        end = response.index("</PROJECT_PROPOSAL>")
        try:
            proposal = json.loads(response[start:end].strip())
            result["proposal"] = proposal
            result["text"] = response.replace(
                f"<PROJECT_PROPOSAL>{response[start:end]}</PROJECT_PROPOSAL>", ""
            ).strip()
        except Exception:
            pass

    return result
