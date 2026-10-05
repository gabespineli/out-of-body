# GitHub + Vercel migration

Prepared on 5 October 2026 in a separate copy, branch `migration/vercel`, from source commit `903c004c7a52befb6d63f94af06266cfafb8043d`. The original `out-of-body-sites` checkout and its working Sites deployment are protected. No hosting connector, publish, GitHub push or Vercel deployment was used.

## Architecture and dependency audit

| Concern | Existing implementation | Migration decision |
|---|---|---|
| Framework | Native Next.js 16.3.8 App Router, React/React DOM 19.3.0, TypeScript. | Retain native Next.js; conversion to Vite would rewrite working code without removing a runtime dependency. |
| Interactions | Client React, Canvas, uploaded image segments and browser MediaPipe Pose Landmarker 1.0.1. | Preserve application components, hooks, detectors, rig, masks and export. |
| Routes | Main page/layout plus a force-static printable SVG route. | Preserve both routes. No participant backend is introduced. |
| Sites hosting | `output: "export"`, `.openai/hosting.json`, `public/_headers`, custom static preview script and Windows launch/stop wrappers. | Remove these deployment-specific files/settings in this copy; use `next build` / `next start` and Next.js headers. |
| Vinext / Vite / edge adapters | None present in source, config or lockfile. | No replacement required. |
| Sites plugin | External authoring/hosting tooling; no plugin SDK is imported or installed in the app. | No Sites tooling is required by the migrated runtime/build. |
| Auth, storage, environment bindings | No app login, database, persistence SDK, environment variables, secrets or Sites bindings. | No external service migration is needed. Images/video stay in browser memory. |
| Optional browser tools | `use-webmcp.ts` feature-detects `document.modelContext`; absent API is a no-op. | Retain this optional enhancement. It is not a Sites package or a requirement for ordinary browsers. |
| Camera assets | Package-matched WASM plus pinned Google Lite model copied/downloaded by postinstall, then served from `/vision`. | Keep same-origin assets and postinstall; add a required prebuild check so a missing/undersized model cannot silently ship. |
| Package sources | Lockfile resolves public npm packages. | Keep all dependency versions unchanged and update only the root Node engine entry. |

## Deployment changes

- Set Node.js to 24.x in `package.json` and `.nvmrc`.
- Use standard `npm run dev`, `npm run build`, and `npm start`, defaulting to port 3000.
- Add `prebuild` to require the camera model and recopy the matching WASM assets.
- Add `vercel.json` for the Next.js preset, `npm ci` and `npm run build`; leave output selection to the framework.
- Move the existing camera/microphone permissions policy and nosniff header to `next.config.ts` so native Next.js serves them.
- Ignore local `.vercel/` metadata instead of the old Sites preview state.
- Point the existing browser tests at a native production server on isolated port 3202. Test interaction assertions remain unchanged.
- Replace Sites-local setup instructions with reproducible local, GitHub and Vercel instructions.

No participant UI, artwork processing, avatar rigging, webcam lifecycle, visual instructor, movement rules, region-specific fading, manual inputs, reset, fullscreen or PNG export has been rebuilt.

## Verification

Fresh `npm ci`, TypeScript and the native Next.js production build passed. All **39 logic/asset tests** and **27 browser scenarios** passed, including five real-model camera replays. Production HTTP checks verified the same-origin model/WASM bytes, MIME types, printable SVG and camera headers. The verification record and interaction results are in [QA.md](QA.md).

All 40 tracked original source files matched their pre-migration SHA-256 values; the original HEAD and clean working tree were unchanged. The migration has no diff in `src/` relative to that source commit. No remote is attached and no cloud deployment has been performed.

## External requirements

- Node.js 24.x and npm for local builds; Vercel supports this runtime.
- Build-time access to public npm and Google's versioned model storage. Model/WASM binaries are generated into ignored `public/vision/` and included in deployment output.
- A GitHub repository and Vercel project owned by the deployer. No remote is attached to this prepared copy; no accounts/project identifiers are embedded.
- A browser with webcam support on localhost or HTTPS and explicit camera permission.
- No runtime database, upload bucket, participant auth provider, OpenAI API, paid inference service or environment variables.

A zip/archive of the source excludes generated assets and dependencies. Run `npm ci` after extracting it. Five optional real-model replay tests require local Y4M fixtures, which are not distributed with the source. Physical participant/projector accuracy remains a practical-trial requirement, unchanged by this hosting migration.

Official deployment references: [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), and [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting).
