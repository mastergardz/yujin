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
    # Google Gemini
    {"id": "gemini-2.5-flash",    "name": "Gemini 2.5 Flash (Latest)", "provider": "google"},
    {"id": "gemini-2.5-pro",      "name": "Gemini 2.5 Pro (Smartest)", "provider": "google"},
    {"id": "gemini-2.0-flash-lite","name": "Gemini 2.0 Flash Lite",    "provider": "google"},
    {"id": "gemini-3-flash-preview","name": "Gemini 3 Flash (Preview)", "provider": "google"},
    # Meta Llama via DeepInfra
    {"id": "meta-llama/Llama-3.3-70B-Instruct-Turbo",  "name": "Llama 3.3 70B Turbo",  "provider": "deepinfra"},
    {"id": "meta-llama/Llama-4-Scout-17B-16E-Instruct", "name": "Llama 4 Scout 17B",    "provider": "deepinfra"},
    {"id": "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo","name": "Llama 3.1 8B Turbo", "provider": "deepinfra"},
]
