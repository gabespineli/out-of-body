import { test, expect, chromium, type Page, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import path from "node:path";
import sharp from "sharp";
import jsQR from "jsqr";
import { silhouetteSvg } from "../../src/lib/rig";
const settings = (() => { try { return { ...parseEnv(readFileSync(".env.local", "utf8")), ...process.env }; } catch { return process.env; } })();
const backendKey = settings.SUPABASE_SECRET_KEY || settings.SUPABASE_SERVICE_ROLE_KEY;
const configured = settings.SUPABASE_URL === "http://127.0.0.1:55321" && !!backendKey && !!settings.OOB_INSTALLATION_KEY;
test.skip(!configured, "Start the dedicated Out of Body local backend and run npm run backend:env. Hosted databases are never modified by this suite.");
// Session API headers contain local operator credentials; never retain network traces.
test.use({ trace: "off" });
const db = () => createClient(settings.SUPABASE_URL!, backendKey!, { auth: { persistSession: false } });
let drawing: Buffer, cameraFixture: string;
const created = new Set<string>();
test.beforeAll(async () => {
  const source = silhouetteSvg(false).replace("</svg>", '<rect x="280" y="110" width="40" height="30" fill="#e5b543"/><rect x="256" y="324" width="87" height="130" fill="#279aa3"/><rect x="219" y="248" width="40" height="55" fill="#db715d"/><rect x="240" y="590" width="30" height="130" fill="#7399b4"/><rect x="292" y="427" width="16" height="16" fill="#222222"/><rect x="284" y="498" width="32" height="22" fill="#d35fa4"/></svg>');
  drawing = await sharp(Buffer.from(source)).png().toBuffer();
  const rgb = await sharp(drawing).removeAlpha().raw().toBuffer(), frame = Buffer.alloc(600 * 900 * 3 / 2);
  for (let y = 0; y < 900; y++) for (let x = 0; x < 600; x++) {
    const i = (y * 600 + x) * 3, r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
    frame[y * 600 + x] = Math.round(16 + .257 * r + .504 * g + .098 * b);
    if (x % 2 === 0 && y % 2 === 0) {
      const p = (y / 2) * 300 + x / 2;
      frame[540000 + p] = Math.round(128 - .148 * r - .291 * g + .439 * b);
      frame[675000 + p] = Math.round(128 + .439 * r - .368 * g - .071 * b);
    }
  }
  await mkdir("test-results", { recursive: true }); cameraFixture = path.resolve("test-results/mobile-camera.y4m");
  await writeFile(cameraFixture, Buffer.concat([Buffer.from("YUV4MPEG2 W600 H900 F5:1 Ip A1:1 C420jpeg\n"), ...Array.from({ length: 4 }, () => Buffer.concat([Buffer.from("FRAME\n"), frame]))]));
});
test.afterAll(async () => {
  if (!configured) return;
  for (const id of created) {
    const { data } = await db().from("oob_sessions").select("object_path").eq("id", id).maybeSingle();
    if (data?.object_path) await db().storage.from("oob-temporary-artwork").remove([data.object_path]);
    await db().from("oob_sessions").delete().eq("id", id);
  }
});
async function create(request: APIRequestContext) {
  const response = await request.post("/api/participant/session", { headers: { Authorization: `Bearer ${settings.OOB_INSTALLATION_KEY}` } });
  expect(response.status()).toBe(200); const value = await response.json(); created.add(value.id); return value;
}
async function connect(request: APIRequestContext, session: { id: string; pairToken: string }) {
  const response = await request.post("/api/participant/pair", { data: { id: session.id, token: session.pairToken } });
  expect(response.status()).toBe(200);
}
async function upload(request: APIRequestContext) {
  return request.post("/api/participant/upload", { headers: { "Content-Type": "image/png" }, data: drawing });
}
async function phoneUpload(page: Page, url: string) {
  await page.goto(url); await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
  await page.getByTestId("mobile-photo").setInputFiles({ name: "private-participant.png", mimeType: "image/png", buffer: drawing });
  await expect(page.getByRole("heading", { name: "Preview your drawing" })).toBeVisible();
  await page.getByRole("button", { name: "Send to installation", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Drawing uploaded" })).toBeVisible();
}
async function pixel(page: Page, x: number, y: number) {
  return page.getByTestId("avatar").evaluate((el, p) => Array.from((el as HTMLCanvasElement).getContext("2d")!.getImageData(p.x + 120, p.y, 1, 1).data), { x, y });
}
async function gentleMovement(page: Page, turn: number) {
  const step = await page.getByTestId("avatar").getAttribute("data-step");
  if (step === "tilt") await page.getByRole("slider", { name: "Manual head tilt", exact: true }).fill(turn % 2 ? "0.3" : "-0.3");
  else if (step === "reach") await page.getByRole("slider", { name: "Manual left arm height", exact: true }).fill(turn % 2 ? "0.8" : "0.5");
  else if (step === "side-stretch") {
    await page.getByRole("slider", { name: "Manual left arm height", exact: true }).fill("0.65");
    await page.getByRole("slider", { name: "Manual side lean", exact: true }).fill(turn % 2 ? "0.3" : "-0.3");
  } else if (step === "heel-raise") await page.getByRole("slider", { name: "Manual heel raise", exact: true }).fill(turn % 2 ? "0.6" : "0");
  else {
    await page.getByRole("slider", { name: "Manual left leg swing", exact: true }).fill(turn % 2 ? "0" : "0.25");
    await page.getByRole("slider", { name: "Manual right leg swing", exact: true }).fill(turn % 2 ? "-0.25" : "0");
  }
  await page.waitForTimeout(450);
}
test("phone pairing -> private upload -> automatic avatar -> full guide -> deletion -> next participant", async ({ page, browser }) => {
  test.setTimeout(75000);
  await create(page.request);
  await page.goto("/installation");
  await page.getByRole("button", { name: "Create session", exact: true }).click();
  await expect(page.getByTestId("session-qr")).toBeVisible();
  const renderedQr = await page.getByTestId("session-qr").getAttribute("src");
  const qrPixels = await sharp(Buffer.from(renderedQr!.split(",")[1], "base64")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(qrPixels.data), qrPixels.info.width, qrPixels.info.height);
  const url = decoded?.data;
  expect(url).toBe(await page.getByTestId("pairing-link").getAttribute("href"));
  const id = new URL(url!).hash.split("=")[1].split(".")[0]; created.add(id);
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } }), phone = await mobile.newPage();
  try {
    await phoneUpload(phone, url!);
    expect(new URL(phone.url()).hash).toBe("");
    await expect.poll(() => pixel(page, 300, 385)).toEqual([39, 154, 163, 255]);
    await expect.poll(async () => (await db().from("oob_sessions").select("status").eq("id", id).single()).data?.status).toBe("received");
    const row = (await db().from("oob_sessions").select("object_path").eq("id", id).single()).data!;
    const stored = await db().storage.from("oob-temporary-artwork").download(row.object_path);
    expect(stored.error).toBeNull(); expect((await sharp(Buffer.from(await stored.data!.arrayBuffer())).metadata()).width).toBe(600);
    await phone.screenshot({ path: "test-results/participant-phone-sent.png", fullPage: true });
    await page.screenshot({ path: "test-results/participant-desktop-received.png", fullPage: true });
    await page.getByRole("combobox", { name: "Motion source", exact: true }).selectOption("manual");
    await page.getByRole("button", { name: "Start guided session", exact: true }).click();
    let turn = 0, previousArea = "";
    while (await page.getByTestId("avatar").count() && turn < 90) {
      const area = await page.getByTestId("avatar").getAttribute("data-area");
      if (area !== previousArea) { await page.getByRole("button", { name: "Return to rest", exact: true }).click(); previousArea = area!; }
      await gentleMovement(page, turn++);
    }
    await expect(page.getByTestId("participant-completion")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Stretching complete!" })).toBeVisible();
    await expect.poll(async () => (await db().storage.from("oob-temporary-artwork").download(row.object_path)).error !== null).toBe(true);
    const snapshot = await page.getByRole("link", { name: "Save your drawing" }).getAttribute("href");
    const raw = await sharp(Buffer.from(snapshot!.split(",")[1], "base64")).ensureAlpha().raw().toBuffer();
    expect(Array.from(raw.subarray(((435 * 840) + 420) * 4, ((435 * 840) + 420) * 4 + 4))).toEqual([34, 34, 34, 255]);
    await page.screenshot({ path: "test-results/participant-completed.png", fullPage: true });
    await page.getByRole("button", { name: "Next participant", exact: true }).click();
    await expect(page.getByTestId("session-qr")).toBeVisible();
    const nextUrl = await page.getByTestId("pairing-link").getAttribute("href");
    const nextId = new URL(nextUrl!).hash.split("=")[1].split(".")[0]; created.add(nextId); expect(nextId).not.toBe(id);
    expect((await phone.request.post("/api/participant/upload", { headers: { "Content-Type": "image/png" }, data: drawing })).status()).toBe(410);
    await expect(page.getByTestId("avatar")).toHaveCount(0);
  } finally { await mobile.close(); }
});
test("pairing is single-use and each desktop can retrieve only its own artwork", async ({ request, browser }) => {
  const first = await create(request), secondContext = await browser.newContext(), phoneContext = await browser.newContext(), thief = await browser.newContext();
  try {
    await connect(phoneContext.request, first);
    const replay = await thief.request.post("/api/participant/pair", { data: { id: first.id, token: first.pairToken } }); expect(replay.status()).toBe(410);
    expect((await upload(phoneContext.request)).status()).toBe(200);
    const second = await create(secondContext.request);
    expect(second.id).not.toBe(first.id);
    expect((await secondContext.request.get("/api/participant/artwork")).status()).toBe(409);
    expect((await request.get("/api/participant/artwork")).status()).toBe(200);
    expect((await thief.request.get("/api/participant/artwork")).status()).toBe(401);
    const anonymous = createClient(settings.SUPABASE_URL!, settings.OOB_LOCAL_ANON_KEY!, { auth: { persistSession: false } });
    expect((await anonymous.from("oob_sessions").select("*")).error).not.toBeNull();
    const row = (await db().from("oob_sessions").select("object_path").eq("id", first.id).single()).data!;
    expect((await anonymous.storage.from("oob-temporary-artwork").download(row.object_path)).error).not.toBeNull();
    const bucket = await db().storage.getBucket("oob-temporary-artwork"); expect(bucket.data?.public).toBe(false);
    const publicUrl = anonymous.storage.from("oob-temporary-artwork").getPublicUrl(row.object_path).data.publicUrl;
    expect((await thief.request.get(publicUrl)).ok()).toBe(false);
  } finally { await secondContext.close(); await phoneContext.close(); await thief.close(); }
});
test("duplicate uploads cannot overwrite the first drawing; rejected inputs leave the session usable", async ({ request, browser }) => {
  const session = await create(request), mobile = await browser.newContext();
  try {
    await connect(mobile.request, session);
    const wrong = await mobile.request.post("/api/participant/upload", { headers: { "Content-Type": "image/svg+xml" }, data: "<svg/>" }); expect(wrong.status()).toBe(415);
    const invalid = await mobile.request.post("/api/participant/upload", { headers: { "Content-Type": "image/png" }, data: Buffer.from("not an image") }); expect(invalid.status()).toBe(400);
    expect((await upload(mobile.request)).status()).toBe(200);
    expect((await upload(mobile.request)).status()).toBe(409);
    const before = await request.get("/api/participant/artwork"); expect(before.status()).toBe(200);
    const metadata = await sharp(await before.body()).metadata(); expect([metadata.width, metadata.height]).toEqual([600, 900]);
  } finally { await mobile.close(); }
});
test("expired pairing and session capabilities are rejected; cleanup removes the actual stored object", async ({ request, browser }) => {
  const session = await create(request), mobile = await browser.newContext();
  try {
    await connect(mobile.request, session); expect((await upload(mobile.request)).status()).toBe(200);
    const row = (await db().from("oob_sessions").select("object_path").eq("id", session.id).single()).data!;
    await db().from("oob_sessions").update({ expires_at: new Date(Date.now() - 180_000).toISOString() }).eq("id", session.id);
    expect((await request.get("/api/participant/artwork")).status()).toBe(410);
    expect((await mobile.request.get("/api/participant/mobile")).status()).toBe(410);
    expect((await request.post("/api/participant/cleanup")).status()).toBe(401);
    const clean = await request.post("/api/participant/cleanup", { headers: { Authorization: `Bearer ${settings.OOB_CLEANUP_SECRET}` } }); expect(clean.status()).toBe(200);
    expect((await db().storage.from("oob-temporary-artwork").download(row.object_path)).error).not.toBeNull();
    expect((await db().from("oob_sessions").select("id").eq("id", session.id).maybeSingle()).data).toBeNull();
    const unpaired = await create(request);
    await db().from("oob_sessions").update({ pair_expires_at: new Date(Date.now() - 1).toISOString() }).eq("id", unpaired.id);
    const pair = await mobile.request.post("/api/participant/pair", { data: { id: unpaired.id, token: unpaired.pairToken } }); expect(pair.status()).toBe(410);
  } finally { await mobile.close(); }
});
test("mobile camera captures a real synthetic video frame and closes the stream before preview", async ({ request }) => {
  const session = await create(request);
  const cameraBrowser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${cameraFixture}`] });
  const context = await cameraBrowser.newContext({ permissions: ["camera"], viewport: { width: 390, height: 844 } }), page = await context.newPage();
  try {
    await page.goto(session.pairingUrl);
    await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
    await page.getByRole("button", { name: "Open camera", exact: true }).click();
    await expect(page.getByRole("button", { name: "Take photo", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Take photo", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Preview your drawing" })).toBeVisible();
    const captured = await page.getByTestId("mobile-preview").evaluate(el => Array.from((el as HTMLCanvasElement).getContext("2d")!.getImageData(300, 385, 1, 1).data));
    expect(captured[1]).toBeGreaterThan(130); expect(captured[0]).toBeLessThan(70);
    await page.screenshot({ path: "test-results/participant-mobile-preview.png", fullPage: true });
    await page.getByRole("button", { name: "Send to installation", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Drawing uploaded" })).toBeVisible();
    const image = await request.get("/api/participant/artwork"); expect(image.status()).toBe(200);
    const raw = await sharp(await image.body()).ensureAlpha().raw().toBuffer();
    expect(Array.from(raw.subarray((385 * 600 + 300) * 4, (385 * 600 + 300) * 4 + 4))).toEqual(captured);
  } finally { await context.close(); await cameraBrowser.close(); }
});
test("camera denial preserves photo selection and invalid images do not advance preview", async ({ request, browser }) => {
  const session = await create(request), context = await browser.newContext({ viewport: { width: 320, height: 700 } }), page = await context.newPage();
  try {
    await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Denied", "NotAllowedError"); }; });
    await page.goto(session.pairingUrl);
    await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
    await page.getByRole("button", { name: "Open camera", exact: true }).click();
    await expect(page.locator("p[role=alert]")).toContainText("Camera permission was denied");
    await page.getByTestId("mobile-photo").setInputFiles({ name: "bad.png", mimeType: "image/png", buffer: Buffer.from("bad") });
    await expect(page.getByRole("heading", { name: "Photograph your drawing" })).toBeVisible();
    await page.getByTestId("mobile-photo").setInputFiles({ name: "drawing.png", mimeType: "image/png", buffer: drawing });
    await expect(page.getByRole("heading", { name: "Preview your drawing" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Retake / choose again", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Photograph your drawing" })).toBeVisible();
  } finally { await context.close(); }
});
test("unpaired phones and unauthenticated/cross-origin operators cannot create or upload", async ({ request, browser }) => {
  const unauth = await browser.newContext(), page = await unauth.newPage();
  try {
    expect((await unauth.request.post("/api/participant/session")).status()).toBe(401);
    expect((await unauth.request.post("/api/participant/upload", { headers: { "Content-Type": "image/png" }, data: drawing })).status()).toBe(401);
    expect((await request.post("/api/participant/session", { headers: { Origin: "https://unrelated.example", Authorization: `Bearer ${settings.OOB_INSTALLATION_KEY}` } })).status()).toBe(403);
    await page.goto("http://127.0.0.1:3202/mobile");
    await expect(page.getByRole("button", { name: "Upload drawing", exact: true })).toBeDisabled();
  } finally { await unauth.close(); }
});

test("simultaneous uploads reserve only one object and a reset revokes the old phone", async ({ request, browser }) => {
  const session = await create(request), mobile = await browser.newContext();
  try {
    await connect(mobile.request, session);
    const responses = await Promise.all([upload(mobile.request), upload(mobile.request)]);
    expect(responses.map(response => response.status()).sort()).toEqual([200, 409]);
    const old = (await db().from("oob_sessions").select("object_path").eq("id", session.id).single()).data!;
    const next = await create(request); expect(next.id).not.toBe(session.id);
    expect((await upload(mobile.request)).status()).toBe(410);
    expect((await db().storage.from("oob-temporary-artwork").download(old.object_path)).error).not.toBeNull();
  } finally { await mobile.close(); }
});

test("a failed phone connection retains the preview and can retry the upload", async ({ request, browser }) => {
  const session = await create(request), mobile = await browser.newContext(), page = await mobile.newPage();
  try {
    await page.goto(session.pairingUrl); await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
    await page.getByTestId("mobile-photo").setInputFiles({ name: "drawing.png", mimeType: "image/png", buffer: drawing });
    await expect(page.getByTestId("mobile-preview")).toBeVisible();
    await page.route("**/api/participant/upload", route => route.abort("failed"));
    await page.getByRole("button", { name: "Send to installation", exact: true }).click();
    await expect(page.locator("p[role=alert]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send to installation", exact: true })).toBeEnabled();
    await page.unroute("**/api/participant/upload");
    await page.getByRole("button", { name: "Send to installation", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Drawing uploaded" })).toBeVisible();
  } finally { await mobile.close(); }
});

test("canceling mobile camera permission releases a stream that arrives late", async ({ request, browser }) => {
  const session = await create(request), mobile = await browser.newContext(), page = await mobile.newPage();
  try {
    await page.addInitScript(() => {
      const state = window as unknown as { finishCamera: () => void; lateTrack: MediaStreamTrack };
      navigator.mediaDevices.getUserMedia = () => new Promise(resolve => {
        state.finishCamera = () => {
          const canvas = document.createElement("canvas"); canvas.width = 600; canvas.height = 900;
          const stream = canvas.captureStream(5); state.lateTrack = stream.getVideoTracks()[0]; resolve(stream);
        };
      });
    });
    await page.goto(session.pairingUrl); await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
    await page.getByRole("button", { name: "Open camera", exact: true }).click();
    await page.getByRole("button", { name: "Cancel camera", exact: true }).click();
    await page.evaluate(() => (window as unknown as { finishCamera: () => void }).finishCamera());
    await expect.poll(() => page.evaluate(() => (window as unknown as { lateTrack: MediaStreamTrack }).lateTrack.readyState)).toBe("ended");
    await expect(page.getByRole("button", { name: "Open camera", exact: true })).toBeEnabled();
  } finally { await mobile.close(); }
});

test("the scheduled cleanup job deletes expired private artwork without a manual cleanup request", async ({ request, browser }) => {
  test.setTimeout(90000);
  const session = await create(request), mobile = await browser.newContext();
  try {
    await connect(mobile.request, session); expect((await upload(mobile.request)).status()).toBe(200);
    const row = (await db().from("oob_sessions").select("object_path").eq("id", session.id).single()).data!;
    await db().from("oob_sessions").update({ expires_at: new Date(Date.now() - 180_000).toISOString() }).eq("id", session.id);
    await expect.poll(async () => (await db().from("oob_sessions").select("id").eq("id", session.id).maybeSingle()).data, { timeout: 75000, intervals: [1000] }).toBeNull();
    expect((await db().storage.from("oob-temporary-artwork").download(row.object_path)).error).not.toBeNull();
  } finally { await mobile.close(); }
});
