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
        "name": "Gemini 2.5 Flash (Latest)",
        "provider": "google",
        "description": "ฉลาด เร็ว ราคาสมเหตุ เหมาะงานทั่วไป วิเคราะห์ข้อมูล เขียนโค้ด",
        "strengths": ["reasoning", "coding", "analysis", "multilingual"],
        "speed": "fast",
        "cost": "medium",
    },
    {
        "id": "gemini-2.5-pro",
        "name": "Gemini 2.5 Pro (Smartest)",
        "provider": "google",
        "description": "ฉลาดที่สุดใน Gemini เหมาะงานซับซ้อน วางแผน วิเคราะห์เชิงลึก แต่ช้าและแพงกว่า",
        "strengths": ["complex reasoning", "deep analysis", "planning", "long context"],
        "speed": "slow",
        "cost": "high",
    },
    {
        "id": "gemini-2.0-flash",
        "name": "Gemini 2.0 Flash",
        "provider": "google",
        "description": "เบาและเร็วมาก ราคาถูกสุดในค่าย Gemini เหมาะงานง่ายซ้ำๆ สรุปข้อความ",
        "strengths": ["summarization", "simple tasks", "high volume"],
        "speed": "very fast",
        "cost": "low",
    },
    {
        "id": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        "name": "Llama 3.3 70B Turbo",
        "provider": "deepinfra",
        "description": "70B parameters ฉลาดมาก ดีเทียบเท่า GPT-4o เหมาะงานวิเคราะห์ reasoning เขียนโค้ด ราคาถูกกว่า Gemini Pro",
        "strengths": ["reasoning", "coding", "instruction following", "analysis"],
        "speed": "medium",
        "cost": "medium",
    },
    {
        "id": "meta-llama/Llama-4-Scout-17B-16E-Instruct",
        "name": "Llama 4 Scout 17B",
        "provider": "deepinfra",
        "description": "รุ่นใหม่ล่าสุดจาก Meta, MoE architecture context window ยาว 320k เหมาะงานที่ต้องอ่านเอกสารยาว",
        "strengths": ["long context", "document analysis", "multimodal", "fast inference"],
        "speed": "fast",
        "cost": "low",
    },
    {
        "id": "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
        "name": "Llama 3.1 8B Turbo",
        "provider": "deepinfra",
        "description": "เล็กและเร็วที่สุด ราคาถูกมาก ($0.02/M) เหมาะ worker ที่ทำงานซ้ำๆ ปริมาณมาก เช่น ดึงข้อมูล แปลง format",
        "strengths": ["speed", "high volume", "data extraction", "formatting"],
        "speed": "very fast",
        "cost": "very low",
    },
]
