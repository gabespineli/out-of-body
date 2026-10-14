import { test, expect, chromium, type Page } from "@playwright/test";
import path from "node:path";
import sharp from "sharp";
import { silhouetteSvg } from "../../src/lib/rig";
import { AREA_IDS, areaConfig, type BodyArea } from "../../src/lib/body-areas";

const spots: Record<BodyArea, [number, number]> = { "neck-head": [300, 120], torso: [300, 385], "left-upper-arm": [200, 285], "left-forearm": [166, 420], "right-upper-arm": [400, 285], "right-forearm": [434, 420], "left-leg": [254, 610], "right-leg": [346, 710] };
const color = [39, 154, 163, 255];
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const host = window as unknown as { installationTools: Record<string, { name: string; execute: (input: unknown) => object }> };
    host.installationTools = {};
    Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool: (tool: { name: string; execute: (input: unknown) => object }) => { host.installationTools[tool.name] = tool; } } });
  });
});
async function manualPose(page: Page, values: Record<string, number>) {
  await page.evaluate(values => {
    const tools = (window as unknown as { installationTools: Record<string, { execute: (input: unknown) => object }> }).installationTools;
    const state = tools.get_installation_state.execute({}) as { manual: object };
    tools.configure_manual_pose.execute({ ...state.manual, ...values });
  }, values);
}
async function rest(page: Page) { await manualPose(page, { left: 0, right: 0, lean: 0, leftElbow: 0, rightElbow: 0, headTilt: 0, leftLeg: 0, rightLeg: 0, heelRaise: 0 }); }

async function drawing(areas: BodyArea[], extra = "") {
  const marks = areas.map(id => { const [x, y] = spots[id]; return `<rect x="${x-8}" y="${y-8}" width="16" height="16" fill="#279aa3"/>`; }).join("");
  return sharp(Buffer.from(silhouetteSvg(false).replace("</svg>", `${marks}${extra}</svg>`))).png().toBuffer();
}
async function upload(page: Page, areas: BodyArea[], extra = "") {
  await page.getByTestId("art-upload").setInputFiles({ name: "regions.png", mimeType: "image/png", buffer: await drawing(areas, extra) });
  await expect(page.getByTestId("art-source")).toBeVisible();
  if (!(await page.locator("details.setup-tools").evaluate(el => (el as HTMLDetailsElement).open))) await page.locator("details.setup-tools > summary").click();
}
async function prepare(page: Page, areas: BodyArea[]) {
  await page.goto("/test"); await upload(page, areas);
  await page.getByRole("combobox", { name: "Motion source", exact: true }).selectOption("manual");
  await page.getByRole("button", { name: "Start guided session", exact: true }).click();
}
async function pixel(page: Page, id: BodyArea) {
  const [x,y] = spots[id];
  return page.getByTestId("avatar").evaluate((el, p) => Array.from((el as HTMLCanvasElement).getContext("2d")!.getImageData(p.x + 120, p.y, 1, 1).data), { x,y });
}
async function move(page: Page, area: BodyArea, i: number) {
  const step = await page.getByTestId("avatar").getAttribute("data-step"), side = area.startsWith("right") ? "right" : "left";
  const control = area === "neck-head" ? "head tilt" : area === "torso" ? "side lean" : step === "reach" ? `${side} arm height` : step === "elbow-bend" ? `${side} elbow bend` : step === "heel-raise" ? "heel raise" : `${side} leg swing`;
  const value = area === "neck-head" || area === "torso" ? i % 2 ? ".5" : "-.5" : step === "reach" ? i % 2 ? ".8" : ".5" : step === "elbow-bend" ? i % 2 ? ".8" : ".1" : step === "heel-raise" ? i % 2 ? ".6" : "0" : i % 2 ? "0" : side === "left" ? ".6" : "-.6";
  const key = area === "neck-head" ? "headTilt" : area === "torso" ? "lean" : step === "reach" ? side : step === "elbow-bend" ? `${side}Elbow` : step === "heel-raise" ? "heelRaise" : `${side}Leg`;
  await manualPose(page, { [key]: Number(value) }); await page.waitForTimeout(350);
}
async function finish(page: Page, area: BodyArea) {
  const start = Date.now();
  for (let i = 0; (await page.getByTestId("avatar").getAttribute(`data-${area}-fade`)) !== "1.00" && Date.now() - start < 17000; i++) await move(page, area, i);
  await expect(page.getByTestId("avatar")).toHaveAttribute(`data-${area}-fade`, "1.00");
}
for (const id of AREA_IDS) test(`only ${id} marks select that region`, async ({ page }) => {
  await page.goto("/test"); await upload(page, [id]);
  const steps = page.getByRole("list", { name: "Stretching sequence" }).locator("li");
  await expect(steps).toHaveCount(1); await expect(steps).toContainText(areaConfig(id).label);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-area", id);
});
test("marks across the elbow boundary select both arm regions; neutral and outside marks select none", async ({ page }) => {
  await page.goto("/test"); await upload(page, [], '<rect x="166" y="342" width="26" height="33" fill="#279aa3"/>');
  await expect(page.getByRole("list", { name: "Stretching sequence" }).locator("li")).toHaveCount(2);
  await expect(page.getByRole("list", { name: "Stretching sequence" })).toContainText("Left upper arm");
  await expect(page.getByRole("list", { name: "Stretching sequence" })).toContainText("Left forearm");
  await upload(page, [], '<rect x="30" y="350" width="40" height="40" fill="#279aa3"/><rect x="280" y="370" width="40" height="40" fill="#222222"/>');
  await expect(page.getByRole("button", { name: "Start guided session", exact: true })).toBeDisabled();
  await expect(page.getByTestId("guided-status")).toContainText("No colored regions detected");
});
test("neck cue and instructor are independent of participant progress and freeze when paused", async ({ page }) => {
  await prepare(page, ["neck-head", "torso", "left-leg"]);
  const avatar = page.getByTestId("avatar"), instructor = page.getByTestId("instructor");
  await expect(instructor).toHaveAttribute("data-neck-arrow", "true"); await expect(instructor).toHaveAttribute("aria-label", /not a full neck circle/);
  const still = await avatar.evaluate(el => (el as HTMLCanvasElement).toDataURL()), loop = await instructor.evaluate(el => (el as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(1400);
  expect(await instructor.evaluate(el => (el as HTMLCanvasElement).toDataURL())).not.toBe(loop);
  expect(await avatar.evaluate(el => (el as HTMLCanvasElement).toDataURL())).toBe(still);
  await expect(avatar).toHaveAttribute("data-guided-progress", "0.000");
  for (let i = 0; i < 5; i++) await move(page, "neck-head", i);
  await rest(page); await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const earned = await avatar.getAttribute("data-neck-head-fade"), pausedLoop = await instructor.evaluate(el => (el as HTMLCanvasElement).toDataURL());
  expect(+earned!).toBeGreaterThan(.1); expect((await pixel(page, "neck-head"))[0]).toBeGreaterThan(39);
  expect(await pixel(page, "torso")).toEqual(color); expect(await pixel(page, "left-leg")).toEqual(color);
  await page.waitForTimeout(1100); expect(await instructor.evaluate(el => (el as HTMLCanvasElement).toDataURL())).toBe(pausedLoop);
  await expect(avatar).toHaveAttribute("data-neck-head-fade", earned!);
  await page.screenshot({ path: "test-results/neck-arrow-regions.png", fullPage: true });
});
test("a forearm activity uses an independent elbow control and only fades that region", async ({ page }) => {
  await prepare(page, ["left-upper-arm", "left-forearm", "right-forearm", "torso"]);
  // Ordered colored regions: torso, left upper arm, left forearm, right forearm.
  await page.getByRole("button", { name: "Skip Stretch", exact: true }).click();
  await page.getByRole("button", { name: "Skip Stretch", exact: true }).click();
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-area", "left-forearm");
  await expect(page.getByRole("slider", { name: "Manual left elbow bend", exact: true })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Manual left arm height", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("instructor")).toHaveAttribute("data-neck-arrow", "false");
  await finish(page, "left-forearm");
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-area", "right-forearm", { timeout: 3000 });
  await rest(page); await page.waitForTimeout(1100);
  expect((await pixel(page, "left-forearm"))[0]).toBeGreaterThan(235);
  for (const id of ["torso", "left-upper-arm", "right-forearm"] as const) expect(await pixel(page, id)).toEqual(color);
  await page.getByRole("button", { name: "Skip Stretch", exact: true }).click();
  await expect(page.getByTestId("guided-status")).toHaveText("Finished · 3 skipped");
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-guided-total", "0.250");
  await page.screenshot({ path: "test-results/forearm-only-fade.png", fullPage: true });
});
test("selected torso and leg activities finish and saved output preserves other colored regions", async ({ page }, testInfo) => {
  test.setTimeout(65000); await prepare(page, ["torso", "left-leg", "right-forearm"]);
  await finish(page, "torso");
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-area", "right-forearm", { timeout: 3000 });
  await page.getByRole("button", { name: "Skip Stretch", exact: true }).click();
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-area", "left-leg");
  await finish(page, "left-leg");
  await expect(page.getByTestId("guided-status")).toHaveText("Finished · 1 skipped", { timeout: 3000 });
  await rest(page); await page.waitForTimeout(1100);
  expect((await pixel(page, "torso"))[0]).toBeGreaterThan(235); expect((await pixel(page, "left-leg"))[0]).toBeGreaterThan(235); expect(await pixel(page, "right-forearm")).toEqual(color);
  await page.getByRole("button", { name: "Back to setup", exact: true }).click();
  if (!(await page.locator("details.setup-tools").evaluate(el => (el as HTMLDetailsElement).open))) await page.locator("details.setup-tools > summary").click();
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Save PNG", exact: true }).click();
  const file = testInfo.outputPath("regions-result.png"); await (await download).saveAs(file);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [x,y] = spots["right-forearm"]; const start = (y * info.width + x + 120) * 4;
  expect(Array.from(data.subarray(start, start + 4))).toEqual(color);
  await page.getByRole("button", { name: "Replay sequence", exact: true }).click();
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-guided-total", "0.000");
});
test("blank drawings cannot start; camera denial retains manual fallback for colored drawings", async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Denied test camera", "NotAllowedError"); }; });
  await page.goto("/test"); await upload(page, []);
  await expect(page.getByRole("button", { name: "Start guided session", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Enable camera", exact: true }).click(); await expect(page.locator("p[role=alert]")).toContainText("Camera permission was denied");
  await upload(page, ["left-forearm"]);
  await page.getByRole("combobox", { name: "Motion source", exact: true }).selectOption("manual");
  await page.getByRole("button", { name: "Start guided session", exact: true }).click(); await finish(page, "left-forearm");
  await expect(page.getByTestId("guided-status")).toHaveText("Sequence completed", { timeout: 3000 });
});
test("selected sequence and both panels survive fullscreen, responsive layout and partial skips", async ({ page }) => {
  await prepare(page, ["neck-head", "left-forearm"]);
  for (let i = 0; i < 3; i++) await move(page, "neck-head", i);
  await page.evaluate(() => { const tools = (window as unknown as { installationTools: Record<string, { execute: (input: unknown) => object }> }).installationTools; tools.configure_manual_pose.execute({ left: 0, right: 0, lean: 0 }); });
  await expect(page.getByTestId("stretch-exhibit")).toBeVisible();
  await expect(page.getByTestId("current-activity")).toBeVisible(); await expect(page.getByTestId("instructor")).toBeVisible();
  await page.getByRole("button", { name: "Skip Stretch", exact: true }).last().click();
  const earned = await page.getByTestId("avatar").getAttribute("data-neck-head-fade"); expect(+earned!).toBeGreaterThan(0); expect(+earned!).toBeLessThan(1);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-area", "left-forearm");

  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await expect(page.getByTestId("instructor")).toBeVisible(); await expect(page.getByTestId("avatar")).toBeVisible();
  }
  await page.getByRole("button", { name: "Skip Stretch", exact: true }).click();
  await expect(page.getByTestId("guided-status")).toHaveText("Finished · 2 skipped"); await expect(page.getByTestId("avatar")).toHaveAttribute("data-neck-head-fade", earned!);
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-neck-head-fade", "0.00"); await expect(page.getByTestId("stretch-exhibit")).toBeVisible();
});

test("individual forearm stretches and WebMCP use independent elbows and eight regions", async ({ page }) => {
  await page.addInitScript(() => {
    const host = window as unknown as { installationTools: Record<string, { execute: (input: unknown) => object; inputSchema: object }> };
    host.installationTools = {};
    Object.defineProperty(document, "modelContext", { value: { registerTool: (tool: { name: string; execute: (input: unknown) => object; inputSchema: object }) => { host.installationTools[tool.name] = tool; } } });
  });
  await page.goto("/test"); await upload(page, ["left-upper-arm", "left-forearm", "right-forearm"]);
  const invoke = (name: string, input: object) => page.evaluate(({ name, input }) => {
    const host = window as unknown as { installationTools: Record<string, { execute: (input: unknown) => object }> };
    return host.installationTools[name].execute(input);
  }, { name, input });
  await invoke("select_body_area", { area: "left-forearm" });
  await invoke("configure_manual_pose", { left: 1, right: 0, lean: 0 });
  await page.waitForTimeout(800); await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", "0.00");
  await invoke("configure_manual_pose", { left: 0, right: 0, lean: 0, rightElbow: .8 });
  await page.waitForTimeout(800); await expect(page.getByTestId("avatar")).toHaveAttribute("data-hold", "0.00");
  await invoke("configure_manual_pose", { left: 0, right: 0, lean: 0, leftElbow: .8 });
  await expect(page.getByRole("slider", { name: "Manual left elbow bend", exact: true })).toHaveValue("0.8");
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-left-forearm-fade", "1.00", { timeout: 6000 });
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-left-upper-arm-fade", "0.00");
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-right-forearm-fade", "0.00");
  expect(await invoke("get_installation_state", {})).toMatchObject({ areaCount: 8, bodyArea: "left-forearm" });
  await invoke("start_guided_session", {});
  expect(await invoke("get_installation_state", {})).toMatchObject({ guided: { areas: ["left-upper-arm", "left-forearm", "right-forearm"], activityCount: 3 } });
});

test("hidden-document lifecycle freezes earned fades and the instructor without catch-up", async ({ page }) => {
  await prepare(page, ["neck-head"]);
  for (let i = 0; i < 3; i++) await move(page, "neck-head", i);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(150);
  const earned = await page.getByTestId("avatar").getAttribute("data-neck-head-fade");
  const loop = await page.getByTestId("instructor").evaluate(el => (el as HTMLCanvasElement).toDataURL());
  for (let i = 0; i < 4; i++) await move(page, "neck-head", i);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-neck-head-fade", earned!);
  expect(await page.getByTestId("instructor").evaluate(el => (el as HTMLCanvasElement).toDataURL())).toBe(loop);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(150);
  await expect(page.getByTestId("avatar")).toHaveAttribute("data-neck-head-fade", earned!);
  for (let i = 0; i < 3; i++) await move(page, "neck-head", i);
  expect(+(await page.getByTestId("avatar").getAttribute("data-neck-head-fade"))!).toBeGreaterThan(+earned!);
});

test("real MediaPipe static replay cannot earn participant progress from the animated instructor", async () => {
  const fixture = process.env.OOB_CAMERA_FIXTURE;
  test.skip(!fixture, "Set OOB_CAMERA_FIXTURE to the external static Y4M replay; no physical camera validation is claimed.");
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${path.resolve(fixture!)}`] });
  const context = await browser.newContext({ permissions: ["camera"] });
  try {
    const page = await context.newPage(); await page.goto("http://127.0.0.1:3202/test"); await upload(page, ["neck-head"]);
    await page.getByRole("button", { name: "Enable camera", exact: true }).click(); await expect(page.getByText("Body found", { exact: true })).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: "Start guided session", exact: true }).click(); await page.waitForTimeout(4500);
    await expect(page.getByTestId("avatar")).toHaveAttribute("data-guided-progress", "0.000");
  } finally { await context.close(); await browser.close(); }
});
