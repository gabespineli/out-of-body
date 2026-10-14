# Out of Body

Routes: `/` is the exhibit installation, `/test` is the local-upload/manual-demo page, and `/mobile` is the participant phone flow. The previous `/installation` address redirects to `/`.

The permanent-QR queue is now available on `/` and `/mobile`: optional participant names, automatic 20-slot intake, compact queue management before and between turns, and local drawing cleanup before upload. See [QUEUE_SETUP.md](QUEUE_SETUP.md) for the Supabase migration, stable QR address, hosting configuration, operating limits, and verification boundaries. The Figma design is implemented with local logo/background/icon assets, supplied Hatch Sans and Urbanist fonts. The completion background uses the approved still export.

An interactive art prototype. Upload a drawing on the supplied human silhouette, follow an independent animated stretching guide, and watch the actual drawing mirror your movements. Participation gradually fades the corresponding colored marks while preserving the outline.

Stretches are selected from eight colored regions: head/neck, torso/pelvis, each upper arm, each forearm/hand, and each leg/foot. Uncolored regions are omitted. Upper-arm marks select a reach; forearm marks select an independent elbow bend; torso marks select hands-on-hips side stretches. Each colored leg selects side steps, side raises and supported heel raises, with a same-leg side-raise fallback when foot tracking is unclear. A sideways arc on the instructor explains neck tilt, not a full neck circle. Blank drawings need an alignment/color check before a guided session can start. These are symbolic activity mappings, not a medical interpretation of the marks.

This is the separate GitHub/Vercel migration of the existing application. The original ChatGPT Sites checkout and deployment remain unchanged. See [MIGRATION.md](MIGRATION.md) for the original migration audit and [QA.md](QA.md) for verification evidence.

The participant-journey implementation adds `/` for the permanent QR and exhibit queue and `/mobile` for phone capture, preview and upload. It uses a dedicated Supabase project for private temporary artwork and session capabilities. The original local-upload/manual-demo experience is available at `/test`. See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for Docker startup/cloud instructions, [PARTICIPANT_JOURNEY.md](PARTICIPANT_JOURNEY.md) for component boundaries and Figma references, and [design asset provenance](public/design/README.md) for asset sources. This design update requires no new database migration or hosting setting.

On the mobile photo preview, drag with one finger to position the drawing and pinch with two fingers to zoom around their midpoint. The silhouette guide stays fixed. Keyboard users can move with arrow keys and zoom with plus/minus. The preview has no adjustment section; paper cleanup runs automatically, and the prepared upload matches the displayed alignment and cleanup. Retake / choose again returns to capture. Cancel my ticket is directly visible and asks for confirmation before releasing the ticket. Page scrolling and browser zoom remain available outside the photo surface.

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

If model setup fails, retry `npm run setup:vision` when online. Development and Manual demo remain available; a production build requires the model. The original local-upload experience needs no cloud configuration. The new QR journey needs the Supabase/server settings in `.env.example`; participants need no accounts.

For the full local journey, with Docker running:

```sh
npm run backend:start
npm run backend:env
npm run dev
```

Open `http://localhost:3000/`. Local Supabase Studio is `http://localhost:55323`. These ports and containers are separate from other projects. The environment helper also configures automatic cleanup. Use the generated `OOB_INSTALLATION_KEY` from your ignored `.env.local` once on the desktop pairing screen.

## GitHub and Vercel

The repository is [gabespineli/out-of-body](https://github.com/gabespineli/out-of-body). **main** is the production branch. Clone it to preserve the existing application history:

```sh
git clone https://github.com/gabespineli/out-of-body.git
cd out-of-body
npm ci
```

The source zip contains files without Git history. It can be used for local development after extraction and `npm ci`; use the Git checkout when contributing to this repository.

Do not copy dependencies, build output, generated `public/vision/` binaries, local test artifacts, temporary files or credentials into Git. These are excluded by `.gitignore`, including `.env.local`. The lockfile and install script reproduce the runtime dependencies and generated assets.

Import that repository into a **new Vercel project**:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Root directory | `.` when this folder is the repository root |
| Framework preset | Next.js |
| Node.js version | 24.x |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | Leave at the Next.js framework default |
| Environment variables | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `OOB_INSTALLATION_KEY`, `OOB_CLEANUP_SECRET`; optional `OOB_PUBLIC_URL` |

`vercel.json` records the framework/install/build settings. Do not set the output directory to `out` or `public`; this copy uses an ordinary Next.js production build. If this folder is placed inside a larger repository, select its actual relative folder as the Vercel root directory.

Keep the existing Sites URL and domain configuration unchanged. Import the GitHub repository into Vercel to create the new deployment. On its HTTPS URL, verify camera permission, upload, a manual guided sequence and PNG export before using it in an exhibition.

Vercel supports [native Next.js deployments](https://vercel.com/docs/frameworks/full-stack/nextjs) and [Node.js 24.x](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). Next.js also supports [running the production build with `next start`](https://nextjs.org/docs/app/guides/self-hosting).

## Project structure

```text
out-of-body-vercel/
├── src/
│   ├── app/                     # Page, layout, CSS and printable drawing-sheet route
│   ├── components/              # Installation, upload, motion controls and visual instructor
│   ├── hooks/                   # Artwork, webcam/MediaPipe and optional WebMCP bindings
│   ├── lib/                     # Fixed rig, pixel rendering, detectors, progress and PNG export
│   └── server/                  # Private sessions, authorization and upload validation
├── public/
│   ├── favicon.svg
│   └── vision/                  # Generated WASM/model assets; not committed
├── scripts/setup-vision.mjs
├── scripts/setup-local.mjs
├── scripts/start-backend.mjs
├── supabase/                    # Dedicated local config, private schema and cleanup schedule
├── tests/                       # Pose/progress logic and browser interaction scenarios
├── next.config.ts               # Native Next.js settings and permission/security headers
├── vercel.json
├── playwright.config.ts
├── package.json
├── package-lock.json
├── .nvmrc
├── README.md
├── MIGRATION.md
├── SUPABASE_SETUP.md
├── PARTICIPANT_JOURNEY.md
└── QA.md
```

The page is a Next.js App Router shell around browser-side React/Canvas logic. The original route handler generates the printable SVG. The QR/queue journey adds authorized server routes and temporary Supabase storage. The direct local-upload page still processes its drawing in browser memory.

## Using the existing experience

1. Get the drawing sheet, draw colored marks inside the silhouette, and photograph the entire page upright, straight-on and evenly lit.
2. Upload a JPEG, PNG or WebP. **Align photo** adjusts scale, position and rotation. **Try an example** supplies a visibly labeled sample.
3. Press **Start guided session**. The positioning screen shows a mirrored camera preview and boundary. Enable the camera, fit the body parts needed by the selected stretches inside the boundary, and hold steady for two seconds. **Start stretching** then opens the exhibit view.
4. During the turn, only the guide, drawing/name, current instruction, progress and **Skip Stretch / Pause / Restart / Skip Turn** are shown. The camera remains active in the background; its preview and the queue stay outside this view.
5. Unreliable tracking freezes drawing, guide and progress immediately. Sustained loss opens a repositioning prompt. Two seconds of steady tracking enable **Continue**, which must be clicked explicitly. **Check position** reopens the preview without losing earned progress. Restart clears progress with the same drawing and returns camera sessions to the positioning gate; Skip Turn releases the camera and ends the current participant's turn.
6. **Setup tools** retains explicit Manual demo, individual stretch practice, fullscreen and export for staff/local development. Manual simulation does not certify camera framing. Mobile alignment uses drag/pinch or arrow keys and plus/minus, with automatic cleanup and a simplified Name/send/retake flow.

The independent guide never earns participant credit. Only colored regions enter the sequence: head tilts; left/right upper-arm reaches; left/right elbow bends; hands-on-hips torso side stretches; and each colored leg's side steps, side raises and supported heel raises. Each region earns eight seconds of movement. Unusable heel tracking falls back to side raises on the selected leg. Chair support is demonstrated, not detected.

## Drawing and movement constraints

- The template is a **600 × 900**, front-facing neutral silhouette. Uploaded pixels are clipped into predefined head/neck, torso, arm, pelvis, thigh and shin/foot segments with fixed joint pivots. This is not arbitrary automatic rigging.
- The pelvis rotates around its fixed center; it does not translate. Feet remain attached to the shins. Exact full-body mirroring, separate ankle rotation and 3D motion are outside the MVP.
- Region-specific masks fade saturated colored pixels toward paper color. Black/gray outline strokes, unselected regions remain unchanged. Pelvis marks belong to the torso region. Back uses the front-facing torso as its artistic proxy.
- Alignment does not correct perspective, remove shadows or recognize discomfort. Pale colors may be excluded; colored lighting can be included. Retake skewed/poorly lit photographs.
- Uploads support JPEG/PNG/WebP up to 20 MB, with minimum 100-pixel dimensions and a 50-megapixel ceiling.
- Direct uploads and webcam frames stay in browser memory. In the QR journey, only a prepared opaque 600 × 900 PNG is sent to private temporary storage; camera video and the original photo are never uploaded. The desktop retrieves it through its own authorized route. Completion/reset deletes the temporary object; expired objects are cleaned automatically when the configured scheduler/app are reachable. **Save PNG** explicitly downloads an opaque 840 × 900 result.
- Color fading represents symbolic artistic progress, not proof of medical relief or exercise-form validation.

## Camera recovery and external requirements

Use Chrome or Edge on localhost or HTTPS, with a physical webcam and permission to use it. The positioning preview preserves the camera’s actual aspect ratio. The preview is hidden while the same live stream tracks the active stretch. Framing checks visibility/confidence, required joints and an inset image boundary; it does not inspect obstacles or certify physical safety.

| State | Recovery |
|---|---|
| Permission denied | Allow camera access in site settings, retry, or use Manual demo. |
| No webcam / camera busy | Connect a webcam or close other camera apps, then retry. |
| Model unavailable | Retry asset setup/build; Manual demo remains usable. |
| Missing landmarks | Face the camera with the relevant head, hands or legs/feet in frame. |
| Disconnected camera | Reconnect and retry. |
| Restricted embedded view | Open the application's own localhost/HTTPS URL directly. |

The MediaPipe CPU model runs at up to 20 inference calls per second; device performance varies. Build-time network access is needed for public npm packages and the [pinned Google model](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task). Runtime model/WASM requests go to `/vision` on the app's own origin.

Optional WebMCP tools are feature-detected and tied to visible controls. They require no Sites SDK, login or OpenAI API key. Browsers without WebMCP run the application. QR pairing uses a dedicated Supabase database/private bucket and server secrets. New-project setup and Cron/Vault activation are documented in `SUPABASE_SETUP.md`; the original local/manual flow continues to work without them.

## Verification

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Browser tests launch the production server on port 3202. Optional real-model replay tests need `OOB_CAMERA_FIXTURE`, `OOB_LEAN_CAMERA_FIXTURE` and `OOB_HIP_CAMERA_FIXTURE` pointing to local Y4M reference-photo camera replays. Those files are not shipped with the source. Without them, the five replay scenarios are skipped; manual/error/upload/guided scenarios still run.

See [QA.md](QA.md) for the participant journey and migration results. Automated replay verifies real model inference and regressions; a physical participant performing the routines, paper photographs under exhibition lighting and the projector still need a practical trial. The migration does not claim new movement accuracy.

The existing tracker follows the [MediaPipe Pose Landmarker documentation](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker).
