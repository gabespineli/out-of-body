## Phone camera selector removed - 15 October 2026

Removed the phone camera dropdown at the user's request. Phone capture again requests the normal rear-facing camera, ignores the old photo-camera preference, and keeps automatic opening for previously granted permission. The stretching camera selector, its remembered choice and countdown reset remain available.

Production build, TypeScript during the build, whitespace checks and five affected browser scenarios passed. Checks covered no phone selector, automatic capture and Retake, rear/default camera constraints despite an old saved USB preference, stream release, permission denial/cancellation and continued exhibit selection. A real synthetic-frame upload matched the phone preview pixels in private storage. Its test now verifies only its own upload instead of attempting to activate the queue while the user's local session is active. No user queue record was changed or removed; no deployment/configuration change was made.

## Camera selection and automatic opening - 15 October 2026

Added a compact native camera selector directly below the positioning preview and phone capture preview, also available in local setup tools. The list refreshes on device changes and after permission, filters out audio inputs, and remembers separate exhibit/photo camera choices in local browser storage. Explicit selection uses an exact device constraint and releases the previous stream first. Changing cameras resets the positioning countdown. The preview adapts to viewport height so the selector and Back fit at 1363 x 783.

Entering camera setup automatically opens previously granted access. An unsupported permission query falls back to existing labelled video inputs. First-time/denied access keeps an explicit open button. Cancel/Back invalidates pending permission checks and late streams; the same visit does not automatically reopen after cancellation. Connected-camera changes are handled during model loading as well as live tracking.

Production build, TypeScript, whitespace checks, all **62 unit tests** and **22 distinct affected browser scenarios passed**. Tests covered named camera switching, hotplug/removal, disconnected and busy devices, saved choice on reload/retake, automatic opening, permission denial, unsupported permission queries, cancellation during opening, delayed permission lookup after leaving, countdown reset, fullscreen/framing recovery, phone capture-to-preview stream release, photo download recovery and existing webcam/model failure fallbacks. Two initial new-test assertions matched duplicate hidden setup errors; scoping them to the visible positioning gate resolved the test ambiguity. No application defect was hidden by those assertion changes.

Rendered setup and phone screenshots were inspected and saved outside the repository under `camera-selection/`. Tests used synthetic browser streams and a synthetic video frame; a physical USB camera has not been validated. Test-owned database records were cleaned. No additional Supabase migration or Vercel setting is required for this camera update. No commit or deployment was performed.

## Side raises, phone downloads and stretch celebrations - 15 October 2026

Replaced the heel-raise stage and side-view guide with extended selected-side leg raises. Each leg still earns eight seconds: one third side steps, two thirds side raises. Foot-detail visibility is no longer needed for this sequence. Completed regions trigger one brief confetti burst; skips do not. Reduced-motion users receive the quiet completion message.

The installation sends its final canvas to private storage before completing the ticket. Only the owning phone can download that result for one hour. The exhibit directs saving to the phone; retries preserve the first stored frame, and original uploads are deleted immediately. Added `202610150001_queue_results.sql`, applied only to the dedicated local Docker database. Hosted Supabase must apply it before deployment; no new Vercel variable is required.

- Production build, TypeScript, whitespace checks and all **62 unit tests passed**.
- **53 distinct affected browser scenarios passed** across the initial batch and focused reruns. One optional static-camera replay was skipped because its external fixture was not configured; no physical camera/device validation is claimed.
- Coverage includes both leg sides, opposite-side/missing-landmark rejection, region-specific fades, partial skips, repeated/final celebrations, reduced motion, phone completion from Home, downloads/reload/retry, non-overlapping phone controls at 320/390/430 pixels, queue cancellation/rejoining and completion recovery.
- The real local phone-to-exhibit flow compared every downloaded image pixel with the captured final canvas after its opaque export. API checks verified ownership, query-ID isolation, inactive/cancelled rejection, one-hour retention, interrupted-publication recovery and first-frame preservation on repeated completion.
- Initial failures came from the new phone test matching Next's separate route announcer, unavailable browser inspection of a Blob request body, and a local scheduler pointing at inactive port 3000. Scoped the alert assertion, captured the actual canvas export for pixel comparison, and temporarily directed the local scheduler to the test server. Both scheduled deletion tests passed; the original port 3000 address was restored. Environment files and unrelated Docker projects were unchanged.
- Screenshots were inspected and saved outside the repository under `stretch-completion/`. Test-owned tickets/files were removed. No commit, hosted migration or deployment was performed.

## Simplified phone queue status — 14 October 2026

Rechecked Figma ending frame `16:144` and applied its logo/title/message/Home spacing to the phone status screen. Waiting participants see one short message with their current place (`ahead + 1`) rather than the permanent ticket number. Called participants receive a short move-to-screen cue within the waiting state; active participants see Drawing on screen and the Figma stretching instruction. Removed repeated names, ticket-number footers and expiry/helper paragraphs. Home and confirmed cancellation remain available, with cancellation centered below Home.

Production build, TypeScript, whitespace checks and all **30 affected browser scenarios passed**. The new status check verified live position updates, called/active transitions, source-frame geometry and non-overlapping controls at 320 × 600, 390 × 783 and 430 × 932. Existing cancellation/restoration, prepared-image matching, local camera capture/denial and Supabase-backed upload/queue/completion checks passed. Source and implementation images were compared using the existing local Figma background, logo and home SVG; no new assets or backend changes were needed. Current screenshots are saved outside the repository under `mobile-queue-simple/`. Changes remain local and undeployed.

## Automatic positioning countdown — 14 October 2026

Replaced Start stretching with a centered 3 → 2 → 1 overlay in the camera preview. Three seconds of continuously valid, visible tracking open the guided view automatically. Invalid required landmarks, hidden tabs and stale frame gaps reset the countdown; Back to setup discards it. Counting uses framing timestamps rather than a delayed timer, so no movement is credited during positioning and a suspended tab cannot start later. Camera retry/cancellation controls and explicit Continue in the tracking-loss prompt remain available.

Production build, TypeScript, whitespace checks, all **63 unit tests** and **nine affected browser scenarios** passed. Browser coverage included centered counts and reset, hidden/abandoned positioning, fullscreen, one preserved camera stream, tracking recovery/fades, manual pause, focus recovery and the actual local queue-to-completion flow. Countdown screenshots are saved outside the repository under `positioning-countdown/`; the camera image is a synthetic test fixture. Physical participant/camera verification remains separate. No database or hosting configuration changed, and no deployment was performed.

## Exhibit root and test route — 14 October 2026

The exhibit installation now opens at `/`. The former root local-upload/manual-demo page is available at `/test`; its link from the installation unlock screen was updated. `/installation` redirects to `/` for existing bookmarks. The `/mobile` route and permanent printed QR address are unchanged.

Production build and whitespace checks passed. All **11 affected browser scenarios passed**, covering the three-route navigation/redirect, root unlock and waiting queue, call/recovery/completion, original drawing upload and movement on `/test`, desktop design geometry and the actual local Supabase-backed phone-to-installation flow. Browser fixtures and current setup documentation now use the new routes. No new database migration or environment setting is required; changes remain local and undeployed.

## Minimal phone preview and confirmed cancellation — 14 October 2026

Removed the Adjust photo section, including its zoom/reset, sliders and cleanup comparison controls, at the user's request. Drag/pinch and keyboard alignment remain available; existing cleanup runs automatically and the uploaded PNG matches the displayed preview. The field label is now Name without helper copy. Retake / choose again is a shaped cream button. Cancel my ticket is directly visible and opens a matching native modal dialog instead of Ticket options.

- Production build, TypeScript and whitespace checks passed. **39 distinct affected browser scenarios passed across the initial run and focused reruns**, including Chromium touch and desktop WebKit, preview/upload pixel matching, repeated cancellation/rejoining, retry/recovery, ticket expiry, queue capacity/private storage and the local installation completion flow.
- The initial 39-scenario run passed 38 and exposed an obsolete scrolling-test coordinate that now lay inside the full-width photo. The test now starts on the actual instruction text outside the gesture surface and passed its focused rerun. The final four checks passed together after the final build.
- Keep my ticket and Escape preserved the photo/name and returned focus to the visible cancel control; neither sent a cancellation request. Confirming sent one cancellation request. Expiry closed an open prompt without cancelling a subsequent ticket. WebKit also opened and dismissed the native dialog successfully.
- Screenshot evidence is saved outside the repository under `mobile-simple-preview/`. No schema, environment-variable, commit or deployment change was made. Existing local preparation data was preserved; test-owned artwork cleanup completed.

## Installation welcome and simplified queue — 14 October 2026

The unlocked installation now fills the viewport with the existing exhibit gradient/texture. Previously, its background ended at the height of the top controls. An empty queue presents the permanent QR and upload instructions as one centered welcome view; waiting tickets reveal a cohesive compact management strip. Removed the QR dropdown, Usage dropdown and Call later buttons. Call next selects a ready ticket, and Start participant explicitly begins that person's session. The favicon now uses the user's transparent `pink_logo.png`, fitted to a square 64 × 64 canvas, with a refreshed icon URL.

- Production build, TypeScript and whitespace checks passed.
- All **eight affected browser scenarios passed**: actual unlock UI, empty/queued/called layouts, responsive widths, queue reconnection, action retry, delayed polling, artwork recovery, lost completion recovery and the local Supabase-backed permanent-QR upload/call/start/completion/deletion flow.
- The empty welcome view was checked at 1363 × 783; no horizontal overflow occurred at 320/768/1363 widths. Local QR decoding still verified the permanent mobile address. Screenshots are saved outside the repository under `installation-waiting/`.
- No schema or environment-variable change was required. Server-side intake limits and usage accounting remain in place. Changes are local; this pass did not deploy to Vercel.

## Full Figma design implementation — 14 October 2026

Implemented stretching frame `6:40`, mobile landing/capture/ticket/About frames `16:86`, `16:121`, `16:144`, `16:164`, and completion frame `16:87`. Screens use local Figma logo/icon/background exports, the user's supplied Hatch Sans files and self-hosted Urbanist. The completion shader is the exact paint-only still export approved by the user. Temporary export frames were removed from Figma; original design nodes were preserved. Asset provenance is recorded in `public/design/README.md`.

- Production build, TypeScript, all **62 unit checks** and the whitespace check passed. The complete **95-scenario browser run passed 90 and skipped five** optional external MediaPipe Y4M replays whose recordings were not configured. Chromium and the existing WebKit phone scenario passed.
- After the final body-scale and long-name refinements, the production build passed again and **all five affected browser checks passed**: Figma phone screens, desktop geometry/full-body framing, camera positioning, tracking recovery and the real local queue-to-completion flow.
- Compared rendered screenshots with the Figma source at 1440 × 1024 and 430 × 932. Local images and the heading font loaded; capture, preview and ticket screens fit 320/390/430 widths, and the stretching screen fit 320/768/1024/1440 widths. Corrected the phone preview overflow, transparent-logo button interception, About margin collapse and body clipping discovered during visual review.
- Live guide/drawing canvases, colored-region selection, neck cue, independent controls, fades and four compact stretching actions remain functional. The camera preview is limited to positioning; tracking loss still freezes progress and opens the recovery prompt. Queue controls remain hidden during the active turn and completion, then return after Next participant.
- Photo gestures, adjustments/cleanup, optional names, ticket restoration/cancellation/rejoining, lost responses, retries, fullscreen, keyboard recovery, admission limits, private storage and actual scheduled deletion passed. The final dedicated local database inventory contained zero synthetic queue tickets, legacy sessions and artwork objects.
- No Supabase migration, new environment variable, server image processing, hosted mutation, commit or deployment was added for this design pass. Physical phones, participant movement under actual camera conditions and the projector still require practical verification.

Current implementation/reference screenshots are saved outside the repository in the task visualization folder under `full-design/implemented` and `full-design/reference`. The temporary in-app demo tab was closed; user tabs were preserved. Earlier sections below describe their historical implementation stages, including previously deferred styling that is now implemented.

## Broader usability and recovery checks — 14 October 2026

Added 17 browser scenarios covering phone/exhibit recovery, existing tickets in a full queue, About/home navigation, lost responses, delayed desktop polling, failed operator actions, artwork retrieval retries and keyboard focus during camera recovery. Before the fixes, six checks reproduced four additional problems: stale desktop polling reversed Call next; a lost completion response left Next participant disabled; connection warnings survived reconnection on phone and desktop; and routine ticket polling erased unresolved upload/cancellation warnings.

Desktop queue mutations now invalidate older polls. Connection, action and artwork errors are kept separate, so unrelated successful requests do not hide failures. Phone polling keeps unresolved action warnings and removes recovered connection warnings. A fresh queue snapshot can unblock completion after an ended ticket disappears from the queue, without submitting another completion request. The singular skipped-activity wording was corrected.

- The complete 93-scenario browser run passed **88** and skipped **5** optional MediaPipe replay cases because their external Y4M inputs were not configured. Both Chromium and the existing WebKit phone checks passed.
- All **62** unit checks, TypeScript, the production build and the whitespace check passed.
- The local Supabase integration checks passed for capacity, FIFO, retries, cancelled late uploads, ticket restoration, completion, private storage and actual scheduled deletion. Test-owned rows and drawings were cleaned up by the existing fixtures.
- Current screenshot evidence and a seven-step review are saved outside the repository in the task visualization folder under `usability/USABILITY_REVIEW.md`. In-app browser observations used a separate temporary tab; the user's original desktop tab was preserved.
- No schema, environment variable, hosted mutation, commit, deployment or high-fidelity design change was made. Physical phone/camera/exhibit checks remain outstanding; targeted keyboard checks do not establish full accessibility compliance.

## Mobile ticket cancellation and restart — 14 October 2026

Fixed a home-screen loop where dismissing an ended ticket cleared client state and immediately restored the same cancelled, expired or completed ticket from its browser credential. Home now retains the ended ticket locally until a new reservation replaces it. Reservation, upload and cancellation actions invalidate older polling responses, including late cancelled-ticket responses and authentication errors. Cancellation refreshes available slots, and an existing ready ticket restored from another tab opens its ticket view.

- Reproduced all three ended-ticket home loops against the previous production build before applying the fix.
- Eight affected browser scenarios passed using a phone viewport: all three ended statuses, existing-ticket restoration, two successive uploads/cancellations, delayed polling, the existing home/ticket round trip, and actual Supabase-backed cancellation/rejoining.
- The local-backend scenario verified different ticket IDs, ready status after upload, cancelled status and erased names after cancellation, and deletion of each stored drawing. Test-owned records were cleaned up afterward.
- TypeScript, all 62 unit checks and the production build passed. No schema, environment-variable, hosted deployment or physical-device change was made.

# Verification record

## Positioning gate and quiet mid-fidelity exhibit layout — 14 October 2026

The Figma stretching frame 6:40 and mobile frames 16:86, 16:121 and 16:144 were read with design context and screenshots. This pass adopts their hierarchy and restrained controls while deferring texture backgrounds, exact branding/fonts and high-fidelity artwork treatment. The moving guide and uploaded drawing remain live canvases.

- Build, TypeScript and **62 unit tests passed**. New framing tests cover selected-joint visibility/confidence, inset camera bounds, stale measurements, two-second readiness, brief versus sustained loss, latched recovery and hidden/stale-frame resets.
- **64 distinct browser scenarios passed across the full regression run and focused reruns**; five optional external MediaPipe Y4M replays were skipped. The full run exposed obsolete test selectors for nested setup summaries and resumed-ticket landing actions. Those selectors were updated and all 17 practice regressions and WebKit alignment passed in focused reruns. The final six-scenario run passed all four positioning/recovery checks, WebKit alignment and the new mobile layout/ticket-round-trip check. The resulting catalog has 69 scenarios.
- Positioning uses one mounted video with its actual aspect ratio and a mirrored boundary. Required body parts must remain confidently inside the image for two seconds. During stretching the same stream remains alive, with its preview hidden. Out-of-frame leg landmarks blocked Start; setup earned no fade.
- Tracking loss freezes drawing, instructor and progress immediately. A sustained 650 ms loss opens a focus-managed modal with background controls inert; stable tracking enables Continue without automatically resuming. Check position retained earned fades, Restart cleared them with the same drawing, an existing manual pause survived recovery, and Skip Turn released the camera. Fullscreen entry and Escape exit passed.
- The active view exposes four quiet actions: Skip Stretch, Pause/Resume, Restart and Skip Turn. It shows the guide, participant drawing/name, current region/instruction and progress. Staff queue controls stay on the same page before/between turns and are absent during the active turn. The named Supabase-backed upload/completion scenario verified queue hiding, continued waiting-ticket intake, artwork deletion and queue return after completion.
- Mobile shows two landing actions, one upload/send priority per step and quiet secondary actions. Adjust photo contains retained zoom/reset/rotation and cleanup comparison; Ticket options contains cancellation. Drag/pinch, keyboard alignment, WebKit drag, cleanup comparison, prepared-image matching and upload retries passed. Back to home retained the existing ticket; View my ticket did not create another reservation.
- The positioning browser fixture supplies a synthetic video stream and controlled landmarks by replacing the model constructor only in that test browser's fetched module. No test overrides or fixture hooks ship in the application. These checks verify UI/state behavior, not physical-camera or real-person detector accuracy. Actual cameras, exhibition framing and physical phone behavior still need validation.

Preview evidence is saved outside the repository under the task visualization folder's `camera-gate/`: quiet-stretching.png, positioning-gate.png, tracking-recovery.png, mobile-mid-landing.png and mobile-mid-preview.png. No Supabase migration or new environment variable is required. The local cleanup target was restored after backend checks; source remains uncommitted and undeployed.

## Color-selected eight-region stretching and neck cue — 14 October 2026

The guided sequence now includes only regions with at least 40 qualifying colored pixels: head/neck, torso/pelvis, left/right upper arms, forearms/hands and legs/feet. Drawing-sheet geometry and the existing color classifier remain compatible. Region-specific activities, detector inputs, instructor highlighting and fades share this mapping; Individual stretches and WebMCP also expose eight regions and independent elbow controls.

- Production build and TypeScript passed. **57 unit tests passed**, including color thresholds/order, empty sequences, wrong-side movement, elbow-only detection, shoulder rotation isolation using synthetic camera landmarks, missing/collapsed limbs, both-direction torso movement, three leg stages, selected-foot heel checks and fallback, skips, pause/stale frames and selected-region progress totals.
- **59 distinct browser scenarios passed across the full regression run and focused reruns.** The full 63-scenario run passed 57, skipped five optional external MediaPipe Y4M replays, and exposed one existing concurrency-test assumption: it required the first of two uploads to win. The corrected test accepts either winner, checks one stored object and nonreplacement, and passed three repeated runs. The additional hidden-document lifecycle scenario also passed. The resulting catalog contains 64 scenarios, including those five optional replays.
- Actual single-region images selected only their corresponding activity. A colored mark across the elbow boundary selected both arm regions; dark and outside-body marks did not create activities. Blank drawings blocked Start and explained the alignment/color check.
- Browser movement completed the left forearm while upper-arm, torso and opposite forearm colors stayed unchanged. Torso/leg sequences completed, skipped regions stayed colored in the exported PNG, and progress denominators used selected regions only. Manual controls and the registered WebMCP tools exercised independent elbows and eight-region state.
- The instructor-only neck arc and neck pivot were inspected visually. Instructor motion did not earn participant credit, and pause/hidden-document states froze animation and earned fades without catch-up. Fullscreen and 320/768/1024/1440 layouts passed.
- A named phone upload containing only torso color selected exactly one installation activity. Real manual movement completed that activity, opened the completion screen, erased the participant name and deleted the temporary artwork while preserving the top queue. Private uploads, admission limits, FIFO/actions, scheduled cleanup, mobile camera failure/cancellation and alignment regressions also passed against the dedicated local Supabase backend.
- Final local inventory contained zero synthetic queue tickets, legacy sessions and artwork objects. The temporary browser-test cleanup target was restored to port 3000. The development app is running at localhost:3000. No schema, environment-variable, hosted deployment or Git publication change was made for this feature.

Visual evidence is saved outside the repository in the task's visualization folder: `stretches/neck-arrow.png` and `stretches/forearm-only-fade.png`. Physical-camera testing with a participant remains required before claiming the new elbow and side-raise detectors are validated in the exhibit. The browser visibility check uses a synthetic document lifecycle signal; physical devices and projector behavior remain unverified.

## Permanent QR, queue and local drawing cleanup — 14 October 2026

Functional architecture and layout are implemented. Queue management is a compact strip above the two canvases on `/installation`, also visible in fullscreen. There is no separate management route. Final Figma assets, typography and high-fidelity styling remain deferred.

- Production build and TypeScript passed. **55 logic/validation/asset checks passed**, including new paper/lighting correction, stroke preservation, cleanup-off and optional-name checks.
- **48 distinct browser scenarios passed across the complete regression run and focused reruns.** The full 50-scenario run passed 45 and skipped five optional MediaPipe reference-camera replays because the external Y4M inputs were not configured. After the final QR migration/retry changes, all 25 affected participant/alignment/queue scenarios passed; the added cleanup comparison scenario and updated queue visual scenario passed in their final two-scenario run. These results cover current source, with unchanged core movement tests retained from the full run.
- The new migration was applied to the dedicated Docker database on 55321–55323. Its final reservation function was refreshed locally after the retry refinement. Existing legacy rows/schema were preserved; no database reset or hosted migration was performed.
- Decoded the actual QR PNG and verified it contains the stable `/mobile` URL. Expired and unexpired old printed pairing links both enter the queue and discard the obsolete fragment.
- Named private artwork was uploaded from a separate phone browser, queued, explicitly called/started, and displayed with its actual pixels. Queue names/actions stayed above the canvases at 320/768/1024/1440 widths and in fullscreen. A waiting Sam ticket was visible during Alex's active session in the final screenshot.
- Concurrent admission across 23 browser contexts accepted exactly 20 reservations and rejected three. Existing reservations could finish uploading while full; cancellation and expiry reopened slots. A lost reservation response restored the same ticket. FIFO follows successful upload order, Call later moves a ticket back, and concurrent start attempts left exactly one active participant.
- Verified private operator APIs, per-phone capability isolation, public counts without names, RLS/function denial to the anonymous key, cross-origin denial, name bounds and non-overwriting upload retries. Cancellation prevented late publication of an in-flight reservation.
- Original/Cleaned preview, cleanup strength and Turn off cleanup were exercised in the actual browser. Preview/export/stored PNG pixels matched. Synthetic warm paper corrected toward the fade background; cleanup off retained the exact original aligned pixels. Existing black marks and well-lit color checks passed. Camera capture/denial/cancellation and mobile touch/WebKit controls remained usable.
- Completion removed stored artwork and erased the name while leaving the queue controls visible. The real Supabase Cron → Vault → application cleanup path deleted expired queued artwork and its row without a manual cleanup call. Synthetic queue tickets/artwork were removed after tests.
- Restored local cleanup to port 3000 and left the local development app running. `.env.local` and generated assets remain ignored; no credentials were printed or committed.

Evidence: ignored `test-results/queue-stretching.png` and mobile preview images. Hosted setup is documented in `QUEUE_SETUP.md`. Physical phones, actual paper under exhibition lighting, projector behavior, hosted Nano performance and provider account usage remain unverified. The 3 GB warning is an application estimate, not account quota enforcement.

## Mobile pinch and drag alignment — 14 October 2026

The mobile preview now supports one-finger positioning and two-finger zoom around the moving midpoint. The silhouette guide stays fixed. Zoom buttons, a percentage readout and Reset alignment provide quick alternatives; Fine adjustment retains the existing sliders and rotation control. Gestures feed the existing alignment object and prepared PNG.

- Production build and TypeScript: **passed**. **50 logic/validation/asset tests passed**, including six new coordinate/focal-point/limit/contact-transition checks.
- **33 browser scenarios passed together in one run (3.0 minutes), zero skipped**: the 27 existing upload/rig/camera/stretch/fade/export/fullscreen scenarios, including five actual MediaPipe replay cases, and six new mobile alignment scenarios.
- Chromium's native injected touch input verified one-finger drag and off-center two-finger pinch. The tracked colored photo point stayed under the pinch midpoint; the SVG guide stayed fixed and the browser viewport did not zoom.
- Contact transitions, cancellation and viewport resize were checked. CDP cannot release just one touch using touchEnd, so the contact-transition scenario supplies one pointer-up event before continuing the remaining native contact. The unit test separately verifies the transition geometry.
- Verified zoom bounds, reset, keyboard pan/zoom, retained rotation sliders, and widths 320/768/1024/1440. Custom gesture handling is limited to the preview; swiping outside it still scrolls the page.
- The submitted 600 × 900 PNG matched the adjusted preview's entire decoded pixel buffer by SHA-256. The same submitted file loaded into the existing avatar with its actual colors. Sending disabled further edits and reset until upload finished.
- WebKit also passed native pointer drag and the zoom/reset controls. Physical iPhone/Android finger behavior still needs a short device check after deployment; desktop WebKit is not a physical Safari device.
- Preview painting reuses its canvas on animation frames. Preview/export share the existing transform through a small extracted drawing helper. No gesture library or dependency was added.
- The new mobile tests use controlled session/upload responses and capture the submitted PNG; no Supabase instance was created, started or modified for this change. Cloud session, storage and cleanup code is unchanged.

Visual evidence: `outputs/out-of-body-mobile-touch-alignment.png`. This is a functional UX update; final Figma styling remains deferred.

## Mobile participant journey — 13 October 2026

The new journey uses a dedicated local Supabase instance, not an in-memory storage substitute. Figma screens were read as structural references; final styling/shader effects are deferred.

- **Production build and TypeScript passed.** Native Next.js exposes the preserved pages plus `/mobile`, `/installation` and authorized participant routes.
- **44 logic/asset/validation tests passed**, including five new capability/origin/PNG checks.
- **38 browser scenarios passed in one full run (4.2 minutes), zero skipped**: all 27 existing scenarios, including the five actual MediaPipe reference-camera replays, plus 11 new participant scenarios.
- After switching the backend to the current Supabase secret/publishable key format, the production build passed again and **all 11 participant scenarios passed** in their focused rerun (1.4 minutes).
- The rendered QR PNG was independently decoded and used to open a separate mobile browser context. Pairing was exchanged once for a private cookie and removed from the phone's address bar.
- The phone landing, camera/file fallback, prepared/aligned preview and explicit upload led to private storage and automatic desktop retrieval. Exact uploaded colors appeared in the existing rig. The complete three-activity guide ended at the new completion screen; black marks stayed unchanged in its PNG.
- A portrait synthetic Y4M drawing replay exercised actual browser video capture. Its captured preview pixels matched the stored PNG. Camera denial retained photo selection; invalid images stayed out of preview; retake and pending-permission cancellation worked. A late camera stream was stopped.
- Verified table RLS, a private bucket, and denial using the actual anonymous/publishable key and a public Storage URL. An unpaired browser could neither upload nor retrieve art. Cross-origin creation was denied. A second installation could not retrieve the first installation's image.
- Duplicate and simultaneous uploads could not replace the first image. A network-failed phone upload retained the preview and retried successfully. Reset made a new session/QR and revoked the old phone. Completion/reset deleted the stored object.
- Expired pairing/session capabilities were rejected. Protected cleanup removed both the actual object and its row. The minute scheduler separately deleted an expired image **without a manual cleanup request**, proving the local Cron → Vault → app → Storage deletion path.
- The existing detector, rig, guide scoring, renderer, masks, webcam hook and artwork hook were unchanged. The existing Installation received only optional remote-file and lifecycle props; all original local/manual features passed regression checks.

The first targeted run exposed a localhost/127.0.0.1 origin mismatch, which was fixed by checking the browser-facing host. A test error report included the local installation test key; that key was rotated, the input is cleared when submitted, and credential-bearing participant tests now disable retained network traces and authenticate setup outside UI snapshots.

**Boundary:** no dedicated hosted Supabase project was provisioned or linked, and no new Vercel deployment was made. The same service implementation was tested against real local Supabase. Live phone HTTPS pairing, physical participant stretching, real paper photos and projector output still require the hosted/exhibition trial. No clinical accuracy or medical relief is claimed.

Startup/cloud directions are in `SUPABASE_SETUP.md`. Local services use project ID `out-of-body-participant-mvp` and ports 55321–55323; other Supabase projects and the original Sites source/deployment were not modified. Generated synthetic test sessions/objects were removed.

## GitHub main preparation — 5 October 2026

The production branch in the separate Vercel copy is now `main`, targeting `https://github.com/gabespineli/out-of-body.git`. The target repository had no refs. Local `main` was fast-forwarded to migration commit `756e5f7`, preserving all nine existing application/migration commits. The README now selects `main` for Vercel.

- Re-ran `npm run build`: passed, including required MediaPipe assets, TypeScript and prerendered application/drawing-sheet routes.
- Checked 22 representative dependency, build-output, temporary, environment and credential paths against `.gitignore`: all excluded. No excluded paths are tracked.
- Scanned all nine existing commits for common embedded token/private-key signatures: no matches. No credentials were printed or copied into the repository.
- Source, favicon, SVG generator, asset setup script, dependency lockfile, tests, README and Next.js/Vercel configuration remain tracked. Large model/WASM assets are generated by installation/prebuild and deliberately excluded from Git.
- Application code is unchanged. No Sites deployment or unrelated repository was modified; no Vercel deployment was performed.

## GitHub / Vercel migration — 5 October 2026

This record applies only to the separate `out-of-body-vercel` copy on branch `migration/vercel`. Earlier sections below describe the original Sites releases. No GitHub push or Vercel deployment was performed.

| Check | Observed result |
|---|---|
| Fresh dependency install | `npm ci` succeeded from the public npm registry using the existing lockfile. Node 24.13.1 / npm 11.8.0. Only the lockfile's root Node engine changed; package versions stayed identical. |
| Generated camera assets | Fresh postinstall downloaded the pinned Lite v1 model (5,777,746 bytes) and copied the package-matched WASM/JS. |
| TypeScript | `npm run typecheck` passed after the migration and new installer checks. |
| Logic / asset setup | **39 tests passed**: all 36 existing pose/progress tests plus three isolated installer checks. |
| Production build | `npm run build` passed using native Next.js 16.3.8. The prebuild camera-asset requirement passed. `/`, `/_not-found` and `/drawing-sheet.svg` were prerendered successfully. |
| Production browser suite | **27 / 27 passed in one run (3.6 minutes), zero skipped**, against `next start` on port 3202, with all three replay fixture variables set. |
| HTTP / static assets | Seven production routes returned HTTP 200: page, favicon, drawing sheet, WASM loader, SIMD/non-SIMD WASM and model. Served camera asset bytes matched installed files by SHA-256. WASM used `application/wasm`; model used `application/octet-stream`. |
| Headers | The page and assets carried `Permissions-Policy: camera=(self), microphone=()` and `X-Content-Type-Options: nosniff`. The printable SVG retained its download disposition. |
| Protected source | Original HEAD remained `903c004c7a52befb6d63f94af06266cfafb8043d`; SHA-256 matched for all **40 tracked files**, and the original working tree remained clean. |
| Application preservation | `git diff 903c004 -- src` was empty. All participant interface, renderer, tracker, guide, scoring and fade source files are unchanged. |

The browser suite checked actual drawing upload and alignment, uploaded-pixel mirroring, the fixed rotating pelvis and independent legs, all three area fades, unchanged unrelated/dark pixels, the complete automatic guided sequence, independent instructor animation, partial progress/pause, Skip, Reset and full participant reset, PNG contents, fullscreen, keyboard controls and layouts at 320/768/1024/1440 pixels. Camera denial, missing/busy webcam, model failure, pending-request cancellation and stream cleanup passed.

All five optional replay scenarios ran with the actual MediaPipe model and local reference-photo Y4M camera inputs. They verified arm/leg tracking, pose rejection, fixed pelvis rotation, real-model leg-hold completion and rejection of progress from an idle participant while the guide animates. These are camera replays, not live participants; no landmarks were injected into those replay scenarios.

The new installer checks used disposable local fixtures and simulated unavailable network responses. Optional installation warned and retained manual development; the required production check failed; an undersized cached model was replaced; and an installed model was reused offline. They did not alter the application's installed camera assets.

Visually inspected production screenshots showed the uploaded drawing beside its independent guide, a partial head-only fade with torso/leg/pelvis colors intact, an unobstructed camera replay and the stacked narrow-screen layout.

**Remaining verification boundary:** a Vercel cloud deployment and physical participant/projector trial have not been performed. The preparation verifies native local production behavior, not live stretching accuracy, heel visibility under exhibition lighting or medical relief.

Evidence outside source: `outputs/out-of-body-vercel-preview.png`, `outputs/out-of-body-vercel-camera.png`, `outputs/out-of-body-vercel-mobile.png`, `work/vercel-production-http-checks.json`, `work/vercel-source-preservation-check.json` and this copy's ignored `test-results/` screenshots. Optional camera replay files are local QA inputs and are not distributed in the source archive.

## Movement refinement and simpler controls — 5 October 2026

The working uploader, artwork texture renderer, pelvis pivot, camera lifecycle and region masks were preserved. Changes are confined to authored guide routines, their rule-based scoring, skip/reset handling and reducing visible controls.

- **36 logic checks passed.** The guide now requires overhead reach before raised-arm side stretches. Low hand waving and unsupported lean fail; a gentle one-arm reach is accepted. Side steps require evidence from both sides; knee flexion alone fails. Heel scoring requires changing relative heel/ankle height with planted toes; jitter, foot lifts and translation fail. Missing/poorly projected feet explicitly select a matching side-step fallback after 2.5 seconds, without granting progress. Loss of the whole body does not activate fallback. Skip keeps only earned fade and advances in order.
- **27 browser scenarios validated:** 23 passed in the full exported-app run including all five real-model replay scenarios; the four guided interaction checks passed on targeted rerun after fixing the test helper's range-input strings (Chromium requires a leading zero). Application logic was unchanged for that test correction. A subsequent fullscreen control/status refinement was built and checked in its targeted fullscreen/responsive scenario.
- The refined full manual sequence completed head tilts → reach → raised-arm side stretch → alternating steps → heel raises, with automatic outer-stage transitions. The instructor's active part and instruction matched the detector's part. The heel guide clearly showed a side view of hand support, planted toes and heel motion.
- Actual uploaded test pixels faded progressively in their assigned masks. Dark torso marks, the magenta pelvis and the silhouette outline stayed visible. Previously earned fades remained through transitions. Export retained the actual participant drawing.
- Skip advanced immediately, kept a partial neck fade, and left skipped arm/leg colors at zero fade. The finished state reported three skips rather than claiming successful stretches. Reset restored exact original pixels, cleared progress/skips and retained the uploaded drawing.
- The camera replay verified a 4:3 preview with its status positioned below the video. No FPS text or overlay occupied the image. The real MediaPipe model still processed the reference-photo camera input; the guide alone earned no head progress.
- The standard guided screen now shows only relevant manual sliders. Existing practice, PNG export and full participant reset remain under **More controls**; landmark diagnostics remain under **Tracking details**. Camera errors, cancellation and stream cleanup still passed.
- Both canvases, activity feedback, Pause, Skip and Reset are available in fullscreen. Layouts at 320, 768 and 1440 pixels fit without horizontal overflow; the preserved practice checks also covered 1024 pixels.
- A supported in-app browser independently uploaded a generated participant PNG, started guided mode, skipped neck, and configured raised arms through the page's manual control tool. The visible guide stayed independent, the participant texture moved, relevant progress appeared and hidden secondary controls stayed collapsed.

**Limits:** this is still an artistic, rule-based prototype. Manual and constructed-landmark checks verify positive routines. Reference-photo replays verify real model inference and regression behavior, not a person performing the refined stretches. Physical webcam/heel visibility, a real paper drawing under exhibition lighting and the projector remain untested. Chair support is instructed and illustrated, not recognized. The participant's existing 2D feet stay attached to the shins; no separate foot rig/body translation was added. Heel input in Manual demo simulates detection measurements.

Evidence outside source: `outputs/out-of-body-refined-preview.png`, `outputs/out-of-body-refined-camera.png`, `outputs/out-of-body-refined-heels.png`, `outputs/out-of-body-refined-completed.png`, `outputs/out-of-body-refined-partial.png`, `outputs/out-of-body-refined-mobile.png`.

## Guided instructor and accumulated movement — 4 October 2026

The default experience now separates a looping visual instructor from the actual uploaded drawing. A predefined sequence runs Neck / head → Arms / back → Legs / feet. The instructor uses its own animation clock/poses, with the relevant region highlighted blue. The participant canvas keeps the existing photograph texture, rig, fixed pelvis pivot, smoothing and MediaPipe tracker. No participant pose is replaced by the demonstration.

Each activity requires eight seconds of credited movement. Forgiving angle displacements (head 0.09 radians, arm 0.18, torso lean 0.10, thigh/knee 0.13) grant brief participation credit between movements. Progress accumulates rather than requiring an uninterrupted exact pose. The matching color fades progressively as that progress builds. A 1.4-second completion transition advances automatically; final completion stops the sequence. Outline strokes remain visible after fading.

- Optimized static export and TypeScript: **passed**. **29 logic/timing checks passed**, including six new guide checks: idle/jitter rejection, gentle movement below the strict head threshold, rest preservation, wrong-region/lost tracking/pause/gap rejection, full ordered transitions, hip-only rejection and baseline reset on transitions.
- **26 browser scenarios validated**: 24 passed in the full run, including all five new guided scenarios and all real-model replay inputs. Two existing practice checks passed on targeted rerun after fixing their assumptions: Start fresh now defaults to guided mode, so hold controls require entering practice; both independently animated legs must be polled until they return to rest after camera stop. Application code was unchanged for those test corrections.
- The guide visibly animated while the participant drawing stayed still; no idle progress or fade was earned. Moving the arms during neck activity also earned none. Gentle head slider motion at ±0.3 (actual ±0.12 radians, below the strict pose threshold) produced a partial fade. Exact torso, leg and dark pixels stayed unchanged.
- The full guided browser flow advanced all three activities automatically. Neck motion, one gently moved arm, and a small leg swing each completed their own area; perfect two-arm or outward-leg target poses were unnecessary. Completed colors stayed faded as the next activity began. All three area fades and total progress reached one.
- After returning to rest, head/torso/leg test pixels softened toward the paper color, while the black torso mark and magenta pelvis retained their exact RGB values. The contour pixel remained visibly dark. Saved PNG contained the actual faded artwork and unchanged black mark. Restart restored all area colors/progress and returned to neck/head.
- Pausing froze both rendered canvases and progress. Resuming at rest retained the earned fade without further progress. An uncolored drawing still accepted movement instead of stalling the sequence. Camera denial preserved a working guided manual fallback.
- Fullscreen retained both panels, the current activity and progress bar. Desktop/tablet panels were side by side; 320-pixel panels stacked, with no horizontal page overflow. Existing 320/768/1024/1440 practice layouts, keyboard controls, uploads, alignment, camera errors/cleanup/cancellation, fixed pelvis rotation, independent legs and selective PNG tests passed.
- The real MediaPipe model processed a static reference-photo camera replay while the instructor animated. Neck activity stayed at zero movement progress/fade; demonstration motion did not leak into participant scoring. Other real-model checks still verified arm/leg tracking, strict pose rejection, leg-hold completion and fixed pelvis rotation. No landmark outputs were injected into those replay tests.
- Supported in-app browser WebMCP checks confirmed the new guided start action, rejection without artwork, gentle manual movement credit, and visible sequence/progress state. The browser tools never enable a webcam automatically.

**Remaining limits:** no physical webcam/live participant, real paper photo under installation lighting, or actual projector has been tested. Guided completion is checked with manual movement and constructed motion samples. Real-model replay verifies tracking and rejection of an idle scene, not live stretching accuracy. Movement credit and color fading are artistic approximations, not exercise-form assessment or evidence of medical relief.

Evidence outside source: `outputs/out-of-body-guided-upload.png`, `outputs/out-of-body-guided-arms.png`, `outputs/out-of-body-guided-completed.png`, `outputs/out-of-body-guided-mobile.png` and the supported-browser `outputs/out-of-body-guided-preview.png`.

Earlier records below describe preserved individual practice and historical releases; guided mode uses accumulated motion, not those strict hold requirements.

## Three independent body areas — 4 October 2026

The current MVP has a plain **Body area** selector for Neck / head, Arms / back and Legs / feet. Each preset has its own instruction, rule-based pose matcher, continuous hold state and fixed segment fade mask. Defaults remain a three-second hold and a 1.6-second fade. This supersedes the one-stretch/circular-region behavior in the historical records below.

| Area | Movement | Color mapping |
|---|---|---|
| Neck / head | Gentle sideways head tilt relative to the shoulder line; either side. | Head segment including the neck. |
| Arms / back | Both wrists above shoulders, elbows near shoulder height. | Both arms and torso; the front-facing torso is the artistic proxy for back. |
| Legs / feet | Either leg extended outward relative to hip-line rotation. | Both thighs and shins/feet. |

- TypeScript and optimized static export: **passed**. Rule/timing tests: **23 passed**, including head tilt on either side, shoulder-roll cancellation, jitter tolerance, missing/collapsed ear rejection, independent area confidence, leg matching, partial-hold reset on switching, completed-fade preservation and all-area pause/restore.
- Exported-app Chromium: **20 scenarios passed in one full run** with all three reference-photo camera fixtures enabled. One additional neck/foot pixel scenario was added and **passed in its targeted run**, making **21 validated scenarios**. The application code was unchanged between these browser runs.
- The uploaded yellow head color faded only after a head hold; the coral arm and teal torso colors faded only after the arms/back hold; blue/purple leg colors faded only after the legs/feet hold. Switching areas kept the previously earned fades, reset unfinished time and reset manual joints. All three completed statuses were visible together.
- Uploaded head pixels moved with the new neck-pivot rotation. Dedicated colored neck and foot marks also softened in their assigned areas, while the teal torso and magenta pelvis retained their exact original RGB values. Restore returned the neck/foot colors exactly.
- At a frozen pose, a full-canvas faded/restored comparison found **zero changed pixels outside the uploaded colored arm/torso marks**; more than 10,000 pixels changed inside. Yellow head, blue legs, dark marks and pelvis/pivot colors stayed unchanged during that fade.
- The 50% amount check and downloaded 840 × 900 PNG preserved independent head and arm/torso fades, untouched leg/pelvis pixels and an opaque paper background.
- **Real MediaPipe inference** completed a continuous three-second leg-extension hold and its fade from a reference-photo camera replay. Only the legs/feet fade advanced. Stopping the camera returned the pose to neutral without clearing that earned fade; exact head, torso and pelvis pixels remained unchanged. No landmark outputs were injected.
- Other real-model replays rejected unraised arms/side lean for the arms/back preset and verified the rotating uploaded pelvis around its fixed center. Translation of the camera input still did not translate the pivot.
- Existing upload validation, no-color blocking, alignment/reset, camera permission/missing/busy/model-load recovery, pending-request cancellation, track cleanup, pause/resume, independent hip/knee rigging and layouts at 320/768/1024/1440 passed.
- The supported in-app browser registered **four WebMCP tools**. Selecting each area updated the visible selector and instruction; manual head/arm/leg inputs updated the visible controls and completed all three fades. Invalid area and out-of-range head input were rejected without changing the visible preset/joints. Legacy arm/lean input reset omitted head/leg controls. Restore reset all three fades. No camera was enabled through these tools.
- **Physical webcam/live participant performance remains unverified.** Positive head/arm rules are checked with constructed landmarks and their complete visual loops in manual mode. Positive leg completion is additionally checked with the real model on a replay. None of these checks establishes therapeutic effectiveness or accuracy with a person, paper photo or installation projector.

Fixed mapping is intentional: no automatic discomfort/art recognition. Head/neck uses the head segment; back uses the front torso; either leg earns the grouped two-leg/feet fade. The pelvis does not fade. Pale/gray/dark marks are mostly excluded by the existing color threshold. Small joint overlaps/seams remain a 2D rig limitation.

Evidence outside source: `outputs/out-of-body-three-areas.png`, `outputs/out-of-body-camera-legs.png`, `outputs/out-of-body-areas-upload.png` and `outputs/out-of-body-areas-mobile.png`.

## One focused stretch loop — 4 October 2026

The active stretch is now only both arms raised. A persistent instruction above the avatar asks for both hands above the shoulders and elbows near shoulder height. Feedback progresses through Not detected, Hold still, Stretch held — fading selected color, and Completed. The default hold is three continuous seconds (adjustable only from two to three), followed by the existing 1.6-second selective fade. The shoulder circle is the initial region mapping; existing photo/area controls remain available for alignment. There is no multi-gesture chooser, and lean/leg movements animate the rig without earning stretch progress.

- Static export and TypeScript: passed. Gesture/timing checks: **17 passed**, including entry/release tolerance for raised-arm landmark jitter, immediate rejection of low-confidence hands, and an upper-body hold that works without hip/leg visibility.
- Exported-app Chromium scenarios: **18 passed** in one full run, including all three real-model reference-photo replays.
- The focused loop showed Not detected, Hold still, a partial fade strictly between zero and one, and Completed. A known shoulder pixel changed gradually between its original and softened values. Pausing froze a partial fade; resuming finished it.
- An incomplete hold interrupted by lowering one arm reset to zero and earned no fade. One raised arm, side lean and leg movement could not earn the arms-raised stretch. Model replays of nonmatching poses likewise stayed at zero hold/fade.
- A full-canvas pixel comparison at a frozen pose found **zero changed pixels outside the selected shoulder region** when comparing the faded/restored drawing. More than 100 pixels changed inside the region. Unselected teal, yellow, leg and dark marks retained their expected values in the existing checks.
- Uploaded texture, fixed hip pivot/visible rotation, pause, PNG export, alignment, camera permission/device/model recovery, cancellation/track cleanup and layouts at 320/768/1024/1440 pixels still passed.
- Positive arms-raised detection is checked with constructed landmark sequences; successful hold-to-fade UI is checked in manual mode. Real MediaPipe inference and rejection of other poses are checked using reference-photo camera replays. **A live participant holding both arms up in a physical webcam was not tested**, so camera framing and detection still need an installation trial. No landmark outputs are injected into the real-model replay tests.
- The supported interactive browser could not bind the old error-page preview tab because its internal error URL was blocked. That tab was left untouched; the normal HTTP preview was handed off through the app, and authored local browser scenarios supplied the rendered verification and screenshots.

The earlier records below are historical. Their multi-gesture completion behavior is superseded by this single-stretch loop; the centered pelvis rotation remains current.

## Anchored pelvis rotation — 4 October 2026

The pelvis pivot stays fixed at template position (300, 522), canvas position (420, 522). The detected hip line rotates the uploaded pelvis texture around that point; the torso and legs remain attached. Camera-frame position no longer translates the avatar. Manual mode has Rotate hips left/right buttons and one Hip rotation slider. Sway, height and camera recenter controls were removed. This supersedes the moving-center behavior recorded below.

- TypeScript and static export: passed. Gesture/timing checks: **15 passed**.
- **18 browser scenarios validated**: 17 passed in the full exported-app run. The final real-model hip replay passed on its targeted rerun with a 75-second test limit. The first run exceeded the original 45-second limit after its rotation/anchor assertions and screenshot, while finishing the camera-stop/rest check. The rerun finished in 28.6 seconds; application code was unchanged.
- A generated uploaded magenta pelvis mark retained exact **RGB 211, 95, 164** at its rotated position. The teal torso and blue leg pixels followed the same parent rotation. A green test mark centered on the pelvis pivot stayed at the same canvas pixel during left/right rotation. Pause froze the rendered pose, the downloaded PNG preserved the rotated magenta pixel, and Return to rest reset the rotation.
- The real MediaPipe model processed the complete eight-second reference-photo replay, including frames shifted horizontally/vertically and rotated in both directions. The rendered magenta mark visibly changed angle by more than 0.15 radians across observations; the pivot mark stayed within two pixels of its starting center throughout. No landmark results were injected. Stopping the camera returned the rig to rest.
- Existing uploads, arm/lean/leg holds and fade, permission/device/model failures, cancellation/cleanup, masks, PNG export and 320/768/1024/1440 layouts passed.
- In the supported in-app browser, WebMCP hipTilt changed the visible rotation control. Out-of-range rotation and obsolete hipSway inputs were rejected without changing state. Legacy arm/lean-only input reset hip rotation to neutral. The plain manual UI was visually checked and captured locally.
- This is 2D hip-line rotation, bounded to about 20 degrees either way. Physical-webcam/live-participant and deployed-domain camera permission behavior still require an installation trial. Model replays use a reference photograph, not participant footage.

The following records describe earlier releases; their translation behavior is historical.

## Moving center pelvis — 3 October 2026

The pelvis now translates sideways/vertically and tilts with the detected hip line. Both legs and the upper body inherit that moving parent, retaining their relative joints and actual uploaded textures. Manual hip sway, height and tilt controls and left/right shift buttons exercise the same renderer. Camera position centers from the first confident pose and can be recentered explicitly.

- TypeScript/static export: passed. Gesture/timing checks: **15 passed**.
- **18 browser scenarios validated**: 17 passed in the full exported-app run; the remaining manual-pelvis scenario passed on a targeted rerun after correcting its assertion to check that the colored hip mark moved away, rather than assuming the original point must be transparent. Another body part can occupy that point. Application code was unchanged for this correction.
- A generated uploaded magenta pelvis mark retained exactly **RGB 211, 95, 164** at its translated/tilted position. Torso and leg pixels moved with the same parent. Pause froze the pelvis, PNG preserved the posed hip pixel, and Return to rest restored all hip controls and the original pixel.
- The real MediaPipe model processed an eight-second replay of the reference photograph shifted and rotated across the camera frame. The rendered pelvis texture moved over 40 pixels horizontally and over 15 pixels vertically; Recenter position brought it near the avatar center, and stopping returned it to rest. No landmark results were injected.
- Existing arm/lean/leg holds and fade, permission/device/model failure states, camera cancellation/cleanup, masks, PNG and responsive checks still passed.
- WebMCP in the supported in-app browser accepted hip parameters and changed the visible controls; an invalid hip range was rejected without changing state. Omitted hip parameters default to neutral.
- This is bounded 2D motion, not full walking or 3D pelvis reconstruction. Real physical-webcam/live-participant and deployed-domain camera permission behavior still need a trial.

The records below describe releases before the moving-center update. The current anchored rotation behavior is documented in the 4 October record above.

## Leg movement update — 3 October 2026

The Sites edition now has separate textured thighs and shins, fixed hip/knee pivots, leg visibility feedback, four manual leg/knee controls, two leg pose buttons and two held leg gestures. Existing drawing sheets keep the same outer silhouette. Feet follow their shins and the pelvis stays anchored.

- Static export and TypeScript build: passed.
- Gesture/timing checks: **13 passed**, including independent leg tracking, knee rotation, missing ankle/collapsed segment rejection, and manual leg controls.
- Chromium checks against the exported app: **16 passed**, including both real-model replays. Uploaded blue leg pixels were exactly **115, 153, 180** at rest and followed both hip and knee rotation. The other leg and torso retained their original pixels. Each leg hold rejected the opposite leg, then faded its selected area.
- Real MediaPipe replay: both legs were confidently visible; the avatar moved from actual model landmarks and a one-second outward left-leg hold completed a 0.2-second selected leg fade. Camera tracks ended on stop; the untouched right-leg color returned unchanged once the rig settled. The replay is the existing reference photograph, not live participant footage.
- Existing upload, arm/lean, pause, multi-area, PNG, camera denial/missing/busy/model-failure/cancellation and 320/768/1024/1440 layout checks passed. Loaded leg region buttons and manual controls do not overflow at these widths.
- WebMCP in the Codex in-app browser: optional leg/knee parameters changed the matching visible controls; an out-of-range leg input was rejected without changing state; legacy arm/lean-only input reset all leg controls to rest.
- Physical webcam/live participant performance and deployed-domain camera permission behavior remain unverified. Forward/back leg motion, separate foot rotation, moving pelvis and exact full-body mirroring remain outside this 2D MVP.

The records below describe the earlier upper-body release and its Sites port.

## Sites export verification

The source was ported to a static Next.js export for Sites, preserving the plain HTML controls and browser-only photo/video processing. No server storage or accounts were added to the participant flow. Sites supplies private hosting access.

- Static build: passed; includes the installation, exported drawing sheet, favicon and locally served MediaPipe model/WASM.
- Five browser scenarios passed against the exported app on port 3201: real uploaded colors and selective fade, real-model camera inference/track cleanup, real-model lean through fade, fade amount/overlap plus downloaded PNG pixels, and pending camera cancellation. The earlier 14-scenario result below belongs to the original local MVP.
- WebMCP validation passed in the supported Codex in-app browser: all three tools registered with their schemas/annotations; state reading, manual configuration and color restore returned the visible app state. Unexpected read arguments, an out-of-range arm value and restoring without a drawing failed intentionally without corrupting the page.
- Physical camera/live participant and deployed-domain camera behavior remain unverified. Camera replays use real model inference on deterministic test images.
- Publication completion is recorded by the native Sites deployment response; this QA record does not claim a live installation trial.

Verified on 3 October 2026, Asia/Manila, on this Windows machine. This is a prototype verification record, not a clinical assessment or a production deployment certification.

## Results

The plain HTML workspace now includes six gesture choices, independent arm controls, up to five fade areas, adjustable hold/fade timing and amount, pause/resume, PNG export, tracking visibility feedback, alignment reset and camera cancellation. The original upload → actual artwork → tracking → movement → selected color fade flow remains functional.

- TypeScript check: passed.
- Next.js optimized build: passed. Routes are the installation page, the standard not-found page, and the printable drawing-sheet route.
- Gesture/timing checks: **10 passed**.
- Chromium browser scenarios: **14 passed**, including both optional real-model camera replays.
- Package audit after the final dependency install: no reported vulnerabilities.

| Browser scenario | Observed result |
|---|---|
| Actual uploaded artwork | A generated participant test PNG was uploaded through the real file input. Its teal pixel appeared on the avatar as exactly RGB **39, 154, 163**, and its coral pixel as exactly RGB **219, 113, 93**. |
| Held raised arms and selective fade | The manual arm controls rotated the textured arms; a three-second hold completed. The selected coral area softened toward the paper color while the teal area remained exactly **39, 154, 163**. Restoring original colors returned the coral pixel to its original value. |
| Interrupted hold and side lean | Returning to rest reset an incomplete hold. A manual side lean then completed a new hold and softened the selected torso area. |
| Permission denial | A deliberately denied camera request produced a clear recovery message; the complete manual gesture/fade flow still worked. |
| Missing and busy webcam | Simulated browser device errors produced separate no-camera and camera-busy messages and allowed retry. |
| Upload validation and participant controls | Wrong file type and corrupt PNG were rejected. Region selection, no-color feedback, alignment sliders, restore/reset and drawing-sheet download worked. |
| Responsive and keyboard use | No horizontal page overflow at widths **320, 768, 1024 and 1440**. The example and manual controls rendered at each width. Enter activated the focused raised-arm control. Screenshots were visually reviewed. |
| Real MediaPipe inference and cleanup | The actual locally served model and WASM processed an official MediaPipe reference image replayed as a Chromium camera stream. It detected the person, moved the avatar's arms, and stopped every captured video track when **Stop camera** was pressed. |
| Real-model gesture through fade | A rotated reference-image replay produced a detected side lean. The real landmark output completed the continuous three-second hold and region fade. Stopping the camera returned the rig to rest while preserving the completed fade; the teal area stayed unchanged. |
| Model unavailable | A deliberately missing model response stopped the camera, showed a recovery message and preserved a working manual demonstration. |
| Six gestures and custom timing | With a one-second hold and 0.2-second fade, both arms, each individual arm, either-side lean and each directional lean completed. An incorrect arm or opposite lean did not earn progress. |
| Multiple regions | Shoulder and torso marks faded together while the unselected yellow head mark and dark torso mark retained their exact original RGB values. Adding areas stopped at five; selection and removal worked. |
| Pause and resume | Changing manual controls while paused left the rendered canvas unchanged. An unfinished hold reset. An earned fade froze during pause and resumed without counting the paused interval. |
| Overlap, fade amount and PNG | A 50% fade produced the same selected pixel with one area or two overlapping identical areas. The downloaded PNG was 840 × 900, contained that softened pixel and the exact unselected teal pixel, and used an opaque paper-colored background. |
| Pending camera cancellation | A delayed camera request was canceled; its stream was released immediately when it arrived later. The page remained in the camera-off state and manual mode remained available. |

The inference display showed approximately 18–19 fps during the camera replays. This is evidence for these local replay checks, not a promised frame rate on another device or with a live participant.

## Test boundaries

- **No physical webcam or live participant was tested.** Camera inference was exercised using Chromium's replay camera. Permission/device failures were explicitly simulated. The model itself and its landmark inference were real.
- The lean fixture is the same reference photograph rotated by 25 degrees; it is a deterministic test input, not a recording of someone performing a stretch. No landmark results were injected into the real-model tests.
- Raised-arm landmark thresholds were checked with constructed coordinates; the raised-arm end-to-end fade was checked in manual mode. The complete webcam-to-fade path was checked with the real-model side lean.
- Pixel preservation/fading used a generated test drawing with known colors. A real paper drawing under camera lighting has not yet been tried; paper tone, shadows, skew, and joint seams still require an installation trial.
- The fixed masks only support the supplied template. The canvas has horizontal padding so extended arms do not clip at the original paper edges.
- Fullscreen is implemented with browser error recovery. Permission behavior, embedded-browser restrictions, projection, and real-world framing should be checked in Chrome or Edge on the installation laptop.
- The app is now privately hosted on Sites. No photos, video, participant records or sessions are automatically persisted by this app. **Save PNG** explicitly downloads one rendered artwork frame to the participant's device.

## Reproduce

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:browser
```

The current suite contains 21 ordinary browser scenarios and five optional real-model scenarios using three replay inputs. A run without those inputs skips the five replays. To include them, set `OOB_CAMERA_FIXTURE`, `OOB_LEAN_CAMERA_FIXTURE` and `OOB_HIP_CAMERA_FIXTURE` to Y4M replay files before running the browser suite. The local fixture inputs are outside the deliverable source and contain no participant footage.

The reference image came from Google's [MediaPipe test assets](https://storage.googleapis.com/mediapipe-assets/pose.jpg). The webcam integration follows the [official Pose Landmarker Web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js).

## Before a live showing

Use the real printed sheet, actual drawing/photo, webcam and projector. Check that shoulders, hands, hips, knees and feet stay in frame; that head tilt, both raised arms and either outward leg are detected for their matching area; that only the corresponding colored area softens; and that the manual demo works if camera access is unavailable. This short installation trial is the remaining practical validation.
