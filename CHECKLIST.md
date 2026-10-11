# Green Gavel checklist

Last checked Sat Oct 10, 9:50 PM against `origin/main` at `4f24d41` (local `main` is 2 commits behind origin: `6b66142` adds photon deps, plus its merge commit — not yet pulled), local HEAD `5709427`, plus local uncommitted edits on Jason's Mac (data/answer_cache.json, Desktop.tsx, aero.css). Owners come from the group chat and commit authors. Full detail is in SCOPE.md.

**34 of 73 tasks done.**

**Risk flagged this check:** `backend/app/services/retrieval_service.py` and `snowflake_service.py` (new, unpushed-logic-wise they're in 5709427) implement a real relevance-ranked fallback and a Snowflake SQL search — but the live answer path (`answer_service.py` → `ask.py`) still imports the OLD root-level `retrieval.py`/`llm.py`/`rag.py`, which has no ranking, no chunk ids, and page hard-coded to 1. The new service files are effectively dead code right now. Someone needs to decide: wire `answer_service.py` to the new services, or drop them.

## Setup

- [x] Repo, scope doc, AGENTS.md, .env.example, .gitignore, diagrams pushed [Jason] (commit 9dea70b)
- [ ] Rename repo to green-gavel and retitle README (still says HeelMates) [Jason]
- [x] Confirm repo is public (Devpost needs a GitHub link) [Jason] (an anonymous clone worked at 5:17 PM)
- [ ] All three teammates registered on one team in the HackNC portal [Team] (chat mentions a two-person team rule, never confirmed; not checkable from the repo)
- [ ] Devpost draft created with all teammates and the 5 opt-ins [Team] (not checkable from the repo)
- [ ] Meet Snowflake and ElevenLabs reps at sponsor fair (Fetzer Gym B, until 3 PM) [Jason] (time has passed; confirm with Jason whether this happened)
- [ ] Update AGENTS.md layout to match repo (ingest.py at root, frontend/) [Jason]

## Accounts

- [x] Snowflake: database GAVEL, warehouse, CORTEX_USER role, token, one test call [Josh] (PAT works; SQL API and Cortex chat both called; database is GREEN_GAVEL (commit 742bc0a))
- [x] ElevenLabs key, one voice chosen, one test MP3 [Unassigned] (key and voice id are set in .env; 5 MP3s already generated in backend/data/audio)
- [x] All keys live in local .env only, never in git or chat [Team] (.env is gitignored; checked both .env.example files and no real value matches .env (only model name and origin); keys are shared with the team)

## Data

- [x] Fetch Town Council events from Legistar (last 6 months) [Josh]
- [x] Download agenda and minutes PDFs, extract, chunk, tag topics [Josh] (33 docs, 169 chunks, 18 meetings)
- [x] Write data/documents.csv and data/chunks.csv with Draft/Final status [Josh]
- [ ] Ingest attachments (staff reports, memos, decks) via eventitems?Attachments=1 [Josh] (not rechecked this pass)
- [ ] Per-page extraction with a page number on every chunk [Josh] (not rechecked this pass; still relevant since page is hard-coded to 1 downstream)
- [ ] Word-boundary topic regex (trees: 3 of 37 real, transit: 21 of 59) [Josh] (not rechecked this pass)
- [ ] Deterministic chunk ids so reloads do not duplicate rows [Josh] (not rechecked this pass)
- [ ] Item title and matter name on every chunk [Josh]
- [ ] Threaded downloads with retries and a failure log [Josh]
- [ ] Save data/raw/events.json as offline fallback for the feed [Josh]
- [x] Load ITEMS and CHUNKS into Snowflake, print row counts per topic [Josh] (CHUNKS is queryable in GREEN_GAVEL.PUBLIC; no ITEMS table in the code)
- [ ] 4:00 PM check: every topic chip has 5+ chunks with a real topic word [Josh] (deadline passed; confirm with Josh whether this ran)
- [ ] Optional: add Planning Commission, Design Commission, Transportation board [Josh]

## Retrieval

- [ ] Cortex Search service CHUNKS_SEARCH created and one real response printed [Josh] (still not created; both the old retrieval.py and the new snowflake_service.py use SQL LIKE, not a Cortex Search service)
- [~] BM25 fallback behind the same retrieve() function [Josh] (backend/app/services/retrieval_service.py now has a real term-frequency ranked fallback behind its own retrieve_chunks() — but see the risk note above, this isn't the retrieve() the live answer path actually calls)
- [ ] Run first 7 test questions on both retrievers by 5:00 PM, apply 6-of-7 rule [Unassigned] (deadline passed; confirm status)
- [ ] Cite-or-refuse prompt and streaming call to Snowflake chat completions [Josh] (ask_llm's prompt now has explicit cite-or-refuse rules and a fixed refusal sentence, which is real progress — but the call is still OpenRouter/Gemini, non-streaming under the hood with the SSE chunking done client-side, not a Snowflake Cortex streaming call)
- [ ] verify() with one retry, then Closest records cards [Unassigned] (not implemented)
- [x] Refusal path with no model call when no passage matches [Unassigned] (confirmed: answer_service.generate_answer returns the fixed refusal immediately when retrieve_chunks finds no rows, no LLM call made)
- [x] Decide the answer model: Gemini (llm.py) or Snowflake Cortex (cortex.py) [Team] (live path calls Gemini through OpenRouter (llm.py, OPENROUTER_MODEL google/gemini-3.8-flash); cortex.py/snowflake_service.py's generate_cortex_answer exist but are unused by the live path)
- [ ] Return chunk ids and page numbers with retrieved rows so answers can cite [Josh] (still open on the live path: map_sources() in answer_service.py hard-codes page=1 and never carries a chunk_id; the new retrieval_service.py's Snowflake branch passes through a real page number but, again, isn't wired in)

## API

- [x] GET /api/health and GET /api/feed [Rachel] (commit 829b2f4; /api/feed returns an empty list until it is wired to real meetings)
- [x] POST /api/ask streaming SSE (sources, delta, done, error) [Rachel] (commit 829b2f4; SSE events match the contract, but live answers raise NotImplementedError)
- [x] POST /api/brief [Rachel] (pushed in a8f56f2; now returns JSON (audio_url, script, seconds, cached) and GET /api/audio/{name} serves the MP3)
- [x] CORS, answer store, request logging [Rachel] (commit 829b2f4; last 50 answers kept in answer_cache.json)
- [x] DEMO_CACHE=1 replay file for tested questions [Rachel] (commit 829b2f4; replay holds 2 labeled sample answers, and DEMO_CACHE defaults to 1)
- [ ] Deploy the API or decide the demo runs from a laptop [Unassigned] (vercel.json now exists in the repo, so this may be in progress — confirm with the team whether it's actually deployed)
- [x] FastAPI backend skeleton with routes, services, requirements.txt, .env.example [Rachel] (commit 7e98633; files are empty stubs)
- [ ] Move Josh's root-level retrieval.py, rag.py, llm.py into backend/app/services [Josh] (still at repo root, confirmed unchanged; backend still imports them with a sys.path insert)
- [x] Connect answer_service.py to Josh's retrieval and model (live path raises NotImplementedError) [Rachel] (pushed in a8f56f2; live path calls retrieve_chunks and ask_llm, falls back to the refusal when no rows; Josh's modules load via sys.path from the repo root)
- [ ] Replace the 2 sample entries in demo_replay.json with real tested answers [Team] (not rechecked this pass; DEMO_CACHE=1 in .env.example default, confirm the real .env)
- [x] Wire feed_service.py to real meetings (returns an empty list now) [Josh] (confirmed: feed_service.py now reads data/documents.csv, filters to the last N days, and returns real Meeting rows — note FeedStrip.tsx, the one UI consumer, was deleted in this diff, so nothing in the frontend currently calls /api/feed)
- [x] Commit and push the local backend and voice work (live answer path, brief script, /api/audio, /api/transcribe, TalkApp, llm.py routing) [Rachel] (a8f56f2 (Sat 6:59 PM))
- [ ] Run one live /api/ask with DEMO_CACHE=0 for each topic chip and log the answers [Team] (not confirmed this pass)
- [x] Add backend/data/answer_cache.json to .gitignore (currently untracked, holds sample answers) [Rachel] (confirmed: data/answer_cache.json and backend/data/answer_cache.json are both now in .gitignore; note data/answer_cache.json still shows as a locally modified tracked file in git status, worth a quick git rm --cached if it was already committed before being ignored)

## Voice

- [x] build_script, tts, and content-hash audio cache [Unassigned] (pushed in a8f56f2; build_script names the source and date aloud, content-hash cache, model eleven_flash_v2_5)
- [ ] Compare Flash and eleven_v4 clips, keep the better [Unassigned] (code still uses eleven_flash_v2_5; no side-by-side clip comparison yet)
- [ ] Check place-name pronunciation and add respellings [Unassigned]
- [ ] Pre-generate MP3s for all 10 test questions [Unassigned] (still only 5 MP3s in backend/data/audio)
- [x] Voice conversation mode (Nice tier): push-to-talk, Web Speech API, then /api/ask and spoken answer [Rachel] (pushed in a8f56f2; TalkApp records with MediaRecorder, POST /api/transcribe (ElevenLabs speech-to-text scribe_v1), router sends chat vs records, then ask and brief. Not confirmed tested end to end)
- [x] Spoken answer script: 2 to 3 sentences that name the source aloud [Unassigned] (pushed in a8f56f2; script is intro, answer sentences, 'That comes from the <body> on <date>', draft warning)
- [ ] Typed-question fallback and out-loud check that demo questions transcribe cleanly [Rachel]

## Front end

- [x] Next.js, TypeScript, Tailwind scaffold with six components [Rachel] (commit 34d2486)
- [x] Replace default page title Create Next App [Rachel] (commit 2b2c60a)
- [x] Remove invented sources (Planning Department, Environmental Committee) [Rachel] (confirmed: no match for either string anywhere in frontend/src/app/page.tsx now; TalkApp and the chat view both show real sources only)
- [x] Controlled AskBox and topic chips with aria-pressed [Rachel] (commit 2b2c60a)
- [~] Stream reader for /api/ask with clickable cite chips [Rachel] (the SSE stream reader itself is implemented and working in page.tsx (route/sources/delta/done/error handling) — but sources render as a SourceCard list beside the latest answer, not as inline clickable cite chips within the answer text)
- [ ] SourceCard with real PDF link #page=N and Draft badge [Rachel] (Draft badge is done; the #page=N approach was replaced with an in-app PDF preview window (previewUrl/usePreview), which doesn't pass a page number at all now — worth confirming with Rachel whether that's the intended final design or still needs a page anchor)
- [ ] BriefPlayer plays real audio; FeedStrip reads /api/feed [Rachel] (BriefPlayer.tsx is gone, brief playback now lives inside TalkApp as before — but FeedStrip.tsx has been deleted entirely in this diff, not just left static, so this item may need rewording or dropping depending on whether a feed UI is still planned)
- [ ] Six states: empty, searching, answered, refused, error, brief loading [Rachel] (partial: empty state and a "searching" typing indicator both exist now in page.tsx; answered/error exist; there's still no visually distinct refused state (it renders like a normal answer) and no brief-loading state in this view)
- [x] Aero skin: gradient, glass panels, gel buttons, bubbles, grass footer [Jason] (built locally and staged, not on GitHub yet: aero.css, fonts, wallpaper, icons, Bubbles, Desktop)
- [ ] Fix contrast: white on blue-500 is 3.68:1, needs 4.5:1 [Rachel] (aero.css still shows as a locally modified, uncommitted file — same status as last check, recheck once pushed)
- [x] Remove dark-mode media query from globals.css [Rachel] (removed in the local Aero work, not pushed)
- [x] Focus ring, button types, aria-live, stacked layout under 800 px [Rachel] (local only: focus-visible ring, aria-live on the answer, stacked layout under 800 px; html and body are overflow hidden, so test long answers and phones)
- [x] Commit and push the Aero skin work and CHECKLIST.md (staged on Jason's Mac) [Jason] (a8f56f2 (Sat 6:59 PM); this CHECKLIST.md edit is local again)
- [x] Credit the AeroMedia icons (CC BY 4.0) and the wallpaper in the app footer or Devpost text [Jason] (credit line is in Desktop.tsx footer (wallpaper CC0, icons CC BY 4.0); public/aero/CREDITS.txt also pushed)
- [x] Records app: browse and search Legistar agendas, minutes and attachments with an in-app PDF viewer (/api/records, /api/records/file proxy with host allowlist and Range support) [Jason] (a8f56f2; not in the original scope, adds a second way to open the source PDFs)

## Ship

- [ ] Sat 10 PM: Must tier done and test run 1 logged [Team] (10 minutes out as of this check — Retrieval and parts of API are still open)
- [ ] Sun 12 AM: voice and Aero polish merged [Team] (Desktop.tsx and aero.css are still uncommitted locally)
- [ ] Sun 2 AM: code freeze and audio pre-generated [Team]
- [ ] Sun 6 AM: 2-minute video shot and uploaded unlisted [Team]
- [ ] Sun 8:30 AM: Devpost submitted with repo, video, text, opt-ins [Team]
- [ ] Recount numbers in Devpost text before the 10 AM deadline [Team]
