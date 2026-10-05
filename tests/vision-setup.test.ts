import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

async function fixture(t: TestContext, fetchImplementation: string) {
  const temporaryRoot = path.resolve(tmpdir());
  const root = await mkdtemp(path.join(temporaryRoot, "oob-vision-test-"));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), temporaryRoot);
    assert.ok(path.basename(root).startsWith("oob-vision-test-"));
    await rm(root, { recursive: true, force: true });
  });
  const wasm = path.join(root, "node_modules/@mediapipe/tasks-vision/wasm");
  await mkdir(wasm, { recursive: true });
  await writeFile(path.join(wasm, "vision_wasm_internal.wasm"), Buffer.from([0, 97, 115, 109]));
  await copyFile(fileURLToPath(new URL("../scripts/setup-vision.mjs", import.meta.url)), path.join(root, "setup-vision.mjs"));
  await writeFile(path.join(root, "fetch-stub.mjs"), `globalThis.fetch = ${fetchImplementation};`);
  return {
    root,
    model: path.join(root, "public/vision/pose_landmarker_lite.task"),
    run(required: boolean) {
      return spawnSync(process.execPath, ["--import", pathToFileURL(path.join(root, "fetch-stub.mjs")).href, path.join(root, "setup-vision.mjs"), ...(required ? ["--required"] : [])], { cwd: root, encoding: "utf8", timeout: 10000 });
    },
  };
}

test("offline installation keeps manual development available, but a production asset check fails", async t => {
  const f = await fixture(t, 'async () => { throw new Error("Simulated offline build"); }');
  const installation = f.run(false);
  assert.equal(installation.status, 0, installation.stderr);
  assert.match(installation.stderr, /Manual demo still works/);
  assert.deepEqual(await readFile(path.join(f.root, "public/vision/vision_wasm_internal.wasm")), Buffer.from([0, 97, 115, 109]));
  const production = f.run(true);
  assert.notEqual(production.status, 0);
  assert.match(production.stderr, /Production build requires the pose model/);
});

test("a truncated cached model is replaced before a production build", async t => {
  const f = await fixture(t, 'async () => new Response(new Uint8Array(1_000_001).fill(7))');
  await mkdir(path.dirname(f.model), { recursive: true });
  await writeFile(f.model, "truncated");
  const production = f.run(true);
  assert.equal(production.status, 0, production.stderr);
  const bytes = await readFile(f.model);
  assert.equal(bytes.length, 1_000_001);
  assert.equal(bytes[bytes.length - 1], 7);
});

test("an installed model is reused when the build is offline", async t => {
  const f = await fixture(t, 'async () => { throw new Error("Model should be reused"); }');
  await mkdir(path.dirname(f.model), { recursive: true });
  const original = Buffer.alloc(1_000_001, 3);
  await writeFile(f.model, original);
  const production = f.run(true);
  assert.equal(production.status, 0, production.stderr);
  assert.match(production.stdout, /already installed/);
  assert.deepEqual(await readFile(f.model), original);
});
