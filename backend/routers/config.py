from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from core.database import get_db
from models.models import YujinConfig
from core.config import AVAILABLE_MODELS, settings
from pydantic import BaseModel
import google.genai as genai_module

router = APIRouter(prefix="/api/config", tags=["config"])

class ConfigUpdate(BaseModel):
    llm_model: str

class ApiKeyUpdate(BaseModel):
    api_key: str

@router.get("/")
async def get_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(YujinConfig).where(YujinConfig.id == 1))
    config = result.scalar_one_or_none()
    current_key = config.api_key if config and config.api_key else settings.gemini_api_key
    masked = current_key[:8] + "..." + current_key[-4:] if len(current_key) > 12 else "***"
    return {
        "llm_model": config.llm_model if config else settings.yujin_llm_model,
        "available_models": AVAILABLE_MODELS,
        "api_key_masked": masked,
        "has_api_key": bool(current_key)
    }

@router.put("/")
async def update_config(data: ConfigUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(YujinConfig).where(YujinConfig.id == 1))
    config = result.scalar_one_or_none()
    if config:
        config.llm_model = data.llm_model
    else:
        config = YujinConfig(id=1, llm_model=data.llm_model)
        db.add(config)
    await db.commit()
    return {"success": True, "llm_model": data.llm_model}

@router.put("/apikey")
async def update_api_key(data: ApiKeyUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(YujinConfig).where(YujinConfig.id == 1))
    config = result.scalar_one_or_none()
    if config:
        config.api_key = data.api_key
    else:
        config = YujinConfig(id=1, api_key=data.api_key)
        db.add(config)
    await db.commit()
    settings.gemini_api_key = data.api_key
    return {"success": True}
