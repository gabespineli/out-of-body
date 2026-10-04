import { test, expect, chromium, type Page } from "@playwright/test";
import sharp from "sharp";
import { silhouetteSvg } from "../../src/lib/rig";
import path from "node:path";
import { readFile } from "node:fs/promises";

let drawing: Buffer;
const atRotated = (x: number, y: number, pivotX: number, pivotY: number, angle: number) => ({ x: Math.round(pivotX + (x - pivotX) * Math.cos(angle) - (y - pivotY) * Math.sin(angle)), y: Math.round(pivotY + (x - pivotX) * Math.sin(angle) + (y - pivotY) * Math.cos(angle)) });
test.beforeAll(async () => {
  const svg = silhouetteSvg(false).replace("</svg>", '<rect x="219" y="248" width="40" height="55" fill="#db715d"/><rect x="256" y="324" width="87" height="130" fill="#279aa3"/><rect x="280" y="110" width="40" height="30" fill="#e5b543"/><rect x="292" y="427" width="16" height="16" fill="#222222"/><rect x="240" y="590" width="30" height="130" fill="#7399b4"/><rect x="334" y="690" width="24" height="70" fill="#a198bd"/><rect x="284" y="498" width="32" height="22" fill="#d35fa4"/><rect x="296" y="518" width="8" height="8" fill="#58b36e"/></svg>');
  drawing = await sharp(Buffer.from(svg)).png().toBuffer();
});

async function upload(page: Page) {
  await page.getByRole("button", { name: "Individual stretches", exact: true }).click();
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
  await page.goto("/"); await page.getByRole("button", { name: "Individual stretches", exact: true }).click(); await upload(page);
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', 300, 385)).toEqual([39, 154, 163, 255]);
  const before = await pixel(page, '[data-testid="avatar"]', 235, 270);
  expect(before.slice(0, 3)).toEqual([219, 113, 93]);
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await page.screenshot({ path: "test-results/upload-rest.png", fullPage: true });
  await page.getByRole("button", { name: "Raise arms", exact: true }).click();
  await expect(page.getByTestId("stretch-status")).toBeVisible();
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", /0\.[1-9]/);
  await page.screenshot({ path: "test-results/raised-arms.png", fullPage: true });
  await expect(page.getByText("Completed — selected color faded")).toBeVisible({ timeout: 6000 });
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-fade", "1.00", { timeout: 4000 });
  await page.getByRole("button", { name: "Return to rest", exact: true }).click();
  await expect.poll(async () => (await pixel(page, '[data-testid="avatar"]', 235, 270))[1]).toBeGreaterThan(235);
  expect((await pixel(page, '[data-testid="avatar"]', 300, 385))[0]).toBeGreaterThan(235);
  expect(await pixel(page, '[data-testid="avatar"]', 300, 120)).toEqual([229, 181, 67, 255]);
  expect(await pixel(page, '[data-testid="avatar"]', 254, 610)).toEqual([115, 153, 180, 255]);
  await page.screenshot({ path: "test-results/softened-region.png", fullPage: true });
  await page.getByRole("button", { name: "Restore original colors", exact: true }).click();
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', 235, 270)).toEqual(before);
  expect(errors).toEqual([]);
});

test("one raised arm or a side lean cannot earn progress; interruption restarts the three-second hold", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Individual stretches", exact: true }).click(); await upload(page);
  await expect(page.getByTestId("stretch-instruction")).toContainText("Raise both hands above your shoulders.");
  await expect(page.getByRole("combobox", { name: "Gesture to hold" })).toHaveCount(0);
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await page.getByRole("slider", { name: "Manual left arm height", exact: true }).fill("1");
  await page.waitForTimeout(700);
  await expect(page.getByTestId("stretch-feedback")).toHaveAttribute("data-stretch-state", "not-detected");
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", "0.00");
  await page.getByRole("button", { name: "Lean left", exact: true }).click();
  await page.waitForTimeout(700);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", "0.00");
  await page.getByRole("button", { name: "Raise arms", exact: true }).click();
  await expect(page.getByTestId("stretch-feedback")).toHaveAttribute("data-stretch-state", "holding");
  await expect.poll(async () => +(await page.getByTestId("avatar").getAttribute("data-hold"))!).toBeGreaterThan(.2);
  await page.getByRole("slider", { name: "Manual right arm height", exact: true }).fill("0");
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", "0.00");
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-fade", "0.00");
  await page.getByRole("slider", { name: "Manual right arm height", exact: true }).fill("1");
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-fade", "0.00");
  await expect(page.getByText("Completed — selected color faded")).toBeVisible({ timeout: 6000 });
});

test("permission denied is explained and manual fallback remains usable", async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Denied by fixture", "NotAllowedError"); }; });
  await page.goto("/"); await page.getByRole("button", { name: "Individual stretches", exact: true }).click(); await upload(page);
  await page.getByRole("button", { name: "Enable camera", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Camera permission was denied");
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await page.getByRole("button", { name: "Raise arms", exact: true }).click();
  await expect(page.getByText("Completed — selected color faded")).toBeVisible({ timeout: 6000 });
});

test("no webcam and a busy camera have distinct recovery states", async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("No fixture camera", "NotFoundError"); }; });
  await page.goto("/"); await page.getByRole("button", { name: "Individual stretches", exact: true }).click(); await page.getByRole("button", { name: "Enable camera", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("No webcam was found");
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Busy fixture", "NotReadableError"); }; });
  await page.getByRole("button", { name: "Try camera again", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("camera is busy");
});

test("invalid uploads, area selection, no color, alignment and reset work", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Individual stretches", exact: true }).click();
  await page.getByTestId("art-upload").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("invalid") });
  await expect(page.locator("p[role=alert]")).toContainText("Choose a JPG, PNG or WebP");
  await page.getByTestId("art-upload").setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from("invalid") });
  await expect(page.locator("p[role=alert]")).toContainText("could not be opened");
  const blank = await sharp(Buffer.from(silhouetteSvg(false))).png().toBuffer();
  await page.getByTestId("art-upload").setInputFiles({ name: "blank-template.png", mimeType: "image/png", buffer: blank });
  await expect(page.getByTestId("art-source")).toBeVisible();
  await page.getByRole("combobox", { name: "Body area", exact: true }).selectOption("neck-head");
  await expect(page.getByTestId("stretch-feedback")).toHaveAttribute("data-stretch-state", "no-color");
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await page.getByRole("button", { name: "Tilt head left", exact: true }).click();
  await page.waitForTimeout(700);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", "0.00");
  await upload(page);
  await page.getByRole("button", { name: "Align photo", exact: true }).click();
  await page.getByRole("slider", { name: "Photo zoom", exact: true }).fill("1.1");
  await page.getByRole("button", { name: "Reset alignment", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Photo zoom", exact: true })).toHaveValue("1");
  await page.getByRole("button", { name: "Start fresh", exact: true }).click();
  await expect(page.getByTestId("art-source")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Guided sequence", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-fade", "0.00");
  const template = await page.request.get("/drawing-sheet.svg");
  expect(template.ok()).toBeTruthy(); expect(await template.text()).toContain('viewBox="0 0 600 900"');
});

test("layout fits 320, 768, 1024 and 1440 widths and supports keyboard controls", async ({ page }) => {
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await page.goto("/"); await page.getByRole("button", { name: "Individual stretches", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.getByRole("button", { name: "Try an example", exact: true }).click();
    await page.getByRole("button", { name: "Manual demo", exact: true }).click();
    await expect(page.getByTestId("avatar")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/layout-${width}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "Raise arms", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Raise arms", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("real MediaPipe moves arms and legs while an unraised pose cannot complete the stretch", async () => {
  const fixture = process.env.OOB_CAMERA_FIXTURE;
  test.skip(!fixture, "Set OOB_CAMERA_FIXTURE to a Y4M replay. No physical webcam is used.");
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${path.resolve(fixture!)}`] });
  const context = await browser.newContext({ permissions: ["camera"], viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:3201"); await upload(page);
    await page.getByRole("button", { name: "Enable camera", exact: true }).click();
    await expect(page.getByRole("button", { name: "Stop camera", exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Body found ·/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("tracking-legs")).toHaveText("Left leg: visible · Right leg: visible");
    await expect.poll(async () => (await pixel(page, '[data-testid="avatar"]', 254, 710))[3]).toBe(0);
    await page.waitForTimeout(3200);
    await expect(page.getByTestId("stretch-feedback")).toHaveAttribute("data-stretch-state", "not-detected");
    await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", "0.00");
    await expect(page.getByTestId("avatar")).toHaveAttribute("data-fade", "0.00");
    await page.screenshot({ path: "test-results/camera-replay.png", fullPage: true });
    await page.evaluate(() => { (window as unknown as { testStream: MediaStream }).testStream = document.querySelector("video")!.srcObject as MediaStream; });
    await page.getByRole("button", { name: "Stop camera", exact: true }).click();
    expect(await page.evaluate(() => (window as unknown as { testStream: MediaStream }).testStream.getTracks().every(track => track.readyState === "ended"))).toBeTruthy();
    await expect.poll(() => pixel(page, '[data-testid="avatar"]', 254, 610)).toEqual([115, 153, 180, 255]);
    await expect.poll(() => pixel(page, '[data-testid="avatar"]', 346, 720)).toEqual([161, 152, 189, 255]);
  } finally { await context.close(); await browser.close(); }
});

test("a real MediaPipe lean does not count as the arms-raised stretch", async () => {
  const fixture = process.env.OOB_LEAN_CAMERA_FIXTURE;
  test.skip(!fixture, "Set OOB_LEAN_CAMERA_FIXTURE to a Y4M lean replay. No physical webcam is used.");
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${path.resolve(fixture!)}`] });
  const context = await browser.newContext({ permissions: ["camera"], viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:3201"); await upload(page);
    await page.getByRole("button", { name: "Enable camera", exact: true }).click();
    await expect(page.getByText(/Body found ·/)).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(3200);
    await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", "0.00");
    await expect(page.getByTestId("avatar")).toHaveAttribute("data-fade", "0.00");
    await expect(page.getByTestId("stretch-status")).toContainText("Not detected");
    await page.getByRole("button", { name: "Stop camera", exact: true }).click();
    await expect.poll(() => pixel(page, '[data-testid="avatar"]', 235, 270)).toEqual([219, 113, 93, 255]);
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
    await expect(page.getByText("Completed — selected color faded")).toBeVisible({ timeout: 6000 });
  } finally { await context.close(); await browser.close(); }
});

test("the three-second stretch transitions through animated fade and changes only colored pixels in arms and torso", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Individual stretches", exact: true }).click(); await upload(page);
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await expect(page.getByTestId("stretch-status")).toContainText("Not detected");
  await expect(page.getByTestId("stretch-instruction")).toContainText("3 seconds");
  await page.getByRole("button", { name: "Raise arms", exact: true }).click();
  await expect(page.getByTestId("stretch-status")).toContainText("Hold still");
  await page.waitForTimeout(2000);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-fade", "0.00");
  await expect(page.getByTestId("stretch-feedback")).toHaveAttribute("data-stretch-state", "fading", { timeout: 2500 });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const partial = +(await page.getByTestId("avatar").getAttribute("data-fade"))!;
  expect(partial).toBeGreaterThan(0); expect(partial).toBeLessThan(1);
  const midColor = await pixel(page, '[data-testid="avatar"]', 300, 385);
  expect(midColor[0]).toBeGreaterThan(39); expect(midColor[0]).toBeLessThan(245);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByTestId("stretch-status")).toHaveText("Completed — selected color faded", { timeout: 4000 });
  await page.getByRole("button", { name: "Return to rest", exact: true }).click();
  await page.waitForTimeout(1300);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByTestId("avatar").evaluate(el => {
    const canvas = el as HTMLCanvasElement & { beforeRestore?: Uint8ClampedArray };
    canvas.beforeRestore = canvas.getContext("2d")!.getImageData(0, 0, 840, 900).data;
  });
  await page.getByRole("button", { name: "Restore original colors", exact: true }).click();
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', 235, 270)).toEqual([219, 113, 93, 255]);
  const difference = await page.getByTestId("avatar").evaluate(el => {
    const canvas = el as HTMLCanvasElement & { beforeRestore: Uint8ClampedArray };
    const current = canvas.getContext("2d")!.getImageData(0, 0, 840, 900).data, previous = canvas.beforeRestore;
    let inside = 0, outside = 0;
    for (let i = 0; i < current.length; i += 4) {
      if ([0, 1, 2, 3].some(c => current[i + c] !== previous[i + c])) {
        const point = i / 4, x = point % 840 - 120, y = Math.floor(point / 840);
        const coloredArm = x >= 218 && x <= 260 && y >= 247 && y <= 304;
        const coloredTorso = x >= 255 && x <= 344 && y >= 323 && y <= 455;
        if (coloredArm || coloredTorso) inside++; else outside++;
      }
    }
    return { inside, outside };
  });
  expect(difference.inside).toBeGreaterThan(10000); expect(difference.outside).toBe(0);
});

test("all three areas complete independently and keep their earned fades when switching", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Individual stretches", exact: true }).click(); await upload(page);
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await page.getByRole("slider", { name: "Hold duration", exact: true }).fill("2");
  await page.getByRole("slider", { name: "Fade duration", exact: true }).fill("0.2");
  const select = page.getByRole("combobox", { name: "Body area", exact: true });
  await expect(select.locator("option")).toHaveCount(3);
  for (const [area, action, expected] of [
    ["neck-head", "Tilt head left", ["1.00", "0.00", "0.00"]],
    ["arms-back", "Raise arms", ["1.00", "1.00", "0.00"]],
    ["legs-feet", "Lift right leg", ["1.00", "1.00", "1.00"]],
  ] as const) {
    await select.selectOption(area);
    await expect(page.getByTestId("stretch-status")).toContainText("Not detected");
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(page.getByText("Completed — selected color faded")).toBeVisible({ timeout: 4000 });
    for (const [i, attribute] of ["data-head-fade", "data-arms-fade", "data-legs-fade"].entries())
      await expect(page.getByTestId("avatar")).toHaveAttribute(attribute, expected[i]);
    await page.getByRole("button", { name: "Return to rest", exact: true }).click();
    await page.waitForTimeout(1100);
    expect(await pixel(page, '[data-testid="avatar"]', 300, 435)).toEqual([34, 34, 34, 255]);
    expect(await pixel(page, '[data-testid="avatar"]', 300, 509)).toEqual([211, 95, 164, 255]);
    if (area === "neck-head") {
      expect((await pixel(page, '[data-testid="avatar"]', 300, 120))[2]).toBeGreaterThan(230);
      expect(await pixel(page, '[data-testid="avatar"]', 300, 385)).toEqual([39, 154, 163, 255]);
      expect(await pixel(page, '[data-testid="avatar"]', 254, 610)).toEqual([115, 153, 180, 255]);
    }
    if (area === "arms-back") {
      expect((await pixel(page, '[data-testid="avatar"]', 300, 385))[0]).toBeGreaterThan(235);
      expect(await pixel(page, '[data-testid="avatar"]', 254, 610)).toEqual([115, 153, 180, 255]);
    }
  }
  await expect(page.getByTestId("area-progress")).toHaveText("Neck / head: completed · Arms / back: completed · Legs / feet: completed");
  expect((await pixel(page, '[data-testid="avatar"]', 254, 610))[0]).toBeGreaterThan(235);
  expect((await pixel(page, '[data-testid="avatar"]', 346, 720))[0]).toBeGreaterThan(235);
  await page.screenshot({ path: "test-results/areas-three-completed.png", fullPage: true });
  await select.selectOption("neck-head");
  await expect(page.getByTestId("stretch-status")).toContainText("Completed");
  await page.getByRole("button", { name: "Restore original colors", exact: true }).click();
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', 300, 120)).toEqual([229, 181, 67, 255]);
  for (const attribute of ["data-head-fade", "data-arms-fade", "data-legs-fade"])
    await expect(page.getByTestId("avatar")).toHaveAttribute(attribute, "0.00");
  await page.getByRole("button", { name: "Start fresh", exact: true }).click();
  await page.getByRole("button", { name: "Individual stretches", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Hold duration", exact: true })).toHaveValue("3");
});

test("pause freezes the displayed pose and fade; resuming restarts an unfinished hold", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Individual stretches", exact: true }).click(); await upload(page);
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
  await expect(page.getByText("Stretch held — fading selected color…")).toBeVisible({ timeout: 3500 });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByText("Session paused")).toBeVisible();
  const fade = await page.getByTestId("avatar").getAttribute("data-fade");
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-fade", fade!);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByText("Completed — selected color faded")).toBeVisible({ timeout: 3500 });
});

test("PNG saves independent area fades at the requested amount", async ({ page }, testInfo) => {
  await page.goto("/"); await page.getByRole("button", { name: "Individual stretches", exact: true }).click(); await upload(page);
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await page.getByRole("slider", { name: "Hold duration", exact: true }).fill("2");
  await page.getByRole("slider", { name: "Fade duration", exact: true }).fill("0.2");
  await page.getByRole("slider", { name: "Fade amount", exact: true }).fill("50");
  await page.getByRole("button", { name: "Raise arms", exact: true }).click();
  await expect(page.getByText("Completed — selected color faded")).toBeVisible({ timeout: 4000 });
  await page.getByRole("button", { name: "Return to rest", exact: true }).click();
  await expect.poll(async () => (await pixel(page, '[data-testid="avatar"]', 235, 270))[1]).toBeGreaterThan(175);
  const single = await pixel(page, '[data-testid="avatar"]', 235, 270);
  expect(single[1]).toBeLessThan(190);
  await page.getByRole("combobox", { name: "Body area", exact: true }).selectOption("neck-head");
  await page.getByRole("button", { name: "Tilt head right", exact: true }).click();
  await expect(page.getByText("Completed — selected color faded")).toBeVisible({ timeout: 4000 });
  await page.getByRole("button", { name: "Return to rest", exact: true }).click();
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', 235, 270)).toEqual(single);
  await page.waitForTimeout(1000);
  const torso = await pixel(page, '[data-testid="avatar"]', 300, 385);
  const head = await pixel(page, '[data-testid="avatar"]', 300, 120);
  expect(torso[0]).toBeGreaterThan(140); expect(torso[0]).toBeLessThan(150);
  expect(head[2]).toBeGreaterThan(150); expect(head[2]).toBeLessThan(160);
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
  expect(savedPixel(300, 385)).toEqual(torso);
  expect(savedPixel(300, 120)).toEqual(head);
  expect(savedPixel(254, 610)).toEqual([115, 153, 180, 255]);
  expect(savedPixel(300, 509)).toEqual([211, 95, 164, 255]);
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
  await page.goto("/"); await page.getByRole("button", { name: "Individual stretches", exact: true }).click(); await upload(page);
  await page.getByRole("button", { name: "Enable camera", exact: true }).click();
  await page.getByRole("button", { name: "Cancel camera", exact: true }).click();
  await page.evaluate(() => (window as unknown as { resolveCamera: () => void }).resolveCamera());
  await expect.poll(() => page.evaluate(() => (window as unknown as { lateStream: MediaStream }).lateStream.getTracks().every(t => t.readyState === "ended"))).toBeTruthy();
  await expect(page.getByRole("button", { name: "Enable camera", exact: true })).toBeEnabled();
  expect(await page.locator("video").evaluate(v => (v as HTMLVideoElement).srcObject)).toBeNull();
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Manual left arm height", exact: true })).toBeVisible();
});

test("uploaded leg marks follow independent hip and knee controls", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Individual stretches", exact: true }).click(); await upload(page);
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', 254, 610)).toEqual([115, 153, 180, 255]);
  expect(await pixel(page, '[data-testid="avatar"]', 254, 710)).toEqual([115, 153, 180, 255]);
  await page.getByRole("slider", { name: "Manual left knee bend", exact: true }).fill("1");
  const shin = atRotated(254, 710, 254, 652, .9);
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', shin.x, shin.y)).toEqual([115, 153, 180, 255]);
  expect(await pixel(page, '[data-testid="avatar"]', 254, 610)).toEqual([115, 153, 180, 255]);
  await page.getByRole("button", { name: "Return to rest", exact: true }).click();
  await page.getByRole("slider", { name: "Manual left leg swing", exact: true }).fill("1");
  const thigh = atRotated(254, 610, 256, 522, .8);
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', thigh.x, thigh.y)).toEqual([115, 153, 180, 255]);
  expect(await pixel(page, '[data-testid="avatar"]', 346, 720)).toEqual([161, 152, 189, 255]);
  expect(await pixel(page, '[data-testid="avatar"]', 300, 385)).toEqual([39, 154, 163, 255]);
  await page.getByRole("button", { name: "Lift right leg", exact: true }).click();
  const right = atRotated(346, 720, 346, 652, -.45);
  const rightSwing = atRotated(right.x, right.y, 344, 522, -.8);
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', rightSwing.x, rightSwing.y)).toEqual([161, 152, 189, 255]);
  await page.screenshot({ path: "test-results/leg-movement.png", fullPage: true });
});

test("manual leg motion cannot trigger the arms and back stretch", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Individual stretches", exact: true }).click(); await upload(page);
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  for (const side of ["left", "right"]) {
    await page.getByRole("button", { name: `Lift ${side} leg`, exact: true }).click();
    await page.waitForTimeout(700);
    await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", "0.00");
    await expect(page.getByTestId("avatar")).toHaveAttribute("data-fade", "0.00");
  }
});

test("neck and foot marks fade in their assigned area while torso and pelvis keep their colors", async ({ page }) => {
  const svg = silhouetteSvg(false).replace("</svg>", '<rect x="290" y="193" width="20" height="12" fill="#e5b543"/><rect x="228" y="790" width="24" height="10" fill="#7399b4"/><rect x="280" y="350" width="40" height="40" fill="#279aa3"/><rect x="284" y="498" width="32" height="22" fill="#d35fa4"/></svg>');
  const texture = await sharp(Buffer.from(svg)).png().toBuffer();
  await page.goto("/"); await page.getByRole("button", { name: "Individual stretches", exact: true }).click();
  await page.getByTestId("art-upload").setInputFiles({ name: "neck-and-feet.png", mimeType: "image/png", buffer: texture });
  await expect(page.getByTestId("art-source")).toBeVisible();
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await page.getByRole("slider", { name: "Hold duration", exact: true }).fill("2");
  await page.getByRole("slider", { name: "Fade duration", exact: true }).fill("0.2");
  const select = page.getByRole("combobox", { name: "Body area", exact: true });
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', 300, 198)).toEqual([229, 181, 67, 255]);
  expect(await pixel(page, '[data-testid="avatar"]', 240, 795)).toEqual([115, 153, 180, 255]);
  await select.selectOption("neck-head");
  await page.getByRole("button", { name: "Tilt head right", exact: true }).click();
  await expect(page.getByTestId("stretch-status")).toContainText("Completed", { timeout: 4000 });
  await page.getByRole("button", { name: "Return to rest", exact: true }).click();
  await expect.poll(async () => (await pixel(page, '[data-testid="avatar"]', 300, 198))[2]).toBeGreaterThan(230);
  expect(await pixel(page, '[data-testid="avatar"]', 240, 795)).toEqual([115, 153, 180, 255]);
  await select.selectOption("legs-feet");
  await page.getByRole("button", { name: "Lift left leg", exact: true }).click();
  await expect(page.getByTestId("stretch-status")).toContainText("Completed", { timeout: 4000 });
  await page.getByRole("button", { name: "Return to rest", exact: true }).click();
  await expect.poll(async () => (await pixel(page, '[data-testid="avatar"]', 240, 795))[0]).toBeGreaterThan(235);
  expect((await pixel(page, '[data-testid="avatar"]', 300, 198))[2]).toBeGreaterThan(230);
  expect(await pixel(page, '[data-testid="avatar"]', 300, 370)).toEqual([39, 154, 163, 255]);
  expect(await pixel(page, '[data-testid="avatar"]', 300, 509)).toEqual([211, 95, 164, 255]);
  await page.getByRole("button", { name: "Restore original colors", exact: true }).click();
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', 300, 198)).toEqual([229, 181, 67, 255]);
  expect(await pixel(page, '[data-testid="avatar"]', 240, 795)).toEqual([115, 153, 180, 255]);
});

test("the uploaded pelvis rotates around its fixed center, carries the body, pauses and resets", async ({ page }, testInfo) => {
  await page.goto("/"); await page.getByRole("button", { name: "Individual stretches", exact: true }).click(); await upload(page);
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', 300, 522)).toEqual([88, 179, 110, 255]);
  const marker = atRotated(286, 501, 300, 522, .35);
  await page.getByRole("button", { name: "Rotate hips right", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Manual hip rotation", exact: true })).toHaveValue("1");
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', marker.x, marker.y)).toEqual([211, 95, 164, 255]);
  expect(await pixel(page, '[data-testid="avatar"]', 286, 501)).not.toEqual([211, 95, 164, 255]);
  // A mark centered on the pelvis pivot stays at the same canvas pixel.
  expect(await pixel(page, '[data-testid="avatar"]', 300, 522)).toEqual([88, 179, 110, 255]);
  const torso = atRotated(300, 385, 300, 522, .35), leg = atRotated(254, 710, 300, 522, .35);
  expect(await pixel(page, '[data-testid="avatar"]', torso.x, torso.y)).toEqual([39, 154, 163, 255]);
  expect(await pixel(page, '[data-testid="avatar"]', leg.x, leg.y)).toEqual([115, 153, 180, 255]);
  for (const control of ["Manual hip sway", "Manual hip height"]) await expect(page.getByRole("slider", { name: control, exact: true })).toHaveCount(0);
  await page.screenshot({ path: "test-results/hip-rotation.png", fullPage: true });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const before = await page.getByTestId("avatar").evaluate(el => (el as HTMLCanvasElement).toDataURL());
  await page.getByRole("button", { name: "Rotate hips left", exact: true }).click();
  await page.waitForTimeout(400);
  expect(await page.getByTestId("avatar").evaluate(el => (el as HTMLCanvasElement).toDataURL())).toBe(before);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save PNG", exact: true }).click();
  const filename = testInfo.outputPath("hip-rotation.png"); await (await downloadEvent).saveAs(filename);
  const { data, info } = await sharp(filename).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const offset = (marker.y * info.width + marker.x + 120) * 4;
  expect(Array.from(data.subarray(offset, offset + 4))).toEqual([211, 95, 164, 255]);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  const leftMarker = atRotated(314, 501, 300, 522, -.35);
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', leftMarker.x, leftMarker.y)).toEqual([211, 95, 164, 255]);
  expect(await pixel(page, '[data-testid="avatar"]', 300, 522)).toEqual([88, 179, 110, 255]);
  await page.getByRole("slider", { name: "Manual hip rotation", exact: true }).fill("0.5");
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', 300, 522)).toEqual([88, 179, 110, 255]);
  await page.getByRole("button", { name: "Return to rest", exact: true }).click();
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', 300, 509)).toEqual([211, 95, 164, 255]);
  await expect(page.getByRole("slider", { name: "Manual hip rotation", exact: true })).toHaveValue("0");
});

test("real MediaPipe rotates the textured pelvis while camera position changes leave its pivot fixed", async () => {
  // Model startup plus a complete replay cycle needs extra time on the CPU runner.
  test.setTimeout(75000);
  const fixture = process.env.OOB_HIP_CAMERA_FIXTURE;
  test.skip(!fixture, "Set OOB_HIP_CAMERA_FIXTURE to a moving Y4M photo replay. No physical webcam is used.");
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${path.resolve(fixture!)}`] });
  const context = await browser.newContext({ permissions: ["camera"], viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const marks = () => page.getByTestId("avatar").evaluate(el => {
    const canvas = el as HTMLCanvasElement, data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    const marker = (r: number, g: number, b: number) => {
      let x = 0, y = 0, xx = 0, yy = 0, xy = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] === r && data[i + 1] === g && data[i + 2] === b && data[i + 3] === 255) {
        const p = i / 4, px = p % canvas.width - 120, py = Math.floor(p / canvas.width);
        x += px; y += py; xx += px * px; yy += py * py; xy += px * py; count++;
      }
      if (!count) return null;
      x /= count; y /= count;
      return { x, y, count, angle: .5 * Math.atan2(2 * (xy / count - x * y), xx / count - x * x - yy / count + y * y) };
    };
    return { hip: marker(211, 95, 164), pivot: marker(88, 179, 110) };
  });
  try {
    await page.goto("http://127.0.0.1:3201"); await upload(page);
    await page.getByRole("button", { name: "Enable camera", exact: true }).click();
    await expect(page.getByText(/Body found ·/)).toBeVisible({ timeout: 30000 });
    const angles: number[] = [];
    // Watch a complete replay cycle, including both shifted/rotated camera frames.
    for (let frame = 0; frame < 40; frame++) {
      const { hip, pivot } = await marks();
      expect(hip?.count).toBeGreaterThan(100); expect(pivot?.count).toBeGreaterThan(20);
      expect(Math.abs(pivot!.x - 299.5)).toBeLessThan(2);
      expect(Math.abs(pivot!.y - 521.5)).toBeLessThan(2);
      expect(Math.abs(hip!.x - 300)).toBeLessThan(10);
      angles.push(hip!.angle);
      await page.waitForTimeout(200);
    }
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(.15);
    await expect(page.getByRole("button", { name: "Recenter position", exact: true })).toHaveCount(0);
    await page.screenshot({ path: "test-results/camera-hip-rotation.png", fullPage: true });
    await page.getByRole("button", { name: "Stop camera", exact: true }).click();
    await expect.poll(() => pixel(page, '[data-testid="avatar"]', 300, 509)).toEqual([211, 95, 164, 255]);
  } finally { await context.close(); await browser.close(); }
});


test("switching areas resets a partial hold and head rotation moves the actual uploaded texture", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Individual stretches", exact: true }).click(); await upload(page);
  await page.getByRole("button", { name: "Manual demo", exact: true }).click();
  await page.getByRole("button", { name: "Raise arms", exact: true }).click();
  await expect.poll(async () => +(await page.getByTestId("avatar").getAttribute("data-hold"))!).toBeGreaterThan(.2);
  const select = page.getByRole("combobox", { name: "Body area", exact: true });
  await select.selectOption("neck-head");
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", "0.00");
  await page.getByRole("button", { name: "Raise arms", exact: true }).click();
  await page.waitForTimeout(700);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", "0.00");
  await page.getByRole("button", { name: "Tilt head right", exact: true }).click();
  const tilted = atRotated(300, 120, 300, 208, .4);
  await expect.poll(() => pixel(page, '[data-testid="avatar"]', tilted.x, tilted.y)).toEqual([229, 181, 67, 255]);
  await select.selectOption("arms-back");
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", "0.00");
  await page.getByRole("button", { name: "Raise arms", exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-fade", "0.00");
});

test("real MediaPipe leg extension earns only the legs and feet fade", async () => {
  const fixture = process.env.OOB_CAMERA_FIXTURE;
  test.skip(!fixture, "Set OOB_CAMERA_FIXTURE to a Y4M replay. No physical webcam is used.");
  test.setTimeout(60000);
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${path.resolve(fixture!)}`] });
  const context = await browser.newContext({ permissions: ["camera"], viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:3201"); await upload(page);
    await page.getByRole("combobox", { name: "Body area", exact: true }).selectOption("legs-feet");
    await page.getByRole("button", { name: "Enable camera", exact: true }).click();
    await expect(page.getByText(/Body found ·/)).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("stretch-status")).toContainText("Completed", { timeout: 12000 });
    await expect(page.getByTestId("avatar")).toHaveAttribute("data-legs-fade", "1.00");
    await expect(page.getByTestId("avatar")).toHaveAttribute("data-arms-fade", "0.00");
    await expect(page.getByTestId("avatar")).toHaveAttribute("data-head-fade", "0.00");
    await page.screenshot({ path: "test-results/camera-legs-completed.png", fullPage: true });
    await page.getByRole("button", { name: "Stop camera", exact: true }).click();
    await expect.poll(async () => (await pixel(page, '[data-testid="avatar"]', 254, 610))[0]).toBeGreaterThan(235);
    await expect.poll(async () => (await pixel(page, '[data-testid="avatar"]', 346, 720))[0]).toBeGreaterThan(235);
    await expect.poll(() => pixel(page, '[data-testid="avatar"]', 300, 385)).toEqual([39, 154, 163, 255]);
    await expect.poll(() => pixel(page, '[data-testid="avatar"]', 300, 120)).toEqual([229, 181, 67, 255]);
    await expect.poll(() => pixel(page, '[data-testid="avatar"]', 300, 509)).toEqual([211, 95, 164, 255]);
  } finally { await context.close(); await browser.close(); }
});
