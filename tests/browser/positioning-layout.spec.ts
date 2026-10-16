import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { silhouetteSvg } from "../../src/lib/rig";
import { trackedCamera, setPoints } from "./fixtures/tracked-camera";

test("camera setup leaves the picker and recovery controls visible beneath the real queue bar", async ({ page }) => {
  await trackedCamera(page);
  const active = { id: "2b2c4167-d1ea-4f9f-a720-698e90ca1d53", number: 7, name: "QA camera layout", ahead: 0, status: "active", createdAt: "2026-10-16T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z" };
  await page.route("**/api/participant/queue?view=operator", route => route.fulfill({ json: {
    tickets: [active], active, called: null, waiting: 0, capacity: 20, accepting: true, online: true,
    mobileUrl: "/mobile", qr: "", downloadBytes: 0, downloads: 0, uploads: 0, usageWarning: false,
  } }));
  const image = await sharp(Buffer.from(silhouetteSvg(true))).png().toBuffer();
  await page.route("**/api/participant/queue/artwork?*", route => route.fulfill({ contentType: "image/png", body: image }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Get into position", exact: true })).toBeVisible();
  await setPoints(page, []);
  await page.getByRole("button", { name: "Enable camera", exact: true }).click();
  await expect(page.locator(".positioning-placeholder")).toHaveCount(0);
  for (const [width, height] of [[1363,783],[1920,1080],[2240,1260]]) {
    await page.setViewportSize({ width, height });
    await expect(page.getByTestId("queue-bar")).toBeVisible();
    const preview = await page.locator(".positioning-preview").boundingBox();
    const picker = await page.getByRole("combobox", { name: "Choose camera" }).boundingBox();
    const back = await page.getByRole("button", { name: "Back to setup", exact: true }).boundingBox();
    const skip = await page.getByRole("button", { name: "Skip participant", exact: true }).boundingBox();
    expect(preview!.height).toBeLessThanOrEqual(height * .8 + 1);
    expect(preview!.height).toBeGreaterThanOrEqual(height * .4);
    expect(picker!.y).toBeGreaterThanOrEqual(preview!.y + preview!.height);
    expect(back!.y + back!.height).toBeLessThanOrEqual(height);
    expect(skip!.y + skip!.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1363) await page.screenshot({ path: "test-results/positioning-controls-fit.png", fullPage: true });
  }
});
