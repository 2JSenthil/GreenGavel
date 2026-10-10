import json
import threading
from collections import OrderedDict

from app.config import DATA_DIR
from app.models import AnswerRecord

CACHE_FILE = DATA_DIR / "answer_cache.json"
MAX_ANSWERS = 50

_lock = threading.Lock()


def _load_cache():
    if not CACHE_FILE.exists():
        return OrderedDict()

    try:
        with CACHE_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)

        return OrderedDict(data)
    except (json.JSONDecodeError, OSError):
        return OrderedDict()


_cache = _load_cache()


def save_answer(answer: AnswerRecord):
    with _lock:
        _cache.pop(answer.answer_id, None)
        _cache[answer.answer_id] = answer.model_dump()

        while len(_cache) > MAX_ANSWERS:
            _cache.popitem(last=False)

        temp_file = CACHE_FILE.with_suffix(".tmp")
        temp_file.write_text(
            json.dumps(_cache, indent=2),
            encoding="utf-8"
        )
        temp_file.replace(CACHE_FILE)


def get_answer(answer_id: str) -> AnswerRecord | None:
    with _lock:
        data = _cache.get(answer_id)

    if data is None:
        return None

    return AnswerRecord.model_validate(data)