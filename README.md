# Out of Body — guided stretching MVP

A plain React/Next.js prototype: upload a drawing on the supplied silhouette, follow an independent animated instructor, and watch your actual uploaded texture mirror your movements. Gentle participation gradually softens the corresponding colors. All photo and camera processing happens in the browser. The Sites edition is a static export; no participant backend or persistence is added.

## Guided sequence (default)

Upload your drawing, enable the camera (or select **Manual demo**) and press **Start guided session**. Follow the instructor beside **Your drawing**. The instructor is authored independently; the uploaded pixels still follow the participant's own MediaPipe landmarks.

| Activity | Matching demonstration and recognition |
|---|---|
| Neck / head | Gentle side-to-side neck tilts, measured relative to the shoulder line. A 0.09-radian change (about 5 degrees) counts. |
| Arms / back | Four credited seconds of reaching overhead and lowering, then four of gentle side stretches with at least one arm raised. Reach needs a visible hand near/above shoulder level and a 0.14-radian arm change; side stretch needs visible hips and a 0.07-radian torso change relative to the pelvis. One raised arm is acceptable. Waving low hands and leaning with both hands lowered do not count. |
| Legs / feet | Four credited seconds of small alternating side steps, then four of supported heel raises. Side steps need hip/knee/ankle confidence, outward thigh displacement of 0.09 radians and evidence from both sides; knee flexion or hip rotation alone does not count. |

Each outer activity still has eight seconds of accumulated movement progress and a 1.4-second automatic transition. The active instruction, looping demonstration and detector switch together at the midpoint. Movements need not match the instructor's timing or exact range. A displacement above the jitter deadband grants up to 0.8 seconds of credit between motions; a static held pose eventually stops earning credit. Rests retain progress. Pause, hidden tabs, stale tracking, missing required points and frame gaps over 250 ms do not earn credit.

**Heel raises where tracking permits:** hold a stable chair and slowly lift/lower the heels while the toes remain planted. The instructor shows a side view with hand support and planted toes for clarity. Detection uses MediaPipe ankles (27/28), heels (29/30) and foot indices (31/32). A usable projected heel-to-toe span and visibility/presence ≥0.6 are required. Relative heel-height changes ≥0.055 shin lengths and ankle-height changes ≥0.03 shin lengths must agree in direction, while the toe's vertical position stays within 0.015 image heights. Feet lifting together, small jitter and whole-body translation do not qualify. Repositioning establishes a fresh baseline without movement credit.

If legs remain tracked but usable foot points are absent for 2.5 seconds, the instruction **explicitly changes to more side steps**, and the visual instructor and detector change with it. The remaining half is earned by alternating steps. Losing the entire person does not trigger this fallback or award progress. Chair support itself is not detected or validated. These thresholds are exhibition approximations, not a validated exercise classifier; heel tracking needs a physical-camera trial.

Only the current region's existing colored-pixel mask fades as progress accumulates. Other regions, the original outline and the pelvis mapping are preserved. An uncolored area still allows participation, with a short note. Back remains mapped to the front-facing torso, and legs/feet remains a combined region. No artwork recognition or new fade mapping is added.

**Skip activity** advances immediately without completing the skipped fade; any partial fade remains. The sequence records skipped activities and does not report them as successfully completed. Use a comfortable range and skip anything uncomfortable. **Reset experience** restores all colors and progress, resets the guide/manual pose and returns to the first activity, while retaining the drawing and current camera connection. Start again explicitly. **Replay sequence** appears after the sequence finishes.

The main screen keeps only Start, Pause/Resume, Skip, Reset and Fullscreen. Export, the existing individual practice mode and **Start fresh** are grouped under **More controls**. Start fresh remains the full participant reset: it removes the photo and releases the camera. Manual guided controls show only the current routine's sliders. The camera preview uses its full 4:3 frame; tracking feedback sits below it, with no FPS overlay. Detailed landmark diagnostics are collapsed.

Fullscreen includes both panels and activity feedback; narrow screens stack them. PNG export contains only the actual participant drawing. The instructor's supported-heel illustration is an authored animation; the participant retains the existing front-facing segment rig with feet attached to the shins and a fixed pelvis pivot. Independent foot rotation and body translation are still outside this MVP. Manual heel input simulates the detector measurements; it does not add a new ankle rig.

Switching experience, motion mode, drawing or alignment resets progress. The existing individual hold-based behavior is retained under **More controls → Individual stretches**, with its original strict matcher and timing/amount controls. The next sections describe that practice mode.

## Individual stretches

1. Get the drawing sheet, print it at its original proportions, and draw colored marks inside the silhouette. Photograph the entire page upright, straight-on and evenly lit.
2. Upload a JPG, PNG or WebP. Use **Align photo** to match the photographed outline to the dashed template. **Try an example** supplies a clearly labeled sample drawing.
3. Choose **Body area**, then follow the instruction above the avatar. Enable the camera and keep the relevant landmarks visible. The dashed outline in the drawing preview shows the current fade mask.
4. A matching pose changes **Not detected** to **Hold still**. Hold continuously for **3 seconds**; the corresponding colored pixels then fade over **1.6 seconds**, followed by **Completed**. Releasing the pose or losing tracking before completion restarts the hold.
5. Switch areas to perform another movement. Completed fades stay visible; unfinished holds reset. **Reset experience** resets all three areas. **Start fresh** releases the camera, removes the photo and restores defaults.

| Body area | Suggested movement | Fixed fade mapping |
|---|---|---|
| Neck / head | Gently tilt the head sideways, keeping shoulders still. Either side works. | Head segment, including the neck. |
| Arms / back | Raise both hands above their shoulders, elbows near shoulder height. | Both upper arms, forearms and torso. |
| Legs / feet | Gently extend either leg outward to the side. | Both thighs and shins, including feet. |

The template faces forward. **Back is represented by the torso**, not a separate back drawing. Either outward leg earns the combined legs/feet fade; there are no separate left/right completion records. The pelvis is excluded from all fade masks. Color is selected by fixed template segments and a simple saturation rule, not inferred from a medical condition or automatically recognized artwork.

Only move within a comfortable range. The fade is symbolic and does not measure pain, validate a therapeutic stretch or prove medical relief.

## Individual stretch detection rules

MediaPipe supplies 33 pose landmarks. All required points must have finite coordinates and visibility/presence of at least **0.6**. Low confidence releases a hold immediately; tracking older than **300 ms** is treated as lost. Detection uses current unsmoothed landmarks; smoothing only affects avatar animation.

- **Head:** compare the ear-line angle (landmarks 7/8) with the shoulder-line angle (11/12). The relative tilt must reach **0.20 radians**, about 11.5 degrees, to enter; it releases below **0.14 radians**. Subtracting shoulder roll prevents a whole-body tilt alone from earning the head stretch. Both ears and shoulders must be visible; collapsed horizontal spans are rejected. Head rotation is bounded to ±0.5 radians and applied around the fixed neck pivot.
- **Arms:** each wrist (15/16) must be at least **0.08 normalized image heights** above its own shoulder; each elbow (13/14) may be at most 0.05 below its shoulder. Once detected, release thresholds are 0.04 and 0.07 respectively to tolerate small jitter. Both arms are required. Legs and hips may be out of frame.
- **Legs:** the hip-to-knee direction relative to hip-line rotation must extend outward by **0.28 radians**, about 16 degrees; release is 0.22 radians. The corresponding hip, knee and ankle (23/25/27 or 24/26/28) must be visible, with noncollapsed thigh/shin lengths. Either leg works; knee bend or hip rotation alone does not earn completion.

These are rule-based approximations with no calibration, anatomical assessment or advanced stretch classification. Face the camera; avoid turning the head/body away from it. For head mode, frame ears and shoulders; for arm mode, shoulders, elbows and hands; for leg mode, step back until shoulders, hips, knees and ankles are visible.

Each area has its own continuous timer and fade value. Only the selected area can earn a hold. Earned fades continue when another area is selected, but **Pause** or a hidden tab freezes all of them. Frame gaps over 250 ms reset an unfinished hold rather than counting a suspension. Uploading another drawing, changing alignment, motion mode, timing or fade amount resets all progress.

## Manual fallback and existing controls

Selecting **Manual demo** in Motion source runs the same matcher, rig, timer and fade using explicit controls instead of a camera. Use **Tilt head left/right**, **Raise arms**, or **Lift left/right leg** for the matching selected area. The mode remains visibly labeled **Manual simulation**. Changing area resets manual joints to rest so the previous pose does not accidentally start a new hold.

In individual practice mode, independent head, arm, lean, hip, leg and knee controls remain available. **Return to rest** resets them all. **Rotate hips left/right** rotates the pelvis texture and attached body around its fixed stage-center pivot; its center does not translate.

- **Hold and fade:** hold 2–3 seconds, fade 0.2–5 seconds, amount 25–100%. Defaults are 3 seconds, 1.6 seconds, 97%. Setting changes reset all areas.
- **Pause / Resume:** freezes the displayed pose and earned fades. Partial holds restart after resuming. The camera may continue tracking while paused; **Stop camera** releases it.
- **Save PNG:** explicitly downloads the displayed artwork/pose/fades as an opaque 840 × 900 image. No automatic saving or recording.
- **Fullscreen:** enlarges the avatar and keeps the stretch instruction/status visible for projection. Escape exits.
- **Tracking feedback:** head, arms, hips and legs show visible/missing states under **Tracking details**. **Cancel camera** releases a delayed stream/model if startup is canceled.
- **No color:** if the chosen mask contains fewer than 40 strongly colored pixels, a clear message asks for a colored mark or alignment. No hold advances in that area.

## Template and rendering constraints

The sheet uses a **600 × 900**, front-facing neutral silhouette. The normalized uploaded photograph is clipped into predefined head/neck, torso, upper arms, forearms, pelvis, thighs and shins/feet. The printable outer outline remains compatible with earlier drawings. Joint pivots and paths are in `src/lib/rig.ts`; area mappings are in `src/lib/body-areas.ts`.

Uploaded pixels become each segment's actual texture. Fixed masks cover only the matching segments. Saturated pixels soften toward paper color; black/gray marks and pale paper remain unchanged. Pale color may not count, while colored lighting/shadows may count, so even lighting is important.

Alignment supports uniform scale, X/Y position and rotation. It does not find page corners, correct perspective, remove shadows, clean outlines or rig arbitrary artwork. Retake heavily skewed photos. Colors outside the silhouette are not shown. Joint overlaps and seams are expected.

The pelvis pivot is template (300, 522), canvas (420, 522), and remains fixed while its texture rotates from the hip line, bounded to ±0.35 radians. Torso/legs inherit this rotation once. Feet move with the shins. There is no separate ankle rotation, 3D depth, forward/back knee reconstruction, unlimited walking translation, finger tracking or exact full-body mirroring.

## Launch locally

Use the installed Node.js runtime (this project was tested with Node 24). In PowerShell:

```powershell
cd "C:\Users\Gab\Documents\Codex\2026-10-03\referenced-chatgpt-conversation-this-is-an\outputs\out-of-body-sites"
npm.cmd install
npm.cmd run dev
```

Open **http://localhost:3201** in Chrome or Edge. Keep the terminal open; Ctrl+C stops it. This checkout uses port 3201; the original local MVP is separate on port 3200. `npm.cmd` avoids PowerShell script-policy problems.

To preview the static build used by Sites:

```powershell
npm.cmd run build
npm.cmd run start
```

If port 3201 is occupied, stop the existing instance first. `stop-demo.cmd` checks that the listener belongs to this project before stopping it.

Installation copies package-matched WASM files and downloads the pinned Pose Landmarker Lite v1 model into `public/vision`. They are served with the app. If model setup fails, use manual mode and retry `npm.cmd run setup:vision` when online. No API keys, database or participant accounts are required.

## Camera recovery

| State | Recovery |
|---|---|
| Permission denied | Allow camera access in browser site settings and use **Try camera again**, or use manual mode. |
| No webcam | Connect a camera and retry. |
| Camera busy | Close other camera apps/tabs and retry. |
| Pose model unavailable | Retry model setup; manual mode remains functional. |
| Missing relevant landmarks | Face the camera in even light and follow the selected area's framing hint. |
| Camera disconnected | Reconnect and retry. |
| Embedded preview restriction | Open localhost in Chrome/Edge. Camera access requires localhost or HTTPS. |

The lightweight CPU model runs at up to 20 inference calls per second; canvas rendering runs separately at display refresh rate. Actual performance depends on the device/browser. Inference runs on the main thread for this MVP.

## Validation and limits

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:browser
```

See `QA.md` for observed results. Optional real-model camera tests require `OOB_CAMERA_FIXTURE`, `OOB_LEAN_CAMERA_FIXTURE` and `OOB_HIP_CAMERA_FIXTURE` pointing to Y4M reference-photo replays. No landmark outputs are injected into those tests.

Constructed landmarks check positive/negative head, arm and leg rules. Manual controls verify the complete three-area interaction and uploaded-pixel fade behavior. Real model replay checks tracking, pose rejection, pelvis rotation and leg completion. Physical-webcam participants, photographed paper under real lighting and the installation projector still need a practical trial; replay/manual checks do not establish clinical or live-camera accuracy.

The integration follows the [official MediaPipe Pose Landmarker documentation](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker). The model is from Google's [versioned model storage](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task).

WebMCP-capable browsers expose five tools tied to the visible controls: read installation state, start/restart guided stretching, select an individual body area, configure a manual pose, and restore colors. They return no photos, names or video frames and never enable the camera automatically. Browsers without WebMCP run the full MVP.

## What stays outside the MVP

No QR/mobile upload flow, shared sessions, persistent participant storage, arbitrary art recognition, automatic rigging, clinical stretch validation or exact body mirroring. Files and camera frames stay in this browser's memory; reloading clears the drawing. Only **Save PNG** creates an explicit local result. The Site identity is retained in `.openai/hosting.json`.
