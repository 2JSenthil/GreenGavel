# Green Gavel

Green Gavel answers what Chapel Hill's town bodies are deciding about trees, water, transit, and energy. A resident asks in plain language, gets a short answer grounded in public records, and can hear that answer as a spoken brief. The interface is a Frutiger Aero desktop called Green Gavel OS.

The browser talks only to this app's API. Snowflake, OpenRouter, Gemini, ElevenLabs, and Legistar are called from the server.

Public `/api/*` requests reach FastAPI with their prefix preserved. All other
paths reach Next.js. Browser API and audio URLs use the same origin.
The Photon webhook at `/api/imessage/webhook` routes to Next.js before the general
API rewrite. Its bot calls Python through the frontend's `BACKEND_URL` service
binding targeting `backend`. This variable is read only inside runtime functions.
Never set a binding variable manually or expose it through `NEXT_PUBLIC_`.

## Desktop

The home page boots into a desktop (skip it with reduced motion, or press Enter). Windows drag, resize, minimize, and maximize. A start menu, taskbar, clock, sounds, and cursors sit on a UNC wallpaper. Settings stores the wallpaper choice in `localStorage` under `gg-wallpaper`.

| App | What it does |
| --- | --- |
| Chat | Typed questions, four topic chips, a streamed answer, and source cards. Opens `frontend/src/app/page.tsx`. |
| Talk | Push to talk. Records audio, transcribes it, asks the same answer API, then plays a spoken brief. |
| Records | Browses and searches live Legistar agendas, minutes, and attachments, grouped by meeting. |
| Preview | Opens a file from Chat, Talk, or Records. PDFs render with pdf.js. Word, Excel, and PowerPoint files render in the browser. |
| Settings | Switches the wallpaper between the campus photo and the portrait wallpaper. |

Topic chips ask a fixed question and send a topic id: `trees`, `water`, `transit`, or `energy`.

Source cards open the town PDF in Preview. Minutes with Draft status show a Draft badge. Draft minutes are also named in the spoken brief.

## How an answer is made

`POST /api/ask` is the live path.

1. `prepare_question` checks `DEMO_CACHE`. When it is `1` and the question matches `backend/data/demo_replay.json`, the stored sample is streamed and the model is not called.
2. Otherwise `llm.route_question` labels the utterance `chat` or `records`. Record words (trees, stormwater, transit, votes, and similar) go straight to records. Short greetings go to chat. Anything else is classified by the model.
3. Chat replies come from `llm.chat_reply` with no sources.
4. Records search runs `retrieval.retrieve_chunks`. That sends a SQL `LIKE` query to Snowflake `CHUNKS` through the SQL REST API, using the programmatic access token. Rows are ordered by meeting date. The default limit is 8, or 5 when `voice` is true.
5. If no rows come back, the API returns exactly `The records I have don't say.` and does not call the model.
6. Otherwise `rag.build_context` turns the rows into a prompt and `llm.ask_llm` writes the answer. OpenRouter is tried first. If it fails, Gemini is tried. If both fail, the user sees a short busy message.
7. The finished answer is stored (last 50) so a brief can be built from that answer id, not from text the browser sends back.

The response is server-sent events, in order:

```
event: route
data: {"kind":"records"}

event: sources
data: {"sources":[{"id":1,"body":"agenda","date":"2026-05-13T00:00:00","document_name":"agenda","page":1,"pdf_url":"https://...","is_draft":false}]}

event: delta
data: {"text":"..."}

event: done
data: {"answer_id":"<uuid>","ok":true,"refused":false,"retriever":"snowflake","ms":2400}
```

Typed answers arrive as 35-character `delta` chunks. Voice answers send the full text in one `delta`. Failures send `event: error` with `code` and `message`.

`backend/app/services/retrieval_service.py` can rank local `data/chunks.csv` rows and can call `snowflake_service.search_chunks`. `snowflake_service.generate_cortex_answer` and root `cortex.py` can call Snowflake Cortex chat. `GET /api/health` reports the chunk count from the CSV and the `RETRIEVER` name. The ask route does not use those modules. It uses root `retrieval.py` and `llm.py`.

Answer sources currently set `page` to 1. The model prompt tells it to stay inside the retrieved text and to refuse when the records are silent. It does not require a bracket citation on every sentence.

## API

| Method | Path | Body or query | Returns |
| --- | --- | --- | --- |
| `GET` | `/api/health` | | `{ok, retriever, model, chunks}` |
| `POST` | `/api/ask` | `{question, topic?, voice?}` | SSE: `route`, `sources`, `delta`, `done`, or `error` |
| `POST` | `/api/brief` | `{answer_id}` | `{audio_url, script, seconds, cached}` |
| `GET` | `/api/brief/stream/{answer_id}` | UUID | MP3 stream, or the cached file |
| `GET` | `/api/audio/{name}` | 40-hex sha1 plus `.mp3` | Cached MP3 |
| `GET` | `/api/feed` | | `{meetings:[{id, title, date, agenda_url}]}` from the last 14 days of `data/documents.csv` |
| `GET` | `/api/records` | `q` | `{query, documents:[...]}` from live Legistar |
| `GET` | `/api/records/file` | `src` | Proxied Chapel Hill file, with `Range` support |
| `POST` | `/api/transcribe` | multipart audio file | `{text}` |

`/api/records/file` allows only `https` URLs on `chapelhill.legistar1.com` and `chapelhill.legistar.com`.

A missing answer, or the refusal sentence, makes `/api/brief` return 404. If ElevenLabs fails, the brief route returns 502 with the script and the message `Audio unavailable.`

CORS allows `http://localhost:3000` and `FRONTEND_ORIGIN`. Methods are `GET` and `POST`.

## Voice

Talk records with `MediaRecorder`, shows a level meter, and also starts the browser speech recognizer for a live transcript. The recording is posted to `/api/transcribe`, which calls ElevenLabs speech to text (`scribe_v1`) and strips bracket tags from the transcript.

The transcript is sent to `/api/ask` with `voice: true`. A records answer that is not the refusal then plays `GET /api/brief/stream/{answer_id}`.

The script is the answer with citation brackets and markdown removed. If a cited source is draft, it adds `Those minutes are still a draft.` The MP3 is cached as `data/audio/{sha1}.mp3`, where the hash is `eleven_flash_v2_5` plus the voice id plus the script. Output format is `mp3_22050_32`. On Vercel that cache directory is temporary, so a brief can 404 after the instance changes.

## Data

Ingest reads the public Legistar API (no key):

`https://webapi.legistar.com/v1/chapelhill/events`

`python ingest.py` keeps Town Council meetings from the last 6 months, downloads each agenda PDF and minutes PDF, extracts text with pypdf, chunks about 1500 characters with 200 characters of overlap, and tags topics by keyword. It writes:

| File | Columns |
| --- | --- |
| `data/documents.csv` | `document_id`, `event_id`, `meeting_name`, `meeting_date`, `meeting_time`, `meeting_location`, `document_type`, `status`, `source_url`, `event_page_url`, `full_text` |
| `data/chunks.csv` | `chunk_id`, `document_id`, `event_id`, `chunk_index`, `chunk_text`, `topics`, `meeting_name`, `meeting_date`, `document_type`, `status`, `source_url` |

Topic tags: `trees_green_space`, `stormwater_water`, `transit_biking`, `energy_climate`, or `other`.

The CSV already in the repo holds 33 documents (18 agendas, 15 minutes) and 169 chunks from 18 Town Council meetings dated 2026-04-15 through 2026-10-14. Status values in that file are `Final` (26), `Draft` (6), and `Final-revised` (1). Topic counts on chunks: transit 59, trees 37, stormwater 35, energy 24, other 70. A chunk can carry more than one topic. Ingest does not download staff-report attachments. Those files show up in the Records app, which calls Legistar live.

Records loads meetings since 2026-01-01 for body ids 138, 190, 180, and 140, including agenda items and attachments. The catalog is cached in memory for 15 minutes. An empty search shows the 12 most recent meetings. A search matches all terms against title, item, body, date, kind, and status, up to 80 documents.

The live answer search expects a Snowflake table `{SNOWFLAKE_DATABASE}.{SNOWFLAKE_SCHEMA}.CHUNKS` with `meeting_date`, `document_type`, `status`, `chunk_text`, and `source_url`. The database name used for this project is `GREEN_GAVEL`.

## Repository

```
main.py                 ASGI entry. Adds backend/ to the path and exports app.
ingest.py               Legistar PDF ingest to data/*.csv
retrieval.py            Live Snowflake LIKE search used by /api/ask
rag.py                  Builds the prompt context from those rows
llm.py                  Router, chat replies, OpenRouter, Gemini fallback
cortex.py               Standalone Cortex chat script
requirements.txt        Python deps for the Vercel backend service
vercel.json             Frontend and backend services, /api rewrite

backend/app/main.py     FastAPI app, CORS, request log
backend/app/config.py   Env loading and data paths
backend/app/models.py   Request and response models
backend/app/routes/     health, ask, brief, feed, records, transcribe
backend/app/services/   answer, brief, cache, feed, records, demo replay,
                        retrieval_service, snowflake_service
backend/data/           demo_replay.json, local answer cache, audio cache
backend/tests/          unittest modules
backend/requirements.txt

frontend/               Next.js 16 app (React 19, Tailwind 4)
frontend/src/app/       layout, page, aero.css import
frontend/src/components Chat, Talk, Records, Preview, desktop, boot, sounds
frontend/src/styles/aero.css
frontend/public/aero/   wallpapers, icons, CREDITS.txt
frontend/public/cursors
frontend/public/sounds
frontend/public/fonts   Selawik, SIL OFL

data/                   documents.csv, chunks.csv, answer cache
connectionTest/         Snowflake PAT and chunk query scripts
docs/frutiger-aero.md   Design inventory
SCOPE.md                Hackathon build scope
CHECKLIST.md            Task checklist
AGENTS.md               Rules for coding agents
```

`windows-xp-1/` is a downloaded cursor pack and is gitignored. The cursors and sounds the app serves live under `frontend/public/`.

## Run locally

Python 3.10 or newer, and Node 20 or newer.

```bash
python -m pip install -r requirements.txt
python -m pip install pandas pypdf
npm install --prefix frontend
```

Copy the variables below into `.env` at the repo root. Never commit that file.

```bash
# API
python -m uvicorn main:app --reload --port 8000

# Web, in another terminal
npm run dev --prefix frontend
```

Open `http://localhost:3000`. Next.js rewrites `/api/*` to `API_PROXY` (default `http://127.0.0.1:8000`) when `VERCEL` is unset, so the browser can use the same origin. `vercel dev` from this directory runs both services together. Running Next.js alone does not answer `/api/*` unless that rewrite target is up.

Refresh the CSVs with `python ingest.py`. That replaces `data/documents.csv` and `data/chunks.csv`. Loading those rows into Snowflake is a separate step. The answer path reads Snowflake, not the CSV.

Check the model with `python llm.py`. Check the token with `python connectionTest/test_pat.py`. Check a chunk query with `python connectionTest/test_chunks.py`.

## Environment

Secrets stay in `.env`. The server reads these names (whitespace is trimmed):

| Variable | Role |
| --- | --- |
| `SNOWFLAKE_ACCOUNT_IDENTIFIER` | Account host. `SNOWFLAKE_ACCOUNT` is the alias. |
| `SNOWFLAKE_PAT` | Programmatic access token. `SNOWFLAKE_TOKEN` is the alias. |
| `SNOWFLAKE_ROLE` | Role for the SQL API. |
| `SNOWFLAKE_WAREHOUSE` | Warehouse for the SQL API. |
| `SNOWFLAKE_DATABASE` | `GREEN_GAVEL` |
| `SNOWFLAKE_SCHEMA` | `PUBLIC` |
| `OPENROUTER_API_KEY` | Primary answer model. |
| `OPENROUTER_MODEL` | Default `openai/gpt-4o-mini`. |
| `GEMINI_API_KEY` | Fallback answer model. |
| `GEMINI_MODEL` | Default `gemini-3.8-flash`. |
| `ELEVENLABS_API_KEY` | Speech to text and text to speech. |
| `ELEVENLABS_VOICE_ID` | Brief voice. |
| `DEMO_CACHE` | `1` replays `backend/data/demo_replay.json`. Default `0`. |
| `RETRIEVER` | Reported by `/api/health`. Default `snowflake`. |
| `FRONTEND_ORIGIN` | Extra CORS origin. Default `http://localhost:3000`. |
| `NEXT_PUBLIC_API_URL` | Optional browser API prefix. Empty means the same origin. |
| `API_PROXY` | Local Next.js rewrite target. Default `http://127.0.0.1:8000`. |

`DEMO_CACHE=1` only matches two normalized sample questions in `backend/data/demo_replay.json`. Those replies are labeled sample data.

## Deploy

`vercel.json` is one Vercel project with two services:

- `backend` uses root `.` and entrypoint `main:app`, because the API imports the root Python modules.
- `frontend` builds from `frontend/`.

`/api/*` goes to FastAPI with the prefix kept. Every other path goes to Next.js. There is no server-to-server binding. Keep the same variable names in the Vercel project environment. Do not put keys in `NEXT_PUBLIC_` variables.

On Vercel, `DATA_DIR` is a temp directory. Answer and MP3 caches are not durable and are not shared across instances. The CSV files and `demo_replay.json` stay in the deployment. A reliable production brief needs shared answer storage and object storage for MP3s.

## Design

The skin is `frontend/src/styles/aero.css`. Tokens, gel buttons, glass panels, and motion rules are listed in `docs/frutiger-aero.md`.

Body text uses ink `#0b2e4f` on glass. Gel controls use white labels. Focus rings are amber. `prefers-reduced-motion` skips the boot animation and turns decorative motion off. Below 800px the chat and sources stack.

Credits, also in `frontend/public/aero/CREDITS.txt`:

- Wallpapers: KnightAnNi, Frutiger Aero Wallpapers, CC0.
- Icons: AeroMedia by On N Off, CC BY 4.0, unmodified.
- Type: Selawik, SIL Open Font License 1.1.

## Tests

```bash
cd backend && python -m unittest discover -s tests
```

`test_env_and_retry.py` checks trimmed env values and OpenRouter retry behavior. `test_data_backend.py` calls the live answer and feed services, so it needs Snowflake credentials and the local CSVs.

## Product rules

1. If retrieval finds nothing, the records answer is exactly `The records I have don't say.`
2. Secrets live only in `.env`.
3. The browser never calls Snowflake, ElevenLabs, or Legistar directly.
4. Draft minutes are labeled Draft on source cards and in the spoken brief.
5. User-facing copy stays plain, without em dashes.

`SCOPE.md` is the hackathon build plan. `CHECKLIST.md` is the task list. `AGENTS.md` is the instruction file for coding agents. The folder names in `AGENTS.md` describe the original plan. The tree in this README is the one in the repo.

On Vercel, answer and MP3 caches use temporary storage; bundled demo records
remain read-only. Caches are neither durable nor shared across instances.
Brief and audio requests can return 404 after an instance change. Reliable
production voice briefs require shared answer storage and MP3 object storage.

## Photon iMessage bot

The bot answers direct text messages using the existing `/api/ask` pipeline,
preserving citations and adding numbered source links and Draft labels.
It does not send voice attachments or initiate conversations.

1. Create a cloud project at https://app.photon.codes/.
2. Set `IMESSAGE_PROJECT_ID` and `IMESSAGE_PROJECT_SECRET` in Vercel for the
   deployment environment you will test. Local Next.js variables belong in
   `frontend/.env.local`; see `frontend/.env.example`. Do not expose credentials
   with `NEXT_PUBLIC_` prefixes.
3. Deploy and register `https://YOUR-DOMAIN/api/imessage/webhook` in Photon.
4. Copy the endpoint's signing secret to `IMESSAGE_WEBHOOK_SECRET` in Vercel,
   then redeploy. The adapter verifies incoming signatures. Missing configuration
   returns 503; unsigned requests should be rejected once configured.
5. Text the project's iMessage address or number and inspect Vercel runtime logs.
   Test a records question, an unsupported question, and Draft records.

Run `npm run test:photon --prefix frontend` for the SSE parsing and backend
binding tests, and `npm run build --prefix frontend` for the production build.

Use `vercel dev` for both services and automatic binding injection. Photon needs
a public HTTPS webhook, so a deployed preview is the simplest end-to-end test.
Ensure deployment protection permits Photon to reach that endpoint.

Chat SDK uses in-memory state here. Deduplication and locking do not persist
across instances, so retried webhook deliveries can produce duplicate replies.
Use a shared Chat SDK state adapter before scaling beyond a prototype.
