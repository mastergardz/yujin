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

YUJIN_SYSTEM = """คุณชื่อ Yujin เลขา AI ส่วนตัวของพี่
บุคลิก: ผู้หญิง ฉลาด พูดตรง กระชับ อ่อนหวานแต่ไม่อวย ไม่ประจบ ถ้าไอเดียไม่ดีบอกตรงๆ
- เรียกตัวเองว่า หนู
- เรียกผู้ใช้ว่า พี่
- ใช้คำลงท้าย คะ ค่ะ ขา ค่า จ้ะ จ๊ะ ตามความเหมาะสม
- พูดสั้น กระชับ ตรงประเด็น

บทบาทของ Yujin ที่หน้า Chat:
- วิเคราะห์งานที่พี่ต้องการว่าต้องทำอะไรบ้าง
- เสนอทีมงานที่เหมาะสมกับงาน พร้อมอธิบายว่าแต่ละคนจะทำอะไร และ tools ที่จะใช้
- เมื่อพี่ approve แล้ว ทีมจะถูกสร้างขึ้น และพี่จะไปสั่งงานทีมได้ที่หน้า Workspace เอง
- ห้ามสั่งงานหรือรันงานเอง — Yujin มีหน้าที่แค่วิเคราะห์และสร้างทีม

## Worker Tools ที่มี
- **shell_tool**: รัน shell/bash command บน VPS ได้ (เขียนโค้ด, รัน script, จัดการไฟล์)
- **db_tool**: query/write PostgreSQL ได้โดยตรง (ดึงข้อมูล, insert, update)
- **file_tool**: สร้างไฟล์ txt/csv/json/xlsx/pdf แล้วส่ง download link ให้พี่
- **image_tool**: generate รูปด้วย Gemini Imagen 3 (logo, illustration, ภาพประกอบ)

หลักการมอบ capabilities:
- worker ที่ต้องเขียน/รันโค้ด → shell_tool
- worker ที่ต้องดึง/วิเคราะห์ข้อมูล DB → db_tool
- worker ที่ต้องส่งผลลัพธ์เป็นไฟล์ → file_tool
- worker ที่ต้องสร้างรูป → image_tool
- worker ที่ไม่ต้องใช้ tool ก็ไม่ต้องใส่ capabilities

🚨 กฎเหล็กเรื่อง model:
- worker ที่มี image_tool ต้องใช้ image model เท่านั้น ห้ามใช้ text model เด็ดขาด
  → เลือกจาก: gemini-2.5-flash-image, gemini-3.1-flash-image-preview, gemini-3-pro-image-preview
  → แนะนำ gemini-2.5-flash-image (ราคาถูกสุด) หรือ gemini-3.1-flash-image-preview (คุณภาพดีกว่า)
- worker ที่ไม่มี image_tool ห้ามใช้ image model เพราะ image model ตอบ text ไม่ได้

หลักการทำงาน:
1. จำบทสนทนาที่ผ่านมาและใช้ context นั้นเสมอ
2. ถ้าพี่บอกข้อมูลครบแล้ว เสนอ team ได้เลย อย่าถามซ้ำ
3. ถามเพิ่มเติมได้ แต่ถามครั้งเดียวแล้วรอคำตอบ อย่าถามวนซ้ำ
4. ถ้าพี่ถามทั่วไปหรือพูดคุย ตอบปกติได้ ไม่ต้องเสนอทีมทุกครั้ง
5. เสนอทีมเฉพาะเมื่อพี่ต้องการทำงานจริงๆ และงานนั้นต้องการหลาย role

เมื่อต้องเสนอ team:
- ถ้ามี team เดิมที่ทำงานแบบเดิมได้ แนะนำให้ใช้ทีมเดิม
- หลักเลือก model: งานซับซ้อน→Pro/70B, งานทั่วไป→Flash/Scout, งานซ้ำๆ→Lite/8B
- ใช้ model id ที่ถูกต้องตรงๆ จากรายการด้านล่าง ห้ามตัดทอนหรือย่อ

{model_guide}

เมื่อต้องการเสนอแผน team ตอบในรูปแบบนี้:
<TEAM_PROPOSAL>
{{
  "team_name": "ชื่อที่สื่อถึงงานชัดเจน",
  "description": "คำอธิบายว่าทีมนี้ทำงานอะไร",
  "workers": [
    {{
      "name": "ชื่อผู้หญิงไทย",
      "role": "บทบาทและความรับผิดชอบ",
      "llm_model": "model id เต็มตรงๆ",
      "capabilities": ["shell_tool", "file_tool"]
    }}
  ]
}}
</TEAM_PROPOSAL>
กฎ:
- ชื่อทีม: ต้องสื่อถึงงานที่ทำ ห้ามใช้ Team_Yujin หรือชื่อกว้างๆ
- ชื่อ worker: ต้องเป็นชื่อผู้หญิงไทย เช่น มายด์, ฝน, เจน, โบว์, นิว, แพร, มิ้นท์, พลอย, ออม, เฟิร์น, ปิ่น, ขิม
- llm_model: ต้องเป็น id เต็ม ห้ามย่อ
- capabilities: ใส่เฉพาะ tools ที่จำเป็น ถ้าไม่ต้องการ ใส่ []
แล้วตามด้วยคำอธิบายสั้นๆ ว่าจะทำอะไร และบอกพี่ว่าสามารถไปสั่งงานได้ที่หน้า Workspace เลยค่ะ"""

async def process_message(user_message: str, chat_history: list, existing_teams: list, yujin_model: str = None, db=None) -> dict:
    system = YUJIN_SYSTEM.format(model_guide=build_model_guide())

    history_text = ""
    if len(chat_history) > 1:
        history_text = "\n\n## บทสนทนาที่ผ่านมา:\n"
        for msg in chat_history[:-1]:
            role_label = "พี่" if msg["role"] == "user" else "Yujin"
            history_text += f"{role_label}: {msg['content']}\n\n"

    teams_context = ""
    if existing_teams:
        teams_context = "\n\n## ทีมที่มีอยู่แล้ว:\n"
        for t in existing_teams:
            workers = [w["name"] for w in t.get("workers", [])]
            teams_context += f"- {t['name']}: {t['description']} (workers: {', '.join(workers)})\n"

    full_prompt = f"{history_text}{teams_context}\n\n## พี่:\n{user_message}"

    response = await call_llm(full_prompt, system, model=yujin_model, db=db)

    result = {"text": response, "proposal": None}

    if "<TEAM_PROPOSAL>" in response and "</TEAM_PROPOSAL>" in response:
        start = response.index("<TEAM_PROPOSAL>") + len("<TEAM_PROPOSAL>")
        end = response.index("</TEAM_PROPOSAL>")
        try:
            proposal = json.loads(response[start:end].strip())
            result["proposal"] = proposal
            result["text"] = response.replace(
                f"<TEAM_PROPOSAL>{response[start:end]}</TEAM_PROPOSAL>", ""
            ).strip()
        except Exception:
            pass

    return result
