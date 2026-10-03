import { test, expect, chromium, type Page } from "@playwright/test";
import sharp from "sharp";
import { silhouetteSvg } from "../../src/lib/rig";
import path from "node:path";
import { readFile } from "node:fs/promises";

let drawing: Buffer;
test.beforeAll(async () => {
  const svg = silhouetteSvg(false).replace("</svg>", '<rect x="219" y="248" width="40" height="55" fill="#db715d"/><rect x="256" y="324" width="87" height="130" fill="#279aa3"/><rect x="280" y="110" width="40" height="30" fill="#e5b543"/><rect x="292" y="427" width="16" height="16" fill="#222222"/></svg>');
  drawing = await sharp(Buffer.from(svg)).png().toBuffer();
});

async function upload(page: Page) {
  await page.getByTestId("art-upload").setInputFiles({ name: "participant-drawing.png", mimeType: "image/png", buffer: drawing });
  await expect(page.getByTestId("art-source")).toBeVisible();
}
async function pixel(page: Page, selector: string, x: number, y: number) {
  return page.locator(selector).evaluate((el, point) => {
    const canvas = el as HTMLCanvasElement;
    return Array.from(canvas.getContext("2d")!.getImageData(point.x + (canvas.width - 600) / 2, point.y, 1, 1).data);
  }, { x, y });
}

test("actual uploaded colors reach the rig; a held gesture fades only selected color", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("/"); await upload(page);
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', 300, 385)).toEqual([39, 154, 163, 255]);
  const before = await pixel(page, '[data-testid="avatar"]', 235, 270);
  expect(before.slice(0, 3)).toEqual([219, 113, 93]);
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await page.screenshot({ path: "test-results/upload-rest.png", fullPage: true });
  await page.getByRole("button", { name: "Raise arms", exact: true }).click();
  await expect(page.getByText("Hold pose")).toBeVisible();
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", /0\.[1-9]/);
  await page.screenshot({ path: "test-results/raised-arms.png", fullPage: true });
  await expect(page.getByText("Selected color faded")).toBeVisible({ timeout: 6000 });
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-fade", "1.00", { timeout: 4000 });
  await page.getByRole("button", { name: "Return to rest", exact: true }).click();
  await expect.poll(async () => (await pixel(page, '[data-testid="avatar"]', 235, 270))[1]).toBeGreaterThan(235);
  expect(await pixel(page, '[data-testid="avatar"]', 300, 385)).toEqual([39, 154, 163, 255]);
  await page.screenshot({ path: "test-results/softened-region.png", fullPage: true });
  await page.getByRole("button", { name: "Restore original colors", exact: true }).click();
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', 235, 270)).toEqual(before);
  expect(errors).toEqual([]);
});

test("interruptions reset the hold; a side lean also moves and fades the torso", async ({ page }) => {
  await page.goto("/"); await upload(page);
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await page.getByRole("button", { name: "Raise arms", exact: true }).click();
  await expect.poll(async () => +(await page.getByTestId("avatar").getAttribute("data-hold"))!).toBeGreaterThan(.2);
  await page.getByRole("button", { name: "Return to rest", exact: true }).click();
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", "0.00");
  await page.getByRole("button", { name: "Torso", exact: true }).click();
  await page.getByRole("combobox", { name: "Gesture to hold", exact: true }).selectOption("lean");
  await page.getByRole("button", { name: "Lean left", exact: true }).click();
  await expect(page.getByText("Selected color faded")).toBeVisible({ timeout: 6000 });
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-fade", "1.00", { timeout: 4000 });
  await page.getByRole("button", { name: "Return to rest", exact: true }).click();
  await expect.poll(async () => (await pixel(page, '[data-testid="avatar"]', 300, 385))[0]).toBeGreaterThan(235);
});

test("permission denied is explained and manual fallback remains usable", async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Denied by fixture", "NotAllowedError"); }; });
  await page.goto("/"); await upload(page);
  await page.getByRole("button", { name: "Enable camera", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Camera permission was denied");
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await page.getByRole("button", { name: "Raise arms", exact: true }).click();
  await expect(page.getByText("Selected color faded")).toBeVisible({ timeout: 6000 });
});

test("no webcam and a busy camera have distinct recovery states", async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("No fixture camera", "NotFoundError"); }; });
  await page.goto("/"); await page.getByRole("button", { name: "Enable camera", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("No webcam was found");
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Busy fixture", "NotReadableError"); }; });
  await page.getByRole("button", { name: "Try camera again", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("camera is busy");
});

test("invalid uploads, region selection, alignment, restore and reset work", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("art-upload").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("invalid") });
  await expect(page.locator("p[role=alert]")).toContainText("Choose a JPG, PNG or WebP");
  await page.getByTestId("art-upload").setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from("invalid") });
  await expect(page.locator("p[role=alert]")).toContainText("could not be opened");
  await upload(page);
  await page.getByRole("button", { name: "Arm", exact: true }).click();
  await expect(page.getByText("No strong color in this area yet")).toBeVisible();
  await page.getByRole("button", { name: "Align photo", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Photo zoom", exact: true })).toBeVisible();
  await page.getByRole("slider", { name: "Photo horizontal", exact: true }).fill("10");
  await page.getByRole("button", { name: "Done aligning", exact: true }).click();
  await page.getByRole("button", { name: "Start fresh", exact: true }).click();
  await expect(page.getByTestId("art-upload")).toBeVisible();
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-fade", "0.00");
  const template = await page.request.get("/drawing-sheet.svg");
  expect(template.ok()).toBeTruthy(); expect(await template.text()).toContain('viewBox="0 0 600 900"');
});

test("layout fits 320, 768, 1024 and 1440 widths and supports keyboard controls", async ({ page }) => {
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.getByRole("button", { name: "Try an example", exact: true }).click();
    await page.getByRole("button", { name: "Manual demo", exact: true }).click();
    await expect(page.getByTestId("avatar")).toBeVisible();
    await page.screenshot({ path: `test-results/layout-${width}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "Raise arms", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Raise arms", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("real local MediaPipe initializes, processes a replay camera and releases tracks", async () => {
  const fixture = process.env.OOB_CAMERA_FIXTURE;
  test.skip(!fixture, "Set OOB_CAMERA_FIXTURE to a Y4M replay. This test does not use a participant’s physical webcam.");
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${path.resolve(fixture!)}`] });
  const context = await browser.newContext({ permissions: ["camera"], viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:3201"); await upload(page);
    await page.getByRole("button", { name: "Enable camera", exact: true }).click();
    await expect(page.getByRole("button", { name: "Stop camera", exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Body found ·/)).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "test-results/camera-replay.png", fullPage: true });
    // The real model output rotates arms for the reference person’s horizontal arm pose.
    await expect.poll(async () => (await pixel(page, '[data-testid="avatar"]', 180, 390))[3]).toBe(0);
    await page.evaluate(() => { (window as unknown as { testStream: MediaStream }).testStream = document.querySelector("video")!.srcObject as MediaStream; });
    await page.getByRole("button", { name: "Stop camera", exact: true }).click();
    expect(await page.evaluate(() => (window as unknown as { testStream: MediaStream }).testStream.getTracks().every(track => track.readyState === "ended"))).toBeTruthy();
    await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", "0.00");
  } finally { await context.close(); await browser.close(); }
});

test("a real MediaPipe-detected lean drives the continuous hold and region fade", async () => {
  const fixture = process.env.OOB_LEAN_CAMERA_FIXTURE;
  test.skip(!fixture, "Set OOB_LEAN_CAMERA_FIXTURE to a Y4M lean replay. No live participant webcam is used.");
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${path.resolve(fixture!)}`] });
  const context = await browser.newContext({ permissions: ["camera"], viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:3201"); await upload(page);
    await page.getByRole("combobox", { name: "Gesture to hold", exact: true }).selectOption("lean");
    await page.getByRole("button", { name: "Enable camera", exact: true }).click();
    await expect(page.getByText(/Body found ·/)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Selected color faded")).toBeVisible({ timeout: 12000 });
    await expect(page.getByTestId("avatar")).toHaveAttribute("data-fade", "1.00", { timeout: 4000 });
    await page.screenshot({ path: "test-results/camera-lean-fade.png", fullPage: true });
    await page.getByRole("button", { name: "Stop camera", exact: true }).click();
    await expect.poll(async () => (await pixel(page, '[data-testid="avatar"]', 235, 270))[1]).toBeGreaterThan(235);
    expect(await pixel(page, '[data-testid="avatar"]', 300, 385)).toEqual([39, 154, 163, 255]);
  } finally { await context.close(); await browser.close(); }
});

test("model-load failure stops the camera and keeps manual demo working", async () => {
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const context = await browser.newContext({ permissions: ["camera"] });
  const page = await context.newPage();
  try {
    await page.route("**/vision/pose_landmarker_lite.task", route => route.fulfill({ status: 404, body: "Missing fixture model" }));
    await page.goto("http://127.0.0.1:3201"); await upload(page);
    await page.getByRole("button", { name: "Enable camera", exact: true }).click();
    await expect(page.locator("p[role=alert]")).toContainText("pose model could not load", { timeout: 30000 });
    expect(await page.locator("video").evaluate(v => (v as HTMLVideoElement).srcObject)).toBeNull();
    await page.getByRole("button", { name: "Manual demo", exact: true }).click();
    await page.getByRole("button", { name: "Raise arms", exact: true }).click();
    await expect(page.getByText("Selected color faded")).toBeVisible({ timeout: 6000 });
  } finally { await context.close(); await browser.close(); }
});

test("six gesture choices use individual arms and lean direction with custom timing", async ({ page }) => {
  await page.goto("/"); await upload(page);
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await page.getByRole("slider", { name: "Hold duration", exact: true }).fill("1");
  await page.getByRole("slider", { name: "Fade duration", exact: true }).fill("0.2");
  const arm = (side: string, value: number) => page.getByRole("slider", { name: `Manual ${side} arm height`, exact: true }).fill(String(value));
  const lean = (value: number) => page.getByRole("slider", { name: "Manual side lean", exact: true }).fill(String(value));
  for (const gesture of ["raise", "left-arm", "right-arm", "lean", "lean-left", "lean-right"]) {
    await page.getByRole("button", { name: "Return to rest", exact: true }).click();
    await page.getByRole("combobox", { name: "Gesture to hold", exact: true }).selectOption(gesture);
    if (gesture === "raise") await arm("left", 1);
    if (gesture === "left-arm") await arm("right", 1);
    if (gesture === "right-arm") await arm("left", 1);
    if (gesture === "lean-left") await lean(1);
    if (gesture === "lean-right") await lean(-1);
    await page.waitForTimeout(1250);
    await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", "0.00");
    await expect(page.getByTestId("avatar")).toHaveAttribute("data-fade", "0.00");
    if (gesture === "raise") await arm("right", 1);
    if (gesture === "left-arm") { await arm("right", 0); await arm("left", 1); }
    if (gesture === "right-arm") { await arm("left", 0); await arm("right", 1); }
    if (gesture === "lean" || gesture === "lean-left") await lean(-1);
    if (gesture === "lean-right") await lean(1);
    await expect(page.getByText("Selected color faded")).toBeVisible({ timeout: 3500 });
    await expect(page.getByTestId("hold-number")).toHaveText("1.0 / 1s");
  }
});

test("several selected areas fade together while unselected color and dark marks survive", async ({ page }) => {
  await page.goto("/"); await upload(page);
  await page.getByRole("button", { name: "Add area", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Selected fade area" })).toHaveValue("1");
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await page.getByRole("slider", { name: "Hold duration", exact: true }).fill("1");
  await page.getByRole("slider", { name: "Fade duration", exact: true }).fill("0.2");
  await page.getByRole("button", { name: "Raise arms", exact: true }).click();
  await expect(page.getByText("Selected color faded")).toBeVisible({ timeout: 3500 });
  await page.getByRole("button", { name: "Return to rest", exact: true }).click();
  await expect.poll(async () => (await pixel(page, '[data-testid="avatar"]', 235, 270))[1]).toBeGreaterThan(235);
  expect((await pixel(page, '[data-testid="avatar"]', 300, 385))[0]).toBeGreaterThan(235);
  expect(await pixel(page, '[data-testid="avatar"]', 300, 120)).toEqual([229, 181, 67, 255]);
  expect(await pixel(page, '[data-testid="avatar"]', 300, 435)).toEqual([34, 34, 34, 255]);
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Add area", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add area", exact: true })).toBeDisabled();
  await page.getByRole("combobox", { name: "Selected fade area" }).selectOption("0");
  await page.getByRole("button", { name: "Remove area", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add area", exact: true })).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Selected fade area" }).locator("option")).toHaveCount(4);
  await page.getByRole("button", { name: "Start fresh", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Hold duration", exact: true })).toHaveValue("3");
});

test("pause freezes the displayed pose and fade; resuming restarts an unfinished hold", async ({ page }) => {
  await page.goto("/"); await upload(page);
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await page.getByRole("slider", { name: "Hold duration", exact: true }).fill("2");
  await page.getByRole("slider", { name: "Fade duration", exact: true }).fill("2");
  await page.getByRole("button", { name: "Raise arms", exact: true }).click();
  await expect.poll(async () => +(await page.getByTestId("avatar").getAttribute("data-hold"))!).toBeGreaterThan(.2);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByText("Session paused")).toBeVisible();
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", "0.00");
  const snapshot = await page.getByTestId("avatar").evaluate(el => (el as HTMLCanvasElement).toDataURL());
  await page.getByRole("button", { name: "Return to rest", exact: true }).click();
  await page.waitForTimeout(1500);
  expect(await page.getByTestId("avatar").evaluate(el => (el as HTMLCanvasElement).toDataURL())).toBe(snapshot);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-fade", "0.00");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Raise arms", exact: true }).click();
  await expect(page.getByText("Fading selected color")).toBeVisible({ timeout: 3500 });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByText("Session paused")).toBeVisible();
  const fade = await page.getByTestId("avatar").getAttribute("data-fade");
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-fade", fade!);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByText("Selected color faded")).toBeVisible({ timeout: 3500 });
});

test("fade amount stays consistent across overlapping areas and PNG saves the actual result", async ({ page }, testInfo) => {
  await page.goto("/"); await upload(page);
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await page.getByRole("slider", { name: "Hold duration", exact: true }).fill("1");
  await page.getByRole("slider", { name: "Fade duration", exact: true }).fill("0.2");
  await page.getByRole("slider", { name: "Fade amount", exact: true }).fill("50");
  await page.getByRole("button", { name: "Raise arms", exact: true }).click();
  await expect(page.getByText("Selected color faded")).toBeVisible({ timeout: 3500 });
  await page.getByRole("button", { name: "Return to rest", exact: true }).click();
  await expect.poll(async () => (await pixel(page, '[data-testid="avatar"]', 235, 270))[1]).toBeGreaterThan(175);
  const single = await pixel(page, '[data-testid="avatar"]', 235, 270);
  expect(single[1]).toBeLessThan(190);
  await page.getByRole("button", { name: "Add area", exact: true }).click();
  await page.getByRole("button", { name: "Shoulder", exact: true }).click();
  await page.getByRole("button", { name: "Raise arms", exact: true }).click();
  await expect(page.getByText("Selected color faded")).toBeVisible({ timeout: 3500 });
  await page.getByRole("button", { name: "Return to rest", exact: true }).click();
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', 235, 270)).toEqual(single);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save PNG", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^out-of-body-manual-\d+\.png$/);
  const filename = testInfo.outputPath("saved-avatar.png"); await download.saveAs(filename);
  const bytes = await readFile(filename);
  const metadata = await sharp(bytes).metadata();
  expect(metadata.width).toBe(840); expect(metadata.height).toBe(900);
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const savedPixel = (x: number, y: number) => Array.from(data.subarray((y * info.width + x + 120) * 4, (y * info.width + x + 120) * 4 + 4));
  expect(savedPixel(235, 270)).toEqual(single);
  expect(savedPixel(300, 385)).toEqual([39, 154, 163, 255]);
  expect(Array.from(data.subarray(0, 4))).toEqual([250, 248, 243, 255]);
});

test("canceling a pending camera request releases a stream that arrives later", async ({ page }) => {
  await page.addInitScript(() => {
    const fixture = window as unknown as { resolveCamera: () => void; lateStream: MediaStream };
    navigator.mediaDevices.getUserMedia = () => new Promise(resolve => {
      fixture.resolveCamera = () => {
        const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 480;
        fixture.lateStream = canvas.captureStream(10); resolve(fixture.lateStream);
      };
    });
  });
  await page.goto("/"); await upload(page);
  await page.getByRole("button", { name: "Enable camera", exact: true }).click();
  await page.getByRole("button", { name: "Cancel camera", exact: true }).click();
  await page.evaluate(() => (window as unknown as { resolveCamera: () => void }).resolveCamera());
  await expect.poll(() => page.evaluate(() => (window as unknown as { lateStream: MediaStream }).lateStream.getTracks().every(t => t.readyState === "ended"))).toBeTruthy();
  await expect(page.getByRole("button", { name: "Enable camera", exact: true })).toBeEnabled();
  expect(await page.locator("video").evaluate(v => (v as HTMLVideoElement).srcObject)).toBeNull();
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Manual left arm height", exact: true })).toBeVisible();
});
