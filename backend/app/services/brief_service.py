import hashlib
import re

import httpx

from app.config import ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
from app.models import Source

MODEL_ID = "eleven_flash_v2_5"
REFUSAL = "The records I have don't say."


def speakable(answer: str) -> str:
    text = re.sub(r"\s*\[\d+\]", "", answer)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"(?m)^\s*\*\s+", "", text)
    text = re.sub(r"\s+\*\s+", " ", text)
    text = text.replace("*", "")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def build_script(answer: str, sources: list[Source], topic_label: str | None) -> str:
    del topic_label
    spoken = speakable(answer)
    cited = {int(number) for number in re.findall(r"\[(\d+)\]", answer)}
    relevant = [source for source in sources if source.id in cited] or sources[:1]
    parts = [spoken]
    if any(source.is_draft for source in relevant):
        parts.append("Those minutes are still a draft.")
    return " ".join(part for part in parts if part)


def cache_key(script: str) -> str:
    return hashlib.sha1(
        f"{MODEL_ID}{ELEVENLABS_VOICE_ID}{script}".encode()
    ).hexdigest()


_client: httpx.AsyncClient | None = None


def eleven_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0))
    return _client


def _voice_request(script: str, stream: bool) -> tuple[str, dict]:
    if not ELEVENLABS_API_KEY or not ELEVENLABS_VOICE_ID:
        raise RuntimeError("ElevenLabs API key or voice ID is missing.")
    path = "stream" if stream else ""
    url = (
        "https://api.elevenlabs.io/v1/text-to-speech/"
        f"{ELEVENLABS_VOICE_ID}"
    )
    if path:
        url = f"{url}/{path}"
    return url, {
        "headers": {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        "params": {
            "output_format": "mp3_22050_32",
            "optimize_streaming_latency": "4",
        },
        "json": {"text": script, "model_id": MODEL_ID},
    }


async def generate_brief(script: str) -> bytes:
    url, options = _voice_request(script, stream=False)
    response = await eleven_client().post(url, **options)
    response.raise_for_status()
    return response.content


async def stream_brief(script: str):
    url, options = _voice_request(script, stream=True)
    async with eleven_client().stream("POST", url, **options) as response:
        response.raise_for_status()
        async for chunk in response.aiter_bytes():
            if chunk:
                yield chunk
