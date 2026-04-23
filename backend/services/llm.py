from google import genai
from google.genai import types
from core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

async def get_api_key(db: AsyncSession = None) -> str:
    if db:
        from models.models import YujinConfig
        result = await db.execute(select(YujinConfig).where(YujinConfig.id == 1))
        config = result.scalar_one_or_none()
        if config and config.api_key:
            return config.api_key
    return settings.gemini_api_key

async def call_llm(prompt: str, system: str = "", model: str = None, db: AsyncSession = None) -> str:
    api_key = await get_api_key(db)
    client = genai.Client(api_key=api_key)
    model_name = model or settings.yujin_llm_model
    config = types.GenerateContentConfig(
        system_instruction=system if system else None,
    )
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=config,
    )
    return response.text
