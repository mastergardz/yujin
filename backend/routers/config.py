from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from models.models import YujinConfig
from core.config import AVAILABLE_MODELS, settings
from pydantic import BaseModel

router = APIRouter(prefix="/api/config", tags=["config"])

def mask(key: str) -> str:
    if not key or len(key) < 12:
        return "ยังไม่ได้ตั้ง"
    return key[:8] + "..." + key[-4:]

class ConfigUpdate(BaseModel):
    llm_model: str

class ApiKeyUpdate(BaseModel):
    provider: str
    api_key: str

@router.get("/")
async def get_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(YujinConfig).where(YujinConfig.id == 1))
    config = result.scalar_one_or_none()
    return {
        "llm_model": config.llm_model if config else settings.yujin_llm_model,
        "available_models": AVAILABLE_MODELS,
        "keys": {
            "google": mask(config.api_key if config else settings.gemini_api_key),
            "deepinfra": mask(config.deepinfra_api_key if config else settings.deepinfra_api_key),
        }
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
    if not config:
        config = YujinConfig(id=1)
        db.add(config)
    if data.provider == "google":
        config.api_key = data.api_key
    elif data.provider == "deepinfra":
        config.deepinfra_api_key = data.api_key
    await db.commit()
    return {"success": True}
