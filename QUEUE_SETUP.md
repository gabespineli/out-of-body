# Permanent QR and participant queue

This release adds one installation queue to the existing `/` and `/mobile` routes. Management is a compact strip on the same installation page before and between turns. It is hidden during an active participant’s positioning and stretching; there is no separate management page.

## Hosted Supabase configuration

Use the existing dedicated **Out of Body** project. Do not apply these migrations to another application's database.

1. Authenticate and link this checkout to that project's reference. Local Docker setup does not link a hosted project. Find the reference in the project's dashboard URL: `https://supabase.com/dashboard/project/YOUR_OUT_OF_BODY_PROJECT_REF`.
2. Review and apply the pending migration:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_OUT_OF_BODY_PROJECT_REF
npx.cmd supabase migration list
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
```

The new migration is `supabase/migrations/202610140001_participant_queue.sql`. It adds private queue/control/rate-limit/usage tables and service-role-only functions. It preserves the original session schema and private `oob-temporary-artwork` bucket. No participant accounts, public table policies, Realtime subscriptions, or new buckets are required.

If linking asks for a password, use that hosted project's database password, not its API key or installation key. Linking and applying a local migration do not verify hosted migration parity; inspect the migration list and dry run before pushing.

Retain the existing Supabase Cron → Vault → `/api/participant/cleanup` schedule. After deploying, confirm:

- Vault `oob_cleanup_url` points to the deployment's stable HTTPS origin plus `/api/participant/cleanup`.
- Vault `oob_cleanup_secret` matches the app's `OOB_CLEANUP_SECRET`.
- The named `out-of-body-temporary-cleanup` job runs every minute and HTTP responses succeed.

For a fresh project, follow `SUPABASE_SETUP.md`, then run `supabase/setup-cleanup.sql` after configuring Vault. Vercel Hobby's native cron cannot replace a minute scheduler.

## Vercel configuration

Keep the existing server-only settings:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Dedicated Out of Body project URL |
| `SUPABASE_SECRET_KEY` | Server-side backend key |
| `OOB_INSTALLATION_KEY` | Operator key, at least 32 random characters |
| `OOB_CLEANUP_SECRET` | Cleanup key matching Supabase Vault |
| `OOB_PUBLIC_URL` | **Set this to the stable production HTTPS origin before printing the QR**, with no path or query |

Deploy after applying the additive migration. Upload/action/cleanup requests have a 30-second application duration setting; queue waiting is stored in Postgres and does not hold a function open. No extra paid Vercel queue service or Supabase Edge Function is needed.

Do not print a temporary preview deployment address. Once printed, retain the production hostname and `/mobile` route. Changes to sessions, queue state, or QR PNG rendering do not change that encoded address. All old printed pairing links open the permanent queue landing page and discard their obsolete fragment. Legacy APIs remain available for already-open sessions during the transition.

Vercel Hobby eligibility is limited to personal, non-commercial use. Check event eligibility and both providers' dashboards; the app cannot know other projects' usage or the account's remaining quotas.

## Operating the installation

Open `/`, enter the operator key, and leave the page visible. Operator authorization lasts up to eight hours; the queue accepts new participants only while the installation has refreshed its presence within two minutes. Restarting/opening the installation restores intake without changing the printed QR.

- With no tickets, the installation shows a centered permanent QR and upload instructions on the full exhibit background. Mobile-upload and print-download links are directly below it.
- When tickets arrive, the compact top strip shows current/called participant, ticket numbers, optional names, and reserved capacity. The QR remains visible below the strip until a session starts.
- **Call next** chooses the oldest successfully uploaded drawing. A preparation in progress does not block ready tickets.
- **Start participant** explicitly activates the called ticket; upload alone never replaces the active drawing.
- **Remove** cancels a waiting ticket; **End current session** ends the active ticket. Participants can cancel their own ticket from their phone.
- **Skip activity** still skips only an exercise, preserving only earned fade.
- Completion hides the queue. Next participant returns to the QR waiting view and any waiting-ticket controls; staff call/start the next ticket.

Queue management is visible on the same display before and after each turn. Waiting names and queue actions are hidden while a participant aligns and stretches. The phone's Name field remains optional, limited to 40 characters, stripped of invisible controls, and erased as soon as a ticket ends/expires. Staff can call the displayed name; no names are included in public queue-count responses or another phone's response. Cancel my ticket is directly visible and opens a confirmation dialog; Keep my ticket and Escape preserve the ticket and preview.

## Initial limits

| Setting | Value |
|---|---|
| Active tickets | 1 |
| Waiting/preparing/uploading/called slots | 20 combined, reserved atomically |
| Preparation deadline | 10 minutes from reservation |
| Waiting deadline | 90 minutes from successful upload |
| Active deadline | 30 minutes from Start participant |
| Prepared upload | Opaque 600 × 900 PNG, at most 2,500,000 bytes |
| Ticket creation limit | 6 successful reservations/browser/hour and 120/installation/hour |
| Upload attempts | 5/ticket/minute |
| Waiting phone checks | 15 seconds |
| Called/active phone checks | 5 seconds |
| Installation checks | 5 seconds |

The server automatically pauses admission at 20 reserved waiting slots and reopens when a slot is freed. Existing reservations can upload while full. Status reads/admission/operator actions expire stale tickets even if cleanup is temporarily delayed.

Polling suspends when a page is hidden and backs off on network/service errors. The desktop retrieves only the active drawing, once per active ticket during a normal mount. Reloads/retries can retrieve it again; these are counted conservatively before the storage download.

The exhibit has no Usage dropdown. Server-side calendar-month upload/download accounting and the 3 GB warning remain available; the warning is an application estimate, **not an account quota enforcement or billing meter**. It excludes API responses, legacy-session downloads, assets, other projects, and provider accounting differences, and does not stop existing participants. Monitor Supabase egress and Vercel invocations/CPU/memory/transfer in their provider dashboards, particularly for repeated events.

Completed/cancelled artwork deletion is attempted immediately. Scheduled cleanup retries failed deletion, removes expired objects before deleting metadata, and retains a two-minute grace period for a late in-flight upload. Expiration revokes access immediately; physical file deletion depends on the scheduler reaching the app.

## Drawing cleanup

After alignment, the phone estimates neutral paper illumination on a small grid, smooths the estimate, and corrects local brightness/channel balance toward the warm-white fade background. Very dark marks stay exact; already well-lit colorful pixels avoid needless recoloring. It preserves a raster drawing rather than inventing/vectorizing marks.

The mobile preview applies the existing cleanup automatically, without an Adjust photo section or comparison/amount controls. Preview and export use the same processing. Drag/pinch aligns the drawing; Retake / choose again returns to capture. Originals remain local to the phone.

This cannot reliably recover glare, deep shadows, or erased/faint details. Participants should inspect the preview and retake when appropriate. Check physical phones and actual exhibition lighting before use.

## Local verification

With Docker running:

```powershell
npm.cmd run backend:start
npx.cmd supabase migration up --local
npm.cmd run backend:env
npm.cmd run build
npm.cmd run dev
```

The environment helper preserves existing local keys and refuses to overwrite a cloud environment. For browser QA, temporarily set `$env:OOB_LOCAL_APP_PORT = '3202'` before `backend:env`, then restore port 3000 afterward. Automated backend tests refuse hosted projects, use synthetic artwork, and remove their test tickets/objects.

The Figma design is implemented with local assets and fonts; its completion shader uses the approved still background. The flow separates queue management, camera positioning and active stretching. The active view shows two live canvases and four compact controls; the webcam runs without a visible preview. Queue controls return after Next participant. The original uploader and movement engine remain available at `/test`. This styling update requires no additional Supabase migration or Vercel environment variable.
