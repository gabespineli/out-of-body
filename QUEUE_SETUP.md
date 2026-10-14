# Permanent QR and participant queue

This release adds one installation queue to the existing `/installation` and `/mobile` routes. Management is a compact strip above the stretching screen; there is no management page.

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

Open `/installation`, enter the operator key, and leave the page visible. Operator authorization lasts up to eight hours; the queue accepts new participants only while the installation has refreshed its presence within two minutes. Restarting/opening the installation restores intake without changing the printed QR.

- The top strip shows current/called participant, ticket numbers, optional names, and reserved capacity.
- **Permanent QR** opens the QR/link and a PNG download for printing.
- **Call next** chooses the oldest successfully uploaded drawing. A preparation in progress does not block ready tickets.
- **Start participant** explicitly activates the called ticket; upload alone never replaces the active drawing.
- **Call later** moves a ready/called ticket behind other ready tickets without extending expiry.
- **Remove** cancels a waiting ticket; **End current session** ends the active ticket. Participants can cancel their own ticket from their phone.
- **Skip activity** still skips only an exercise, preserving only earned fade.
- Completion leaves the top queue visible. Next participant returns to waiting; staff call/start the next ticket.

Queue management is visible on the same display, including fullscreen. Names may be seen on the exhibit screen; the phone field explains that staff use the name to call the ticket. First name/nickname is optional, limited to 40 characters, stripped of invisible controls, and erased as soon as a ticket ends/expires. No names are included in public queue-count responses or another phone's response.

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

`Usage` shows calendar-month upload count, image-download count, and attempted image bytes. A warning appears at 3 GB. This is an application estimate, **not an account quota enforcement or billing meter**: it excludes API responses, legacy-session downloads, assets, other projects, and provider accounting differences. The warning does not stop existing participants. Monitor Supabase egress and Vercel invocations/CPU/memory/transfer, particularly for repeated events.

Completed/cancelled artwork deletion is attempted immediately. Scheduled cleanup retries failed deletion, removes expired objects before deleting metadata, and retains a two-minute grace period for a late in-flight upload. Expiration revokes access immediately; physical file deletion depends on the scheduler reaching the app.

## Drawing cleanup

After alignment, the phone estimates neutral paper illumination on a small grid, smooths the estimate, and corrects local brightness/channel balance toward the warm-white fade background. Very dark marks stay exact; already well-lit colorful pixels avoid needless recoloring. It preserves a raster drawing rather than inventing/vectorizing marks.

Original/Cleaned comparison, a cleanup amount slider, and Turn off cleanup are in the preview. Original is a comparison view; the configured cleaned result is what is submitted. Set cleanup to zero to submit the original aligned pixels. Preview and export use the same processing. Originals remain local to the phone.

This cannot reliably recover glare, deep shadows, or erased/faint details. Participants should inspect the preview and retake or turn off cleanup when appropriate. Check physical phones and actual exhibition lighting before use.

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

High-fidelity Figma styling is deferred. The functional layout puts the compact queue first, the two canvases beneath it, and camera/session setup controls below the stage. The original `/` uploader and movement engine remain available.
