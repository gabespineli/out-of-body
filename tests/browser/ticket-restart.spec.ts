import { test, expect } from "@playwright/test";
import type { TicketStatus } from "../../src/lib/queue";
import sharp from "sharp";
import { silhouetteSvg } from "../../src/lib/rig";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

for (const ended of ["cancelled", "expired", "completed"] as const) {
  test(`a restored ${ended} ticket can return home and start a new drawing`, async ({ page }) => {
    test.setTimeout(15000);
    let joins = 0;
    let status: TicketStatus = ended;
    const ticket = () => ({ id: "2b2c4167-d1ea-4f9f-a720-698e90ca1d53", number: joins ? 8 : 7,
      name: "", ahead: 0, status, createdAt: "2026-10-14T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z" });
    await page.route("**/api/participant/queue", route => route.fulfill({ json: { waiting: 0, capacity: 20, accepting: true, online: true } }));
    await page.route("**/api/participant/queue/ticket", route => {
      if (route.request().method() === "POST") { joins++; status = "preparing"; }
      return route.fulfill({ json: ticket() });
    });
    await page.goto("/mobile");
    await expect(page.getByRole("heading", { name: ended === "cancelled" ? "Ticket cancelled" : ended === "expired" ? "Your ticket expired" : "Thank you for moving!" })).toBeVisible();
    await page.getByRole("button", { name: "Back to home", exact: true }).click();
    await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
    await expect(page.getByTestId("mobile-photo")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel my ticket", exact: true })).toBeVisible();
    expect(joins).toBe(1);
  });
}

test("starting again restores a ready ticket already reserved by another tab", async ({ page }) => {
  let joins = 0;
  let status: TicketStatus = "cancelled";
  const ticket = () => ({ id: "2b2c4167-d1ea-4f9f-a720-698e90ca1d53", number: joins ? 8 : 7,
    name: "Alex", ahead: 0, status, createdAt: "2026-10-14T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z" });
  await page.route("**/api/participant/queue", route => route.fulfill({ json: { waiting: 1, capacity: 20, accepting: true, online: true } }));
  await page.route("**/api/participant/queue/ticket", route => {
    if (route.request().method() === "POST") { joins++; status = "ready"; }
    return route.fulfill({ json: ticket() });
  });
  await page.goto("/mobile");
  await expect(page.getByRole("heading", { name: "Ticket cancelled" })).toBeVisible();
  await page.getByRole("button", { name: "Back to home", exact: true }).click();
  await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
  await expect(page.getByTestId("queue-ticket")).toContainText("#1 in line");
  await expect(page.getByTestId("mobile-photo")).toHaveCount(0);
  expect(joins).toBe(1);
});

test("the same phone can upload, cancel and upload a different drawing without waiting", async ({ page }) => {
  let joins = 0;
  let status: TicketStatus | null = null;
  const ticket = () => ({ id: "2b2c4167-d1ea-4f9f-a720-698e90ca1d53", number: joins,
    name: "Alex", ahead: 0, status, createdAt: "2026-10-14T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z" });
  await page.route("**/api/participant/queue", route => route.fulfill({ json: { waiting: 0, capacity: 20, accepting: true, online: true } }));
  await page.route("**/api/participant/queue/ticket", route => {
    if (route.request().method() === "POST") { joins++; status = "preparing"; }
    if (route.request().method() === "DELETE") status = "cancelled";
    return status ? route.fulfill({ json: ticket() }) : route.fulfill({ status: 401, json: { error: "No ticket" } });
  });
  await page.route("**/api/participant/queue/upload", route => { status = "ready"; return route.fulfill({ json: ticket() }); });
  await page.goto("/mobile");
  for (const color of ["#279aa3", "#d8667b"]) {
    await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
    const image = await sharp(Buffer.from(silhouetteSvg(true).replace("</svg>", `<rect x="256" y="324" width="87" height="130" fill="${color}"/></svg>`))).png().toBuffer();
    await page.getByTestId("mobile-photo").setInputFiles({ name: "drawing.png", mimeType: "image/png", buffer: image });
    await page.getByRole("button", { name: "Tap to continue", exact: true }).click();
    await page.getByRole("button", { name: "Send to installation", exact: true }).click();
    await expect(page.getByTestId("queue-ticket")).toContainText("#1 in line");
    await page.getByRole("button", { name: "Cancel my ticket", exact: true }).click();
    await page.getByRole("button", { name: "Yes, cancel ticket", exact: true }).click();
    await expect(page.getByRole("button", { name: "Upload drawing", exact: true })).toBeEnabled();
    await expect(page.getByRole("heading", { name: "Ticket cancelled" })).toHaveCount(0);
  }
  expect(joins).toBe(2);
});

test("a delayed cancelled-ticket poll cannot overwrite the new reservation", async ({ page }) => {
  type PollTest = { hold: boolean; pending: boolean; release?: () => void };
  await page.addInitScript(() => {
    const host = window as unknown as { ticketPollTest: PollTest };
    host.ticketPollTest = { hold: false, pending: false };
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const held = host.ticketPollTest.hold && String(input).endsWith("/queue/ticket") && (!init?.method || init.method === "GET");
      if (held) host.ticketPollTest.hold = false;
      const response = await original(input, held ? { ...init, signal: undefined } : init);
      if (held) {
        host.ticketPollTest.pending = true;
        await new Promise<void>(resolve => { host.ticketPollTest.release = resolve; });
      }
      return response;
    };
  });
  await page.clock.install();
  let status: TicketStatus = "ready";
  let joins = 0;
  const ticket = () => ({ id: "2b2c4167-d1ea-4f9f-a720-698e90ca1d53", number: joins ? 8 : 7,
    name: "", ahead: 0, status, createdAt: "2026-10-14T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z" });
  await page.route("**/api/participant/queue", route => route.fulfill({ json: { waiting: 0, capacity: 20, accepting: true, online: true } }));
  await page.route("**/api/participant/queue/ticket", route => {
    if (route.request().method() === "POST") { joins++; status = "preparing"; }
    if (route.request().method() === "DELETE") status = "cancelled";
    return route.fulfill({ json: ticket() });
  });
  await page.goto("/mobile");
  await expect(page.getByTestId("queue-ticket")).toContainText("#1 in line");
  status = "cancelled";
  await page.evaluate(() => { (window as unknown as { ticketPollTest: PollTest }).ticketPollTest.hold = true; });
  await page.clock.runFor(15001);
  await expect.poll(() => page.evaluate(() => (window as unknown as { ticketPollTest: PollTest }).ticketPollTest.pending)).toBe(true);
  await page.getByRole("button", { name: "Cancel my ticket", exact: true }).click();
  await page.getByRole("button", { name: "Yes, cancel ticket", exact: true }).click();
  await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
  await expect(page.getByTestId("mobile-photo")).toBeVisible();
  await page.evaluate(() => { (window as unknown as { ticketPollTest: PollTest }).ticketPollTest.release!(); });
  await page.clock.runFor(100);
  await expect(page.getByTestId("mobile-photo")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel my ticket", exact: true })).toBeVisible();
  expect(joins).toBe(1);
});
