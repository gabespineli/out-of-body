import { test, expect, chromium, type Page } from "@playwright/test";
import sharp from "sharp";
import path from "node:path";
import { silhouetteSvg } from "../../src/lib/rig";

let drawing: Buffer;
test.beforeAll(async () => {
  const svg = silhouetteSvg(false).replace("</svg>", '<rect x="280" y="110" width="40" height="30" fill="#e5b543"/><rect x="256" y="324" width="87" height="130" fill="#279aa3"/><rect x="219" y="248" width="40" height="55" fill="#db715d"/><rect x="240" y="590" width="30" height="130" fill="#7399b4"/><rect x="292" y="427" width="16" height="16" fill="#222222"/><rect x="284" y="498" width="32" height="22" fill="#d35fa4"/></svg>');
  drawing = await sharp(Buffer.from(svg)).png().toBuffer();
});
async function upload(page: Page, buffer = drawing) {
  await page.getByTestId("art-upload").setInputFiles({ name: "guided-participant.png", mimeType: "image/png", buffer });
  await expect(page.getByTestId("art-source")).toBeVisible();
}
async function pixel(page: Page, x: number, y: number) {
  return page.getByTestId("avatar").evaluate((el, p) => Array.from((el as HTMLCanvasElement).getContext("2d")!.getImageData(p.x + 120, p.y, 1, 1).data), { x, y });
}
async function prepare(page: Page) {
  await page.goto("/"); await upload(page);
  await page.getByRole("combobox", { name: "Motion source", exact: true }).selectOption("manual");
  await page.getByRole("button", { name: "Start guided session", exact: true }).click();
}
async function move(page: Page, area: string, times: number) {
  for (let i = 0; i < times; i++) {
    const step = await page.getByTestId("avatar").getAttribute("data-step");
    if (area === "neck-head") await page.getByRole("slider", { name: "Manual head tilt", exact: true }).fill(i % 2 ? "0.3" : "-0.3");
    else if (step === "reach") await page.getByRole("slider", { name: "Manual left arm height", exact: true }).fill(i % 2 ? "0.8" : "0.5");
    else if (step === "side-stretch") {
      await page.getByRole("slider", { name: "Manual left arm height", exact: true }).fill("0.65");
      await page.getByRole("slider", { name: "Manual side lean", exact: true }).fill(i % 2 ? "0.3" : "-0.3");
    } else if (step === "heel-raise") await page.getByRole("slider", { name: "Manual heel raise", exact: true }).fill(i % 2 ? "0.6" : "0");
    else {
      await page.getByRole("slider", { name: "Manual left leg swing", exact: true }).fill(i % 2 ? "0" : "0.25");
      await page.getByRole("slider", { name: "Manual right leg swing", exact: true }).fill(i % 2 ? "-0.25" : "0");
    }
    await page.waitForTimeout(450);
  }
}
test("independent visual guide loops without earning participant progress; gentle motion fades only the head", async ({ page }) => {
  await prepare(page);
  await expect(page.getByRole("heading", { name: "Follow the guide" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your drawing" })).toBeVisible();
  const still = await page.getByTestId("avatar").evaluate(el => (el as HTMLCanvasElement).toDataURL());
  const instructor = await page.getByTestId("instructor").evaluate(el => (el as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(1400);
  expect(await page.getByTestId("instructor").evaluate(el => (el as HTMLCanvasElement).toDataURL())).not.toBe(instructor);
  expect(await page.getByTestId("avatar").evaluate(el => (el as HTMLCanvasElement).toDataURL())).toBe(still);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-guided-progress", "0.000");
  await move(page, "neck-head", 5);
  await expect.poll(async () => +(await page.getByTestId("avatar").getAttribute("data-head-fade"))!).toBeGreaterThan(.1);
  await page.getByRole("button", { name: "Return to rest", exact: true }).click();
  await page.waitForTimeout(1400);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const partial = +(await page.getByTestId("avatar").getAttribute("data-head-fade"))!;
  expect(partial).toBeGreaterThan(.1); expect(partial).toBeLessThan(.8);
  const softened = await pixel(page, 300, 120);
  expect(softened[2]).toBeGreaterThan(67); expect(softened[2]).toBeLessThan(230);
  expect(await pixel(page, 300, 385)).toEqual([39, 154, 163, 255]);
  expect(await pixel(page, 254, 610)).toEqual([115, 153, 180, 255]);
  expect(await pixel(page, 300, 435)).toEqual([34, 34, 34, 255]);
  const pauseGuide = await page.getByTestId("instructor").evaluate(el => (el as HTMLCanvasElement).toDataURL());
  const pauseAvatar = await page.getByTestId("avatar").evaluate(el => (el as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(1100);
  expect(await page.getByTestId("instructor").evaluate(el => (el as HTMLCanvasElement).toDataURL())).toBe(pauseGuide);
  expect(await page.getByTestId("avatar").evaluate(el => (el as HTMLCanvasElement).toDataURL())).toBe(pauseAvatar);
  await page.screenshot({ path: "test-results/guided-partial.png", fullPage: true });
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  const saved = +(await page.getByTestId("avatar").getAttribute("data-head-fade"))!;
  await page.waitForTimeout(1200);
  await expect.poll(async () => +(await page.getByTestId("avatar").getAttribute("data-head-fade"))!).toBe(saved);
});
test("three activities advance automatically from forgiving motion and save the actual faded artwork", async ({ page }, testInfo) => {
  test.setTimeout(65000);
  await prepare(page);
  for (const [area, completedAttribute] of [["neck-head", "data-head-fade"], ["arms-back", "data-arms-fade"], ["legs-feet", "data-legs-fade"]]) {
    await expect(page.getByTestId("avatar")).toHaveAttribute("data-area", area);
    const started = Date.now();
    if (area !== "neck-head") await page.getByRole("button", { name: "Return to rest", exact: true }).click();
    while ((await page.getByTestId("avatar").getAttribute(completedAttribute)) !== "1.00" && Date.now() - started < 15000) await move(page, area, 2);
    await expect(page.getByTestId("avatar")).toHaveAttribute(completedAttribute, "1.00");
    await page.screenshot({ path: `test-results/guided-${area}.png`, fullPage: true });
    if (area !== "legs-feet") await expect(page.getByTestId("avatar")).not.toHaveAttribute("data-area", area, { timeout: 3000 });
  }
  await expect(page.getByTestId("guided-status")).toHaveText("Sequence completed", { timeout: 3000 });
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-guided-total", "1.000");
  await page.getByRole("button", { name: "Return to rest", exact: true }).click();
  await page.waitForTimeout(1200);
  expect((await pixel(page, 300, 120))[2]).toBeGreaterThan(230);
  expect((await pixel(page, 300, 385))[0]).toBeGreaterThan(235);
  expect((await pixel(page, 254, 610))[0]).toBeGreaterThan(235);
  expect(await pixel(page, 300, 435)).toEqual([34, 34, 34, 255]);
  expect(await pixel(page, 300, 509)).toEqual([211, 95, 164, 255]);
  const outline = await pixel(page, 300, 83);
  expect(outline[0]).toBeLessThan(180); expect(outline[3]).toBeGreaterThan(100);
  await page.screenshot({ path: "test-results/guided-sequence-completed.png", fullPage: true });
  const event = page.waitForEvent("download");
  await page.locator("details.secondary-controls > summary").click();
  await page.getByRole("button", { name: "Save PNG", exact: true }).click();
  const file = testInfo.outputPath("guided-result.png"); await (await event).saveAs(file);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const start = (435 * info.width + 420) * 4;
  expect(Array.from(data.subarray(start, start + 4))).toEqual([34, 34, 34, 255]);
  await page.getByRole("button", { name: "Replay sequence", exact: true }).click();
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-area", "neck-head");
  for (const attribute of ["data-head-fade", "data-arms-fade", "data-legs-fade"]) await expect(page.getByTestId("avatar")).toHaveAttribute(attribute, "0.00");
});
test("camera denial retains a guided manual fallback and an uncolored area does not stall participation", async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Denied test camera", "NotAllowedError"); }; });
  await page.goto("/");
  const blank = await sharp(Buffer.from(silhouetteSvg(false))).png().toBuffer();
  await upload(page, blank);
  await page.getByRole("button", { name: "Enable camera", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Camera permission was denied");
  await page.getByRole("combobox", { name: "Motion source", exact: true }).selectOption("manual");
  await page.getByRole("button", { name: "Start guided session", exact: true }).click();
  await expect(page.getByText("No colored marks here. Movement still counts.")).toBeVisible();
  await move(page, "neck-head", 4);
  await expect.poll(async () => +(await page.getByTestId("avatar").getAttribute("data-guided-progress"))!).toBeGreaterThan(.1);
});
test("both panels and activity feedback survive fullscreen and responsive layouts", async ({ page }) => {
  await page.goto("/"); await upload(page);
  await page.getByRole("button", { name: "Start guided session", exact: true }).click();
  await page.getByRole("button", { name: "Open installation fullscreen", exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBeTruthy();
  await expect(page.getByTestId("instructor")).toBeVisible();
  await expect(page.getByTestId("avatar")).toBeVisible();
  await expect(page.getByTestId("current-activity")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Activity progress", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Skip activity", exact: true }).last().click();
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-area", "arms-back");
  await expect(page.getByTestId("current-activity")).toContainText("reach overhead");
  await page.getByRole("button", { name: "Pause", exact: true }).last().click();
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-paused", "true");
  await page.getByRole("button", { name: "Reset experience", exact: true }).last().click();
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-area", "neck-head");
  await expect(page.getByTestId("art-source")).toHaveText("Uploaded drawing");
  await page.getByRole("button", { name: "Exit fullscreen", exact: true }).last().click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBeFalsy();
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await expect(page.getByTestId("instructor")).toBeVisible();
    await expect(page.getByTestId("avatar")).toBeVisible();
    const left = await page.getByTestId("instructor").boundingBox(), right = await page.getByTestId("avatar").boundingBox();
    if (width >= 768) expect(left!.x + left!.width).toBeLessThanOrEqual(right!.x);
    else expect(left!.y + left!.height).toBeLessThanOrEqual(right!.y);
    await page.screenshot({ path: `test-results/guided-layout-${width}.png`, fullPage: true });
  }
});
test("real MediaPipe static-camera replay does not earn progress from the visual instructor", async () => {
  const fixture = process.env.OOB_CAMERA_FIXTURE;
  test.skip(!fixture, "Set OOB_CAMERA_FIXTURE to the existing reference-photo Y4M replay.");
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${path.resolve(fixture!)}`] });
  const context = await browser.newContext({ permissions: ["camera"] });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:3201/"); await upload(page);
    await page.getByRole("button", { name: "Enable camera", exact: true }).click();
    await expect(page.getByText("Body found", { exact: true })).toBeVisible({ timeout: 30000 });
    const video = await page.getByLabel("Mirrored webcam preview").boundingBox();
    const caption = await page.locator(".camera-status").boundingBox();
    expect(caption!.y).toBeGreaterThanOrEqual(video!.y + video!.height);
    expect(video!.width / video!.height).toBeCloseTo(4 / 3, 1);
    await expect(page.getByText(/\d+ fps/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save PNG", exact: true })).not.toBeVisible();
    await page.screenshot({ path: "test-results/refined-camera.png", fullPage: true });
    await page.getByRole("button", { name: "Start guided session", exact: true }).click();
    await page.waitForTimeout(4500);
    await expect(page.getByTestId("avatar")).toHaveAttribute("data-guided-progress", "0.000");
    await expect(page.getByTestId("avatar")).toHaveAttribute("data-head-fade", "0.00");
    await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  } finally { await context.close(); await browser.close(); }
});
test("skip retains a partial fade without awarding completion; reset preserves the upload", async ({ page }) => {
  await prepare(page);
  await move(page, "neck-head", 3);
  const earned = +(await page.getByTestId("avatar").getAttribute("data-head-fade"))!;
  expect(earned).toBeGreaterThan(0); expect(earned).toBeLessThan(1);
  await page.getByRole("button", { name: "Skip activity", exact: true }).click();
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-area", "arms-back");
  const preserved = await page.getByTestId("avatar").getAttribute("data-head-fade");
  expect(+preserved!).toBeLessThan(1);
  await expect(page.getByTestId("current-activity")).toContainText("reach overhead");
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-arms-fade", "0.00");
  await page.getByRole("button", { name: "Skip activity", exact: true }).click();
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-area", "legs-feet");
  await expect(page.getByTestId("instructor")).toHaveAttribute("data-step", "side-step");
  await page.getByRole("button", { name: "Skip activity", exact: true }).click();
  await expect(page.getByTestId("guided-status")).toHaveText("Finished · 3 skipped");
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-head-fade", preserved!);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-arms-fade", "0.00");
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-legs-fade", "0.00");
  await page.getByRole("button", { name: "Reset experience", exact: true }).click();
  await expect(page.getByTestId("art-source")).toHaveText("Uploaded drawing");
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-area", "neck-head");
  for (const a of ["data-head-fade", "data-arms-fade", "data-legs-fade"]) await expect(page.getByTestId("avatar")).toHaveAttribute(a, "0.00");
  expect(await pixel(page, 300, 120)).toEqual([229, 181, 67, 255]);
  await expect(page.getByRole("button", { name: "Start guided session", exact: true })).toBeVisible();
});
