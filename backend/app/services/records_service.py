import asyncio
import time
from urllib.parse import quote, urlparse

import httpx

from app.models import RecordDocument

LEGISTAR = "https://webapi.legistar.com/v1/chapelhill"
BODY_IDS = {138, 190, 180, 140}
ALLOWED_HOSTS = {"chapelhill.legistar1.com", "chapelhill.legistar.com"}
TTL_SECONDS = 15 * 60
BROWSE_MEETINGS = 12
SEARCH_LIMIT = 80

_lock = asyncio.Lock()
_cached: tuple[float, list[RecordDocument]] | None = None


def _date(value: str | None) -> str:
    if not value:
        return ""
    return value[:10]


def _draft(status: str | None, title: str) -> bool:
    return "draft" in f"{status or ''} {title}".lower()


def _pdf(url: str, name: str) -> bool:
    path = url.lower().split("?", 1)[0]
    return path.endswith(".pdf") or name.lower().endswith(".pdf")


def proxy_url(url: str) -> str:
    return "/api/records/file?src=" + quote(url, safe="")


def validate_source(src: str) -> str:
    parsed = urlparse(src)
    if parsed.scheme != "https" or (parsed.hostname or "") not in ALLOWED_HOSTS:
        raise ValueError("unsupported file")
    return src


def _doc(
    *,
    doc_id: str,
    event_id: int,
    title: str,
    item_title: str,
    kind: str,
    body: str,
    date: str,
    time: str,
    status: str,
    url: str,
) -> RecordDocument:
    return RecordDocument(
        id=doc_id,
        event_id=event_id,
        title=title,
        item_title=item_title,
        kind=kind,
        body=body,
        date=date,
        time=time,
        status=status or "",
        is_draft=_draft(status, title),
        is_pdf=_pdf(url, title),
        file_url=proxy_url(url),
    )


def _from_event(event: dict, items: list[dict]) -> list[RecordDocument]:
    event_id = int(event.get("EventId") or 0)
    body = event.get("EventBodyName") or "Meeting"
    date = _date(event.get("EventDate"))
    clock = event.get("EventTime") or ""
    docs: list[RecordDocument] = []
    seen_urls: set[str] = set()

    def add(url: str | None, **kwargs) -> None:
        if not url or url in seen_urls:
            return
        seen_urls.add(url)
        docs.append(_doc(url=url, **kwargs))

    add(
        event.get("EventAgendaFile"),
        doc_id=f"agenda-{event_id}",
        event_id=event_id,
        title="Agenda",
        item_title="",
        kind="agenda",
        body=body,
        date=date,
        time=clock,
        status=event.get("EventAgendaStatusName") or "",
    )
    add(
        event.get("EventMinutesFile"),
        doc_id=f"minutes-{event_id}",
        event_id=event_id,
        title="Minutes",
        item_title="",
        kind="minutes",
        body=body,
        date=date,
        time=clock,
        status=event.get("EventMinutesStatusName") or "",
    )

    for item in items:
        item_title = (item.get("EventItemTitle") or "").strip()
        item_id = item.get("EventItemId") or 0
        for index, attachment in enumerate(item.get("EventItemMatterAttachments") or []):
            url = attachment.get("MatterAttachmentHyperlink") or ""
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            name = (attachment.get("MatterAttachmentName") or "Attachment").strip()
            attachment_id = attachment.get("MatterAttachmentId") or name
            docs.append(
                _doc(
                    doc_id=f"att-{event_id}-{item_id}-{attachment_id}-{index}",
                    event_id=event_id,
                    title=name,
                    item_title=item_title,
                    kind="attachment",
                    body=body,
                    date=date,
                    time=clock,
                    status="",
                    url=url,
                )
            )

    return docs


async def _fetch_items(client: httpx.AsyncClient, event_id: int, sem: asyncio.Semaphore) -> list[dict]:
    url = f"{LEGISTAR}/events/{event_id}/eventitems"
    async with sem:
        response = await client.get(url, params={"Attachments": "1"})
        response.raise_for_status()
        data = response.json()
        return data if isinstance(data, list) else []


async def _load_catalog() -> list[RecordDocument]:
    params = {
        "$filter": "EventDate ge datetime'2026-01-01'",
        "$orderby": "EventDate desc",
        "$top": "200",
    }
    timeout = httpx.Timeout(30.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.get(f"{LEGISTAR}/events", params=params)
        response.raise_for_status()
        events = response.json()
        if not isinstance(events, list):
            return []
        chosen = [event for event in events if event.get("EventBodyId") in BODY_IDS]
        sem = asyncio.Semaphore(8)
        item_lists = await asyncio.gather(
            *[_fetch_items(client, int(event["EventId"]), sem) for event in chosen]
        )

    documents: list[RecordDocument] = []
    for event, items in zip(chosen, item_lists):
        documents.extend(_from_event(event, items))
    return documents


async def catalog() -> list[RecordDocument]:
    global _cached
    now = time.time()
    if _cached and now - _cached[0] < TTL_SECONDS:
        return _cached[1]
    async with _lock:
        now = time.time()
        if _cached and now - _cached[0] < TTL_SECONDS:
            return _cached[1]
        documents = await _load_catalog()
        _cached = (time.time(), documents)
        return documents


def search_documents(documents: list[RecordDocument], query: str) -> list[RecordDocument]:
    terms = [term for term in query.lower().split() if term]
    if not terms:
        meeting_ids: list[int] = []
        for document in documents:
            if document.event_id not in meeting_ids:
                meeting_ids.append(document.event_id)
            if len(meeting_ids) >= BROWSE_MEETINGS:
                break
        allowed = set(meeting_ids)
        return [document for document in documents if document.event_id in allowed]

    matches: list[RecordDocument] = []
    for document in documents:
        haystack = " ".join(
            [
                document.title,
                document.item_title,
                document.body,
                document.date,
                document.kind,
                document.status,
            ]
        ).lower()
        if all(term in haystack for term in terms):
            matches.append(document)
            if len(matches) >= SEARCH_LIMIT:
                break
    return matches


async def search_records(query: str) -> list[RecordDocument]:
    return search_documents(await catalog(), query)
