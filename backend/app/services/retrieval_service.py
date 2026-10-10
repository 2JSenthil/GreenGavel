import csv
import re
from collections import Counter

from app.config import CHUNKS_CSV, RETRIEVER
from app.services.snowflake_service import search_chunks, snowflake_enabled

STOP_WORDS = {
    "what", "when", "where", "why", "how", "the", "a", "an",
    "is", "are", "was", "were", "be", "been", "being", "to",
    "of", "in", "on", "for", "with", "from", "that", "this",
    "have", "has", "had", "did", "do", "does", "can", "could",
    "would", "should", "about", "into", "after", "before",
    "you", "your", "we", "they", "them", "their", "our", "us",
    "town", "council", "chapel", "hill", "meeting", "meetings",
    "discuss", "discussed", "discussing", "tell", "show", "give",
    "me", "make", "record", "records", "recent", "latest"
}


def _tokenize(text: str):
    return [
        token.lower()
        for token in re.findall(r"[a-zA-Z0-9_]+", (text or ""))
        if token.lower() not in STOP_WORDS and len(token) > 2
    ]


def _score_chunk(question_tokens, chunk_row):
    text = " ".join(
        filter(
            None,
            [
                chunk_row.get("chunk_text", ""),
                chunk_row.get("meeting_name", ""),
                chunk_row.get("topics", ""),
                chunk_row.get("document_type", ""),
            ],
        )
    )
    haystack = text.lower()
    counter = Counter()

    for token in question_tokens:
        counter[token] += haystack.count(token)

    total_matches = sum(counter.values())
    score = total_matches * 3

    if chunk_row.get("status", "").lower() == "draft":
        score -= 1

    return score


def _load_chunks():
    if not CHUNKS_CSV.exists():
        return []

    with CHUNKS_CSV.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader)


async def retrieve_chunks(question: str, topic: str | None = None, limit: int = 6):
    if not question or not question.strip():
        return []

    if snowflake_enabled() and (RETRIEVER.lower() in {"snowflake", "auto", ""}):
        rows = await search_chunks(question, limit=limit)
        normalized = []
        for row in rows:
            normalized.append({
                "chunk_text": row.get("text") or row.get("body") or "",
                "meeting_name": row.get("source_name") or "",
                "meeting_date": row.get("meeting_date") or "",
                "document_type": row.get("source_name") or "",
                "status": row.get("status") or "Final",
                "source_url": row.get("source_url") or "",
                "chunk_index": row.get("page") or 0,
                "topics": row.get("topics") or "",
            })
        return normalized

    tokens = _tokenize(question)
    if not tokens:
        return []

    matches = []

    for row in _load_chunks():
        topics = row.get("topics", "")
        topic_match = False

        if topic:
            normalized_topic = topic.strip().lower().replace(" ", "_")
            topic_match = normalized_topic in (topics or "").lower()

        score = _score_chunk(tokens, row)

        if topic_match:
            score += 8

        if score > 0:
            matches.append({**row, "score": score})

    matches.sort(key=lambda item: item["score"], reverse=True)
    return matches[:limit]


def get_chunk_count() -> int:
    return len(_load_chunks())


def get_retriever_name() -> str:
    return RETRIEVER or "local_csv"
