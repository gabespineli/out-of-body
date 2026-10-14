import { test, expect, webkit, type Page, type CDPSession } from "@playwright/test";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { silhouetteSvg } from "../../src/lib/rig";
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
let drawing: Buffer;
const waiting = { id: "2b2c4167-d1ea-4f9f-a720-698e90ca1d53", number: 7, name: "", ahead: 0, status: "preparing", createdAt: "2026-10-14T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z" };
test.beforeAll(async () => {
  drawing = await sharp(Buffer.from(silhouetteSvg(false).replace("</svg>", '<rect x="256" y="324" width="87" height="130" fill="#279aa3"/><rect x="280" y="110" width="40" height="30" fill="#e5b543"/></svg>'))).png().toBuffer();
});
async function prepare(page: Page) {
  // UI-only fixture: no Supabase instance or participant credentials are used.
  await page.route("**/api/participant/queue", route => route.fulfill({ json: { waiting: 0, capacity: 20, accepting: true, online: true } }));
  await page.route("**/api/participant/queue/ticket", route => route.fulfill({ json: waiting })); await page.goto("/mobile");
  await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
  await page.getByTestId("mobile-photo").setInputFiles({ name: "drawing.png", mimeType: "image/png", buffer: drawing });
  await expect(page.getByTestId("photo-alignment")).toBeVisible();
  await expect.poll(() => pixel(page, 300, 385)).toEqual([39, 154, 163, 255]);
}
async function pixel(page: Page, x: number, y: number) {
  return page.getByTestId("mobile-preview").evaluate((el, point) => Array.from((el as HTMLCanvasElement).getContext("2d")!.getImageData(point.x, point.y, 1, 1).data), { x, y });
}
async function alignment(page: Page) {
  return page.getByTestId("photo-alignment").evaluate(el => Object.fromEntries(["scale", "x", "y", "rotation"].map(key => [key, +(el.getAttribute("data-" + key) ?? "0")]))) as Promise<{ scale: number; x: number; y: number; rotation: number }>;
}
type Finger = { id: number; x: number; y: number };
async function touch(page: Page, cdp: CDPSession, type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel", fingers: Finger[]) {
  const bounds = (await page.getByTestId("photo-alignment").boundingBox())!;
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: fingers.map(finger => ({ id: finger.id,
    x: bounds.x + finger.x * bounds.width / 600, y: bounds.y + finger.y * bounds.height / 900, radiusX: 2, radiusY: 2, force: 1 })) });
  await page.waitForTimeout(25);
}
async function drag(page: Page, cdp: CDPSession, from = { x: 280, y: 350 }, to = { x: 310, y: 370 }) {
  await touch(page, cdp, "touchStart", [{ id: 1, ...from }]);
  await touch(page, cdp, "touchMove", [{ id: 1, ...to }]);
  await touch(page, cdp, "touchEnd", []);
}
async function pinch(page: Page, cdp: CDPSession) {
  await touch(page, cdp, "touchStart", [{ id: 1, x: 290, y: 405 }, { id: 2, x: 370, y: 405 }]);
  await touch(page, cdp, "touchMove", [{ id: 1, x: 250, y: 405 }, { id: 2, x: 410, y: 405 }]);
  await touch(page, cdp, "touchEnd", []);
}
test("real one-finger drag and two-finger pinch move the photo around a fixed guide", async ({ page }) => {
  await prepare(page);
  const cdp = await page.context().newCDPSession(page);
  const guide = await page.locator(".phone-photo .photo-template").innerHTML();
  await drag(page, cdp);
  const moved = await alignment(page); expect(moved.x).toBeCloseTo(30, 0); expect(moved.y).toBeCloseTo(20, 0);
  await expect.poll(() => pixel(page, 330, 405)).toEqual([39, 154, 163, 255]);
  await pinch(page, cdp);
  const zoomed = await alignment(page); expect(zoomed.scale).toBeCloseTo(2, 1); expect(zoomed.x).toBeCloseTo(30, 0); expect(zoomed.y).toBeCloseTo(85, 0);
  await expect.poll(() => pixel(page, 330, 405)).toEqual([39, 154, 163, 255]);
  expect(await page.locator(".phone-photo .photo-template").innerHTML()).toBe(guide);
  expect(await page.evaluate(() => window.visualViewport!.scale)).toBe(1);
  await page.screenshot({ path: "test-results/mobile-touch-alignment.png", fullPage: true });
});
test("lifting one finger continues as a drag; cancellation and resize clear active touches", async ({ page }) => {
  await prepare(page); const cdp = await page.context().newCDPSession(page);
  await page.getByTestId("photo-alignment").evaluate(el => {
    const state = window as unknown as { contactIds: number[] }; state.contactIds = [];
    el.addEventListener("pointerdown", event => state.contactIds.push((event as PointerEvent).pointerId));
  });
  await touch(page, cdp, "touchStart", [{ id: 1, x: 200, y: 450 }, { id: 2, x: 400, y: 450 }]);
  await touch(page, cdp, "touchMove", [{ id: 1, x: 180, y: 450 }, { id: 2, x: 420, y: 450 }]);
  const before = await alignment(page);
  // CDP touchEnd releases all contacts. Supply the single-contact up event here,
  // then continue moving the remaining native contact and verify the app's rebase.
  const contact = await page.evaluate(() => (window as unknown as { contactIds: number[] }).contactIds[0]);
  const bounds = (await page.getByTestId("photo-alignment").boundingBox())!;
  await page.getByTestId("photo-alignment").dispatchEvent("pointerup", { pointerId: contact, pointerType: "touch",
    clientX: bounds.x + 180 * bounds.width / 600, clientY: bounds.y + 450 * bounds.height / 900 });
  const lifted = await alignment(page); expect(lifted.scale).toBeCloseTo(before.scale, 5); expect(lifted.x).toBeCloseTo(before.x, 5);
  await touch(page, cdp, "touchMove", [{ id: 2, x: 440, y: 420 }]);
  const dragged = await alignment(page); expect(dragged.x - before.x).toBeCloseTo(20, 0); expect(dragged.y - before.y).toBeCloseTo(-30, 0);
  await touch(page, cdp, "touchCancel", []);
  const canceled = await alignment(page);
  await drag(page, cdp, { x: 250, y: 350 }, { x: 260, y: 350 });
  expect((await alignment(page)).x - canceled.x).toBeCloseTo(10, 0);
  await touch(page, cdp, "touchStart", [{ id: 1, x: 250, y: 350 }]);
  await page.setViewportSize({ width: 430, height: 844 });
  const resized = await alignment(page);
  await touch(page, cdp, "touchMove", [{ id: 1, x: 350, y: 350 }]);
  expect(await alignment(page)).toEqual(resized); await touch(page, cdp, "touchEnd", []);
});
test("zoom/reset/keyboard and rotation sliders remain usable across narrow and wide screens", async ({ page }) => {
  await prepare(page); const frame = page.getByTestId("photo-alignment");
  await frame.focus(); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("+");
  expect(await alignment(page)).toEqual({ scale: 1.2, x: 12, y: 12, rotation: 0 });
  await page.getByRole("button", { name: "Reset alignment", exact: true }).click();
  expect(await alignment(page)).toEqual({ scale: 1, x: 0, y: 0, rotation: 0 });
  await page.getByText("Fine adjustment", { exact: true }).click();
  await page.getByRole("slider", { name: "Mobile photo rotation" }).fill("12");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  expect((await alignment(page)).rotation).toBe(12);
  for (let i = 0; i < 8; i++) { const button = page.getByRole("button", { name: "Zoom in", exact: true }); if (await button.isEnabled()) await button.click(); }
  expect((await alignment(page)).scale).toBe(3); await expect(page.getByRole("button", { name: "Zoom in", exact: true })).toBeDisabled();
  for (let i = 0; i < 12; i++) { const button = page.getByRole("button", { name: "Zoom out", exact: true }); if (await button.isEnabled()) await button.click(); }
  expect((await alignment(page)).scale).toBe(.5);
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "Send to installation", exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Reset alignment", exact: true }).click();
  expect((await alignment(page)).rotation).toBe(0);
});
test("the uploaded PNG matches the adjusted preview and is used by the existing avatar", async ({ page }) => {
  await prepare(page); const cdp = await page.context().newCDPSession(page); await drag(page, cdp); await pinch(page, cdp);
  await expect.poll(() => pixel(page, 330, 405)).toEqual([39, 154, 163, 255]);
  const preview = await page.getByTestId("mobile-preview").evaluate(el => (el as HTMLCanvasElement).toDataURL());
  let uploaded: Buffer | null = null;
  let release!: () => void; const waitingUpload = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/participant/queue/upload", async route => {
    uploaded = route.request().postDataBuffer(); await waitingUpload;
    await route.fulfill({ json: { ...waiting, status: "ready" } });
  });
  await page.getByRole("button", { name: "Send to installation", exact: true }).click();
  await expect(page.getByTestId("photo-alignment")).toHaveAttribute("aria-disabled", "true");
  const locked = await alignment(page); await drag(page, cdp); expect(await alignment(page)).toEqual(locked);
  await expect(page.getByRole("button", { name: "Reset alignment", exact: true })).toBeDisabled();
  await expect.poll(() => uploaded !== null).toBe(true);
  const hash = async (bytes: Buffer) => createHash("sha256").update(await sharp(bytes).ensureAlpha().raw().toBuffer()).digest("hex");
  expect(await hash(uploaded!)).toBe(await hash(Buffer.from(preview.split(",")[1], "base64")));
  expect([(await sharp(uploaded!).metadata()).width, (await sharp(uploaded!).metadata()).height]).toEqual([600, 900]);
  release(); await expect(page.getByRole("heading", { name: "Drawing uploaded" })).toBeVisible();
  const avatar = await page.context().newPage();
  try {
    await avatar.goto("http://127.0.0.1:3202/");
    await avatar.getByTestId("art-upload").setInputFiles({ name: "aligned-drawing.png", mimeType: "image/png", buffer: uploaded! });
    await expect.poll(() => avatar.getByTestId("avatar").evaluate(el => Array.from((el as HTMLCanvasElement).getContext("2d")!.getImageData(450, 405, 1, 1).data))).toEqual([39, 154, 163, 255]);
  } finally { await avatar.close(); }
});
test("photo gestures do not scroll the page, but swiping outside the preview still does", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 }); await prepare(page);
  const cdp = await page.context().newCDPSession(page);
  const scroll = await page.evaluate(() => scrollY); await drag(page, cdp, { x: 280, y: 500 }, { x: 280, y: 300 });
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: 317, y: 450 }] });
  for (const y of [425, 400, 350, 300, 250]) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x: 317, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll + 20);
});
test("WebKit uses the same alignment controls and native pointer drag", async () => {
  test.skip(!existsSync(webkit.executablePath()), "Install WebKit with npx playwright install webkit.");
  const browser = await webkit.launch(); const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.route("**/api/participant/queue", route => route.fulfill({ json: { waiting: 0, capacity: 20, accepting: true, online: true } }));
    await page.route("**/api/participant/queue/ticket", route => route.fulfill({ json: waiting })); await page.goto("http://127.0.0.1:3202/mobile");
    await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
    await page.getByTestId("mobile-photo").setInputFiles({ name: "drawing.png", mimeType: "image/png", buffer: drawing });
    await expect(page.getByTestId("photo-alignment")).toBeVisible();
    const bounds = (await page.getByTestId("photo-alignment").boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + 18, bounds.y + bounds.height / 2 + 12, { steps: 4 }); await page.mouse.up();
    expect((await alignment(page)).x).toBeGreaterThan(20); expect((await alignment(page)).y).toBeGreaterThan(10);
    await page.getByRole("button", { name: "Zoom in", exact: true }).click(); expect((await alignment(page)).scale).toBe(1.2);
    await page.getByRole("button", { name: "Reset alignment", exact: true }).click();
    expect(await alignment(page)).toEqual({ scale: 1, x: 0, y: 0, rotation: 0 });
  } finally { await context.close(); await browser.close(); }
});
