import csv
from datetime import datetime, timedelta

from app.config import DOCUMENTS_CSV
from app.models import Meeting


async def get_meetings(days: int = 14) -> list[Meeting]:
    if not DOCUMENTS_CSV.exists():
        return []

    cutoff = datetime.utcnow() - timedelta(days=days)
    meetings: list[Meeting] = []

    with DOCUMENTS_CSV.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)

        for row in reader:
            meeting_date_raw = (row.get("meeting_date") or "").strip()
            if not meeting_date_raw:
                continue

            try:
                meeting_date = datetime.fromisoformat(meeting_date_raw.replace("Z", "+00:00"))
                if meeting_date.tzinfo:
                    meeting_date = meeting_date.astimezone().replace(tzinfo=None)
            except ValueError:
                continue

            if meeting_date < cutoff:
                continue

            meetings.append(
                Meeting(
                    id=row.get("event_id") or row.get("document_id", ""),
                    title=row.get("meeting_name") or "Town meeting",
                    date=meeting_date_raw,
                    agenda_url=row.get("source_url") or row.get("event_page_url") or "",
                )
            )

    meetings.sort(key=lambda meeting: meeting.date, reverse=True)
    return meetings