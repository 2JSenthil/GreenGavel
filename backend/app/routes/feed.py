from fastapi import APIRouter

from app.models import FeedResponse
from app.services.feed_service import get_meetings

router = APIRouter()


@router.get("/api/feed", response_model=FeedResponse)
async def feed():
    meetings = await get_meetings()

    return FeedResponse(meetings=meetings)