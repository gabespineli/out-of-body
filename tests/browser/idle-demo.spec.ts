import { test, expect, type Page } from "@playwright/test";
async function idle(page: Page) {
  await page.route("**/api/participant/queue?view=operator", route => route.fulfill({ json: { tickets: [], active: null, called: null, waiting: 0, capacity: 20, online: true, accepting: true, qr: "", mobileUrl: "/mobile" } }));
  await page.route("**/api/participant/queue/action", () => { throw new Error("The idle example must never change the queue."); });
  await page.goto("/");
  await expect(page.getByTestId("demo-drawing")).toHaveAttribute("data-demo-fade", /\d/);
}
test("idle example moves, fades, resets and never opens a camera or changes tickets", async ({ page }) => {
  await page.clock.install(); await idle(page);
  await page.clock.runFor(8500);
  await expect.poll(async () => +(await page.getByTestId("demo-drawing").getAttribute("data-demo-fade"))!).toBeGreaterThan(.7);
  await page.clock.runFor(4300);
  expect(+(await page.getByTestId("demo-drawing").getAttribute("data-demo-fade"))!).toBeLessThan(.2);
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.getByTestId("session-qr")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Back to home", exact: true })).toHaveCount(0);
});
test("reduced-motion preference keeps the idle example still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await idle(page);
  const initial = await page.getByTestId("demo-drawing").evaluate(el => (el as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(500);
  expect(await page.getByTestId("demo-drawing").evaluate(el => (el as HTMLCanvasElement).toDataURL())).toBe(initial);
  await expect(page.getByTestId("demo-drawing")).toHaveAttribute("data-demo-fade", "0.000");
});
test("phone reservation says Loading while a slot is being prepared", async ({ page }) => {
  await page.route("**/api/participant/queue", route => route.fulfill({ json: { waiting: 0, capacity: 20, accepting: true, online: true } }));
  await page.route("**/api/participant/queue/ticket", async route => {
    if (route.request().method() === "GET") return route.fulfill({ status: 401, json: { error: "No ticket" } });
    await new Promise(resolve => setTimeout(resolve, 800));
    return route.fulfill({ json: { id: "2b2c4167-d1ea-4f9f-a720-698e90ca1d53", number: 1, name: "", status: "preparing", ahead: 0, expiresAt: "2099-01-01T00:00:00Z" } });
  });
  await page.goto("/mobile"); await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Loading…", exact: true })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Photograph your drawing", exact: true })).toBeVisible();
});
