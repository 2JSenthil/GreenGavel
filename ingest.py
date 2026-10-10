import os
import re
import uuid
from io import BytesIO
from datetime import datetime, timedelta

import pandas as pd
import requests
from pypdf import PdfReader

LEGISTAR_URL = "https://webapi.legistar.com/v1/chapelhill/events"

MONTHS_BACK = 6
CHUNK_SIZE = 1500
CHUNK_OVERLAP = 200

OUTPUT_FOLDER = "data"
DOCUMENTS_CSV = os.path.join(OUTPUT_FOLDER, "documents.csv")
CHUNKS_CSV = os.path.join(OUTPUT_FOLDER, "chunks.csv")

os.makedirs(OUTPUT_FOLDER, exist_ok=True)

TOPIC_KEYWORDS = {
    "trees_green_space": [
        "tree",
        "trees",
        "forest",
        "green space",
        "park",
        "parks",
        "vegetation",
        "canopy",
        "land conservation",
    ],
    "stormwater_water": [
        "stormwater",
        "storm water",
        "flood",
        "flooding",
        "drainage",
        "creek",
        "water",
        "watershed",
        "sewer",
    ],
    "transit_biking": [
        "transit",
        "bus",
        "bicycle",
        "bike",
        "biking",
        "pedestrian",
        "transportation",
        "sidewalk",
    ],
    "energy_climate": [
        "climate",
        "energy",
        "emissions",
        "carbon",
        "solar",
        "sustainability",
        "renewable",
        "greenhouse gas",
    ],
}


def get_events():
    print("Fetching Chapel Hill meetings from Legistar...")

    response = requests.get(
        LEGISTAR_URL,
        timeout=30
    )

    response.raise_for_status()

    events = response.json()

    print(f"Found {len(events)} total events.")

    return events


def filter_recent_events(events, months=6):
    cutoff = datetime.now() - timedelta(days=30 * months)

    recent_events = []

    for event in events:
        date_string = event.get("EventDate")

        if not date_string:
            continue

        try:
            event_date = datetime.fromisoformat(
                date_string.replace("Z", "+00:00")
            )

            event_date = event_date.replace(tzinfo=None)

        except ValueError:
            print(
                f"Could not parse date for event "
                f"{event.get('EventId')}: {date_string}"
            )
            continue

        if event_date >= cutoff:
            recent_events.append(event)

    print(
        f"{len(recent_events)} events found "
        f"in the last {months} months."
    )

    return recent_events


def filter_town_council(events):
    filtered = []

    for event in events:
        body_name = event.get("EventBodyName") or ""

        if "town council" in body_name.lower():
            filtered.append(event)

    print(f"{len(filtered)} Town Council events found.")

    return filtered


def download_pdf(url):
    if not url:
        return None

    print(f"Downloading PDF: {url}")

    try:
        response = requests.get(
            url,
            timeout=60,
            headers={
                "User-Agent": "Mozilla/5.0 GreenGavelHackathon/1.0"
            }
        )

        response.raise_for_status()

        return response.content

    except requests.RequestException as e:
        print(f"PDF download failed: {e}")
        return None


def extract_pdf_text(pdf_bytes):
    if not pdf_bytes:
        return ""

    try:
        reader = PdfReader(BytesIO(pdf_bytes))

    except Exception as e:
        print(f"Could not open PDF: {e}")
        return ""

    pages = []

    for page_number, page in enumerate(reader.pages):
        try:
            text = page.extract_text()

            if text:
                pages.append(text)

        except Exception as e:
            print(
                f"Could not extract page "
                f"{page_number + 1}: {e}"
            )

    return "\n".join(pages)


def clean_text(text):
    if not text:
        return ""

    text = text.replace("\x00", "")

    text = re.sub(
        r"[ \t]+",
        " ",
        text
    )

    text = re.sub(
        r"\n{3,}",
        "\n\n",
        text
    )

    return text.strip()


def chunk_text(
    text,
    chunk_size=CHUNK_SIZE,
    overlap=CHUNK_OVERLAP
):
    if not text:
        return []

    chunks = []

    start = 0

    while start < len(text):
        end = min(
            start + chunk_size,
            len(text)
        )

        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end == len(text):
            break

        start += chunk_size - overlap

    return chunks


def detect_topics(text):
    text_lower = text.lower()

    topics = []

    for topic, keywords in TOPIC_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text_lower:
                topics.append(topic)
                break

    if not topics:
        topics.append("other")

    return topics


def process_document(
    event,
    document_type,
    pdf_url,
    document_status
):
    meeting_date = event.get("EventDate")
    meeting_name = event.get("EventBodyName")
    event_id = event.get("EventId")

    print()
    print("=" * 60)
    print(f"Processing {document_type.upper()}")
    print(f"Meeting: {meeting_name}")
    print(f"Date: {meeting_date}")
    print(f"Event ID: {event_id}")
    print("=" * 60)

    pdf_bytes = download_pdf(pdf_url)

    if not pdf_bytes:
        print("Skipping document.")
        return None, []

    raw_text = extract_pdf_text(pdf_bytes)

    text = clean_text(raw_text)

    if not text:
        print("No text extracted from PDF.")
        return None, []

    print(f"Extracted {len(text):,} characters.")

    document_id = str(uuid.uuid4())

    document_record = {
        "document_id": document_id,
        "event_id": event_id,
        "meeting_name": meeting_name,
        "meeting_date": meeting_date,
        "meeting_time": event.get("EventTime"),
        "meeting_location": event.get("EventLocation"),
        "document_type": document_type,
        "status": document_status or "Unknown",
        "source_url": pdf_url,
        "event_page_url": event.get("EventInSiteURL"),
        "full_text": text,
    }

    text_chunks = chunk_text(text)

    chunk_records = []

    for index, chunk in enumerate(text_chunks):
        topics = detect_topics(chunk)

        chunk_record = {
            "chunk_id": str(uuid.uuid4()),
            "document_id": document_id,
            "event_id": event_id,
            "chunk_index": index,
            "chunk_text": chunk,
            "topics": ",".join(topics),
            "meeting_name": meeting_name,
            "meeting_date": meeting_date,
            "document_type": document_type,
            "status": document_status or "Unknown",
            "source_url": pdf_url,
        }

        chunk_records.append(chunk_record)

    print(f"Created {len(chunk_records)} chunks.")

    return document_record, chunk_records


def ingest_events(events):
    documents = []
    chunks = []

    for event in events:
        agenda_url = event.get("EventAgendaFile")

        if agenda_url:
            document, document_chunks = process_document(
                event=event,
                document_type="agenda",
                pdf_url=agenda_url,
                document_status=event.get("EventAgendaStatusName"),
            )

            if document:
                documents.append(document)
                chunks.extend(document_chunks)

        else:
            print(
                f"No agenda for event "
                f"{event.get('EventId')}"
            )

        minutes_url = event.get("EventMinutesFile")

        if minutes_url:
            document, document_chunks = process_document(
                event=event,
                document_type="minutes",
                pdf_url=minutes_url,
                document_status=event.get("EventMinutesStatusName"),
            )

            if document:
                documents.append(document)
                chunks.extend(document_chunks)

        else:
            print(
                f"No minutes for event "
                f"{event.get('EventId')}"
            )

    return documents, chunks


def save_to_csv(documents, chunks):
    documents_df = pd.DataFrame(documents)

    chunks_df = pd.DataFrame(chunks)

    documents_df.to_csv(
        DOCUMENTS_CSV,
        index=False
    )

    chunks_df.to_csv(
        CHUNKS_CSV,
        index=False
    )

    print()
    print("=" * 60)
    print("INGESTION COMPLETE")
    print("=" * 60)
    print(f"Documents: {len(documents_df)}")
    print(f"Chunks: {len(chunks_df)}")
    print()
    print(DOCUMENTS_CSV)
    print(CHUNKS_CSV)

    return documents_df, chunks_df


def main():
    events = get_events()

    events = filter_recent_events(
        events,
        months=MONTHS_BACK
    )

    events = filter_town_council(events)

    documents, chunks = ingest_events(events)

    documents_df, chunks_df = save_to_csv(
        documents,
        chunks
    )

    if not chunks_df.empty:
        print()
        print("=" * 60)
        print("EXAMPLE CHUNK")
        print("=" * 60)

        first = chunks_df.iloc[0]

        print("Meeting:", first["meeting_name"])
        print("Date:", first["meeting_date"])
        print("Type:", first["document_type"])
        print("Topics:", first["topics"])
        print()
        print(first["chunk_text"][:500])


if __name__ == "__main__":
    main()