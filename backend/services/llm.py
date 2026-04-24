from google import genai
from google.genai import types
from openai import AsyncOpenAI
from core.config import settings, AVAILABLE_MODELS
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

def get_provider_for_model(model_id: str) -> str:
    for m in AVAILABLE_MODELS:
        if m["id"] == model_id:
            return m["provider"]
    return "google"

async def get_keys(db: AsyncSession = None) -> dict:
    keys = {"gemini": settings.gemini_api_key, "deepinfra": settings.deepinfra_api_key}
    if db:
        from models.models import YujinConfig
        result = await db.execute(select(YujinConfig).where(YujinConfig.id == 1))
        config = result.scalar_one_or_none()
        if config:
            if config.api_key:
                keys["gemini"] = config.api_key
            if config.deepinfra_api_key:
                keys["deepinfra"] = config.deepinfra_api_key
    return keys

async def call_llm(prompt: str, system: str = "", model: str = None, db: AsyncSession = None) -> str:
    model_name = model or settings.yujin_llm_model
    provider = get_provider_for_model(model_name)
    keys = await get_keys(db)

    if provider == "google":
        client = genai.Client(api_key=keys["gemini"])
        cfg = types.GenerateContentConfig(system_instruction=system if system else None)
        response = client.models.generate_content(model=model_name, contents=prompt, config=cfg)
        return response.text

    elif provider == "deepinfra":
        client = AsyncOpenAI(api_key=keys["deepinfra"], base_url="https://api.deepinfra.com/v1/openai")
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        response = await client.chat.completions.create(model=model_name, messages=messages)
        return response.choices[0].message.content

    raise ValueError(f"Unknown provider: {provider}")
