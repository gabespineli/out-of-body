# Participant journey architecture

The Figma frames now supply the implemented backgrounds, colors, typography, icons and screen proportions. Supplied Hatch Sans and self-hosted Urbanist fonts are local. The completion shader is the exact still export approved by the user. Source assets and their transformations are documented in `public/design/README.md`.

| Figma node | Referenced flow | Implementation |
|---|---|---|
| `16:86` mobile landing | Upload action and About | `QueueMobileFlow` |
| `16:121` upload page | Silhouette framing and upload action | `MobileCapture`, `TemplateGuide`, `MobilePreview` |
| `16:144` ending page | Drawing uploaded, named queue ticket, home | `QueueMobileFlow` |
| `16:164` About | Exhibit description and home action | `QueueMobileFlow` |
| `6:40` installation | Independent instructor and participant drawing with progress | Existing `Installation` and `VisualInstructor` |
| `16:87` end screen | Completion and next participant | `CompletionScreen` |

The camera and preview are separate functional steps around the Figma upload structure. Static instructor screenshots in Figma are references: the live guide and participant remain independently rendered from the working canvas implementation.

## Boundaries

- `src/components/participant/`: screen markup, buttons and stage coordination.
- `src/hooks/use-mobile-camera.ts`: rear-camera request/capture/cancellation/stream disposal.
- `src/hooks/use-photo-preview.ts`: local photo validation and alignment using the existing normalizer.
- `src/hooks/use-photo-gestures.ts` and `src/lib/photo-alignment.ts`: pointer capture, anchored pinch/drag, cancellation, limits and keyboard/button equivalents. Gesture state feeds the existing alignment; it does not change the upload or session protocol.
- `src/lib/participant-api.ts`, `participant-session.ts`: browser transport, shared session types and QR URL format.
- `src/server/`: authorization, session state/storage, bounded PNG validation.
- `src/app/api/participant/`: small route handlers; no participant secrets or storage keys in browser code.
- `supabase/`: private session/bucket schema, isolated local configuration and scheduled cleanup.
- Stretch selection and fades use eight drawing regions. The fixed rig and drawing sheet remain compatible; region masks separate torso/pelvis, left/right upper arms, forearms and legs. The sequence contains only regions with at least 40 qualifying colored pixels. Camera/manual measurements, instructor loops and individual stretches use the same region mapping.

The existing `Installation` accepts an optional prepared File and lifecycle callbacks. Without those props, `/test` keeps the original local-upload/manual-demo behavior. The new `/` wrapper supplies remote artwork and reacts to receipt/completion/reset. Visual updates can replace screen markup/CSS without changing capability authorization, storage or movement logic.

Mobile preview and PNG preparation share `drawAlignedPhoto`, with the existing canvas transform. The preview reuses its canvas and paints on animation frames during gestures. Pointer count changes rebase the current alignment to avoid jumps; resize, cancellation, reset and upload disablement clear active contacts. Custom touch handling is scoped to the photo surface, leaving navigation/scrolling outside it available.

## Session lifecycle

The permanent entry now runs `/mobile` → private preparation ticket → cleaned/aligned upload → ready queue → automatic head selection → staff Start participant → existing avatar/guide → completion/deletion. Queue controls stay on `/` before and between turns. Starting a participant opens the positioning gate, then a clean guide/drawing view; the queue is hidden throughout the active turn. No separate management screen is created. `queue-store.ts` and service-role-only SQL functions serialize admission/activation and preserve private per-phone credentials. Old printed pairing links enter this same queue, while legacy APIs remain available for already-open sessions. See `QUEUE_SETUP.md` for deadlines, budgets, and deployment steps. The lifecycle below documents the legacy API.

Desktop operator → new QR → one phone claims it → phone previews PNG → upload reservation → private stored PNG → desktop polls/retrieves → existing avatar → guide/fades → completion → deletion → next QR.

Owner, pairing and mobile credentials are separate 256-bit random values. Only hashes are stored in the session row. The pairing token is in the QR URL fragment, exchanged once for an HttpOnly mobile cookie and removed from the address bar. The desktop owns a separate HttpOnly capability. Neither device receives the Supabase secret key.

SameSite cookies and origin checks protect writes. All status/artwork responses disable caching. Table RLS and a private bucket prevent anonymous access. Upload reservation uses an atomic conditional update, preventing duplicate/concurrent replacement. Invalid input is rejected before reservation.

Sessions expire after 30 minutes; unclaimed QR codes expire after 10. Completion/reset removes the storage object. The minute scheduler retries expired objects, retaining metadata if deletion fails. A two-minute grace window covers an in-flight upload after reset; final upload publication also checks that the session still exists and is active.

No realtime socket service, user accounts, persistent artwork archive, automatic rigging or new exercise classifier is introduced. Desktop polling is intentionally simple. Paper photographs still need manual framing/alignment, and independent feet remain outside the existing rig.

## Completed drawings and leg activities � 15 October 2026

Leg activities keep eight seconds of earned movement: one third side steps, then two thirds selected-side leg raises. Heel raises and the side-view instructor are removed. A brief confetti burst follows each fully earned region, including the final one; skips do not celebrate. Reduced-motion users see the completion message without animated particles.

The exhibit completion view directs participants to their phone. The operator uploads the exact final canvas to a deterministic private result path before atomically completing the ticket. The owning ticket cookie is required for the download; request IDs cannot select another participant. Results expire one hour later, and the existing cleanup removes them. Retries preserve the first stored frame. Original uploads are still deleted immediately. One additive migration (`202610150001_queue_results.sql`) is required on hosted Supabase before deployment, with no new Vercel settings.

## Camera setup - 15 October 2026

A compact camera selector sits directly below the stretching positioning preview. Phone capture has no camera selector and requests its normal rear camera. It lists video inputs exposed by the browser, refreshes after access and device changes, and remembers the exhibit camera choice in local browser storage. Selecting a camera closes the previous stream before opening that exact device; switching resets the positioning countdown. Cameras remain hidden from the stretching interface.

Entering positioning or phone capture opens automatically only when camera access is already granted (or a browser without permission queries exposes an already-labelled camera). First access, denied permission and unsupported permission discovery retain the explicit open button. Cancel/Back invalidates pending attempts, closes late-arriving streams and never automatically reopens the camera on the same visit. No additional database migration or environment variable is needed for this camera update.
