import asyncio
import json
import uuid

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.models import AnswerRecord, AskRequest
from app.services.answer_service import generate_answer
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
                    {"message": "Question cannot be empty."}
                )
                return

            result = await generate_answer(
                question,
                request.topic
            )

            sources = result["sources"]
            answer_text = result["text"]
            answer_id = str(uuid.uuid4())

            # Send sources first
            yield sse_event(
                "sources",
                {
                    "sources": [
                        source.model_dump()
                        for source in sources
                    ]
                }
            )

            # Stream answer text in chunks
            chunk_size = 35

            for i in range(0, len(answer_text), chunk_size):
                chunk = answer_text[i:i + chunk_size]

                yield sse_event(
                    "delta",
                    {"text": chunk}
                )

                await asyncio.sleep(0.05)

            # Save completed answer
            record = AnswerRecord(
                answer_id=answer_id,
                question=question,
                text=answer_text,
                sources=sources
            )

            save_answer(record)

            yield sse_event(
                "done",
                {"answer_id": answer_id}
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            yield sse_event(
                "error",
                {
                    "message": (
                        "Unable to generate an answer. "
                        "Check demo questions or backend configuration."
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