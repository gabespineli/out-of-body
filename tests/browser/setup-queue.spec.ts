import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { silhouetteSvg } from "../../src/lib/rig";
import type { QueueState, QueueTicket } from "../../src/lib/queue";
import { trackedCamera } from "./fixtures/tracked-camera";

async function setup(page: Page) {
  const active: QueueTicket = { id: "2b2c4167-d1ea-4f9f-a720-698e90ca1d53", number: 7, name: "Alex", ahead: 0, status: "active", createdAt: "2026-10-15T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z" };
  const waiting: QueueTicket = { ...active, id: "3b2c4167-d1ea-4f9f-a720-698e90ca1d53", number: 8, name: "Sam", status: "ready", ahead: 1 };
  const queue: QueueState = { tickets: [active, waiting], active, called: null, waiting: 1, capacity: 20, accepting: true, online: true,
    mobileUrl: "http://127.0.0.1:3202/mobile", qr: "data:image/png;base64,", downloadBytes: 0, downloads: 0, uploads: 0, usageWarning: false };
  const drawing = await sharp(Buffer.from(silhouetteSvg(true))).png().toBuffer();
  await page.route("**/api/participant/queue?view=operator", route => route.fulfill({ json: queue }));
  await page.route("**/api/participant/queue/artwork?*", route => route.fulfill({ contentType: "image/png", body: drawing }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Get into position", exact: true })).toBeVisible();
  return { queue, active, waiting };
}

test("camera setup manages waiting tickets and confirms removal without ending the current participant", async ({ page }) => {
  await page.setViewportSize({ width: 1363, height: 783 });
  const { queue, active, waiting } = await setup(page);
  const actions: string[] = [];
  await page.route("**/api/participant/queue/action", route => {
    const input = route.request().postDataJSON(); actions.push(input.action);
    expect(input.id).toBe(waiting.id); queue.tickets = [active]; queue.waiting = 0;
    return route.fulfill({ json: { cleanupPending: false } });
  });
  await expect(page.getByTestId("queue-bar")).toHaveCount(1);
  const skip = await page.getByRole("button", { name: "Skip participant", exact: true }).boundingBox();
  expect(skip!.y + skip!.height).toBeLessThanOrEqual(783);
  await expect(page.getByRole("button", { name: "Enable camera", exact: true })).toBeVisible();
  await expect(page.getByTestId("queue-bar")).toContainText("Sam");
  expect((await page.getByTestId("queue-bar").boundingBox())!.y).toBeLessThan((await page.getByTestId("positioning-gate").boundingBox())!.y);
  await expect(page.getByRole("button", { name: "End current session", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Remove ticket 8", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Remove this participant?");
  await expect(page.getByRole("button", { name: "Keep participant", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Keep participant", exact: true }).click(); expect(actions).toEqual([]);
  await page.getByRole("button", { name: "Remove ticket 8", exact: true }).click();
  await page.getByRole("button", { name: "Yes, remove participant", exact: true }).click();
  await expect(page.getByTestId("queue-bar")).not.toContainText("Sam"); expect(actions).toEqual(["remove"]);
  await expect(page.getByRole("button", { name: "Manage queue", exact: true })).toHaveCount(0);
  await page.screenshot({ path: "test-results/setup-queue-controls.png", fullPage: true });
});

test("a failed completion keeps the drawing and offers a visible save retry before the next turn", async ({ page }) => {
  const { queue } = await setup(page); let saves = 0;
  await page.route("**/api/participant/queue/result?*", route => {
    saves++;
    if (saves === 1) return route.fulfill({ status: 503, json: { error: "Queue storage is unavailable." } });
    queue.active = null; queue.tickets = []; queue.waiting = 0;
    return route.fulfill({ json: { cleanupPending: false } });
  });
  await page.getByRole("button", { name: "Back to setup", exact: true }).click();
  await page.getByText("Setup tools", { exact: true }).click();
  await page.getByRole("combobox", { name: "Motion source", exact: true }).selectOption("manual");
  await page.getByRole("button", { name: "Start guided session", exact: true }).click();
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "Skip Stretch", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry saving drawing", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Back to home", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Retry saving drawing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Back to home", exact: true })).toBeEnabled();
  expect(saves).toBe(2);
});

test("skip is available in both setup screens, Escape preserves the turn and failed skips can retry", async ({ page }) => {
  const { active } = await setup(page);
  let requests = 0;
  await page.route("**/api/participant/queue/action", route => {
    expect(route.request().postDataJSON()).toEqual({ action: "end", id: active.id }); requests++;
    return route.fulfill({ status: 503, json: { error: "Connection interrupted. Please retry." } });
  });
  await page.getByRole("button", { name: "Skip participant", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("without saving a finished drawing");
  await page.getByRole("button", { name: "Keep participant", exact: true }).press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0); expect(requests).toBe(0);
  await page.getByRole("button", { name: "Back to setup", exact: true }).click();
  await page.getByRole("button", { name: "Skip participant", exact: true }).click();
  await page.getByRole("button", { name: "Yes, skip participant", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Connection interrupted" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip participant", exact: true })).toBeEnabled(); expect(requests).toBe(1);
  await page.getByRole("button", { name: "Skip participant", exact: true }).click();
  await page.getByRole("button", { name: "Yes, skip participant", exact: true }).click();
  await expect.poll(() => requests).toBe(2);
});

test("confirmed skip calls the next ready participant, and queue controls stay out of stretching", async ({ page }) => {
  const { queue, waiting } = await setup(page);
  await page.route("**/api/participant/queue/action", route => {
    const input = route.request().postDataJSON();
    if (input.action === "end") { queue.active = null; queue.tickets = [waiting]; }
    else { expect(input.action).toBe("call"); waiting.status = "called"; queue.called = waiting; }
    return route.fulfill({ json: { cleanupPending: false } });
  });
  await page.getByRole("button", { name: "Skip participant", exact: true }).click();
  await page.getByRole("button", { name: "Yes, skip participant", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sam, it’s your turn", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start participant", exact: true })).toHaveCount(0);
});

test("setup management does not appear during an active stretch", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Back to setup", exact: true }).click();
  await page.getByText("Setup tools", { exact: true }).click();
  await page.getByRole("combobox", { name: "Motion source", exact: true }).selectOption("manual");
  await page.getByRole("button", { name: "Start guided session", exact: true }).click();
  await expect(page.getByTestId("stretch-exhibit")).toBeVisible();
  await expect(page.getByRole("button", { name: "Manage queue", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Skip participant", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("queue-bar")).toHaveCount(0);
});

test("queue management and skip confirmation pause automatic start and require a fresh countdown", async ({ page }) => {
  await trackedCamera(page); await setup(page);
  await page.getByRole("button", { name: "Enable camera", exact: true }).click();
  const count = page.getByTestId("positioning-countdown").locator("strong");
  await expect(count).toHaveText("3");
  await page.getByRole("button", { name: "Skip participant", exact: true }).click();
  await page.waitForTimeout(3300);
  await expect(page.getByTestId("guided-shell")).toHaveAttribute("data-phase", "positioning");
  await page.getByRole("button", { name: "Keep participant", exact: true }).click();
  await expect(count).toHaveText("3");
  await expect(page.getByTestId("guided-shell")).toHaveAttribute("data-phase", "stretching", { timeout: 5000 });
});

test("completion calls the next person and their phone activation replaces completion without a PC click", async ({ page }) => {
  const { queue, waiting } = await setup(page);
  await page.route("**/api/participant/queue/result?*", route => {
    queue.active = null; queue.tickets = [waiting];
    return route.fulfill({ json: { cleanupPending: false } });
  });
  await page.route("**/api/participant/queue/action", route => {
    expect(route.request().postDataJSON().action).toBe("call");
    waiting.status = "called"; queue.called = waiting;
    return route.fulfill({ json: { cleanupPending: false } });
  });
  await page.getByRole("button", { name: "Back to setup", exact: true }).click();
  await page.getByText("Setup tools", { exact: true }).click();
  await page.getByRole("combobox", { name: "Motion source", exact: true }).selectOption("manual");
  await page.getByRole("button", { name: "Start guided session", exact: true }).click();
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "Skip Stretch", exact: true }).click();
  await expect(page.getByTestId("participant-completion")).toBeVisible();
  await expect.poll(() => queue.called?.name).toBe("Sam");
  // Model the authenticated phone transition, separately covered against real local Supabase.
  waiting.status = "active"; queue.active = waiting; queue.called = null;
  await expect(page.getByRole("heading", { name: "Get into position", exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("participant-completion")).toHaveCount(0);
  await expect(page.getByTestId("queue-bar")).toContainText("Current participant: Sam");
});
