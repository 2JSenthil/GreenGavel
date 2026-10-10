import asyncio
import json
import time
import uuid

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.config import RETRIEVER
from app.models import AnswerRecord, AskRequest
from app.services.answer_service import generate_answer, prepare_question
from app.services.cache import save_answer

router = APIRouter()


def sse_event(event: str, data: dict) -> str:
    return (
        f"event: {event}\n"
        f"data: {json.dumps(data)}\n\n"
    )


@router.post("/api/ask")
async def ask(request: AskRequest):
    async def event_stream():
        try:
            question = request.question.strip()

            if not question:
                yield sse_event(
                    "error",
                    {"code": "bad_request", "message": "Question cannot be empty."}
                )
                return

            started = time.perf_counter()
            kind, prepared = prepare_question(question)
            yield sse_event("route", {"kind": kind})

            result = await generate_answer(
                question,
                request.topic,
                kind,
                prepared,
            )

            sources = result["sources"]
            answer_text = result["text"]
            answer_id = str(uuid.uuid4())

            yield sse_event(
                "sources",
                {
                    "sources": [
                        source.model_dump()
                        for source in sources
                    ]
                }
            )

            chunk_size = 35
            for i in range(0, len(answer_text), chunk_size):
                chunk = answer_text[i:i + chunk_size]
                yield sse_event("delta", {"text": chunk})
                await asyncio.sleep(0.05)

            record = AnswerRecord(
                answer_id=answer_id,
                question=question,
                text=answer_text,
                sources=sources,
                topic=request.topic,
            )

            save_answer(record)

            elapsed_ms = int((time.perf_counter() - started) * 1000)
            yield sse_event(
                "done",
                {
                    "answer_id": answer_id,
                    "ok": True,
                    "refused": answer_text == "The records I have don't say.",
                    "retriever": RETRIEVER,
                    "ms": elapsed_ms,
                }
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            yield sse_event(
                "error",
                {
                    "code": "internal_error",
                    "message": (
                        "Unable to generate an answer. "
                        "Check the connected data source or backend configuration."
                    )
                }
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )