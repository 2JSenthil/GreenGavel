import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]

load_dotenv(BASE_DIR / ".env")

DEMO_CACHE = os.getenv("DEMO_CACHE", "1") == "1"

FRONTEND_ORIGIN = os.getenv(
    "FRONTEND_ORIGIN",
    "http://localhost:3000"
)

ELEVENLABS_API_KEY = os.getenv(
    "ELEVENLABS_API_KEY", ""
)

ELEVENLABS_VOICE_ID = os.getenv(
    "ELEVENLABS_VOICE_ID", ""
)

DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)