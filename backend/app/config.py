import os
import tempfile
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


def _env_any(*names: str, default: str = "") -> str:
    for name in names:
        value = _env(name)
        if value:
            return value
    return default


DEMO_CACHE = _env("DEMO_CACHE", "0") == "1"
RETRIEVER = _env("RETRIEVER", "snowflake")
OPENROUTER_MODEL = _env("OPENROUTER_MODEL", "openai/gpt-4o-mini")
MODEL_NAME = _env("MODEL_NAME", OPENROUTER_MODEL)

FRONTEND_ORIGIN = _env("FRONTEND_ORIGIN", "http://localhost:3000")
OPENROUTER_API_KEY = _env("OPENROUTER_API_KEY", "")
ELEVENLABS_API_KEY = _env("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = _env("ELEVENLABS_VOICE_ID", "")

SNOWFLAKE_ACCOUNT = _env_any("SNOWFLAKE_ACCOUNT_IDENTIFIER", "SNOWFLAKE_ACCOUNT", default="")
SNOWFLAKE_PAT = _env_any("SNOWFLAKE_PAT", "SNOWFLAKE_TOKEN", default="")
SNOWFLAKE_ROLE = _env("SNOWFLAKE_ROLE", "")
SNOWFLAKE_WAREHOUSE = _env("SNOWFLAKE_WAREHOUSE", "")
SNOWFLAKE_DATABASE = _env("SNOWFLAKE_DATABASE", "")
SNOWFLAKE_SCHEMA = _env("SNOWFLAKE_SCHEMA", "")

STATIC_DATA_DIR = BASE_DIR / "data"
SOURCE_DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR = (
    Path(tempfile.gettempdir()) / "green-gavel"
    if os.getenv("VERCEL")
    else SOURCE_DATA_DIR
)
DATA_DIR.mkdir(parents=True, exist_ok=True)
CHUNKS_CSV = SOURCE_DATA_DIR / "chunks.csv"
DOCUMENTS_CSV = SOURCE_DATA_DIR / "documents.csv"
