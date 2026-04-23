from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    postgres_host: str
    postgres_port: int = 5432
    postgres_db: str
    postgres_user: str
    postgres_password: str
    gemini_api_key: str
    default_llm_model: str = "gemini-2.0-flash-exp"
    yujin_llm_model: str = "gemini-2.0-flash-exp"

    class Config:
        env_file = ".env"

settings = Settings()

AVAILABLE_MODELS = [
    {"id": "gemini-2.0-flash-exp", "name": "Gemini 2.0 Flash", "provider": "google"},
    {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "provider": "google"},
    {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "provider": "google"},
]
