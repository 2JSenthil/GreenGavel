from urllib.parse import unquote, urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response

from app.models import RecordsResponse
from app.services.records_service import search_records, validate_source

router = APIRouter()


def _byte_range(header: str, total: int) -> tuple[int, int] | None:
    if not header.startswith("bytes="):
        return None
    spec = header.split("=", 1)[1].split(",", 1)[0].strip()
    start_text, _, end_text = spec.partition("-")
    try:
        if start_text == "":
            length = int(end_text)
            if length <= 0:
                return None
            start = max(0, total - length)
            end = total - 1
        else:
            start = int(start_text)
            end = int(end_text) if end_text else total - 1
    except ValueError:
        return None
    if start < 0 or start >= total or end < start:
        return None
    return start, min(end, total - 1)


@router.get("/api/records", response_model=RecordsResponse)
async def records(q: str = ""):
    try:
        documents = await search_records(q.strip())
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Records are unavailable right now.") from exc
    return RecordsResponse(query=q.strip(), documents=documents)


@router.get("/api/records/file")
async def record_file(request: Request, src: str = Query(min_length=1)):
    try:
        url = validate_source(unquote(src))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="That file is not a Chapel Hill record.") from exc

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0), follow_redirects=True) as client:
            upstream = await client.get(url)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="That file could not be opened.") from exc

    if upstream.status_code >= 400:
        raise HTTPException(status_code=502, detail="That file could not be opened.")

    media = upstream.headers.get("content-type", "application/octet-stream").split(";", 1)[0]
    name = urlparse(url).path.rsplit("/", 1)[-1] or "record"
    data = upstream.content
    headers = {
        "Content-Disposition": f'inline; filename="{name}"',
        "Cache-Control": "private, max-age=3600",
        "Accept-Ranges": "bytes",
    }
    requested = request.headers.get("range")
    if requested:
        span = _byte_range(requested, len(data))
        if span is None:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{len(data)}"})
        start, end = span
        headers["Content-Range"] = f"bytes {start}-{end}/{len(data)}"
        return Response(content=data[start : end + 1], status_code=206, media_type=media, headers=headers)
    return Response(content=data, media_type=media, headers=headers)
