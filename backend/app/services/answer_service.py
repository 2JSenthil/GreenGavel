from app.config import DEMO_CACHE
from app.services.demo_replay import get_demo_answer


async def generate_answer(
    question: str,
    topic: str | None = None,
):
    if DEMO_CACHE:
        result = get_demo_answer(question)

        if result is None:
            raise ValueError(
                "No saved demo answer exists for this question."
            )

        return result

    # TODO: Connect Snowflake Cortex and retrieval pipeline.
    raise NotImplementedError(
        "Live Snowflake answer generation is not connected yet."
    )