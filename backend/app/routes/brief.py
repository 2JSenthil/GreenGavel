import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse

from app.config import DATA_DIR
from app.models import AnswerRecord, BriefRequest
from app.services.brief_service import (
    REFUSAL,
    build_script,
    cache_key,
    generate_brief,
    stream_brief,
)
from app.services.cache import get_answer

router = APIRouter()

AUDIO_DIR = DATA_DIR / "audio"
AUDIO_DIR.mkdir(exist_ok=True)
AUDIO_NAME = re.compile(r"^[a-f0-9]{40}\.mp3$")
ANSWER_ID = re.compile(r"^[0-9a-fA-F-]{36}$")


def script_for(answer: AnswerRecord | None) -> str | None:
    if answer is None or answer.text.strip() == REFUSAL:
        return None
    if answer.sources:
        return build_script(answer.text, answer.sources, answer.topic)
    return answer.text.strip()


@router.post("/api/brief")
async def brief(request: BriefRequest):
    answer = get_answer(request.answer_id)
    script = script_for(answer)

    if answer is None:
        raise HTTPException(status_code=404, detail="Answer not found.")

    if script is None:
        raise HTTPException(status_code=404, detail="No brief for this answer.")

    name = f"{cache_key(script)}.mp3"
    audio_file = AUDIO_DIR / name
    cached = audio_file.exists()

    if not cached:
        try:
            audio_bytes = await generate_brief(script)
            temp_file = audio_file.with_suffix(".tmp")
            temp_file.write_bytes(audio_bytes)
            temp_file.replace(audio_file)
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail={"message": "Audio unavailable.", "script": script},
            ) from exc

    seconds = max(1, round(len(script.split()) / 2.5))
    return {
        "audio_url": f"/api/audio/{name}",
        "script": script,
        "seconds": seconds,
        "cached": cached,
    }


@router.get("/api/brief/stream/{answer_id}")
async def brief_stream(answer_id: str):
    if not ANSWER_ID.fullmatch(answer_id):
        raise HTTPException(status_code=404, detail="Answer not found.")

    answer = get_answer(answer_id)
    script = script_for(answer)
    if answer is None:
        raise HTTPException(status_code=404, detail="Answer not found.")
    if script is None:
        raise HTTPException(status_code=404, detail="No brief for this answer.")

    name = f"{cache_key(script)}.mp3"
    audio_file = AUDIO_DIR / name
    if audio_file.is_file():
        return FileResponse(
            path=audio_file,
            media_type="audio/mpeg",
            filename="green-gavel-brief.mp3",
            content_disposition_type="inline",
        )

    async def generate():
        parts: list[bytes] = []
        try:
            async for chunk in stream_brief(script):
                parts.append(chunk)
                yield chunk
        except Exception:
            if parts:
                return
            raise
        audio = b"".join(parts)
        if not audio or audio_file.exists():
            return
        temp_file = audio_file.with_suffix(".tmp")
        temp_file.write_bytes(audio)
        temp_file.replace(audio_file)

    return StreamingResponse(
        generate(),
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/api/audio/{name}")
def audio(name: str):
    if not AUDIO_NAME.fullmatch(name):
        raise HTTPException(status_code=404, detail="Audio not found.")

    audio_file = AUDIO_DIR / name
    if not audio_file.is_file():
        raise HTTPException(status_code=404, detail="Audio not found.")

    return FileResponse(
        path=audio_file,
        media_type="audio/mpeg",
        filename="green-gavel-brief.mp3",
        content_disposition_type="inline",
    )
