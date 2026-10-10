from fastapi import APIRouter

from app.config import MODEL_NAME
from app.services.retrieval_service import get_chunk_count, get_retriever_name

router = APIRouter()


@router.get("/api/health")
def health():
    return {
        "ok": True,
        "retriever": get_retriever_name(),
        "model": MODEL_NAME,
        "chunks": get_chunk_count(),
    }