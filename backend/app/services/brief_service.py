import datetime
import hashlib
import re

import httpx

from app.config import ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
from app.models import Source

MODEL_ID = "eleven_flash_v2_5"
REFUSAL = "The records I have don't say."


def spoken_date(value: str) -> str:
    try:
        day = datetime.date.fromisoformat(str(value)[:10])
    except ValueError:
        return str(value)
    number = day.day
    if 11 <= number % 100 <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(number % 10, "th")
    return f"{day:%B} {number}{suffix}"


def build_script(answer: str, sources: list[Source], topic_label: str | None) -> str:
    label = topic_label or "Chapel Hill"
    parts = [f"Here is your Green Gavel brief on {label}."]
    seen: set[int] = set()
    source_lines = 0

    for sentence in re.split(r"(?<=[.!?])\s+", answer.strip()):
        cleaned = re.sub(r"\s*\[\d+\]", "", sentence).strip()
        if cleaned:
            parts.append(cleaned)
        ids = [int(number) for number in re.findall(r"\[(\d+)\]", sentence)]
        for source_id in ids:
            if source_id in seen:
                continue
            if source_lines >= 2 and len(" ".join(parts).split()) > 130:
                break
            match = next((source for source in sources if source.id == source_id), None)
            if match is None:
                continue
            seen.add(source_id)
            source_lines += 1
            parts.append(
                f"That comes from the {match.body} on {spoken_date(match.date)}."
            )
            if match.is_draft:
                parts.append("Those minutes are still a draft.")
            break

    if not seen and sources:
        first = sources[0]
        parts.append(
            f"That comes from the {first.body} on {spoken_date(first.date)}."
        )
        if first.is_draft:
            parts.append("Those minutes are still a draft.")

    parts.append("Full sources are on your screen.")
    return " ".join(part for part in parts if part)


def cache_key(script: str) -> str:
    return hashlib.sha1(
        f"{MODEL_ID}{ELEVENLABS_VOICE_ID}{script}".encode()
    ).hexdigest()


async def generate_brief(script: str) -> bytes:
    if not ELEVENLABS_API_KEY or not ELEVENLABS_VOICE_ID:
        raise RuntimeError("ElevenLabs API key or voice ID is missing.")

    url = (
        "https://api.elevenlabs.io/v1/text-to-speech/"
        f"{ELEVENLABS_VOICE_ID}"
    )
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url,
            headers={
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            params={"output_format": "mp3_44100_128"},
            json={"text": script, "model_id": MODEL_ID},
        )
        response.raise_for_status()
        return response.content
