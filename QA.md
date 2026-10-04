# Verification record

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

The current browser run executes fifteen non-replay scenarios and explicitly skips the three optional real-model replay checks. To include them, set `OOB_CAMERA_FIXTURE`, `OOB_LEAN_CAMERA_FIXTURE` and `OOB_HIP_CAMERA_FIXTURE` to Y4M replay files before running the browser suite. The local fixture inputs are outside the deliverable source and contain no participant footage.

The reference image came from Google's [MediaPipe test assets](https://storage.googleapis.com/mediapipe-assets/pose.jpg). The webcam integration follows the [official Pose Landmarker Web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js).

## Before a live showing

Use the real printed sheet, actual drawing/photo, webcam and projector. Check that shoulders, hands, hips, knees and feet stay in frame; that the chosen arm, lean and leg gestures are detected; that the selected colored area visibly softens; and that the manual demo works if camera access is unavailable. This short installation trial is the remaining practical validation.
