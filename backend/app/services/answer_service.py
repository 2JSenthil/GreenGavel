import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import DEMO_CACHE
from app.models import Source
from app.services.demo_replay import get_demo_answer
from llm import ask_llm, chat_reply, route_question
from rag import build_context
from retrieval import retrieve_chunks

REFUSAL = "The records I have don't say."


def map_sources(rows) -> list[Source]:
    sources = []
    for index, row in enumerate(rows, start=1):
        meeting_date, document_type, status, _text, source_url = row[:5]
        body = str(document_type or "Town Council")
        sources.append(
            Source(
                id=index,
                body=body,
                date=str(meeting_date or ""),
                document_name=body,
                page=1,
                pdf_url=source_url or None,
                is_draft=str(status or "").lower() == "draft",
            )
        )
    return sources


def prepare_question(question: str):
    if DEMO_CACHE:
        demo = get_demo_answer(question)
        if demo is not None:
            return "records", demo
    return route_question(question), None


async def generate_answer(
    question: str,
    topic: str | None = None,
    kind: str = "records",
    prepared: dict | None = None,
    max_tokens: int = 600,
    limit: int = 8,
):
    if prepared is not None:
        return {**prepared, "kind": "records"}

    if kind == "chat":
        text = await asyncio.to_thread(chat_reply, question)
        return {"text": text, "sources": [], "kind": "chat"}

    rows = await asyncio.to_thread(retrieve_chunks, question, limit)
    if not rows:
        return {"text": REFUSAL, "sources": [], "kind": "records"}

    text = await asyncio.to_thread(
        ask_llm,
        question,
        build_context(rows),
        3,
        max_tokens,
    )
    return {"text": text, "sources": map_sources(rows), "kind": "records"}
