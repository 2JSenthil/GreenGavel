# Green Gavel checklist

Last checked Sat Oct 10, 5:20 PM against `origin/main` at `829b2f4`, plus local uncommitted work on Jason's Mac. Owners come from the group chat and commit authors. Full detail is in SCOPE.md.

**19 of 69 tasks done.**


## Setup

- [x] Repo, scope doc, AGENTS.md, .env.example, .gitignore, diagrams pushed [Jason] (commit 9dea70b)
- [ ] Rename repo to green-gavel and retitle README (still says HeelMates) [Jason]
- [x] Confirm repo is public (Devpost needs a GitHub link) [Jason] (an anonymous clone worked at 5:17 PM)
- [ ] All three teammates registered on one team in the HackNC portal [Team] (chat mentions a two-person team rule, never confirmed)
- [ ] Devpost draft created with all teammates and the 5 opt-ins [Team]
- [ ] Meet Snowflake and ElevenLabs reps at sponsor fair (Fetzer Gym B, until 3 PM) [Jason]
- [ ] Update AGENTS.md layout to match repo (ingest.py at root, frontend/) [Jason]

## Accounts

- [x] Snowflake: database GAVEL, warehouse, CORTEX_USER role, token, one test call [Josh] (PAT works; SQL API and Cortex chat both called; database is GREEN_GAVEL (commit 742bc0a))
- [ ] ElevenLabs key, one voice chosen, one test MP3 [Unassigned]
- [ ] All keys live in local .env only, never in git or chat [Team]

## Data

- [x] Fetch Town Council events from Legistar (last 6 months) [Josh]
- [x] Download agenda and minutes PDFs, extract, chunk, tag topics [Josh] (33 docs, 169 chunks, 18 meetings)
- [x] Write data/documents.csv and data/chunks.csv with Draft/Final status [Josh]
- [ ] Ingest attachments (staff reports, memos, decks) via eventitems?Attachments=1 [Josh] (demo facts like 57% and 25+ miles appear in 0 chunks)
- [ ] Per-page extraction with a page number on every chunk [Josh]
- [ ] Word-boundary topic regex (trees: 3 of 37 real, transit: 21 of 59) [Josh]
- [ ] Deterministic chunk ids so reloads do not duplicate rows [Josh]
- [ ] Item title and matter name on every chunk [Josh]
- [ ] Threaded downloads with retries and a failure log [Josh]
- [ ] Save data/raw/events.json as offline fallback for the feed [Josh]
- [x] Load ITEMS and CHUNKS into Snowflake, print row counts per topic [Josh] (CHUNKS is queryable in GREEN_GAVEL.PUBLIC; no ITEMS table in the code)
- [ ] 4:00 PM check: every topic chip has 5+ chunks with a real topic word [Josh]
- [ ] Optional: add Planning Commission, Design Commission, Transportation board [Josh]

## Retrieval

- [ ] Cortex Search service CHUNKS_SEARCH created and one real response printed [Josh] (not created; retrieval.py uses SQL LIKE instead)
- [ ] BM25 fallback behind the same retrieve() function [Josh] (retrieval.py ORs LIKE terms and sorts by date, with no relevance ranking)
- [ ] Run first 7 test questions on both retrievers by 5:00 PM, apply 6-of-7 rule [Unassigned]
- [ ] Cite-or-refuse prompt and streaming call to Snowflake chat completions [Josh] (rag.py + llm.py (Gemini) and cortex.py exist; non-streaming, no citation check, no fixed refusal sentence)
- [ ] verify() with one retry, then Closest records cards [Unassigned]
- [ ] Refusal path with no model call when no passage matches [Unassigned]
- [ ] Decide the answer model: Gemini (llm.py) or Snowflake Cortex (cortex.py) [Team] (the MLH Snowflake track expects Cortex; llm.py model id gemini-3.8-flash needs checking)
- [ ] Return chunk ids and page numbers with retrieved rows so answers can cite [Josh] (retrieval.py returns only date, type, status, text, URL)

## API

- [x] GET /api/health and GET /api/feed [Rachel] (commit 829b2f4; /api/feed returns an empty list until it is wired to real meetings)
- [x] POST /api/ask streaming SSE (sources, delta, done, error) [Rachel] (commit 829b2f4; SSE events match the contract, but live answers raise NotImplementedError)
- [x] POST /api/brief [Rachel] (commit 829b2f4; caches MP3 by text hash; ElevenLabs call untested without a key)
- [x] CORS, answer store, request logging [Rachel] (commit 829b2f4; last 50 answers kept in answer_cache.json)
- [x] DEMO_CACHE=1 replay file for tested questions [Rachel] (commit 829b2f4; replay holds 2 labeled sample answers, and DEMO_CACHE defaults to 1)
- [ ] Deploy the API or decide the demo runs from a laptop [Unassigned]
- [x] FastAPI backend skeleton with routes, services, requirements.txt, .env.example [Rachel] (commit 7e98633; files are empty stubs)
- [ ] Move Josh's root-level retrieval.py, rag.py, llm.py into backend/app/services [Josh] (they sit at the repo root, outside backend/)
- [ ] Connect answer_service.py to Josh's retrieval and model (live path raises NotImplementedError) [Rachel] (needs the root-level retrieval.py, rag.py, llm.py moved into backend first)
- [ ] Replace the 2 sample entries in demo_replay.json with real tested answers [Team] (current entries are labeled sample data with invented sources)
- [ ] Wire feed_service.py to real meetings (returns an empty list now) [Josh]

## Voice

- [ ] build_script, tts, and content-hash audio cache [Unassigned] (tts and hash cache exist in brief.py and brief_service.py; no 60-second script builder yet, and the whole answer text is sent)
- [ ] Compare Flash and eleven_v4 clips, keep the better [Unassigned]
- [ ] Check place-name pronunciation and add respellings [Unassigned]
- [ ] Pre-generate MP3s for all 10 test questions [Unassigned]
- [ ] Voice conversation mode (Nice tier): push-to-talk, Web Speech API, then /api/ask and spoken answer [Rachel] (start only after typed Q&A and the brief work)
- [ ] Spoken answer script: 2 to 3 sentences that name the source aloud [Unassigned]
- [ ] Typed-question fallback and out-loud check that demo questions transcribe cleanly [Rachel]

## Front end

- [x] Next.js, TypeScript, Tailwind scaffold with six components [Rachel] (commit 34d2486)
- [x] Replace default page title Create Next App [Rachel] (commit 2b2c60a)
- [ ] Remove invented sources (Planning Department, Environmental Committee) [Rachel] (still in page.tsx, including in the local Aero version)
- [x] Controlled AskBox and topic chips with aria-pressed [Rachel] (commit 2b2c60a)
- [ ] Stream reader for /api/ask with clickable cite chips [Rachel]
- [ ] SourceCard with real PDF link #page=N and Draft badge [Rachel]
- [ ] BriefPlayer plays real audio; FeedStrip reads /api/feed [Rachel]
- [ ] Six states: empty, searching, answered, refused, error, brief loading [Rachel]
- [x] Aero skin: gradient, glass panels, gel buttons, bubbles, grass footer [Jason] (built locally and staged, not on GitHub yet: aero.css, fonts, wallpaper, icons, Bubbles, Desktop)
- [ ] Fix contrast: white on blue-500 is 3.68:1, needs 4.5:1 [Rachel] (blue-500 buttons are gone locally; gel labels are white, so recheck them at 4.5:1)
- [x] Remove dark-mode media query from globals.css [Rachel] (removed in the local Aero work, not pushed)
- [x] Focus ring, button types, aria-live, stacked layout under 800 px [Rachel] (local only: focus-visible ring, aria-live on the answer, stacked layout under 800 px; html and body are overflow hidden, so test long answers and phones)
- [ ] Commit and push the Aero skin work and CHECKLIST.md (staged on Jason's Mac) [Jason] (pull first: nothing new on GitHub since 829b2f4)
- [ ] Credit the AeroMedia icons (CC BY 4.0) and the wallpaper in the app footer or Devpost text [Jason] (CREDITS.txt exists in public/aero; CC BY requires visible attribution)

## Ship

- [ ] Sat 10 PM: Must tier done and test run 1 logged [Team]
- [ ] Sun 12 AM: voice and Aero polish merged [Team]
- [ ] Sun 2 AM: code freeze and audio pre-generated [Team]
- [ ] Sun 6 AM: 2-minute video shot and uploaded unlisted [Team]
- [ ] Sun 8:30 AM: Devpost submitted with repo, video, text, opt-ins [Team]
- [ ] Recount numbers in Devpost text before the 10 AM deadline [Team]
