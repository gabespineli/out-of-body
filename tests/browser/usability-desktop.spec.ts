import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { silhouetteSvg } from "../../src/lib/rig";
import type { QueueState, QueueTicket } from "../../src/lib/queue";

async function exhibit(page: Page, active = false) {
  const state = { offline: false, lostCompletion: false, lostCall: false, completions: 0, calls: 0, attempts: 0, actionError: "", artworkUnavailable: false };
  const ticket: QueueTicket = { id: "2b2c4167-d1ea-4f9f-a720-698e90ca1d53", number: 7, name: "Alex", ahead: 0,
    status: active ? "active" : "ready", createdAt: "2026-10-14T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z" };
  const queue: QueueState = { tickets: [ticket], active: active ? ticket : null, called: null, waiting: active ? 0 : 1, capacity: 20,
    accepting: true, online: true, mobileUrl: "http://127.0.0.1:3202/mobile", qr: "", downloadBytes: 0, downloads: 0, uploads: 0, usageWarning: false };
  await page.route("**/api/participant/queue?view=operator", route => state.offline
    ? route.fulfill({ status: 503, json: { error: "Queue connection interrupted. Retrying…" } })
    : route.fulfill({ json: queue }));
  await page.route("**/api/participant/queue/action", route => {
    const { action } = route.request().postDataJSON();
    if (action === "call") state.attempts++;
    if (state.actionError) return route.fulfill({ status: 503, json: { error: state.actionError } });
    if (action === "call") { state.calls++; const next = queue.tickets.find(value => value.status === "ready")!; next.status = "called"; queue.called = next; if (state.lostCall) return route.abort("failed"); }
    if (action === "later") { ticket.status = "ready"; queue.called = null; }
    if (action === "start") { ticket.status = "active"; queue.active = ticket; queue.called = null; }
    if (action === "complete") {
      state.completions++; queue.active = null; queue.tickets = []; queue.waiting = 0;
      if (state.lostCompletion) return route.abort("failed");
    }
    return route.fulfill({ json: { cleanupPending: false } });
  });
  const drawing = await sharp(Buffer.from(silhouetteSvg(false).replace("</svg>", '<rect x="256" y="324" width="87" height="130" fill="#279aa3"/></svg>'))).png().toBuffer();
  await page.route("**/api/participant/queue/artwork?*", route => state.artworkUnavailable
    ? route.fulfill({ status: 503, json: { error: "Unavailable" } }) : route.fulfill({ contentType: "image/png", body: drawing }));
  return { state, queue };
}

test("desktop reconnect clears only the old connection warning", async ({ page }) => {
  await page.clock.install(); const { state } = await exhibit(page);
  await page.goto("/"); await expect(page.getByTestId("queue-bar")).toBeVisible();
  state.offline = true; await page.clock.runFor(5001); await expect(page.locator("p[role=alert]")).toContainText("Queue connection interrupted");
  state.offline = false; await page.clock.runFor(10001);
  await page.screenshot({ path: "test-results/usability-desktop-reconnect.png", fullPage: true });
  await expect(page.locator("p[role=alert]")).toHaveCount(0);
});

test("automatic head selection retries on fresh polls without a request loop", async ({ page }) => {
  await page.clock.install(); const { state } = await exhibit(page); state.actionError = "Could not call the participant. Retry.";
  await page.goto("/");
  await expect(page.locator("p[role=alert]")).toContainText(state.actionError);
  expect(state.attempts).toBe(1); await page.clock.runFor(4000); expect(state.attempts).toBe(1);
  await page.clock.runFor(5001); await expect(page.locator("p[role=alert]")).toContainText(state.actionError);
  state.actionError = ""; await page.clock.runFor(5001);
  await expect(page.getByTestId("queue-bar")).toContainText("Calling: Alex");
  await expect(page.locator("p[role=alert]")).toHaveCount(0); expect(state.calls).toBe(1);
});

test("a temporary artwork failure retries into positioning and clears its own warning", async ({ page }) => {
  await page.clock.install(); const { state } = await exhibit(page, true); state.artworkUnavailable = true;
  await page.goto("/"); await expect(page.locator("p[role=alert]")).toContainText("Could not retrieve the active drawing");
  state.artworkUnavailable = false; await page.clock.runFor(15001);
  await expect(page.getByRole("heading", { name: "Get into position", exact: true })).toBeVisible();
  await expect(page.locator("p[role=alert]")).toHaveCount(0);
});

test("a delayed called-participant poll cannot undo starting the automatically selected participant", async ({ page }) => {
  type PollTest = { hold: boolean; pending: boolean; release?: () => void };
  await page.addInitScript(() => {
    const host = window as unknown as { exhibitPollTest: PollTest }; host.exhibitPollTest = { hold: false, pending: false };
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const held = host.exhibitPollTest.hold && String(input).includes("queue?view=operator");
      if (held) host.exhibitPollTest.hold = false;
      const response = await original(input, held ? { ...init, signal: undefined } : init);
      if (held) { host.exhibitPollTest.pending = true; await new Promise<void>(resolve => { host.exhibitPollTest.release = resolve; }); }
      return response;
    };
  });
  await page.clock.install(); const { state } = await exhibit(page);
  await page.goto("/"); await expect(page.getByTestId("queue-bar")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start participant", exact: true })).toBeEnabled();
  await page.evaluate(() => { (window as unknown as { exhibitPollTest: PollTest }).exhibitPollTest.hold = true; });
  await page.clock.runFor(5001);
  await expect.poll(() => page.evaluate(() => (window as unknown as { exhibitPollTest: PollTest }).exhibitPollTest.pending)).toBe(true);
  await page.getByRole("button", { name: "Start participant", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Get into position", exact: true })).toBeVisible();
  await page.evaluate(() => { (window as unknown as { exhibitPollTest: PollTest }).exhibitPollTest.release!(); });
  await page.clock.runFor(100);
  await page.screenshot({ path: "test-results/usability-delayed-call.png", fullPage: true });
  await expect(page.getByTestId("queue-bar")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Get into position", exact: true })).toBeVisible(); expect(state.calls).toBe(1);
});

test("a lost automatic selection response is confirmed by polling without selecting twice", async ({ page }) => {
  await page.clock.install(); const { state } = await exhibit(page); state.lostCall = true;
  await page.goto("/"); await expect(page.locator("p[role=alert]")).toBeVisible();
  await page.clock.runFor(5001);
  await expect(page.getByRole("button", { name: "Start participant", exact: true })).toBeEnabled();
  await expect(page.locator("p[role=alert]")).toHaveCount(0); expect(state.calls).toBe(1); expect(state.attempts).toBe(1);
});

test("cancelling the called ticket automatically selects the next ready drawing", async ({ page }) => {
  await page.clock.install(); const { state, queue } = await exhibit(page); await page.goto("/");
  await expect(page.getByRole("button", { name: "Start participant", exact: true })).toBeEnabled();
  const sam: QueueTicket = { ...queue.tickets[0], id: "cf649a68-bca1-4210-af45-8a3fbb398324", number: 8, name: "Sam", status: "ready" };
  queue.tickets = [sam]; queue.called = null; await page.clock.runFor(5001);
  await expect(page.getByTestId("installation-welcome")).toContainText("Sam");
  await expect(page.getByRole("button", { name: "Start participant", exact: true })).toBeEnabled(); expect(state.calls).toBe(2);
});

test("preparing drawings cannot fill the head until their upload is ready", async ({ page }) => {
  await page.clock.install(); const { state, queue } = await exhibit(page); queue.tickets[0].status = "preparing";
  await page.goto("/"); await expect(page.getByTestId("queue-bar")).toContainText("Waiting for a drawing");
  await expect(page.getByRole("button", { name: "Start participant", exact: true })).toHaveCount(0); expect(state.attempts).toBe(0);
  queue.tickets[0].status = "ready"; await page.clock.runFor(5001);
  await expect(page.getByRole("button", { name: "Start participant", exact: true })).toBeEnabled(); expect(state.calls).toBe(1);
});

test("completion with a lost response recovers after the queue confirms the ticket has ended", async ({ page }) => {
  await page.clock.install(); const { state } = await exhibit(page, true); state.lostCompletion = true;
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Get into position", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to setup", exact: true }).click();
  await page.getByText("Setup tools", { exact: true }).click();
  await page.getByRole("combobox", { name: "Motion source", exact: true }).selectOption("manual");
  await page.getByRole("button", { name: "Start guided session", exact: true }).click();
  await page.getByRole("button", { name: "Skip Stretch", exact: true }).click();
  await expect(page.getByTestId("participant-completion")).toBeVisible();
  await page.clock.runFor(6001);
  await page.screenshot({ path: "test-results/usability-completion-recovery.png", fullPage: true });
  await expect(page.getByRole("button", { name: "Next participant", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Next participant", exact: true }).click();
  await expect(page.getByTestId("installation-welcome")).toBeVisible(); await expect(page.getByTestId("participant-completion")).toHaveCount(0);
  expect(state.completions).toBe(1);
});
