from app.models import Meeting


async def get_meetings() -> list[Meeting]:
    # TODO: Connect the real council meeting feed.
    # Empty list means no live data is connected yet.
    return []