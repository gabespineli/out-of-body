# Verification record

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
- Nothing was deployed to a public service. No photos, video, participant records or sessions are automatically persisted by this app. **Save PNG** explicitly downloads one rendered artwork frame to the participant's device.

## Reproduce

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:browser
```

The ordinary browser run executes the twelve non-replay scenarios and explicitly skips the two optional real-model replay checks. To include them, set `OOB_CAMERA_FIXTURE` and `OOB_LEAN_CAMERA_FIXTURE` to Y4M replay files before running the browser suite. The original local fixture inputs are outside the deliverable source and contain no participant footage.

The reference image came from Google's [MediaPipe test assets](https://storage.googleapis.com/mediapipe-assets/pose.jpg). The webcam integration follows the [official Pose Landmarker Web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js).

## Before a live showing

Use the real printed sheet, actual drawing/photo, webcam and projector. Check that the shoulders, hips and hands stay in frame; that both chosen gestures are detected; that the selected colored area visibly softens; and that the manual demo works if camera access is unavailable. This short installation trial is the remaining practical validation.
