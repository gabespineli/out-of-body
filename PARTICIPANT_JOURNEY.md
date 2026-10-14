# Participant journey architecture

Figma is a structural reference for this phase; final colors, typography, images, shader backgrounds and pixel alignment are deferred.

| Figma node | Referenced flow | Implementation |
|---|---|---|
| `16:86` mobile landing | Upload action and About | `MobileLanding` |
| `16:121` upload page | Silhouette framing and upload action | `MobileCapture`, `TemplateGuide`, `MobilePreview` |
| `16:144` ending page | Drawing uploaded; move to installation | `MobileSent` |
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
- Existing pose detector, guide progression, fixed rig, color masks, renderer, webcam hook and artwork hook remain unchanged.

The existing `Installation` accepts an optional prepared File and lifecycle callbacks. Without those props, `/` keeps its original behavior. The new `/installation` wrapper supplies remote artwork and reacts to receipt/completion/reset. Visual updates can replace screen markup/CSS without changing capability authorization, storage or movement logic.

Mobile preview and PNG preparation share `drawAlignedPhoto`, with the existing canvas transform. The preview reuses its canvas and paints on animation frames during gestures. Pointer count changes rebase the current alignment to avoid jumps; resize, cancellation, reset and upload disablement clear active contacts. Custom touch handling is scoped to the photo surface, leaving navigation/scrolling outside it available.

## Session lifecycle

The permanent entry now runs `/mobile` → private preparation ticket → cleaned/aligned upload → ready queue → operator Call next → Start participant → existing avatar/guide → completion/deletion. Queue controls are embedded at the top of `/installation`, including fullscreen; no separate management screen is created. `queue-store.ts` and service-role-only SQL functions serialize admission/activation and preserve private per-phone credentials. Old printed pairing links enter this same queue, while legacy APIs remain available for already-open sessions. See `QUEUE_SETUP.md` for deadlines, budgets, and deployment steps. The lifecycle below documents the legacy API.

Desktop operator → new QR → one phone claims it → phone previews PNG → upload reservation → private stored PNG → desktop polls/retrieves → existing avatar → guide/fades → completion → deletion → next QR.

Owner, pairing and mobile credentials are separate 256-bit random values. Only hashes are stored in the session row. The pairing token is in the QR URL fragment, exchanged once for an HttpOnly mobile cookie and removed from the address bar. The desktop owns a separate HttpOnly capability. Neither device receives the Supabase secret key.

SameSite cookies and origin checks protect writes. All status/artwork responses disable caching. Table RLS and a private bucket prevent anonymous access. Upload reservation uses an atomic conditional update, preventing duplicate/concurrent replacement. Invalid input is rejected before reservation.

Sessions expire after 30 minutes; unclaimed QR codes expire after 10. Completion/reset removes the storage object. The minute scheduler retries expired objects, retaining metadata if deletion fails. A two-minute grace window covers an in-flight upload after reset; final upload publication also checks that the session still exists and is active.

No realtime socket service, user accounts, persistent artwork archive, automatic rigging or new exercise classifier is introduced. Desktop polling is intentionally simple. Paper photographs still need manual framing/alignment, and independent feet remain outside the existing rig.
