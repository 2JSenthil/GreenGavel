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
There are no server-to-server calls between these services, so no bindings are
needed. If server-side frontend calls are added, declare a binding on `frontend`
targeting `backend` and consume its injected URL in runtime functions only.
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
