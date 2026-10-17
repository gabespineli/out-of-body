import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { silhouetteSvg } from "../../src/lib/rig";

test.use({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });
async function editor(page: Page) {
  await page.route("**/api/participant/queue", route => route.fulfill({ json: { waiting: 1, capacity: 20, accepting: true, online: true } }));
  await page.route("**/api/participant/queue/ticket", route => route.fulfill({ json: { id: "2b2c4167-d1ea-4f9f-a720-698e90ca1d53", number: 7, name: "", ahead: 0, status: "preparing", expiresAt: "2099-01-01T00:00:00Z" } }));
  await page.goto("/mobile");
  await page.getByRole("button", { name: "Continue my drawing", exact: true }).click();
}
async function fits(page: Page, width: number, height: number, kind: string) {
  await page.setViewportSize({ width, height });
  const main = await page.getByTestId("mobile-flow").boundingBox();
  const frame = await page.locator(kind === "capture" ? ".phone-camera" : ".phone-photo").boundingBox();
  expect(frame!.x).toBeGreaterThanOrEqual(main!.x + 16);
  expect(frame!.x + frame!.width).toBeLessThanOrEqual(main!.x + main!.width - 16);
  expect(frame!.width / frame!.height).toBeCloseTo(2 / 3, 2);
  for (const label of kind === "capture" ? ["Open camera", "Cancel my ticket"] : ["Send to installation", "Retake / choose again", "Cancel my ticket"]) {
    const button = await page.getByRole("button", { name: label, exact: true }).boundingBox();
    expect(button!.y).toBeGreaterThanOrEqual(0);
    expect(button!.y + button!.height).toBeLessThanOrEqual(height + 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  expect(await page.getByTestId("mobile-flow").evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  if (width === 390 || width === 844) await page.screenshot({ path: `test-results/compact-${kind}-${width}x${height}.png`, fullPage: true });
}

test("capture and photo adjustment keep safe edges and actions visible without page scrolling", async ({ page }) => {
  await editor(page);
  for (const [width, height] of [[320,568],[390,664],[430,932],[844,390]]) await fits(page, width, height, "capture");
  const image = await sharp(Buffer.from(silhouetteSvg(true))).png().toBuffer();
  await page.getByTestId("mobile-photo").setInputFiles({ name: "layout.png", mimeType: "image/png", buffer: image });
  await page.getByRole("button", { name: "Tap to continue", exact: true }).click();
  for (const [width, height] of [[320,568],[390,664],[430,932],[844,390]]) await fits(page, width, height, "preview");
});

test("name entry and a smaller visual viewport retain the controls; Retake resets the gesture hint", async ({ page }) => {
  await editor(page);
  const image = await sharp(Buffer.from(silhouetteSvg(true))).png().toBuffer();
  await page.getByTestId("mobile-photo").setInputFiles({ name: "first.png", mimeType: "image/png", buffer: image });
  await page.getByRole("button", { name: "Tap to continue", exact: true }).click();
  await page.getByTestId("photo-alignment").press("ArrowRight");
  await expect(page.getByTestId("photo-gesture-cue")).toHaveCount(0);
  await page.getByLabel("Name", { exact: true }).fill("QA editor");
  await fits(page, 390, 400, "preview");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("QA editor");
  await page.getByRole("button", { name: "Retake / choose again", exact: true }).click();
  await page.getByTestId("mobile-photo").setInputFiles({ name: "second.png", mimeType: "image/png", buffer: image });
  await expect(page.getByTestId("photo-gesture-cue")).toBeVisible();
  await expect(page.getByTestId("photo-alignment")).toHaveAttribute("data-x", "0");
});

test("centered filled-hand onboarding covers the editor, then tap unlocks photo adjustment", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await editor(page);
  const image = await sharp(Buffer.from(silhouetteSvg(true))).png().toBuffer();
  await page.getByTestId("mobile-photo").setInputFiles({ name: "gesture-preview.png", mimeType: "image/png", buffer: image });
  const cue = page.getByTestId("photo-gesture-cue");
  await expect(cue).toBeVisible();
  await expect.poll(() => cue.locator("img").evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const open = cue.locator(".gesture-hand-open");
  await cue.locator(".gesture-hand").evaluateAll(images => images.forEach(el => { const animation = el.getAnimations()[0]; animation.pause(); animation.currentTime = 0; }));
  await expect(open).toHaveCSS("opacity", "0");
  await page.screenshot({ path: "test-results/filled-hand-closed-phone.png", fullPage: true });
  await cue.locator(".gesture-hand").evaluateAll(images => images.forEach(el => { el.getAnimations()[0].currentTime = 1500; }));
  await expect(cue.locator(".gesture-hand-closed")).toHaveCSS("opacity", "0");
  await expect(open).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "test-results/filled-hand-open-phone.png", fullPage: true });
  await fits(page, 390, 664, "preview");
  await page.screenshot({ path: "test-results/filled-hand-compact-phone.png", fullPage: true });
  const layer = (await cue.boundingBox())!;
  expect(layer.x).toBe(0); expect(layer.y).toBe(0);
  expect(layer.width).toBe(390); expect(layer.height).toBe(664);
  const hand = (await cue.locator(".gesture-hand-frames").boundingBox())!;
  expect(hand.x + hand.width / 2).toBeCloseTo(195, 0);
  await expect(page.getByRole("button", { name: "Tap to continue", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Tap to continue", exact: true }).click();
  await expect(page.getByTestId("photo-alignment")).toHaveAttribute("data-x", "0");
  await expect(page.getByTestId("photo-alignment")).toBeFocused();
  await page.screenshot({ path: "test-results/filled-hand-dismissed-phone.png", fullPage: true });
  await page.getByTestId("photo-alignment").press("ArrowRight");
  await expect(cue).toHaveCount(0);
});


test("onboarding keeps keyboard focus, supports Escape and background tap, and fits landscape", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await editor(page);
  const image = await sharp(Buffer.from(silhouetteSvg(true))).png().toBuffer();
  await page.getByTestId("mobile-photo").setInputFiles({ name: "onboarding.png", mimeType: "image/png", buffer: image });
  const layer = page.getByTestId("photo-gesture-cue"), proceed = page.getByRole("button", { name: "Tap to continue", exact: true });
  await expect(proceed).toBeFocused();
  await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
  await expect(proceed).toBeFocused();
  await page.keyboard.press("Escape"); await expect(layer).toHaveCount(0);
  await expect(page.getByTestId("photo-alignment")).toBeFocused();
  await page.getByRole("button", { name: "Retake / choose again", exact: true }).click();
  await page.getByTestId("mobile-photo").setInputFiles({ name: "again.png", mimeType: "image/png", buffer: image });
  await expect(layer).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  const button = (await proceed.boundingBox())!;
  expect(button.y + button.height).toBeLessThanOrEqual(390);
  expect(await layer.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  await page.mouse.click(10, 10); await expect(layer).toHaveCount(0);
  await expect(page.getByTestId("photo-alignment")).toHaveAttribute("data-x", "0");
});
