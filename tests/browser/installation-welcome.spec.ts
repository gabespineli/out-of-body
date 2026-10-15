import { test, expect } from "@playwright/test";
import QRCode from "qrcode";
import type { QueueState, QueueTicket } from "../../src/lib/queue";

test("the root opens the exhibit, /test preserves the local demo, and the previous installation address redirects", async ({ page }) => {
  await page.route("**/api/participant/queue?view=operator", route => route.fulfill({ status: 401, json: { error: "Unlock required" } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Open the exhibit queue", exact: true })).toBeVisible();
  const demo = page.getByRole("link", { name: "Local upload / Manual demo", exact: true });
  await expect(demo).toHaveAttribute("href", "/test"); await demo.click();
  await expect(page).toHaveURL(/\/test$/);
  await expect(page.getByTestId("art-upload")).toBeVisible();
  await page.getByRole("button", { name: "Try an example", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start guided session", exact: true })).toBeEnabled();
  await page.goto("/installation"); await expect(page).toHaveURL("http://127.0.0.1:3202/");
  await expect(page.getByRole("heading", { name: "Open the exhibit queue", exact: true })).toBeVisible();
});

test("unlock opens a centered permanent QR on the full exhibit background, without unused management controls", async ({ page }) => {
  await page.setViewportSize({ width: 1363, height: 783 });
  let unlocked = false;
  const qr = await QRCode.toDataURL("http://127.0.0.1:3202/mobile");
  const queue: QueueState = { tickets: [], active: null, called: null, waiting: 0, capacity: 20, accepting: true, online: true,
    mobileUrl: "http://127.0.0.1:3202/mobile", qr, downloadBytes: 0, downloads: 0, uploads: 0, usageWarning: false };
  await page.route("**/api/participant/queue?view=operator", route => unlocked ? route.fulfill({ json: queue }) : route.fulfill({ status: 401, json: { error: "Unlock required" } }));
  await page.route("**/api/participant/queue", route => { expect(route.request().headers().authorization).toBe("Bearer test-installation-key"); unlocked = true; return route.fulfill({ json: queue }); });
  await page.goto("/");
  await page.getByLabel("Installation key").fill("test-installation-key");
  await page.getByRole("button", { name: "Open installation", exact: true }).click();
  await expect(page.getByTestId("session-qr")).toBeVisible();
  await expect(page.getByTestId("queue-bar")).toHaveCount(0);
  await expect(page.getByText("Usage", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Call next", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("installation-welcome")).toContainText("Scan the permanent QR to upload.");
  const symbol = await page.getByTestId("session-qr").boundingBox();
  expect(symbol!.x + symbol!.width / 2).toBeCloseTo(1363 / 2, 0);
  expect(await page.getByTestId("desktop-flow").evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(783);
  expect(await page.getByTestId("desktop-flow").evaluate(el => getComputedStyle(el).backgroundImage)).toContain("exhibit-texture.webp");
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: "test-results/installation-empty-welcome.png", fullPage: true });
  for (const width of [320, 768, 1363]) { await page.setViewportSize({ width, height: 783 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.png?v=2");
});

test("waiting tickets automatically fill the head and show a single centered Start participant prompt", async ({ page }) => {
  const ticket: QueueTicket = { id: "2b2c4167-d1ea-4f9f-a720-698e90ca1d53", number: 7, name: "Alex", ahead: 0, status: "ready", createdAt: "2026-10-14T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z" };
  const queue: QueueState = { tickets: [ticket], active: null, called: null, waiting: 1, capacity: 20, accepting: true, online: true,
    mobileUrl: "http://127.0.0.1:3202/mobile", qr: await QRCode.toDataURL("http://127.0.0.1:3202/mobile"), downloadBytes: 0, downloads: 0, uploads: 0, usageWarning: false };
  await page.route("**/api/participant/queue?view=operator", route => route.fulfill({ json: queue }));
  await page.route("**/api/participant/queue/action", route => { expect(route.request().postDataJSON().action).toBe("call"); ticket.status = "called"; queue.called = ticket; return route.fulfill({ json: { cleanupPending: false } }); });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Call next", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Call .*later/ })).toHaveCount(0);
  await expect(page.getByText("Usage", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Alex, it’s your turn", exact: true })).toBeVisible();
  await expect(page.getByText("Come to the screen, then tap Start my session on your phone.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start participant", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("session-qr")).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: "test-results/installation-called-welcome.png", fullPage: true });
});
