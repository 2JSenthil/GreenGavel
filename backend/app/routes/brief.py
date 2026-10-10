import hashlib

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.config import DATA_DIR
from app.models import BriefRequest
from app.services.brief_service import generate_brief
from app.services.cache import get_answer

router = APIRouter()

AUDIO_DIR = DATA_DIR / "audio"
AUDIO_DIR.mkdir(exist_ok=True)


@router.post("/api/brief")
async def brief(request: BriefRequest):
    answer = get_answer(request.answer_id)

    if answer is None:
        raise HTTPException(
            status_code=404,
            detail="Answer not found."
        )

    # Use a hash of the answer text to cache generated audio
    text_hash = hashlib.sha256(
        answer.text.encode("utf-8")
    ).hexdigest()

    audio_file = AUDIO_DIR / f"{text_hash}.mp3"

    if not audio_file.exists():
        try:
            audio_bytes = await generate_brief(answer.text)

            temp_file = audio_file.with_suffix(".tmp")
            temp_file.write_bytes(audio_bytes)
            temp_file.replace(audio_file)

        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail="Audio generation is unavailable."
            ) from exc

    return FileResponse(
        path=audio_file,
        media_type="audio/mpeg",
        filename="green-gavel-brief.mp3",
        content_disposition_type="inline"
    )