# Supabase startup and cloud setup

For the permanent QR and queue release, also apply `202610140001_participant_queue.sql` and follow [QUEUE_SETUP.md](QUEUE_SETUP.md). The new queue uses the same project, bucket, server variables, and cleanup schedule.

The local Out of Body instance is separate from the existing projects on ports 54321–54323. Its project ID is `out-of-body-participant-mvp`, with API **55321**, database **55322**, and Studio **55323**.

## Start locally

1. Open Docker Desktop and wait for the engine to run.
2. Open PowerShell in the application folder:

```powershell
cd "C:\Users\Gab\Documents\Codex\2026-10-03\referenced-chatgpt-conversation-this-is-an\outputs\out-of-body-vercel"
npm.cmd ci
npm.cmd run backend:start
npm.cmd run backend:env
npm.cmd run dev
```

`backend:start` creates the dedicated local Docker network and starts only this project's Supabase containers. First startup applies the included migration: a private artwork bucket and the session table. `backend:env` reads the local CLI configuration without printing keys, writes the ignored `.env.local`, and schedules minute-by-minute cleanup for the app on port 3000.

Open:

| Purpose | URL |
|---|---|
| Desktop participant journey | http://localhost:3000/installation |
| Original local-upload / Manual demo MVP | http://localhost:3000/ |
| Mobile flow in a separate browser session | The QR/pairing link shown by the installation |
| Local Supabase Studio | http://localhost:55323 |

Enter the `OOB_INSTALLATION_KEY` from your local `.env.local` once on the desktop pairing screen. The phone uses the QR, never this key. Use a separate browser/profile for the phone test so it has its own cookies.

Keep the app terminal running. Ctrl+C stops Next.js. To stop only this Supabase project while preserving its local data:

```powershell
npm.cmd run backend:stop
```

Normal startup does not reset participant tables or other projects. A physical phone's `localhost` refers to the phone itself, so real phone pairing needs a shared HTTPS application URL. Use the cloud setup below for that test.

## Prepare the NEW dedicated cloud project

Create an Out of Body project in your Supabase account. Keep it separate from CleanHAUL and other applications. The local Docker instance and cloud project are independent; starting Docker does not create or deploy a cloud project.

From this checkout, authenticate and link to the new project's reference:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_OUT_OF_BODY_PROJECT_REF
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
```

Check that the linked reference is the new Out of Body project before the final command. The migration creates `public.oob_sessions`, enables RLS, removes direct participant table access, and creates the private `oob-temporary-artwork` bucket. The application accesses it only through its authorized server routes.

Configure these **server-only** Vercel environment variables using that project's Settings → API Keys:

| Name | Value |
|---|---|
| `SUPABASE_URL` | The new project's HTTPS URL |
| `SUPABASE_SECRET_KEY` | A backend secret key from the new project |
| `OOB_INSTALLATION_KEY` | A separate random value of at least 32 characters |
| `OOB_CLEANUP_SECRET` | Another separate random value of at least 32 characters |
| `OOB_PUBLIC_URL` | Optional canonical HTTPS application origin for QR links |

Generate the two application secrets independently, or choose your own secure random values. The generated local `.env.local` already contains local-only application secrets; cloud credentials belong in Vercel, outside Git and chat. The app also accepts legacy `SUPABASE_SERVICE_ROLE_KEY` for compatibility, but the new project should use `SUPABASE_SECRET_KEY`.

Deploy the participant-journey branch to a Vercel preview first. Both devices must open that same deployment. Set `OOB_PUBLIC_URL` to its origin only, with no path/query. Once checked and merged, use `main` for production. No new Supabase account login is required for participants.

## Activate cloud automatic cleanup

After deploying, use the new project's Vault dashboard to create:

- `oob_cleanup_url`: `https://YOUR_APP/api/participant/cleanup`
- `oob_cleanup_secret`: exactly the application's `OOB_CLEANUP_SECRET`

Run [supabase/setup-cleanup.sql](supabase/setup-cleanup.sql) in that project's SQL Editor. It creates a private dispatcher and a job every minute. The dispatcher reads the encrypted Vault values and calls the protected application cleanup endpoint. No secret values are embedded in the SQL file.

Check the Cron history and successful HTTP responses before exhibition use. The application rejects expired capabilities after 30 minutes. The cleanup worker removes expired storage files through the Storage API before deleting their metadata. A two-minute grace period covers uploads interrupted by reset; normal cleanup is therefore approximately 32–33 minutes after an abandoned session starts. Completion/reset attempt file deletion immediately; failed deletion remains queued for retry. A disconnected or stopped app delays physical deletion until the cleanup endpoint is reachable again.

The local `backend:env` script configures the same scheduler automatically, targeting the local app through Docker's host connection. It touches only the named Out of Body test database.

## Verify both devices

1. Open `/installation`, enter the installation key and create a QR.
2. Scan it on the phone. Use the landing action, open the camera or choose a photo, adjust the preview, and send.
3. Confirm the actual drawing appears automatically on the desktop and the phone reports receipt.
4. Enable the desktop webcam or select Manual demo. Start the guide and complete all three activities.
5. Confirm the completion screen, region-specific fading and PNG download.
6. Select Next participant. Confirm a different QR appears, the old phone cannot upload, and no previous drawing is shown.
7. In Studio, verify the previous storage object was deleted. Check the scheduled cleanup for abandoned sessions.

Uploaded originals remain in the phone's memory. Only a flattened, metadata-free 600 × 900 PNG is sent, capped at 2.5 MB. The default template still requires an upright, front-facing photograph; there is no automatic perspective or arbitrary-art recognition.

## Automated tests

Start the backend and generate local environment settings first. For browser tests, temporarily point the local cleanup job at the suite's app port:

```powershell
$env:OOB_LOCAL_APP_PORT = "3202"
npm.cmd run backend:env
npm.cmd run build
npm.cmd run test:browser
Remove-Item Env:\OOB_LOCAL_APP_PORT
npm.cmd run backend:env
```

The final `backend:env` restores cleanup to normal development port 3000. The participant tests refuse to modify hosted databases and skip unless the backend is the dedicated localhost instance on 55321. Optional MediaPipe reference-photo replays require the existing three Y4M fixture environment variables.

## Reference

The implementation follows [Supabase local development](https://supabase.com/docs/guides/local-development), [private bucket access](https://supabase.com/docs/guides/storage/buckets/fundamentals), [server API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Storage API deletion](https://supabase.com/docs/guides/storage/schema/design), and [Cron/Vault scheduling](https://supabase.com/docs/guides/functions/schedule-functions).
