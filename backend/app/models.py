from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str = Field(min_length=1)
    topic: str | None = None


class Source(BaseModel):
    id: int
    body: str
    date: str
    document_name: str
    page: int
    pdf_url: str | None = None
    is_draft: bool = False


class AnswerRecord(BaseModel):
    answer_id: str
    question: str
    text: str
    sources: list[Source]


class BriefRequest(BaseModel):
    answer_id: str


class Meeting(BaseModel):
    id: str
    title: str
    date: str
    agenda_url: str


class FeedResponse(BaseModel):
    meetings: list[Meeting]