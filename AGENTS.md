# Green Gavel
Residents ask what Chapel Hill's town bodies are deciding on trees, water, transit, and energy. The app returns a cited answer and a 60-second voice brief.

## Layout
ingest/   fetch.py extract.py chunk.py load.py   (Legistar -> text -> chunks -> Snowflake and data/chunks.jsonl)
api/      main.py retrieve.py answer.py verify.py brief.py feed.py   (FastAPI)
web/      Next.js app: app/ components/ lib/ styles/aero.css
tests/    questions.json run.py
audio/    cached MP3 files named by sha1

## Rules that must never break
1. Every sentence of an answer ends with a bracket number that points at a retrieved passage. api/verify.py enforces it.
2. If retrieval finds nothing relevant, reply exactly: The records I have don't say.  Do not call the model.
3. Secrets live only in .env. Never print or commit a token or key.
4. The browser never calls Snowflake, ElevenLabs, or Legistar directly. Only the API does.
5. Minutes with Draft status are labeled Draft in the UI and in the spoken brief.
6. Keep text plain: no em dashes in user-facing copy.

## API contract
POST /api/ask {question, topic?} streams SSE: event sources {sources:[{n, body, date, source_name, source_url, page, status}]}, then event delta {text}, then event done {answer_id, ok, refused, retriever, ms}. Failure: event error {code, message}.
POST /api/brief {answer_id} -> {audio_url, script, seconds, cached}
GET /api/feed?days=14 -> {meetings:[{date, time, body, agenda_pdf, meeting_url, topics, item_titles}]}
GET /api/health -> {ok, retriever, model, chunks}

## Data
Legistar: https://webapi.legistar.com/v1/chapelhill/events and /events/{id}/eventitems?Attachments=1 (no key).
Chunk row: chunk_id, item_id, event_id, body, meeting_date, source_name, source_url, page, text, topics.
Topics: trees, water, transit, energy, tagged by regex over chunk text.

## Design (Frutiger Aero)
The full inventory of tokens, controls, surfaces, and decorations is in docs/frutiger-aero.md. Use styles/aero.css tokens. Gel buttons and window bars use the skill gel with white labels. Body text sits on glass panels with ink #0b2e4f. Respect prefers-reduced-motion. Every control is a real button or link with a visible focus ring.

## Done means
The change runs locally, python tests/run.py shows no regressions, and no secret appears in git diff.
