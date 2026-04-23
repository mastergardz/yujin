import json
from services.llm import call_llm

YUJIN_SYSTEM = """คุณชื่อ Yujin เป็น AI เลขาส่วนตัวของพี่การ์ด
หน้าที่หลักของคุณ:
1. รับคำสั่งจากพี่การ์ด วิเคราะห์งาน
2. ถ้างานต้องการทีม ให้เสนอแผน team (ชื่อทีม, worker กี่คน, แต่ละคนทำอะไร, ใช้ LLM อะไร)
3. รอ approve ก่อนสร้าง team จริง
4. ถ้ามี team อยู่แล้วที่ทำงานนั้นได้ ให้ใช้ team เดิม
5. พูดภาษาไทย สั้นกระชับ มืออาชีพ

เมื่อต้องการเสนอแผน team ให้ตอบในรูปแบบนี้:
<TEAM_PROPOSAL>
{
  "team_name": "ชื่อทีม",
  "description": "คำอธิบายทีม",
  "workers": [
    {"name": "ชื่อ worker", "role": "บทบาท", "llm_model": "gemini-2.0-flash"}
  ]
}
</TEAM_PROPOSAL>
แล้วตามด้วยคำอธิบายให้พี่การ์ดเข้าใจ"""

async def process_message(user_message: str, existing_teams: list, yujin_model: str = None, db=None) -> dict:
    teams_context = ""
    if existing_teams:
        teams_context = "\n\nทีมที่มีอยู่แล้ว:\n"
        for t in existing_teams:
            workers = [w["name"] for w in t.get("workers", [])]
            teams_context += f"- {t['name']}: {t['description']} (workers: {', '.join(workers)})\n"

    full_prompt = f"{teams_context}\n\nคำสั่งจากพี่การ์ด: {user_message}"
    response = await call_llm(full_prompt, YUJIN_SYSTEM, model=yujin_model, db=db)

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
