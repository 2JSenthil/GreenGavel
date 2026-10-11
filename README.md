# HeelMates

## Vercel services

Import this repository as one Vercel project with its root set to this directory.
`backend` uses root `.` because it imports the shared root Python modules.
`main.py` exposes the ASGI app. Root `requirements.txt` lists backend dependencies
directly for Vercel's dependency parser. Keep it in sync with
`backend/requirements.txt` when adding or changing Python dependencies.
`frontend` builds independently from `frontend/`.

Public `/api/*` requests reach FastAPI with their prefix preserved. All other
paths reach Next.js. Browser API and audio URLs use the same origin.
The Photon webhook at `/api/imessage/webhook` routes to Next.js before the general
API rewrite. Its bot calls Python through the frontend's `BACKEND_URL` service
binding targeting `backend`. This variable is read only inside runtime functions.
Never set a binding variable manually or expose it through `NEXT_PUBLIC_`.

Install with `python -m pip install -r requirements.txt` and
`npm install --prefix frontend`. Run `vercel dev` from this directory to test
both services together, or `vercel dev -L` without Cloud authentication.
Use that single origin; running Next.js alone does not route `/api/*` to Python.

Keep local secrets in `.env`. Configure equivalent server-side variables in
Vercel project environment settings using `.env.example` as a guide.
Retrieval uses `SNOWFLAKE_ACCOUNT_IDENTIFIER` and `SNOWFLAKE_PAT`.
No public API base URL is needed. `DEMO_CACHE=0` disables bundled demo answers.

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
