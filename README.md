# Out of Body — Sites edition

The existing MVP is packaged for Sites as a static Next.js export. The browser runs the rig and MediaPipe; no participant photos or video are sent to a server. The private Site identity is in `.openai/hosting.json`, and its deployed model/WASM files are included in the build archive. This preserves the plain interface and all existing controls.

WebMCP-compatible browsers also expose three tools using the same visible state/actions: read installation state, configure a manual pose and restore colors. These do not expose images, file names or camera frames and do not automatically enable a webcam. Browsers without WebMCP still run the full MVP.

A local, one-day vertical-slice prototype of an interactive art installation. A participant's photograph becomes the actual moving texture of a fixed 2D body. A webcam tracks arms, torso and legs, and a continuously held gesture softens color in a selected area.

## Launch

Use Node.js 22 or 24 (tested with Node 24.13.1; Next.js requires at least 20.9). In PowerShell:

```powershell
cd "C:\Users\Gab\Documents\Codex\2026-10-03\referenced-chatgpt-conversation-this-is-an\outputs\out-of-body-sites"
npm.cmd install
npm.cmd run dev
```

Open **http://localhost:3201** in Chrome or Edge. Keep the terminal open; Ctrl+C stops the server. `npm.cmd` avoids PowerShell execution-policy problems with `npm.ps1`. This Sites preview uses port 3201; the original local MVP remains on port 3200.

This Sites checkout builds a static export in `out/`. For a local preview of that exact exported app, run `npm.cmd run build` and `npm.cmd run start`. The development command above is also available. To stop a running preview, use Ctrl+C or `stop-demo.cmd`, which checks that the listener belongs to this project before stopping it. If port 3201 is already in use, stop the existing instance before starting another.

For an optimized demonstration:

```powershell
npm.cmd run build
npm.cmd run start
```

Installation copies the package-matched MediaPipe WASM files and downloads the pinned Pose Landmarker Lite v1 model into `public/vision`. These files and the app are then served locally. If the model download fails, the app still works in manual mode; retry `npm.cmd run setup:vision` when online. No API keys, backend, accounts, or database are needed.

## A two-minute demonstration

1. Download **Get the drawing sheet** and print it without stretching its proportions. Draw colored marks inside the outline. Or select **Try an example**, which is explicitly labeled example artwork.
2. Photograph the complete page, upright and straight-on, with even light. Upload a JPG, PNG or WebP. The avatar now displays that photo inside the body segments, preserving its colors and marks.
3. If the photo does not match the silhouette, use **Align photo**: zoom, horizontal/vertical position and rotation. Match the photographed outline to the dashed guide.
4. Choose a colored region by tapping the small drawing or pressing **Shoulder**, **Torso**, **Arm**, **Left leg** or **Right leg**. Adjust area size. **Add area** includes another circle, up to five; the **Editing area** dropdown switches the circle you move or resize. All selected areas fade together. Areas with no sufficiently saturated color are labeled; at least one selected area must contain color for a hold to advance.
5. Press **Enable camera** and allow the browser's camera request. Face the webcam alone and step back far enough to show your full body, including knees and feet. The preview shows the entire camera frame and behaves as a mirror. The pelvis pivot stays fixed at the center of the stage. The left/right hip line visibly rotates the pelvis with the torso and legs attached; walking sideways or up/down in the camera frame does not shift the avatar. A leg needs a confidently visible hip, knee and ankle to move; a missing leg returns to rest without disabling the other leg or arm gestures.
6. In **Gesture to hold**, select **Raised arms** and gently raise both hands above your shoulders, with elbows near or above shoulder height. Or choose **Left arm**, **Right arm**, **Side lean**, **Lean left**, **Lean right**, **Left leg lift** or **Right leg lift**. For a leg hold, move that leg outward to the side; the trigger is approximately 16 degrees from its neutral thigh direction with a visible hip, knee and ankle. Forward knee lifts have depth ambiguity in this front-facing 2D rig. Directions follow your own left and right in the mirrored preview. Default timing is a continuous three-second hold followed by a 1.6-second fade. Unselected areas retain their colors.
7. **Restore colors** lets you repeat the fade. Relax first so another gesture hold does not immediately begin. **Start fresh** releases the camera, clears the drawing and restores default controls. **Fullscreen** enlarges the artwork for projection; Escape exits. To replace the drawing, use the file chooser again.

If camera access fails, switch to **Manual demo**. Arm/lean buttons, **Lift left leg**, **Lift right leg**, and independent arm, leg swing and knee bend sliders drive the same rig and hold timer. **Rotate hips left/right** and the **Hip rotation** slider tilt the pelvis around its fixed center. **Return to rest** resets every joint and hip rotation. This mode is visibly labeled **Manual simulation** and is fully functional without camera access.

## Added functional controls

- **Hold and fade:** choose a hold from 1–10 seconds, a fade from 0.2–5 seconds, and a fade amount from 25–100%. Defaults are 3 seconds, 1.6 seconds and 97%. The hold bar and seconds display use the chosen duration. Changing these settings or the gesture resets progress and restores color.
- **Several fade areas:** add, select, resize or remove up to five participant-chosen circles. Their masks combine into a single fade; overlapping circles do not apply the effect twice. Selecting a circle to edit preserves progress; moving/resizing/adding/removing one restores color. Areas share one gesture and one timer, rather than separate exercises.
- **Pause / Resume:** freeze the avatar and an earned fade. An incomplete continuous hold resets and must be performed again after resuming. The camera preview/tracker can keep running while the session is paused; **Stop camera** releases the webcam.
- **Save PNG:** download the displayed pose and current fade as an 840 × 900 PNG with a paper-colored background. The image includes the actual uploaded texture. This is an explicit local download; there is no automatic saving, video recording or session backend.
- **Tracking feedback:** left/right arm, hip and left/right leg visibility help identify why a gesture is not detected. A leg requires all three joints and noncollapsed segment lengths. These use the same confidence checks as gesture detection. **Cancel camera** safely cancels an in-progress camera startup, including releasing a stream or model that arrives later.
- **Reset alignment:** return the photo's zoom, position and rotation to their starting values without choosing another file.

## Drawing and rig constraints

- The supplied sheet has a **600 × 900** coordinate system and a front-facing silhouette in a neutral stance. Photograph this template, not an arbitrary person or shape. Keep its proportions and orientation.
- Fixed vector masks cut the normalized photograph into **head, torso, upper arms, forearms, pelvis, thighs and shins including feet**. Shoulder, elbow, hip and knee pivots are defined in `src/lib/rig.ts`. The outer printable silhouette is unchanged, so drawings made on the original sheet still fit. Small overlaps at the hips and knees help join moving segments.
- Marks outside the silhouette are not displayed. Uploaded pixels within each segment become that segment's texture; there is no replacement avatar drawn over them. A very light contour helps conceal seams.
- Alignment offers uniform scale, position and rotation. It does **not** automatically find page corners, rectify perspective, remove shadows, clean the photographed outline, or rig arbitrary artwork. For a badly skewed photo, retake it.
- Arms, torso, pelvis, thighs and shins rotate in 2D. The pelvis rotates around the fixed template pivot (300, 522), at canvas position (420, 522), and remains the parent of the torso and legs. Hip-line rotation is bounded to ±0.35 radians (about 20 degrees). Joint angles remain relative to the pelvis so its rotation is applied once. Missing hip confidence returns pelvis rotation to neutral. Feet move with the shins. Proportions stay fixed, and there is no 3D depth, forward/back knee reconstruction, separate ankle/foot rotation, unlimited walking translation, hand/finger tracking, exact full-body mirroring, or occlusion handling. Some overlap or seams at joints are expected.
- Use visible, saturated colors for areas you want to fade. Pale colors, black pencil/ink, gray shading, and white paper are mostly preserved by the saturation threshold. Colored lighting or shadows may be mistaken for color; even lighting helps.
- Selected circular regions are **participant-chosen**. They are not automatically identified as pain or discomfort, and their relationship to the chosen gesture is an artistic choice.

## What is real and what is symbolic

**Real:** local file upload, photo alignment, source-image texture clipping, MediaPipe Pose Landmarker webcam inference, confidence checks, anchored pelvis rotation, arm/torso/hip/knee joint rotation, continuous gesture timing, region-specific pixel fading and camera cleanup.

**Symbolic:** a softened color represents a moment of letting go. This does not measure pain, validate a therapeutic stretch, show clinical progress, or prove medical relief. Only move within your own comfortable range.

**Simulated:** manual mode uses explicit buttons/sliders instead of a detected participant. The example drawing is generated from the same template and clearly identified as an example. Automated camera QA replays a reference photograph through the real MediaPipe model; it does not establish physical-webcam performance with a live participant.

The interface is a plain MVP workspace with native HTML controls. Photos and video frames are processed in memory in this browser tab. There is no upload endpoint, automatic persistence, analytics or recording. A participant can explicitly download the current avatar using **Save PNG**. Reloading clears the drawing. A first dependency/model installation needs internet; the installed app does not need third-party runtime requests.

## Camera recovery

| State | What to do |
|---|---|
| Permission denied | Allow camera access in the browser's site settings and press **Try camera again**, or use manual mode. |
| No webcam | Connect a camera and retry; manual mode is available. |
| Camera busy | Close other camera apps/tabs and retry. |
| Pose model unavailable | Run `npm.cmd run setup:vision` and retry. Manual mode still works. |
| No body detected / legs missing | Stand alone in even light; step back until shoulders, hands, hips, knees and feet are in frame. |
| Camera disconnected | Reconnect and retry. |
| Camera unavailable in an embedded preview | Open `http://localhost:3201` in Chrome or Edge. Camera access needs localhost or HTTPS. |

Tracking inference is throttled to 20 Hz with a lightweight CPU model; the smoothed canvas render runs independently at display refresh rate. Actual speed depends on the laptop and browser. The one-day implementation runs inference on the main thread; a worker is a later optimization if a target device stutters. Tracking older than 300 ms is treated as lost. Hold time resets on interrupted gestures, missing confidence, long frame gaps, tab hiding, pause, changes to region geometry, drawing, mode, gesture or timing/amount settings. Completed fades survive pose loss and pause until restored or one of those configuration changes. Hidden tabs do not advance a fade.

## Validation

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:browser
```

See `QA.md` for the observed results and precise limits. Browser tests cover uploaded pixels, eight gesture choices, independent hip/knee movement, a rotating textured pelvis with a fixed pivot and attached body, multiple/overlapping region masks, custom timing/amount, pause/resume, exported PNG pixels, upload/alignment/reset, camera recovery/cancellation, resource release and layouts at 320, 768, 1024 and 1440 pixels. The replay camera checks are optional: set `OOB_CAMERA_FIXTURE` to a local Y4M person replay, `OOB_LEAN_CAMERA_FIXTURE` to a local Y4M lean replay, and `OOB_HIP_CAMERA_FIXTURE` to a moving reference-photo replay before running browser tests. Without these, the corresponding three tests are explicitly skipped.

The webcam integration follows the [official MediaPipe Pose Landmarker guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js). The model is downloaded from Google's [versioned MediaPipe model storage](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task). Runtime/package versions are pinned in the lockfile.

## Deliberately outside this prototype

Production QR/mobile uploads, shared sessions, persistent participant storage, automatic art recognition, automatic rigging, clinical stretch validation and exact all-body tracking. The app itself is hosted on Sites. The intended next step is a short trial with the real printed template and the actual installation laptop/webcam/projector, tuning framing and gesture thresholds from that observation.
