from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import httpx, base64, os

router = APIRouter(prefix="/api/ai", tags=["ai"])

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

SKILL_CREATOR_SYSTEM = """You are a Skill Creator expert for Yujin AI Secretary system. Help design high-quality skill .md files for AI agents.

A great skill .md file follows this structure:

```
---
name: <skill-name>
description: <one-line description>
---

# <Skill Title>

## When to use
<Clear trigger conditions>

## Instructions
<Step-by-step instructions>

## Output format
<What the output should look like>

## Examples
<1-2 concrete examples>

## Notes
<Edge cases, warnings>
```

If the skill needs reference files, list them as `references/filename.md` in the content.

Rules:
1. Be specific and actionable
2. Use imperative language
3. Include trigger conditions
4. Keep it concise
5. If reference files are needed, mention them as `references/xxx.md`

Always respond in the same language the user writes in."""

ROLE_MAP = {"assistant": "model", "user": "user"}

class AIRequest(BaseModel):
    message: str
    history: Optional[list] = []
    gemini_api_key: str

@router.post("/chat")
async def ai_chat(data: AIRequest):
    if not data.gemini_api_key:
        raise HTTPException(status_code=400, detail="Gemini API key required")

    contents = []
    for msg in data.history:
        role = ROLE_MAP.get(msg["role"], msg["role"])
        parts = []
        if msg.get("content"):
            parts.append({"text": msg["content"]})
        if msg.get("files"):
            for f in msg["files"]:
                if f.get("type") == "image":
                    parts.append({"inline_data": {"mime_type": f["mime_type"], "data": f["data"]}})
                elif f.get("type") == "text":
                    parts.append({"text": f"[File: {f['name']}]\n{f['data']}"})
        if parts:
            contents.append({"role": role, "parts": parts})

    user_parts = []
    if data.message:
        user_parts.append({"text": data.message})
    contents.append({"role": "user", "parts": user_parts})

    payload = {
        "system_instruction": {"parts": [{"text": SKILL_CREATOR_SYSTEM}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 8192}
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(f"{GEMINI_URL}?key={data.gemini_api_key}", json=payload)

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Gemini error: {resp.text}")

    result = resp.json()
    text = result["candidates"][0]["content"]["parts"][0]["text"]
    return {"reply": text}


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    ext = os.path.splitext(file.filename or "")[1].lower()
    mime = file.content_type or ""

    if mime.startswith("image/") or ext in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
        b64 = base64.b64encode(content).decode()
        mime_type = mime if mime.startswith("image/") else f"image/{ext.lstrip('.')}" 
        return {"type": "image", "name": file.filename, "mime_type": mime_type, "data": b64}

    try:
        text = content.decode("utf-8")
    except Exception:
        try:
            text = content.decode("latin-1")
        except Exception:
            raise HTTPException(status_code=400, detail="Cannot read file as text")
    return {"type": "text", "name": file.filename, "data": text}
