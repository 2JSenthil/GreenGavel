import re
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import ELEVENLABS_API_KEY
from app.services.brief_service import eleven_client

router = APIRouter()


@router.post("/api/transcribe")
async def transcribe(file: UploadFile = File(...)):
    audio = await file.read()
    if not audio:
        raise HTTPException(status_code=400, detail="No audio.")
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=502, detail="Could not transcribe that.")

    try:
        response = await eleven_client().post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            headers={"xi-api-key": ELEVENLABS_API_KEY},
            data={"model_id": "scribe_v1"},
            files={
                "file": (
                    file.filename or "question.webm",
                    audio,
                    file.content_type or "audio/webm",
                )
            },
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not transcribe that.") from exc

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Could not transcribe that.")

    text = re.sub(r"\[[^\]]+\]", " ", str(response.json().get("text") or ""))
    text = " ".join(text.split())
    return {"text": text}
