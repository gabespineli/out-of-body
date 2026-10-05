# Out of Body

An interactive art prototype. Upload a drawing on the supplied human silhouette, follow an independent animated stretching guide, and watch the actual drawing mirror your movements. Participation gradually fades the corresponding colored marks while preserving the outline.

This is the separate GitHub/Vercel migration of the existing application. The original ChatGPT Sites checkout and deployment are not part of this deployment. See [MIGRATION.md](MIGRATION.md) for the architecture audit and [QA.md](QA.md) for verification evidence.

## Local development

Use Node.js **24.x** and npm. The included `.nvmrc` and `package.json` record this version.

```sh
npm ci
npm run dev
```

Open **http://localhost:3000**. Keep the terminal open; Ctrl+C stops it. On Windows PowerShell, use `npm.cmd` in place of `npm` if script execution is restricted.

To run the production build locally:

```sh
npm run build
npm start
```

A different port can be selected with `npm run dev -- --port 3202` or `npm start -- --port 3202`. The browser test suite reserves port 3202, so stop other listeners on that port before running it.

Installation copies the matching MediaPipe WASM files and downloads Google's pinned Pose Landmarker Lite v1 model into `public/vision/`. These generated assets are ignored by Git and served from this application's own origin. `npm run build` rechecks them and fails if the model cannot be installed, preventing a successful deployment with a missing camera model.

If model setup fails, retry `npm run setup:vision` when online. Development and Manual demo remain available; a production build requires the model. No environment variables, API keys, database or participant accounts are required.

## GitHub and Vercel

The prepared Git checkout is on branch **migration/vercel**, with no remote attached. If you extracted the source zip instead, first initialize its Git history:

```sh
git init -b migration/vercel
git add .
git commit -m "Prepare Out of Body for Vercel"
```

Create a new empty GitHub repository, then from this project directory:

```sh
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin migration/vercel
```

Do not copy `node_modules/`, `.next/`, `out/`, `public/vision/`, `.vercel/` or local test artifacts into Git. The lockfile and install script reproduce the runtime dependencies and generated assets.

Import that repository into a **new Vercel project**:

| Setting | Value |
|---|---|
| Production branch | `migration/vercel` |
| Root directory | `.` when this folder is the repository root |
| Framework preset | Next.js |
| Node.js version | 24.x |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | Leave at the Next.js framework default |
| Environment variables | None required |

`vercel.json` records the framework/install/build settings. Do not set the output directory to `out` or `public`; this copy uses an ordinary Next.js production build. If this folder is placed inside a larger repository, select its actual relative folder as the Vercel root directory.

Keep the existing Sites URL and domain configuration unchanged. GitHub repository creation, pushing and Vercel deployment are separate steps; they have not been performed as part of preparing this copy. On the new HTTPS deployment, verify camera permission, upload, a manual guided sequence and PNG export before using it in an exhibition.

Vercel supports [native Next.js deployments](https://vercel.com/docs/frameworks/full-stack/nextjs) and [Node.js 24.x](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). Next.js also supports [running the production build with `next start`](https://nextjs.org/docs/app/guides/self-hosting).

## Project structure

```text
out-of-body-vercel/
├── src/
│   ├── app/                     # Page, layout, CSS and printable drawing-sheet route
│   ├── components/              # Installation, upload, motion controls and visual instructor
│   ├── hooks/                   # Artwork, webcam/MediaPipe and optional WebMCP bindings
│   └── lib/                     # Fixed rig, pixel rendering, detectors, progress and PNG export
├── public/
│   ├── favicon.svg
│   └── vision/                  # Generated WASM/model assets; not committed
├── scripts/setup-vision.mjs
├── tests/                       # Pose/progress logic and browser interaction scenarios
├── next.config.ts               # Native Next.js settings and permission/security headers
├── vercel.json
├── playwright.config.ts
├── package.json
├── package-lock.json
├── .nvmrc
├── README.md
├── MIGRATION.md
└── QA.md
```

The page is a Next.js App Router shell around browser-side React/Canvas logic. The only route handler generates the printable SVG. There is no participant API or persistent storage.

## Using the existing experience

1. Get the drawing sheet, draw colored marks inside the silhouette, and photograph the entire page upright, straight-on and evenly lit.
2. Upload a JPEG, PNG or WebP. **Align photo** adjusts scale, position and rotation. **Try an example** supplies a visibly labeled sample.
3. Enable the camera, or select **Manual demo**. Press **Start guided session** and follow the instructor beside **Your drawing**.
4. Move gently within a comfortable range. **Skip activity** advances without awarding its unearned fade. **Pause/Resume** freezes progress. **Reset experience** restores colors/progress while retaining the drawing and camera connection.
5. **More controls** retains individual stretch practice, **Save PNG** and **Start fresh**. Start fresh removes the drawing and releases the camera. Fullscreen retains the guide, drawing and activity controls.

The guide and drawing remain independent: the guide animates its authored demonstration; the drawing follows participant landmarks or explicit manual inputs. An idle guide does not earn participant progress.

| Guided activity | Demonstration and matching forgiving detection | Fade mapping |
|---|---|---|
| Neck / head | Gentle side-to-side neck tilts relative to the shoulders. | Head segment, including neck. |
| Arms / back | Overhead reaching, then a gentle side stretch with at least one arm raised. | Torso and both arms. |
| Legs / feet | Alternating small side steps, then supported heel raises when foot points are usable. | Both thighs and shins, including feet. |

Each activity accumulates eight seconds of meaningful movement and transitions automatically after a brief completion pause. Rest retains earned progress; idle poses, tracking loss, paused/hidden tabs and long frame gaps earn none. During legs/feet, unusable foot points with tracked legs trigger an explicit **more side steps** fallback after 2.5 seconds; the guide and detector change together. Chair support is instructed and illustrated, not recognized.

Manual demo uses the existing sliders and progress system. Manual heel input simulates detection measurements; it does not add a separate foot rig. Individual stretch practice retains the separate continuous-hold rules, timing and fade-amount controls.

## Drawing and movement constraints

- The template is a **600 × 900**, front-facing neutral silhouette. Uploaded pixels are clipped into predefined head/neck, torso, arm, pelvis, thigh and shin/foot segments with fixed joint pivots. This is not arbitrary automatic rigging.
- The pelvis rotates around its fixed center; it does not translate. Feet remain attached to the shins. Exact full-body mirroring, separate ankle rotation and 3D motion are outside the MVP.
- Region-specific masks fade saturated colored pixels toward paper color. Black/gray outline strokes, other regions and the pelvis remain unchanged. Back uses the front-facing torso as its artistic proxy.
- Alignment does not correct perspective, remove shadows or recognize discomfort. Pale colors may be excluded; colored lighting can be included. Retake skewed/poorly lit photographs.
- Uploads support JPEG/PNG/WebP up to 20 MB, with minimum 100-pixel dimensions and a 50-megapixel ceiling.
- All participant photos and camera frames stay in browser memory. Reloading clears the drawing; **Save PNG** explicitly downloads an opaque 840 × 900 result. There is no QR/mobile handoff, shared session or participant database.
- Color fading represents symbolic artistic progress, not proof of medical relief or exercise-form validation.

## Camera recovery and external requirements

Use Chrome or Edge on localhost or HTTPS, with a physical webcam and permission to use it. The camera preview keeps its full 4:3 frame and displays tracking feedback below it.

| State | Recovery |
|---|---|
| Permission denied | Allow camera access in site settings, retry, or use Manual demo. |
| No webcam / camera busy | Connect a webcam or close other camera apps, then retry. |
| Model unavailable | Retry asset setup/build; Manual demo remains usable. |
| Missing landmarks | Face the camera with the relevant head, hands or legs/feet in frame. |
| Disconnected camera | Reconnect and retry. |
| Restricted embedded view | Open the application's own localhost/HTTPS URL directly. |

The MediaPipe CPU model runs at up to 20 inference calls per second; device performance varies. Build-time network access is needed for public npm packages and the [pinned Google model](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task). Runtime model/WASM requests go to `/vision` on the app's own origin.

Optional WebMCP tools are feature-detected and tied to visible controls. They require no Sites SDK, login or OpenAI API key. Browsers without WebMCP run the full application. Deployment requires your GitHub/Vercel accounts; the application itself requires no external auth, storage, database or paid API.

## Verification

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Browser tests launch the production server on port 3202. Optional real-model replay tests need `OOB_CAMERA_FIXTURE`, `OOB_LEAN_CAMERA_FIXTURE` and `OOB_HIP_CAMERA_FIXTURE` pointing to local Y4M reference-photo camera replays. Those files are not shipped with the source. Without them, the five replay scenarios are skipped; manual/error/upload/guided scenarios still run.

See [QA.md](QA.md) for the migration's actual results. Automated replay verifies real model inference and regressions; a physical participant performing the routines, paper photographs under exhibition lighting and the projector still need a practical trial. The migration does not claim new movement accuracy.

The existing tracker follows the [MediaPipe Pose Landmarker documentation](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker).
