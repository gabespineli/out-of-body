import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { silhouetteSvg } from "../../src/lib/rig";
import type { TicketStatus } from "../../src/lib/queue";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
async function phone(page: Page, status: TicketStatus | null = null) {
  const state = { status, joins: 0, sends: 0, cancels: 0, offline: false, uploadError: "", cancelError: "", lostUpload: false, full: false, lostJoin: false };
  const ticket = () => ({ id: "2b2c4167-d1ea-4f9f-a720-698e90ca1d53", number: 7, name: "Alex", ahead: 1,
    status: state.status, createdAt: "2026-10-14T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z" });
  await page.route("**/api/participant/queue", route => state.offline
    ? route.fulfill({ status: 503, json: { error: "Connection interrupted. Retrying…" } })
    : route.fulfill({ json: { waiting: state.full ? 20 : 1, capacity: 20, accepting: !state.full, online: true } }));
  await page.route("**/api/participant/queue/ticket", route => {
    if (route.request().method() === "POST") {
      state.joins++; state.status = "preparing";
      if (state.lostJoin) return route.abort("failed");
    }
    if (route.request().method() === "DELETE") {
      state.cancels++;
      if (state.cancelError) return route.fulfill({ status: 503, json: { error: state.cancelError } });
      state.status = "cancelled";
    }
    return state.status ? route.fulfill({ json: ticket() }) : route.fulfill({ status: 401, json: { error: "No ticket" } });
  });
  await page.route("**/api/participant/queue/upload", route => {
    state.sends++;
    if (state.uploadError) return route.fulfill({ status: 503, json: { error: state.uploadError } });
    state.status = "ready";
    return state.lostUpload ? route.abort("failed") : route.fulfill({ json: ticket() });
  });
  return state;
}
async function prepare(page: Page) {
  await page.goto("/mobile");
  await page.getByRole("button", { name: /Upload drawing|Continue my drawing/ }).click();
  const image = await sharp(Buffer.from(silhouetteSvg(false).replace("</svg>", '<rect x="256" y="324" width="87" height="130" fill="#279aa3"/></svg>'))).png().toBuffer();
  await page.getByTestId("mobile-photo").setInputFiles({ name: "drawing.png", mimeType: "image/png", buffer: image });
  await expect(page.getByTestId("mobile-preview")).toBeVisible();
}

test("cancellation confirmation preserves the preview on Keep or Escape and cancels only after confirmation", async ({ page }) => {
  const state = await phone(page); await prepare(page);
  await page.getByLabel("Name", { exact: true }).fill("Alex");
  const preview = await page.getByTestId("mobile-preview").evaluate(el => (el as HTMLCanvasElement).toDataURL());
  const cancelButton = page.getByRole("button", { name: "Cancel my ticket", exact: true });
  await cancelButton.click();
  await expect(page.getByRole("dialog", { name: "Cancel your ticket?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep my ticket", exact: true })).toBeFocused();
  expect(state.cancels).toBe(0);
  await page.screenshot({ path: "test-results/mobile-cancel-confirmation.png", fullPage: true });
  await page.getByRole("button", { name: "Keep my ticket", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0); await expect(cancelButton).toBeFocused();
  expect(await page.getByTestId("mobile-preview").evaluate(el => (el as HTMLCanvasElement).toDataURL())).toBe(preview);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Alex");
  await cancelButton.click(); await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0); expect(state.cancels).toBe(0);
  await cancelButton.click(); await page.getByRole("button", { name: "Yes, cancel ticket", exact: true }).click();
  await expect(page.getByRole("button", { name: "Upload drawing", exact: true })).toBeEnabled();
  expect(state.cancels).toBe(1);
});

test("ticket expiry closes an open cancellation prompt without cancelling a replacement ticket", async ({ page }) => {
  await page.clock.install(); const state = await phone(page); await prepare(page);
  await page.getByRole("button", { name: "Cancel my ticket", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  state.status = "expired"; await page.clock.runFor(15001);
  await expect(page.getByRole("dialog")).toHaveCount(0); expect(state.cancels).toBe(0);
  await page.getByRole("button", { name: "Back to home", exact: true }).click();
  await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
  await expect(page.getByTestId("mobile-photo")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0); expect(state.cancels).toBe(0);
});

test("phone reconnect removes its old connection warning and re-enables intake", async ({ page }) => {
  await page.clock.install(); const state = await phone(page); state.offline = true;
  await page.goto("/mobile"); await expect(page.locator("p[role=alert]")).toContainText("Connection interrupted");
  state.offline = false; await page.clock.runFor(30001);
  await expect(page.getByRole("button", { name: "Upload drawing", exact: true })).toBeEnabled();
  await page.screenshot({ path: "test-results/usability-phone-reconnect.png", fullPage: true });
  await expect(page.locator("p[role=alert]")).toHaveCount(0);
});

test("a failed upload keeps its preview and actionable error through status polling, then retries", async ({ page }) => {
  await page.clock.install(); const state = await phone(page); await prepare(page);
  await page.getByLabel("Name").fill("Retry Alex");
  state.uploadError = "Drawing storage unavailable. Please retry.";
  await page.getByRole("button", { name: "Send to installation", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText(state.uploadError);
  const pixels = await page.getByTestId("mobile-preview").evaluate(el => (el as HTMLCanvasElement).toDataURL());
  await page.clock.runFor(15001);
  await page.screenshot({ path: "test-results/usability-upload-retry.png", fullPage: true });
  await expect(page.locator("p[role=alert]")).toContainText(state.uploadError);
  expect(await page.getByTestId("mobile-preview").evaluate(el => (el as HTMLCanvasElement).toDataURL())).toBe(pixels);
  await expect(page.getByLabel("Name")).toHaveValue("Retry Alex");
  state.uploadError = ""; await page.getByRole("button", { name: "Send to installation", exact: true }).click();
  await expect(page.getByTestId("queue-ticket")).toBeVisible(); await expect(page.locator("p[role=alert]")).toHaveCount(0);
  expect(state.sends).toBe(2); expect(state.joins).toBe(1);
});

test("a failed cancellation keeps the ticket and warning until a successful retry", async ({ page }) => {
  await page.clock.install(); const state = await phone(page, "ready"); await page.goto("/mobile");
  state.cancelError = "Cancellation unavailable. Please retry.";
  await page.getByRole("button", { name: "Cancel my ticket", exact: true }).click();
  await page.getByRole("button", { name: "Yes, cancel ticket", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText(state.cancelError);
  await page.clock.runFor(15001); await expect(page.locator("p[role=alert]")).toContainText(state.cancelError);
  await expect(page.getByTestId("queue-ticket")).toContainText("Ticket 7");
  state.cancelError = ""; await page.getByRole("button", { name: "Cancel my ticket", exact: true }).click();
  await page.getByRole("button", { name: "Yes, cancel ticket", exact: true }).click();
  await expect(page.getByRole("button", { name: "Upload drawing", exact: true })).toBeEnabled();
  await expect(page.locator("p[role=alert]")).toHaveCount(0); expect(state.cancels).toBe(2);
});

test("an uploaded drawing is recovered after its response is lost without a second upload", async ({ page }) => {
  await page.clock.install(); const state = await phone(page); await prepare(page); state.lostUpload = true;
  await page.getByRole("button", { name: "Send to installation", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toBeVisible(); await page.clock.runFor(15001);
  await expect(page.getByTestId("queue-ticket")).toContainText("Ticket 7");
  await expect(page.locator("p[role=alert]")).toHaveCount(0); expect(state.sends).toBe(1);
});

test("a lost reservation response recovers the same ticket and lets the phone continue", async ({ page }) => {
  await page.clock.install(); const state = await phone(page); state.lostJoin = true;
  await page.goto("/mobile"); await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toBeVisible(); await page.clock.runFor(15001);
  await page.getByRole("button", { name: "Continue my drawing", exact: true }).click();
  await expect(page.getByTestId("mobile-photo")).toBeVisible(); await expect(page.locator("p[role=alert]")).toHaveCount(0);
  expect(state.joins).toBe(1);
});

test("ticket expiry during preview discards the photo and permits a fresh reservation", async ({ page }) => {
  await page.clock.install(); const state = await phone(page); await prepare(page);
  state.status = "expired"; await page.clock.runFor(15001);
  await expect(page.getByRole("heading", { name: "Your ticket expired", exact: true })).toBeVisible();
  await expect(page.getByTestId("mobile-preview")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to home", exact: true }).click();
  await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
  await expect(page.getByTestId("mobile-photo")).toBeVisible(); expect(state.joins).toBe(2);
});

for (const status of ["preparing", "ready", "called", "active"] as const) {
  test(`reloading a ${status} ticket in a full queue restores it without a new reservation`, async ({ page }) => {
    const state = await phone(page, status); state.full = true; await page.goto("/mobile");
    if (status === "preparing") await page.getByRole("button", { name: "Continue my drawing", exact: true }).click();
    else await expect(page.getByTestId("queue-ticket")).toBeVisible();
    await page.reload();
    if (status === "preparing") await page.getByRole("button", { name: "Continue my drawing", exact: true }).click();
    else await expect(page.getByTestId("queue-ticket")).toContainText("Ticket 7");
    expect(state.joins).toBe(0);
  });
}

test("About and home preserve an existing ticket while it is called", async ({ page }) => {
  await page.clock.install(); const state = await phone(page, "ready"); await page.goto("/mobile");
  await page.getByRole("button", { name: "Back to home", exact: true }).click();
  await page.getByRole("button", { name: "About Out of Body", exact: true }).click();
  state.status = "called"; await page.clock.runFor(15001);
  await expect(page.getByRole("heading", { name: "About Out of Body", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to home", exact: true }).click();
  await page.getByRole("button", { name: "View my ticket", exact: true }).click();
  await expect(page.getByRole("heading", { name: "It’s your turn", exact: true })).toBeVisible(); expect(state.joins).toBe(0);
});
