import { test, expect } from "@playwright/test";
import type { QueueTicket } from "../../src/lib/queue";
test("only a called phone shows Start, failures retry and activation survives reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const ticket: QueueTicket = { id: "2b2c4167-d1ea-4f9f-a720-698e90ca1d53", number: 7, name: "Alex", ahead: 0, status: "called", createdAt: "2026-10-15T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z" };
  let attempts = 0;
  await page.route("**/api/participant/queue", route => route.fulfill({ json: { waiting: 1, capacity: 20, online: true, accepting: true } }));
  await page.route("**/api/participant/queue/ticket", route => route.fulfill({ json: ticket }));
  await page.route("**/api/participant/queue/start", async route => {
    attempts++; expect(route.request().postData()).toBeNull();
    if (attempts === 1) return route.fulfill({ status: 503, json: { error: "Connection interrupted. Please retry." } });
    await new Promise(resolve => setTimeout(resolve, 200)); ticket.status = "active";
    return route.fulfill({ json: ticket });
  });
  await page.goto("/mobile");
  await expect(page.getByRole("button", { name: "Start my session", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/phone-start.png", fullPage: true });
  await page.getByRole("button", { name: "Start my session", exact: true }).click();
  await expect(page.getByText("Connection interrupted. Please retry.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start my session", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Drawing on screen", exact: true })).toBeVisible();
  expect(attempts).toBe(2);
  await page.reload(); await expect(page.getByRole("button", { name: "Start my session", exact: true })).toHaveCount(0);
  ticket.status = "ready"; ticket.ahead = 2; await page.reload();
  await expect(page.getByTestId("queue-ticket")).toContainText("#3 in line");
  await expect(page.getByRole("button", { name: "Start my session", exact: true })).toHaveCount(0);
});
