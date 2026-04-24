from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from services.llm import get_keys
from pathlib import Path
import base64, mimetypes, re

router = APIRouter(prefix="/api/files", tags=["files"])

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "text/plain", "text/csv", "text/markdown",
    "application/json",
}

MAX_SIZE = 20 * 1024 * 1024  # 20MB
FILES_DIR = Path("/root/yujin/backend/generated_files")
FILES_DIR.mkdir(exist_ok=True)


@router.post("/analyze")
async def analyze_file(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "ไฟล์ใหญ่เกิน 20MB ค่ะ")

    mime = file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
    if mime not in ALLOWED_TYPES:
        raise HTTPException(400, f"ไม่รองรับไฟล์ประเภท {mime} ค่ะ")

    keys = await get_keys(db)
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=keys["gemini"])

    if mime.startswith("image/"):
        prompt = "วิเคราะห์รูปภาพนี้อย่างละเอียด บอกว่ามีอะไรในรูป ข้อความ ตัวเลข กราฟ หรือข้อมูลสำคัญอะไรบ้าง ตอบเป็นภาษาไทย"
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=content, mime_type=mime),
                prompt
            ]
        )
    elif mime == "application/pdf":
        prompt = "อ่านและสรุปเนื้อหาของ PDF นี้อย่างละเอียด ครอบคลุมประเด็นสำคัญทั้งหมด ตอบเป็นภาษาไทย"
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=content, mime_type="application/pdf"),
                prompt
            ]
        )
    else:
        try:
            text_content = content.decode("utf-8")
        except Exception:
            text_content = content.decode("latin-1")
        prompt = f"อ่านและสรุปเนื้อหาของไฟล์นี้อย่างละเอียด:\n\n{text_content[:50000]}"
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

    return {
        "filename": file.filename,
        "mime_type": mime,
        "size": len(content),
        "analysis": response.text
    }


@router.get("/download/{filename}")
async def download_file(filename: str):
    """Serve generated files for download"""
    # Security: only allow safe filenames, no path traversal
    safe = re.sub(r'[^a-zA-Z0-9._\- ]', '', filename)
    if safe != filename or ".." in filename:
        raise HTTPException(400, "Invalid filename")
    
    fpath = FILES_DIR / filename
    if not fpath.exists():
        raise HTTPException(404, "ไม่พบไฟล์ค่ะ")
    
    media_type, _ = mimetypes.guess_type(str(fpath))
    return FileResponse(
        path=str(fpath),
        filename=filename,
        media_type=media_type or "application/octet-stream"
    )
