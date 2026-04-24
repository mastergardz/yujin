import asyncio
import os
import json
import csv
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

# ============================================================
# SHELL TOOL
# ============================================================
async def shell_tool(command: str, working_dir: str = "/root") -> dict:
    """Worker executes a shell command on VPS"""
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            cwd=working_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        except asyncio.TimeoutError:
            proc.kill()
            return {"success": False, "stdout": "", "stderr": "Timeout after 30s", "returncode": -1}
        return {
            "success": proc.returncode == 0,
            "stdout": stdout.decode("utf-8", errors="replace")[:5000],
            "stderr": stderr.decode("utf-8", errors="replace")[:2000],
            "returncode": proc.returncode
        }
    except Exception as e:
        return {"success": False, "stdout": "", "stderr": str(e), "returncode": -1}


# ============================================================
# DB TOOL
# ============================================================
async def db_tool(query: str, params: Optional[dict] = None) -> dict:
    """Worker queries PostgreSQL database"""
    from core.database import AsyncSessionLocal
    from sqlalchemy import text
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(text(query), params or {})
            if query.strip().upper().startswith("SELECT"):
                rows = result.fetchall()
                columns = list(result.keys())
                cleaned = []
                for row in rows:
                    cleaned_row = {}
                    for k, v in zip(columns, row):
                        if hasattr(v, 'isoformat'):
                            cleaned_row[k] = v.isoformat()
                        elif not isinstance(v, (str, int, float, bool, type(None))):
                            cleaned_row[k] = str(v)
                        else:
                            cleaned_row[k] = v
                    cleaned.append(cleaned_row)
                return {"success": True, "rows": cleaned, "count": len(cleaned)}
            else:
                await session.commit()
                return {"success": True, "rows": [], "count": 0, "message": "Query executed"}
    except Exception as e:
        return {"success": False, "rows": [], "error": str(e)}


# ============================================================
# FILE TOOL
# ============================================================
FILES_DIR = Path("/root/yujin/backend/generated_files")
FILES_DIR.mkdir(exist_ok=True)

async def file_tool(filename: str, content: str, file_type: str = "txt") -> dict:
    """Worker creates a file and returns download info"""
    try:
        safe_name = "".join(c for c in filename if c.isalnum() or c in "._- ").strip() or "output"
        uid = str(uuid.uuid4())[:8]

        if file_type == "csv":
            fname = f"{uid}_{safe_name}.csv"
            fpath = FILES_DIR / fname
            lines = content.split("\n")
            with open(fpath, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                for line in lines:
                    if line.strip():
                        writer.writerow(line.split(","))

        elif file_type == "json":
            fname = f"{uid}_{safe_name}.json"
            fpath = FILES_DIR / fname
            try:
                data = json.loads(content)
                fpath.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            except Exception:
                fpath.write_text(content, encoding="utf-8")

        elif file_type in ("xlsx", "excel"):
            try:
                import openpyxl
                fname = f"{uid}_{safe_name}.xlsx"
                fpath = FILES_DIR / fname
                wb = openpyxl.Workbook()
                ws = wb.active
                for line in content.split("\n"):
                    if line.strip():
                        ws.append(line.split(","))
                wb.save(fpath)
            except ImportError:
                fname = f"{uid}_{safe_name}.csv"
                fpath = FILES_DIR / fname
                fpath.write_text(content, encoding="utf-8")

        elif file_type == "pdf":
            try:
                from reportlab.lib.pagesizes import A4
                from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
                from reportlab.lib.styles import getSampleStyleSheet
                fname = f"{uid}_{safe_name}.pdf"
                fpath = FILES_DIR / fname
                doc = SimpleDocTemplate(str(fpath), pagesize=A4)
                styles = getSampleStyleSheet()
                story = []
                for line in content.split("\n"):
                    story.append(Paragraph(line if line.strip() else " ", styles["Normal"]))
                    story.append(Spacer(1, 4))
                doc.build(story)
            except ImportError:
                fname = f"{uid}_{safe_name}.txt"
                fpath = FILES_DIR / fname
                fpath.write_text(content, encoding="utf-8")

        else:
            fname = f"{uid}_{safe_name}.txt"
            fpath = FILES_DIR / fname
            fpath.write_text(content, encoding="utf-8")

        return {
            "success": True,
            "filename": fname,
            "path": str(fpath),
            "download_url": f"/api/files/download/{fname}",
            "size": fpath.stat().st_size
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============================================================
# IMAGE TOOL — Gemini native image generation
# Supports: gemini-2.5-flash-image, gemini-3.1-flash-image-preview, gemini-3-pro-image-preview
# ============================================================
IMAGE_MODELS = {
    "fast": "gemini-2.5-flash-image",       # ถูก เร็ว
    "preview": "gemini-3.1-flash-image-preview",  # Nano Banana 2
    "pro": "gemini-3-pro-image-preview",     # Nano Banana Pro
}
DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image"

async def image_tool(prompt: str, filename: str = "image", model: str = None, db=None) -> dict:
    """Worker generates an image using Gemini native image generation"""
    try:
        from google import genai
        from google.genai import types
        from services.llm import get_keys

        keys = await get_keys(db)
        gemini_key = keys.get("gemini", "")
        if not gemini_key or gemini_key == "placeholder":
            return {"success": False, "error": "ยังไม่ได้ตั้ง Gemini API Key ค่ะ — ไปตั้งได้ที่หน้า Settings"}

        client = genai.Client(api_key=gemini_key)
        # model id ที่ใช้ได้จริงกับ Gemini image gen API
        MODEL_MAP = {
            "gemini-2.5-flash-image": "gemini-2.0-flash-preview-image-generation",
            "gemini-3.1-flash-image-preview": "gemini-2.0-flash-preview-image-generation",
            "gemini-3-pro-image-preview": "gemini-2.0-flash-preview-image-generation",
        }
        raw_model = model or DEFAULT_IMAGE_MODEL
        model_id = MODEL_MAP.get(raw_model, "gemini-2.0-flash-preview-image-generation")

        response = client.models.generate_content(
            model=model_id,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
            ),
        )

        image_data = None
        mime = "image/png"
        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                image_data = part.inline_data.data
                mime = part.inline_data.mime_type
                break

        if not image_data:
            return {"success": False, "error": "No image in response"}

        uid = str(uuid.uuid4())[:8]
        safe_name = "".join(c for c in filename if c.isalnum() or c in "._- ").strip() or "image"
        ext = "png" if "png" in mime else "jpg"
        fname = f"{uid}_{safe_name}.{ext}"
        fpath = FILES_DIR / fname

        import base64
        fpath.write_bytes(base64.b64decode(image_data) if isinstance(image_data, str) else image_data)

        return {
            "success": True,
            "filename": fname,
            "path": str(fpath),
            "download_url": f"/api/files/download/{fname}",
            "image_url": f"/api/files/download/{fname}",
            "model_used": model_id,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============================================================
# TOOL REGISTRY — map name -> function + description
# ============================================================
TOOLS = {
    "shell_tool": {
        "fn": shell_tool,
        "description": "รัน shell command บน VPS ได้",
        "params": {"command": "str", "working_dir": "str (optional)"}
    },
    "db_tool": {
        "fn": db_tool,
        "description": "Query/write PostgreSQL database",
        "params": {"query": "SQL string", "params": "dict (optional)"}
    },
    "file_tool": {
        "fn": file_tool,
        "description": "สร้างไฟล์ txt/csv/json/xlsx/pdf ให้ download",
        "params": {"filename": "str", "content": "str", "file_type": "txt|csv|json|xlsx|pdf"}
    },
    "image_tool": {
        "fn": image_tool,
        "description": "สร้างรูปด้วย Gemini image generation (gemini-2.5-flash-image, gemini-3.1-flash-image-preview, gemini-3-pro-image-preview)",
        "params": {"prompt": "str", "filename": "str (optional)", "model": "gemini-2.5-flash-image|gemini-3.1-flash-image-preview|gemini-3-pro-image-preview (optional)"}
    },
}
