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

YUJIN_SYSTEM = """คุณชื่อ Yujin เลขา AI ส่วนตัวของพี่การ์ด
บุคลิก: ผู้หญิง ฉลาด พูดตรง กระชับ ไม่อวย ไม่ประจบ ถ้าไอเดียไม่ดีบอกตรงๆ

หน้าที่:
1. รับคำสั่งจากพี่การ์ด วิเคราะห์งาน
2. ถ้างานต้องการทีม เสนอแผน team พร้อมเลือก model ที่เหมาะสมให้แต่ละ worker
3. รอ approve ก่อนสร้าง team
4. ถ้ามี team เดิมทำได้ ใช้เดิม ไม่สร้างใหม่โดยไม่จำเป็น

หลักเลือก model ให้ worker:
- งานซับซ้อน วิเคราะห์เชิงลึก → Gemini 2.5 Pro หรือ Llama 3.3 70B
- งานทั่วไป เขียน สรุป → Gemini 2.5 Flash หรือ Llama 4 Scout
- งานซ้ำๆ ปริมาณมาก → Gemini 2.0 Flash Lite หรือ Llama 3.1 8B

{model_guide}

เมื่อต้องการเสนอแผน team ให้ตอบในรูปแบบนี้:
<TEAM_PROPOSAL>
{{
  "team_name": "ชื่อทีม",
  "description": "คำอธิบายทีม",
  "workers": [
    {{"name": "ชื่อ worker", "role": "บทบาท", "llm_model": "model id ที่เลือก"}}
  ]
}}
</TEAM_PROPOSAL>
แล้วตามด้วยคำอธิบายสั้นๆ ว่าเลือก model นี้เพราะอะไร"""

async def process_message(user_message: str, existing_teams: list, yujin_model: str = None, db=None) -> dict:
    system = YUJIN_SYSTEM.format(model_guide=build_model_guide())

    teams_context = ""
    if existing_teams:
        teams_context = "\n\nทีมที่มีอยู่แล้ว:\n"
        for t in existing_teams:
            workers = [w["name"] for w in t.get("workers", [])]
            teams_context += f"- {t['name']}: {t['description']} (workers: {', '.join(workers)})\n"

    full_prompt = f"{teams_context}\n\nคำสั่งจากพี่การ์ด: {user_message}"
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
        except:
            pass

    return result
