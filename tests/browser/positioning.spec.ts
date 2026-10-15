import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { silhouetteSvg } from "../../src/lib/rig";
import { trackedCamera, standingPoints, setPoints } from "./fixtures/tracked-camera";
async function setup(page: Page, legs = false, fullscreen = false) {
  await trackedCamera(page); await page.goto("/test");
  const svg = silhouetteSvg(false).replace("</svg>", '<rect x="280" y="110" width="40" height="30" fill="#e5b543"/>' + (legs ? '<rect x="240" y="590" width="30" height="30" fill="#7399b4"/>' : '') + '</svg>');
  await page.getByTestId("art-upload").setInputFiles({ name: "position.png", mimeType: "image/png", buffer: await sharp(Buffer.from(svg)).png().toBuffer() });
  if (fullscreen) { await page.getByText("Setup tools", { exact: true }).click(); await page.getByRole("button", { name: "Fullscreen", exact: true }).click(); }
  await page.getByRole("button", { name: "Start guided session", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Get into position", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Enable camera", exact: true }).click();
}
async function start(page: Page) { await setup(page); await expect(page.getByTestId("positioning-countdown")).toBeVisible({ timeout: 10000 }); await expect(page.getByTestId("guided-shell")).toHaveAttribute("data-phase", "stretching", { timeout: 5000 }); }
async function moveHead(page: Page, count = 4) { for (let i=0;i<count;i++) { const p=standingPoints(); p[8].y += i%2 ? .045 : -.045; await setPoints(page,p); await page.waitForTimeout(400); } }

test("a centered 3-2-1 countdown resets when position is lost and automatically starts only after stabilizing", async ({ page }) => {
  await setup(page);
  const count = page.getByTestId("positioning-countdown").locator("strong");
  await expect(count).toHaveText("3"); await expect(count).toHaveText("2", { timeout: 2500 });
  await setPoints(page, []); await expect(page.getByTestId("positioning-countdown")).toHaveCount(0);
  await expect(page.getByTestId("guided-shell")).toHaveAttribute("data-phase", "positioning");
  await setPoints(page, standingPoints()); await expect(count).toHaveText("3");
  const badge = await page.getByTestId("positioning-countdown").boundingBox(), camera = await page.locator(".positioning-preview").boundingBox();
  expect(badge!.x + badge!.width / 2).toBeCloseTo(camera!.x + camera!.width / 2, 0);
  expect(badge!.y + badge!.height / 2).toBeCloseTo(camera!.y + camera!.height / 2, 0);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-guided-total", "0.000");
  await page.screenshot({ path: "test-results/positioning-countdown.png", fullPage: true });
  await expect(count).toHaveText("2", { timeout: 2500 }); await expect(count).toHaveText("1", { timeout: 2500 });
  await expect(page.getByTestId("guided-shell")).toHaveAttribute("data-phase", "stretching", { timeout: 2500 });
});

test("hidden tabs and leaving positioning discard the countdown instead of starting later", async ({ page }) => {
  await setup(page); await expect(page.getByTestId("positioning-countdown")).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(3200); await expect(page.getByTestId("guided-shell")).toHaveAttribute("data-phase", "positioning");
  await expect(page.getByTestId("positioning-countdown")).toHaveCount(0);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.getByTestId("positioning-countdown").locator("strong")).toHaveText("3");
  await page.getByRole("button", { name: "Back to setup", exact: true }).click();
  await page.waitForTimeout(3200); await expect(page.getByTestId("guided-shell")).toHaveAttribute("data-phase", "setup");
  expect(await page.getByLabel("Positioning camera preview").evaluate(el => (el as HTMLVideoElement).srcObject)).toBeNull();
});
test("positioning requires steady in-frame tracking, and keeps one hidden camera alive during stretching", async ({ page }) => {
  await setup(page, true, true); await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  const p=standingPoints(); p[27].y=1.1; await setPoints(page,p);
  await page.waitForTimeout(2400); await expect(page.getByTestId("positioning-countdown")).toHaveCount(0);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-guided-total", "0.000");
  await setPoints(page,standingPoints()); await expect(page.getByTestId("positioning-countdown")).toBeVisible();
  await page.waitForTimeout(900); await expect(page.getByTestId("guided-shell")).toHaveAttribute("data-phase", "positioning");
  await expect(page.getByRole("button", { name: "Start stretching", exact: true })).toHaveCount(0);
  await page.screenshot({ path: "test-results/positioning-gate.png", fullPage: true });
  const video=page.getByLabel("Positioning camera preview");
  await expect(page.getByTestId("guided-shell")).toHaveAttribute("data-phase", "stretching", { timeout: 4000 });
  await expect(page.getByTestId("positioning-gate")).toHaveClass("background-tracker");
  expect(await video.evaluate(el => (el as HTMLVideoElement).srcObject instanceof MediaStream)).toBe(true);
  await expect(page.locator("video")).toHaveCount(1);
  await expect(page.getByTestId("stretch-exhibit").getByRole("button")).toHaveCount(4);
  await expect(page.getByTestId("stretch-exhibit")).toContainText("Your Guide");
  await expect(page.getByRole("combobox", { name: "Motion source" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/quiet-stretching.png", fullPage: true });
  await page.keyboard.press("Escape"); await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
});
test("tracking loss freezes progress and instructor, then resumes automatically after stable return", async ({ page }) => {
  await start(page); await moveHead(page); await expect.poll(async () => +(await page.getByTestId("avatar").getAttribute("data-neck-head-fade"))!).toBeGreaterThan(.05);
  await setPoints(page, []); await expect(page.getByTestId("tracking-notice")).toBeVisible();
  const earned = await page.getByTestId("avatar").getAttribute("data-neck-head-fade");
  const frame = await page.getByTestId("instructor").evaluate(el => (el as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(800); await expect(page.getByTestId("avatar")).toHaveAttribute("data-neck-head-fade", earned!);
  expect(await page.getByTestId("instructor").evaluate(el => (el as HTMLCanvasElement).toDataURL())).toBe(frame);
  await setPoints(page, standingPoints()); await page.waitForTimeout(800);
  await expect(page.getByTestId("tracking-notice")).toBeVisible();
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-neck-head-fade", earned!);
  await page.screenshot({ path: "test-results/automatic-recovery.png", fullPage: true });
  await expect(page.getByTestId("tracking-notice")).toHaveCount(0, { timeout: 3000 });
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toHaveCount(0);
  await moveHead(page); expect(+(await page.getByTestId("avatar").getAttribute("data-neck-head-fade"))!).toBeGreaterThan(+earned!);
});

test("brief loss avoids notice flicker and Restart returns to the larger position preview", async ({ page }) => {
  await start(page); await moveHead(page, 3); await setPoints(page, []); await page.waitForTimeout(300); await setPoints(page, standingPoints());
  await page.waitForTimeout(300); await expect(page.getByTestId("tracking-notice")).toHaveCount(0);
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.getByTestId("positioning-gate")).toHaveClass("positioning-gate");
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-guided-total", "0.000");
});

test("manual Pause stays paused through automatic recovery and home confirmation releases the camera", async ({ page }) => {
  await start(page); await page.getByRole("button", { name: "Pause", exact: true }).click(); await setPoints(page, []);
  await expect(page.getByTestId("tracking-notice")).toBeVisible(); await setPoints(page, standingPoints());
  await expect(page.getByTestId("tracking-notice")).toHaveCount(0, { timeout: 4000 });
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to home", exact: true }).click();
  await expect(page.getByRole("button", { name: "Keep stretching", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Keep stretching", exact: true }).press("Escape");
  await expect(page.getByTestId("guided-shell")).toHaveAttribute("data-phase", "stretching");
  await page.getByRole("button", { name: "Back to home", exact: true }).click();
  await page.getByRole("button", { name: "End turn and go home", exact: true }).click();
  await expect(page.getByTestId("guided-shell")).toHaveAttribute("data-phase", "setup");
  expect(await page.getByLabel("Positioning camera preview").evaluate(el => (el as HTMLVideoElement).srcObject)).toBeNull();
});

test("tracking notice never traps focus or blocks Back to home", async ({ page }) => {
  await start(page); await page.getByRole("button", { name: "Pause", exact: true }).click();
  await setPoints(page, []); await expect(page.getByTestId("tracking-notice")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check position", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Back to home", exact: true }).click();
  await page.getByRole("button", { name: "Keep stretching", exact: true }).click();
  await expect(page.getByTestId("tracking-notice")).toBeVisible();
});

test("home confirmation freezes progress until Keep stretching or Escape", async ({ page }) => {
  await start(page); await moveHead(page, 2);
  await page.getByRole("button", { name: "Back to home", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const earned = await page.getByTestId("avatar").getAttribute("data-neck-head-fade");
  await moveHead(page, 3);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-neck-head-fade", earned!);
  await page.getByRole("button", { name: "Keep stretching", exact: true }).press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await moveHead(page, 3);
  expect(+(await page.getByTestId("avatar").getAttribute("data-neck-head-fade"))!).toBeGreaterThan(+earned!);
});
