import { mkdir, readdir, copyFile, stat, writeFile, rename } from "node:fs/promises";
import path from "node:path";

// Serve the package-matched WASM and a pinned model locally; no runtime CDN dependency.
const required = process.argv.includes("--required");
const root = process.cwd();
const destination = path.join(root, "public/vision");
await mkdir(destination, { recursive: true });
const wasmDirectory = path.join(root, "node_modules/@mediapipe/tasks-vision/wasm");
for (const file of await readdir(wasmDirectory)) {
  await copyFile(path.join(wasmDirectory, file), path.join(destination, file));
}
const model = path.join(destination, "pose_landmarker_lite.task");
try {
  if ((await stat(model)).size < 1_000_000) throw new Error("Installed model is incomplete");
  console.log("Pose model already installed. Local camera tracking is ready.");
} catch {
  try {
    console.log("Downloading the pinned MediaPipe Pose Landmarker Lite v1 model...");
    const url = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1_000_000) throw new Error("Downloaded model is unexpectedly small");
    await writeFile(`${model}.partial`, bytes);
    await rename(`${model}.partial`, model);
    console.log(`Installed pose model (${(bytes.length / 1024 / 1024).toFixed(1)} MB).`);
  } catch (error) {
    if (required) throw new Error(`Production build requires the pose model: ${error.message}. Run npm run setup:vision when online.`);
    // Installation remains usable offline; a production build must include the model.
    console.warn(`Camera model unavailable: ${error.message}. Run npm run setup:vision when online. Manual demo still works.`);
  }
}
