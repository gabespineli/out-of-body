import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { silhouetteSvg } from "../../src/lib/rig";
import { trackedCamera, standingPoints, setPoints } from "./fixtures/tracked-camera";
async function setup(page: Page, legs = false, fullscreen = false) {
  await trackedCamera(page); await page.goto("/");
  const svg = silhouetteSvg(false).replace("</svg>", '<rect x="280" y="110" width="40" height="30" fill="#e5b543"/>' + (legs ? '<rect x="240" y="590" width="30" height="30" fill="#7399b4"/>' : '') + '</svg>');
  await page.getByTestId("art-upload").setInputFiles({ name: "position.png", mimeType: "image/png", buffer: await sharp(Buffer.from(svg)).png().toBuffer() });
  if (fullscreen) { await page.getByText("Setup tools", { exact: true }).click(); await page.getByRole("button", { name: "Fullscreen", exact: true }).click(); }
  await page.getByRole("button", { name: "Start guided session", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Get into position", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Enable camera", exact: true }).click();
}
async function start(page: Page) { await setup(page); await expect(page.getByRole("button", { name: "Start stretching", exact: true })).toBeEnabled({ timeout: 10000 }); await page.getByRole("button", { name: "Start stretching", exact: true }).click(); }
async function moveHead(page: Page, count = 4) { for (let i=0;i<count;i++) { const p=standingPoints(); p[8].y += i%2 ? .045 : -.045; await setPoints(page,p); await page.waitForTimeout(400); } }
test("positioning requires steady in-frame tracking, and keeps one hidden camera alive during stretching", async ({ page }) => {
  await setup(page, true, true); await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  const p=standingPoints(); p[27].y=1.1; await setPoints(page,p);
  await page.waitForTimeout(2400); await expect(page.getByRole("button", { name: "Start stretching", exact: true })).toBeDisabled();
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-guided-total", "0.000");
  await setPoints(page,standingPoints()); await page.waitForTimeout(900); await expect(page.getByRole("button", { name: "Start stretching", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Start stretching", exact: true })).toBeEnabled({ timeout: 4000 });
  await page.screenshot({ path: "test-results/positioning-gate.png", fullPage: true });
  const video=page.getByLabel("Positioning camera preview");
  await page.getByRole("button", { name: "Start stretching", exact: true }).click();
  await expect(page.getByTestId("positioning-gate")).toHaveClass("background-tracker");
  expect(await video.evaluate(el => (el as HTMLVideoElement).srcObject instanceof MediaStream)).toBe(true);
  await expect(page.locator("video")).toHaveCount(1);
  await expect(page.getByTestId("stretch-exhibit").getByRole("button")).toHaveCount(4);
  await expect(page.getByTestId("stretch-exhibit")).toContainText("Your Guide");
  await expect(page.getByRole("combobox", { name: "Motion source" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/quiet-stretching.png", fullPage: true });
  await page.keyboard.press("Escape"); await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
});
test("tracking loss freezes earned progress and instructor, requires stable recovery and explicit Continue", async ({ page }) => {
  await start(page); await moveHead(page); await expect.poll(async () => +(await page.getByTestId("avatar").getAttribute("data-neck-head-fade"))!).toBeGreaterThan(.05);
  await setPoints(page,[]); await expect(page.getByTestId("tracking-prompt")).toBeVisible({ timeout: 2500 });
  const earned=await page.getByTestId("avatar").getAttribute("data-neck-head-fade"), loop=await page.getByTestId("instructor").getAttribute("data-loop-time");
  const shot=await page.getByTestId("instructor").evaluate(el=>(el as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(1000); await expect(page.getByTestId("avatar")).toHaveAttribute("data-neck-head-fade",earned!);
  expect(await page.getByTestId("instructor").evaluate(el=>(el as HTMLCanvasElement).toDataURL())).toBe(shot);
  await setPoints(page,standingPoints()); await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled({ timeout: 4000 });
  await expect(page.getByTestId("tracking-prompt")).toBeVisible(); await expect(page.getByTestId("avatar")).toHaveAttribute("data-neck-head-fade",earned!);
  await page.screenshot({ path: "test-results/tracking-recovery.png", fullPage: true });
  await page.getByRole("button", { name: "Continue", exact: true }).click(); await expect(page.getByTestId("tracking-prompt")).toHaveCount(0);
  await moveHead(page); expect(+(await page.getByTestId("avatar").getAttribute("data-neck-head-fade"))!).toBeGreaterThan(+earned!);
});
test("brief loss avoids prompt flicker; Check position preserves progress and Restart clears it", async ({ page }) => {
  await start(page); await moveHead(page,3); await setPoints(page,[]); await page.waitForTimeout(300); await setPoints(page,standingPoints());
  await page.waitForTimeout(300); await expect(page.getByTestId("tracking-prompt")).toHaveCount(0);
  await setPoints(page,[]); await expect(page.getByTestId("tracking-prompt")).toBeVisible();
  const earned=await page.getByTestId("avatar").getAttribute("data-neck-head-fade");
  await page.getByRole("button", { name: "Check position", exact: true }).click(); await expect(page.getByTestId("positioning-gate")).toHaveClass("positioning-gate");
  await setPoints(page,standingPoints()); await expect(page.getByRole("button", { name: "Start stretching", exact: true })).toBeEnabled({ timeout: 4000 });
  await page.getByRole("button", { name: "Start stretching", exact: true }).click(); await expect(page.getByTestId("avatar")).toHaveAttribute("data-neck-head-fade",earned!);
  await page.getByRole("button", { name: "Restart", exact: true }).click(); await expect(page.getByTestId("positioning-gate")).toHaveClass("positioning-gate");
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-guided-total","0.000");
});
test("manual Pause remains paused after tracking recovery, and Skip Turn releases the camera", async ({ page }) => {
  await start(page); await page.getByRole("button", { name: "Pause", exact: true }).click(); await setPoints(page,[]);
  await expect(page.getByTestId("tracking-prompt")).toBeVisible(); await setPoints(page,standingPoints());
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled({ timeout: 4000 }); await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Skip Turn", exact: true }).click();
  await expect(page.getByTestId("guided-shell")).toHaveAttribute("data-phase","setup");
  expect(await page.getByLabel("Positioning camera preview").evaluate(el => (el as HTMLVideoElement).srcObject)).toBeNull();
});

test("tracking recovery keeps keyboard focus inside the prompt and returns it to Pause", async ({ page }) => {
  await start(page); await page.getByRole("button", { name: "Pause", exact: true }).click();
  await setPoints(page, []); await expect(page.getByTestId("tracking-prompt")).toBeVisible();
  await expect(page.getByTestId("tracking-prompt")).toBeFocused();
  await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Check position", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(page.getByRole("button", { name: "Check position", exact: true })).toBeFocused();
  await setPoints(page, standingPoints()); await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled({ timeout: 4000 });
  await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(page.getByRole("button", { name: "Check position", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeFocused();
});
