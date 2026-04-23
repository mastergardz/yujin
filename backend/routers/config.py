from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from models.models import YujinConfig
from core.config import AVAILABLE_MODELS, settings
from pydantic import BaseModel

router = APIRouter(prefix="/api/config", tags=["config"])

class ConfigUpdate(BaseModel):
    llm_model: str

@router.get("/")
async def get_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(YujinConfig).where(YujinConfig.id == 1))
    config = result.scalar_one_or_none()
    return {
        "llm_model": config.llm_model if config else settings.yujin_llm_model,
        "available_models": AVAILABLE_MODELS
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
