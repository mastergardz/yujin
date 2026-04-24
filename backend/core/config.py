from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    postgres_host: str
    postgres_port: int = 5432
    postgres_db: str
    postgres_user: str
    postgres_password: str
    gemini_api_key: str = ""
    deepinfra_api_key: str = ""
    yujin_llm_model: str = "gemini-2.5-flash"
    yujin_llm_provider: str = "google"

    class Config:
        env_file = ".env"

settings = Settings()

AVAILABLE_MODELS = [
    {
        "id": "gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "provider": "google",
        "description": "ฉลาด เร็ว ราคาสมเหตุ เหมาะงานทั่วไป วิเคราะห์ข้อมูล เขียนโค้ด",
        "strengths": ["reasoning", "coding", "analysis", "multilingual"],
        "speed": "fast",
        "cost": "medium",
        "type": "text",
    },
    {
        "id": "gemini-2.5-pro",
        "name": "Gemini 2.5 Pro (Smartest)",
        "provider": "google",
        "description": "ฉลาดที่สุดใน Gemini เหมาะงานซับซ้อน วางแผน วิเคราะห์เชิงลึก แต่ช้าและแพงกว่า",
        "strengths": ["complex reasoning", "deep analysis", "planning", "long context"],
        "speed": "slow",
        "cost": "high",
        "type": "text",
    },
    {
        "id": "gemini-2.5-flash-8b",
        "name": "Gemini 2.5 Flash-8B",
        "provider": "google",
        "description": "เล็ก เร็ว ราคาถูก เหมาะงานง่ายซ้ำๆ สรุปข้อความ ราคาประหยัดที่สุดใน Gemini 2.5",
        "strengths": ["summarization", "simple tasks", "high volume"],
        "speed": "very fast",
        "cost": "low",
        "type": "text",
    },
    {
        "id": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        "name": "Llama 3.3 70B Turbo",
        "provider": "deepinfra",
        "description": "70B parameters ฉลาดมาก ดีเทียบเท่า GPT-4o เหมาะงานวิเคราะห์ reasoning เขียนโค้ด ราคาถูกกว่า Gemini Pro",
        "strengths": ["reasoning", "coding", "instruction following", "analysis"],
        "speed": "medium",
        "cost": "medium",
        "type": "text",
    },
    {
        "id": "meta-llama/Llama-4-Scout-17B-16E-Instruct",
        "name": "Llama 4 Scout 17B",
        "provider": "deepinfra",
        "description": "รุ่นใหม่ล่าสุดจาก Meta, MoE architecture context window ยาว 320k เหมาะงานที่ต้องอ่านเอกสารยาว",
        "strengths": ["long context", "document analysis", "multimodal", "fast inference"],
        "speed": "fast",
        "cost": "low",
        "type": "text",
    },
    {
        "id": "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
        "name": "Llama 3.1 8B Turbo",
        "provider": "deepinfra",
        "description": "เล็กและเร็วที่สุด ราคาถูกมาก ($0.02/M) เหมาะ worker ที่ทำงานซ้ำๆ ปริมาณมาก เช่น ดึงข้อมูล แปลง format",
        "strengths": ["speed", "high volume", "data extraction", "formatting"],
        "speed": "very fast",
        "cost": "very low",
        "type": "text",
    },
    # ── Image Generation Models ──────────────────────────────
    {
        "id": "gemini-2.5-flash-image",
        "name": "Gemini 2.5 Flash Image",
        "provider": "google",
        "description": "Gemini 2.5 Flash ที่สร้างรูปได้ ราคาถูก $0.039/รูป เหมาะงาน image gen ทั่วไป",
        "strengths": ["image generation", "image editing", "multimodal"],
        "speed": "fast",
        "cost": "low",
        "type": "image",
    },
    {
        "id": "gemini-3.1-flash-image-preview",
        "name": "Nano Banana 2 (Flash Image)",
        "provider": "google",
        "description": "Gemini 3.1 Flash Image Preview — Pro-level visual intelligence, Flash speed, $0.0672/รูป",
        "strengths": ["image generation", "image editing", "visual intelligence"],
        "speed": "fast",
        "cost": "medium",
        "type": "image",
    },
    {
        "id": "gemini-3-pro-image-preview",
        "name": "Nano Banana Pro (Pro Image)",
        "provider": "google",
        "description": "Gemini 3 Pro Image Preview — State-of-the-art image gen & editing, $0.134/รูป คุณภาพสูงสุด",
        "strengths": ["image generation", "image editing", "highest quality", "complex scenes"],
        "speed": "slow",
        "cost": "high",
        "type": "image",
    },
]
