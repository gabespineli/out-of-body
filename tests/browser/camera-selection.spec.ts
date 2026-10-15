import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { silhouetteSvg } from "../../src/lib/rig";
import { trackedCamera, setPoints, standingPoints } from "./fixtures/tracked-camera";

type Fixture = { permission: string; delay: boolean; delayPermission: boolean; failUsb: boolean; devices: string[]; requests: string[]; streams: MediaStream[]; release?: () => void; allow?: () => void };
async function cameras(page: Page, permission = "prompt", delay = false, delayPermission = false) {
  await trackedCamera(page);
  await page.addInitScript(({ permission, delay, delayPermission }) => {
    const state: Fixture = { permission, delay, delayPermission, failUsb: false, devices: ["builtin", "usb"], requests: [], streams: [] };
    (window as unknown as { cameraTest: Fixture }).cameraTest = state;
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = async input => {
      if (input.name !== "camera") return query(input);
      if (state.permission === "unsupported") throw new TypeError("Camera query unsupported");
      if (state.delayPermission) await new Promise<void>(resolve => { state.allow = resolve; });
      return { state: state.permission } as PermissionStatus;
    };
    navigator.mediaDevices.enumerateDevices = async () => state.devices.map((id, index) => ({ kind: "videoinput", deviceId: id, groupId: id,
      label: ["granted", "unsupported"].includes(state.permission) ? index === 0 ? "Built-in webcam" : id === "usb" ? "USB exhibit camera" : "Connected camera" : "", toJSON() { return {}; } } as MediaDeviceInfo));
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      const video = constraints?.video as MediaTrackConstraints;
      const id = (video?.deviceId as ConstrainDOMStringParameters)?.exact as string || "default";
      state.requests.push(id);
      if (state.permission === "denied") throw new DOMException("Denied", "NotAllowedError");
      if (id === "usb" && state.failUsb) throw new DOMException("Busy", "NotReadableError");
      state.permission = "granted";
      if (state.delay) await new Promise<void>(resolve => { state.release = resolve; });
      const stream = await original(constraints); state.streams.push(stream); return stream;
    };
  }, { permission, delay, delayPermission });
}
async function drawing(page: Page) {
  await setPoints(page, []);
  const image = await sharp(Buffer.from(silhouetteSvg(false).replace("</svg>", '<rect x="280" y="110" width="40" height="30" fill="#e5b543"/></svg>'))).png().toBuffer();
  await page.getByTestId("art-upload").setInputFiles({ name: "camera-test.png", mimeType: "image/png", buffer: image });
  await page.getByRole("button", { name: "Start guided session", exact: true }).click();
}
async function setup(page: Page, permission = "prompt", delay = false, delayPermission = false) {
  await cameras(page, permission, delay, delayPermission); await page.goto("/test"); await drawing(page);
}
const requests = (page: Page) => page.evaluate(() => (window as unknown as { cameraTest: Fixture }).cameraTest.requests);
const picker = (page: Page) => page.getByTestId("positioning-gate").getByRole("combobox", { name: "Choose camera" });
async function live(page: Page) { await expect(page.getByTestId("positioning-gate").locator(".positioning-placeholder")).toHaveCount(0); }

test("first permission stays explicit; connected cameras switch cleanly, refresh on hotplug and recover after unplugging", async ({ page }) => {
  await setup(page); await page.waitForTimeout(200); expect(await requests(page)).toEqual([]);
  await page.getByRole("button", { name: "Enable camera", exact: true }).click(); await live(page);
  await expect(picker(page).getByRole("option", { name: "USB exhibit camera" })).toHaveCount(1);
  const preview = await page.locator(".positioning-preview").boundingBox(), select = await picker(page).boundingBox();
  expect(select!.y).toBeGreaterThanOrEqual(preview!.y + preview!.height);
  await picker(page).selectOption("usb"); await live(page);
  expect(await requests(page)).toEqual(["default", "usb"]);
  expect(await page.evaluate(() => (window as unknown as { cameraTest: Fixture }).cameraTest.streams[0].getTracks()[0].readyState)).toBe("ended");
  await page.evaluate(() => { (window as unknown as { cameraTest: Fixture }).cameraTest.devices.push("external"); navigator.mediaDevices.dispatchEvent(new Event("devicechange")); });
  await expect(picker(page).getByRole("option", { name: "Connected camera" })).toHaveCount(1);
  await picker(page).selectOption("external"); await live(page);
  await page.evaluate(() => {
    const state = (window as unknown as { cameraTest: Fixture }).cameraTest;
    state.devices = ["builtin", "usb"]; state.streams.at(-1)!.getTracks()[0].dispatchEvent(new Event("ended"));
    navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
  });
  await expect(page.getByTestId("positioning-gate").locator("p[role=alert]")).toContainText("disconnected");
  await picker(page).selectOption("builtin"); await live(page);
  await expect(page.getByTestId("positioning-gate").locator("p[role=alert]")).toHaveCount(0);
  await page.setViewportSize({ width: 1363, height: 783 });
  const back = await page.getByRole("button", { name: "Back to setup", exact: true }).boundingBox();
  expect(back!.y + back!.height).toBeLessThanOrEqual(783);
  await page.screenshot({ path: "test-results/camera-selector.png", fullPage: true });
  for (const width of [320,768,1024,1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("granted permission opens automatically, remembers the chosen camera on reload and resets positioning when switching", async ({ page }) => {
  await setup(page, "granted"); await live(page); expect(await requests(page)).toEqual(["default"]);
  await setPoints(page, standingPoints());
  await expect(page.getByTestId("positioning-countdown").locator("strong")).toHaveText("2", { timeout: 3500 });
  await picker(page).selectOption("usb"); await live(page);
  await expect(page.getByTestId("positioning-countdown").locator("strong")).toHaveText("3");
  await page.getByRole("button", { name: "Back to setup", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { cameraTest: Fixture }).cameraTest.streams.every(stream => stream.getTracks().every(track => track.readyState === "ended")))).toBe(true);
  await page.reload(); await drawing(page); await live(page);
  expect(await requests(page)).toEqual(["usb"]); await expect(picker(page)).toHaveValue("usb");
});

test("cancelled automatic opening releases a late stream and does not reopen itself", async ({ page }) => {
  await setup(page, "granted", true);
  await expect.poll(() => requests(page)).toHaveLength(1);
  await page.getByRole("button", { name: "Cancel camera", exact: true }).click();
  await page.evaluate(() => (window as unknown as { cameraTest: Fixture }).cameraTest.release!());
  await expect.poll(() => page.evaluate(() => (window as unknown as { cameraTest: Fixture }).cameraTest.streams[0]?.getTracks()[0].readyState)).toBe("ended");
  await page.waitForTimeout(300); expect(await requests(page)).toHaveLength(1);
  await expect(page.getByRole("button", { name: "Enable camera", exact: true })).toBeEnabled();
});

test("leaving setup before permission lookup finishes cannot start a camera later", async ({ page }) => {
  await setup(page, "granted", false, true);
  await page.getByRole("button", { name: "Back to setup", exact: true }).click();
  await page.evaluate(() => (window as unknown as { cameraTest: Fixture }).cameraTest.allow!());
  await page.waitForTimeout(300); expect(await requests(page)).toEqual([]);
});

test("denied permission does not auto-prompt, and a busy selected camera can be replaced", async ({ page }) => {
  await setup(page, "denied"); await page.waitForTimeout(200); expect(await requests(page)).toEqual([]);
  await page.getByRole("button", { name: "Enable camera", exact: true }).click();
  await expect(page.getByTestId("positioning-gate").locator("p[role=alert]")).toContainText("denied");
  await page.evaluate(() => { const state = (window as unknown as { cameraTest: Fixture }).cameraTest; state.permission = "granted"; state.failUsb = true; navigator.mediaDevices.dispatchEvent(new Event("devicechange")); });
  await picker(page).selectOption("usb"); await expect(page.getByTestId("positioning-gate").locator("p[role=alert]")).toContainText("busy");
  await picker(page).selectOption("builtin"); await live(page);
  await expect(page.getByTestId("positioning-gate").locator("p[role=alert]")).toHaveCount(0);
});

test("browsers without camera permission queries can reopen an already labelled camera", async ({ page }) => {
  await setup(page, "unsupported"); await live(page); expect(await requests(page)).toEqual(["default"]);
});

test("phone capture keeps automatic opening and retake without a camera selector", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await cameras(page, "granted");
  let joined = false;
  await page.route("**/api/participant/queue", route => route.fulfill({ json: { waiting: 0, capacity: 20, online: true, accepting: true } }));
  await page.route("**/api/participant/queue/ticket", route => {
    if (route.request().method() === "POST") joined = true;
    return joined ? route.fulfill({ json: { id: "2b2c4167-d1ea-4f9f-a720-698e90ca1d53", number: 1, name: "", ahead: 0, status: "preparing", createdAt: "2026-10-15T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z" } }) : route.fulfill({ status: 401, json: { error: "No ticket" } });
  });
  await page.goto("/mobile"); expect(await requests(page)).toEqual([]);
  await page.evaluate(() => localStorage.setItem("oob-photo-camera", "usb"));
  await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Take photo", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Choose camera" })).toHaveCount(0);
  expect(await requests(page)).toEqual(["default"]);
  await page.getByRole("button", { name: "Take photo", exact: true }).click();
  await expect(page.getByTestId("mobile-preview")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { cameraTest: Fixture }).cameraTest.streams.every(stream => stream.getTracks().every(track => track.readyState === "ended")))).toBe(true);
  await page.getByRole("button", { name: "Retake / choose again", exact: true }).click();
  await expect(page.getByRole("button", { name: "Take photo", exact: true })).toBeVisible();
  expect(await requests(page)).toEqual(["default", "default"]);
  await page.screenshot({ path: "test-results/phone-camera-selector.png", fullPage: true });
});
