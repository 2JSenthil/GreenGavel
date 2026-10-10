import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import FRONTEND_ORIGIN
from app.routes import ask, brief, feed, health, records, transcribe

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s"
)

logger = logging.getLogger("green_gavel")

app = FastAPI(
    title="Green Gavel API",
    description="Environmental council records API",
    version="1.0.0"
)

# Allow requests from Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        FRONTEND_ORIGIN,
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# Log one line per request
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    status_code = 500

    try:
        response = await call_next(request)
        status_code = response.status_code
        return response

    finally:
        duration = (
            time.perf_counter() - start
        ) * 1000

        logger.info(
            "%s %s status=%s duration_ms=%.2f",
            request.method,
            request.url.path,
            status_code,
            duration
        )


# Register API routes
app.include_router(health.router)
app.include_router(ask.router)
app.include_router(brief.router)
app.include_router(feed.router)
app.include_router(records.router)
app.include_router(transcribe.router)