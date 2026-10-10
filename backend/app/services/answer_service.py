import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import DEMO_CACHE
from app.models import Source
from app.services.demo_replay import get_demo_answer
from llm import ask_llm
from retrieval import retrieve_chunks


def _build_context(rows):
    context_parts = []

    for row in rows:
        meeting_date = row[0]
        document_type = row[1]
        status = row[2]
        chunk_text = row[3]
        source_url = row[4]

        context_part = f"""
Meeting date: {meeting_date}
Document type: {document_type}
Status: {status}

Text:
{chunk_text}

Source:
{source_url}
"""
        context_parts.append(context_part)

    return "\n\n--------------------\n\n".join(context_parts)


def _build_sources(rows):
    sources = []
    seen_urls = set()

    for index, row in enumerate(rows, start=1):
        source_url = row[4]
        if not source_url or source_url in seen_urls:
            continue
        seen_urls.add(source_url)

        sources.append(
            Source(
                id=index,
                body=row[3],
                date=row[0],
                document_name=row[1],
                page=1,
                pdf_url=source_url,
                is_draft=str(row[2]).lower() == "draft",
            )
        )

    return sources


async def generate_answer(
    question: str,
    topic: str | None = None,
):
    if DEMO_CACHE:
        result = get_demo_answer(question)
        if result is not None:
            return result

    rows = retrieve_chunks(question=question, limit=8)

    if not rows:
        return {
            "text": "The records I have don't say.",
            "sources": [],
        }

    context = _build_context(rows)
    answer_text = ask_llm(question=question, context=context)

    return {
        "text": answer_text,
        "sources": _build_sources(rows),
    }