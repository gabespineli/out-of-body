import type { Page } from "@playwright/test";
import type { Landmark } from "../../../src/lib/pose";
export function standingPoints(): Landmark[] {
  const p = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: .99, presence: .99 }));
  for (const [i,x,y] of [[0,.5,.13],[7,.55,.15],[8,.45,.15],[11,.6,.3],[12,.4,.3],[13,.65,.5],[14,.35,.5],[15,.7,.7],[16,.3,.7],[23,.56,.65],[24,.44,.65],[25,.562,.8],[26,.438,.8],[27,.558,.93],[28,.442,.93]]) p[i] = { ...p[i], x,y };
  return p;
}
// Test-browser-only module replacement. No test overrides ship in the application.
export async function trackedCamera(page: Page) {
  await page.addInitScript(points => {
    const host = window as unknown as { fixturePoints: typeof points; createPoseFixture: () => Promise<object> };
    host.fixturePoints = points;
    host.createPoseFixture = async () => ({ detectForVideo: () => ({ landmarks: host.fixturePoints.length ? [host.fixturePoints] : [] }), close() {} });
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 480;
      const ctx = canvas.getContext("2d")!;
      const paint = () => { ctx.fillStyle = "#eceeea"; ctx.fillRect(0,0,640,480); ctx.strokeStyle = "#5b767e"; ctx.lineWidth = 8; ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(320,80,26,0,Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(320,108); ctx.lineTo(320,300); ctx.moveTo(260,150); ctx.lineTo(380,150); ctx.lineTo(410,300); ctx.moveTo(260,150); ctx.lineTo(230,300); ctx.moveTo(320,300); ctx.lineTo(285,440); ctx.moveTo(320,300); ctx.lineTo(355,440); ctx.stroke(); };
      paint(); const timer = setInterval(paint, 40), stream = canvas.captureStream(25);
      stream.getTracks()[0].addEventListener("ended", () => clearInterval(timer)); return stream;
    };
  }, standingPoints());
  await page.route("**/_next/static/chunks/*.js", async route => {
    const response = await route.fetch(), body = await response.text();
    if (!body.includes("The pose model took too long to load")) return route.fulfill({ response });
    const alias = body.match(/PoseLandmarker:([A-Za-z_$][\w$]*)/);
    if (!alias || !body.includes(`${alias[1]}.createFromOptions`)) throw new Error("Camera fixture could not identify the production hook module.");
    await route.fulfill({ response, body: body.replace(`${alias[1]}.createFromOptions`, "window.createPoseFixture") });
  });
}
export async function setPoints(page: Page, points: Landmark[]) { await page.evaluate(points => { (window as unknown as { fixturePoints: Landmark[] }).fixturePoints = points; }, points); }
