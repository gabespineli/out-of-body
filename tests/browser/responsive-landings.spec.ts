import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { silhouetteSvg } from "../../src/lib/rig";

// These layout fixtures never read or modify the running exhibit's queue.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", route => route.abort("blockedbyclient"));
});

test("phone entry keeps the logo and both actions in view on short, portrait and landscape windows", async ({ page }) => {
  await page.route("**/api/participant/queue", route => route.fulfill({ json: { waiting: 1, capacity: 20, accepting: true, online: true } }));
  await page.route("**/api/participant/queue/ticket", route => route.fulfill({ status: 401, json: { error: "No ticket" } }));
  await page.goto("/mobile");
  await expect(page.getByRole("button", { name: "Upload drawing", exact: true })).toBeEnabled();
  await page.evaluate(async () => { await document.fonts.ready; });
  for (const [width, height] of [[320,568],[360,640],[390,664],[430,932],[844,390],[1445,900]]) {
    await page.setViewportSize({ width, height });
    const logo = await page.locator(".mobile-brand .brand-logo").boundingBox();
    const upload = await page.getByRole("button", { name: "Upload drawing", exact: true }).boundingBox();
    const about = await page.getByRole("button", { name: "About Out of Body", exact: true }).boundingBox();
    const status = await page.locator(".intake-status").boundingBox();
    // The square logo asset contains transparent padding; test painted content's separation via the action row.
    expect(logo!.y).toBeGreaterThanOrEqual(14);
    expect(logo!.height).toBeGreaterThanOrEqual(112);
    expect(upload!.height).toBeGreaterThanOrEqual(44);
    expect(upload!.height).toBeLessThanOrEqual(56);
    expect(upload!.y + upload!.height).toBeLessThan(about!.y);
    expect(about!.y + about!.height).toBeLessThan(status!.y);
    expect(status!.y + status!.height).toBeLessThanOrEqual(height - 16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
    if (width === 320 || width === 844 || width === 430) await page.screenshot({ path: `test-results/phone-landing-${width}x${height}.png`, fullPage: true });
  }
});

test("empty exhibit fills large displays without squeezing its panels or cropping the sample bodies", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/participant/queue?view=operator", route => route.fulfill({ json: { tickets: [], active: null, called: null, waiting: 0, capacity: 20, online: true, accepting: true, qr: "", mobileUrl: "/mobile" } }));
  await page.goto("/");
  await expect(page.getByTestId("demo-drawing")).toHaveAttribute("data-demo-fade", "0.000");
  await page.evaluate(async () => { await document.fonts.ready; });
  for (const [width, height] of [[1280,720],[1440,900],[1920,1080],[2240,1260],[2560,1440],[3840,2160]]) {
    await page.setViewportSize({ width, height });
    const panels = await page.locator(".idle-exhibit .exhibit-panels").boundingBox();
    const caption = await page.locator(".demo-caption").boundingBox();
    expect(panels!.width).toBeGreaterThanOrEqual(Math.min(width * .75, 2160));
    expect(caption!.y + caption!.height).toBeLessThanOrEqual(height - 16);
    for (const selector of [".exhibit-guide", ".exhibit-drawing"]) {
      const panel = page.locator(`.idle-exhibit ${selector}`);
      const heading = await panel.locator("h2").boundingBox();
      const info = await panel.locator(".exhibit-panel-info").boundingBox();
      const canvas = await panel.locator("canvas").boundingBox();
      expect(canvas!.height).toBeGreaterThan(200);
      expect(heading!.y + heading!.height).toBeLessThanOrEqual(info!.y + 1);
      expect(info!.y + info!.height).toBeLessThanOrEqual(canvas!.y + 1);
      expect(canvas!.y + canvas!.height).toBeLessThan(caption!.y);
      const stage = await panel.locator(".stage-pane").boundingBox();
      expect(canvas!.x).toBeGreaterThanOrEqual(stage!.x - 1);
      expect(canvas!.x + canvas!.width).toBeLessThanOrEqual(stage!.x + stage!.width + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
    if (width === 1440 || width === 2240) await page.screenshot({ path: `test-results/exhibit-landing-${width}x${height}.png`, fullPage: true });
  }
});

test("active stretching retains the same roomy panels on large host displays", async ({ page }) => {
  await page.goto("/test");
  const image = await sharp(Buffer.from(silhouetteSvg(false).replace("</svg>", '<rect x="280" y="110" width="40" height="30" fill="#e5b543"/></svg>'))).png().toBuffer();
  await page.getByTestId("art-upload").setInputFiles({ name: "neck.png", mimeType: "image/png", buffer: image });
  await page.getByText("Setup tools", { exact: true }).click();
  await page.getByRole("combobox", { name: "Motion source", exact: true }).selectOption("manual");
  await page.getByRole("button", { name: "Start guided session", exact: true }).click();
  await expect(page.getByTestId("stretch-exhibit")).toBeVisible();
  for (const [width, height] of [[1440,900],[1920,1080],[2240,1260],[2560,1440]]) {
    await page.setViewportSize({ width, height });
    const panels = await page.locator(".exhibit-panels").boundingBox();
    expect(panels!.width).toBeGreaterThanOrEqual(Math.min(width * .85, 2160));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
    if (width === 2240) await page.screenshot({ path: "test-results/stretching-large-host.png", fullPage: true });
  }
});
