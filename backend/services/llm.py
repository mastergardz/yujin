from google import genai
from google.genai import types
from core.config import settings

client = genai.Client(api_key=settings.gemini_api_key)

async def call_llm(prompt: str, system: str = "", model: str = None) -> str:
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
