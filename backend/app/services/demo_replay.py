import json

from app.config import STATIC_DATA_DIR
from app.models import Source

REPLAY_FILE = STATIC_DATA_DIR / "demo_replay.json"


def normalize_question(question: str) -> str:
    return " ".join(question.strip().lower().split())


def get_demo_answer(question: str):
    if not REPLAY_FILE.exists():
        return None

    with REPLAY_FILE.open("r", encoding="utf-8") as f:
        data = json.load(f)

    result = data.get(normalize_question(question))

    if result is None:
        return None

    return {
        "text": result["text"],
        "sources": [
            Source.model_validate(source)
            for source in result["sources"]
        ],
    }
