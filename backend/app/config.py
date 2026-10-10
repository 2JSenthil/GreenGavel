import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BASE_DIR.parent
ROOT_DIR = PROJECT_ROOT

load_dotenv(ROOT_DIR / ".env")
load_dotenv(BASE_DIR / ".env")
load_dotenv(PROJECT_ROOT / ".env")


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name, default) or "").strip()


DEMO_CACHE = _env("DEMO_CACHE", "0") == "1"
RETRIEVER = _env("RETRIEVER", "snowflake")
OPENROUTER_MODEL = _env("OPENROUTER_MODEL", "openai/gpt-4o-mini")
MODEL_NAME = _env("MODEL_NAME", OPENROUTER_MODEL)

FRONTEND_ORIGIN = _env(
    "FRONTEND_ORIGIN",
    "http://localhost:3000"
)

OPENROUTER_API_KEY = _env("OPENROUTER_API_KEY", "")

ELEVENLABS_API_KEY = _env(
    "ELEVENLABS_API_KEY", ""
)

ELEVENLABS_VOICE_ID = _env(
    "ELEVENLABS_VOICE_ID", ""
)

SNOWFLAKE_ACCOUNT = _env("SNOWFLAKE_ACCOUNT_IDENTIFIER", "")
SNOWFLAKE_PAT = _env("SNOWFLAKE_PAT", "")
SNOWFLAKE_ROLE = _env("SNOWFLAKE_ROLE", "")
SNOWFLAKE_WAREHOUSE = _env("SNOWFLAKE_WAREHOUSE", "")
SNOWFLAKE_DATABASE = _env("SNOWFLAKE_DATABASE", "")
SNOWFLAKE_SCHEMA = _env("SNOWFLAKE_SCHEMA", "")

DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)
CHUNKS_CSV = DATA_DIR / "chunks.csv"
DOCUMENTS_CSV = DATA_DIR / "documents.csv"