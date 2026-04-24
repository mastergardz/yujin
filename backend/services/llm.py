from google import genai
from google.genai import types
from openai import AsyncOpenAI
from core.config import settings, AVAILABLE_MODELS
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Pricing per 1M tokens (input/output) in USD
MODEL_PRICING = {
    "gemini-2.5-flash":    {"input": 0.15,  "output": 0.60},
    "gemini-2.5-pro":      {"input": 1.25,  "output": 10.0},
    "gemini-2.0-flash-lite": {"input": 0.075, "output": 0.30},
    "meta-llama/Llama-3.3-70B-Instruct-Turbo":    {"input": 0.23, "output": 0.40},
    "meta-llama/Llama-4-Scout-17B-16E-Instruct":  {"input": 0.06, "output": 0.30},
    "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": {"input": 0.02, "output": 0.02},
}

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

def calc_cost(model_id: str, input_tokens: int, output_tokens: int) -> float:
    p = MODEL_PRICING.get(model_id, {"input": 0, "output": 0})
    return (input_tokens * p["input"] + output_tokens * p["output"]) / 1_000_000

async def call_llm(prompt: str, system: str = "", model: str = None, db: AsyncSession = None) -> str:
    """Returns text only — for backward compatibility"""
    text, _ = await call_llm_with_usage(prompt, system, model, db)
    return text

async def call_llm_with_usage(prompt: str, system: str = "", model: str = None, db: AsyncSession = None) -> tuple[str, dict]:
    """Returns (text, usage_dict) where usage = {input_tokens, output_tokens, cost_usd, model}"""
    model_name = model or settings.yujin_llm_model
    provider = get_provider_for_model(model_name)
    keys = await get_keys(db)

    if provider == "google":
        client = genai.Client(api_key=keys["gemini"])
        cfg = types.GenerateContentConfig(system_instruction=system if system else None)
        response = client.models.generate_content(model=model_name, contents=prompt, config=cfg)
        usage = response.usage_metadata
        input_t = getattr(usage, 'prompt_token_count', 0) or 0
        output_t = getattr(usage, 'candidates_token_count', 0) or 0
        return response.text, {
            "model": model_name, "input_tokens": input_t, "output_tokens": output_t,
            "cost_usd": calc_cost(model_name, input_t, output_t)
        }

    elif provider == "deepinfra":
        client = AsyncOpenAI(api_key=keys["deepinfra"], base_url="https://api.deepinfra.com/v1/openai")
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        response = await client.chat.completions.create(model=model_name, messages=messages)
        usage = response.usage
        input_t = getattr(usage, 'prompt_tokens', 0) or 0
        output_t = getattr(usage, 'completion_tokens', 0) or 0
        return response.choices[0].message.content, {
            "model": model_name, "input_tokens": input_t, "output_tokens": output_t,
            "cost_usd": calc_cost(model_name, input_t, output_t)
        }

    raise ValueError(f"Unknown provider: {provider}")
