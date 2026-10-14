import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import sharp from "sharp";
import jsQR from "jsqr";
import { silhouetteSvg } from "../../src/lib/rig";
const settings = (() => { try { return { ...parseEnv(readFileSync(".env.local", "utf8")), ...process.env }; } catch { return process.env; } })();
const configured = settings.SUPABASE_URL === "http://127.0.0.1:55321" && !!settings.SUPABASE_SECRET_KEY;
test.skip(!configured, "Only the dedicated local Out of Body backend may be tested.");
test.use({ trace: "off" });
const db = () => createClient(settings.SUPABASE_URL!, settings.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const created = new Set<string>(); let drawing: Buffer;
test.beforeAll(async () => {
  drawing = await sharp(Buffer.from(silhouetteSvg(false).replace("</svg>", '<rect x="256" y="324" width="87" height="130" fill="#279aa3"/><rect x="292" y="427" width="16" height="16" fill="#222222"/></svg>'))).png().toBuffer();
});
test.afterEach(async () => {
  for (const id of created) {
    const row = (await db().from("oob_queue_tickets").select("object_path").eq("id", id).maybeSingle()).data;
    if (row?.object_path) await db().storage.from("oob-temporary-artwork").remove([row.object_path]);
    await db().from("oob_queue_tickets").delete().eq("id", id);
  }
  created.clear();
});
async function open(request: APIRequestContext) {
  const response = await request.post("/api/participant/queue", { headers: { Authorization: `Bearer ${settings.OOB_INSTALLATION_KEY}` } });
  expect(response.status()).toBe(200); return response.json();
}
async function join(context: BrowserContext) {
  const response = await context.request.post("/api/participant/queue/ticket"); expect(response.status()).toBe(200);
  const ticket = await response.json(); created.add(ticket.id); return ticket;
}
async function upload(context: BrowserContext, name = "Alex") {
  const response = await context.request.post("/api/participant/queue/upload", { headers: { "Content-Type": "image/png", "X-Participant-Name": encodeURIComponent(name) }, data: drawing });
  expect(response.status()).toBe(200); return response.json();
}
async function action(request: APIRequestContext, action: string, id?: string) {
  const response = await request.post("/api/participant/queue/action", { data: { action, id } }); expect(response.status()).toBe(200);
}
test("permanent QR, private named upload, call/start, top queue, fullscreen, completion and deletion", async ({ page, browser }) => {
  await open(page.request); await page.goto("/installation");
  await expect(page.getByTestId("queue-bar")).toBeVisible(); await page.getByText("Permanent QR", { exact: true }).click();
  const qr = await page.getByTestId("session-qr").getAttribute("src");
  const pixels = await sharp(Buffer.from(qr!.split(",")[1], "base64")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(pixels.data), pixels.info.width, pixels.info.height);
  expect(decoded?.data).toBe("http://127.0.0.1:3202/mobile");
  await page.getByText("Permanent QR", { exact: true }).click();
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } }), phone = await mobile.newPage();
  try {
    await phone.goto(decoded!.data); await phone.getByRole("button", { name: "Upload drawing", exact: true }).click();
    await expect(phone.getByTestId("mobile-photo")).toBeVisible();
    const ticket = await phone.request.get("/api/participant/queue/ticket").then(r => r.json()); created.add(ticket.id);
    await phone.getByTestId("mobile-photo").setInputFiles({ name: "drawing.png", mimeType: "image/png", buffer: drawing });
    await phone.getByLabel("Name we can call at the exhibit").fill("Alex");
    const preview = await phone.getByTestId("mobile-preview").evaluate(el => (el as HTMLCanvasElement).toDataURL());
    await phone.getByRole("button", { name: "Send to installation", exact: true }).click();
    await expect(phone.getByTestId("queue-ticket")).toContainText("Alex");
    await expect(page.getByTestId("queue-bar")).toContainText("Alex", { timeout: 10000 });
    await expect(page.getByTestId("avatar")).toHaveAttribute("aria-label", /Blank silhouette/);
    await page.getByRole("button", { name: "Call next", exact: true }).click();
    await expect(page.getByTestId("queue-bar")).toContainText("Calling: Alex");
    await page.getByRole("button", { name: "Start participant", exact: true }).click();
    await expect.poll(() => page.getByTestId("avatar").evaluate(el => Array.from((el as HTMLCanvasElement).getContext("2d")!.getImageData(420, 385, 1, 1).data))).toEqual([39, 154, 163, 255]);
    const row = (await db().from("oob_queue_tickets").select("object_path").eq("id", ticket.id).single()).data!;
    const stored = await db().storage.from("oob-temporary-artwork").download(row.object_path);
    const submitted = await sharp(Buffer.from(await stored.data!.arrayBuffer())).ensureAlpha().raw().toBuffer();
    expect(submitted.equals(await sharp(Buffer.from(preview.split(",")[1], "base64")).ensureAlpha().raw().toBuffer())).toBe(true);
    const nextPhone = await browser.newContext();
    try { await join(nextPhone); await upload(nextPhone, "Sam"); }
    finally { await nextPhone.close(); }
    await expect(page.getByTestId("queue-bar")).toContainText("Sam", { timeout: 10000 });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1024 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const queueBounds = await page.getByTestId("queue-bar").boundingBox(), stageBounds = await page.getByTestId("avatar").boundingBox();
      expect(queueBounds!.y + queueBounds!.height).toBeLessThan(stageBounds!.y);
    }
    await page.screenshot({ path: "test-results/queue-stretching.png", fullPage: true });
    await page.getByRole("button", { name: "Open installation fullscreen", exact: true }).click();
    await expect(page.getByTestId("queue-bar")).toBeVisible();
    await page.getByRole("button", { name: "Exit fullscreen", exact: true }).click();
    await page.getByRole("combobox", { name: "Motion source", exact: true }).selectOption("manual");
    await page.getByRole("button", { name: "Start guided session", exact: true }).click();
    await page.getByRole("button", { name: "Skip activity", exact: true }).click();
    await page.getByRole("button", { name: "Skip activity", exact: true }).click();
    await page.getByRole("button", { name: "Skip activity", exact: true }).click();
    await expect(page.getByTestId("participant-completion")).toBeVisible();
    await expect(page.getByTestId("queue-bar")).toBeVisible();
    await expect.poll(async () => (await db().storage.from("oob-temporary-artwork").download(row.object_path)).error !== null).toBe(true);
    expect((await db().from("oob_queue_tickets").select("participant_name,status").eq("id", ticket.id).single()).data).toEqual({ participant_name: "", status: "completed" });
    await page.getByText("Permanent QR", { exact: true }).click(); expect(await page.getByTestId("session-qr").getAttribute("src")).toBe(qr);
  } finally { await mobile.close(); }
});
test("concurrent admission stops at 20, existing tickets finish, and cancellation/expiry reopen slots", async ({ request, browser }) => {
  await open(request); const contexts = await Promise.all(Array.from({ length: 23 }, () => browser.newContext()));
  try {
    const responses = await Promise.all(contexts.map(c => c.request.post("/api/participant/queue/ticket")));
    expect(responses.filter(r => r.status() === 200)).toHaveLength(20); expect(responses.filter(r => r.status() === 409)).toHaveLength(3);
    const accepted: { context: BrowserContext; ticket: { id: string } }[] = [];
    for (let i = 0; i < responses.length; i++) if (responses[i].status() === 200) { const ticket = await responses[i].json(); created.add(ticket.id); accepted.push({ context: contexts[i], ticket }); }
    expect((await request.get("/api/participant/queue").then(r => r.json())).accepting).toBe(false);
    await upload(accepted[0].context);
    const first = await accepted[0].context.request.post("/api/participant/queue/ticket").then(r => r.json()); expect(first.id).toBe(accepted[0].ticket.id);
    expect((await accepted[1].context.request.delete("/api/participant/queue/ticket")).status()).toBe(200);
    expect((await request.get("/api/participant/queue").then(r => r.json())).accepting).toBe(true);
    await db().from("oob_queue_tickets").update({ expires_at: new Date(Date.now() - 1).toISOString() }).eq("id", accepted[2].ticket.id);
    expect((await request.get("/api/participant/queue").then(r => r.json())).waiting).toBe(18);
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
test("FIFO follows upload order; call later and simultaneous starts preserve one active participant", async ({ request, browser }) => {
  await open(request); const first = await browser.newContext(), second = await browser.newContext();
  try {
    const a = await join(first), b = await join(second); await upload(second, "Sam"); await upload(first, "Alex");
    await action(request, "call"); let queue = await request.get("/api/participant/queue?view=operator").then(r => r.json()); expect(queue.called.id).toBe(b.id);
    await action(request, "later", b.id); await action(request, "call"); queue = await request.get("/api/participant/queue?view=operator").then(r => r.json()); expect(queue.called.id).toBe(a.id);
    const starts = await Promise.all([a.id, b.id].map(id => request.post("/api/participant/queue/action", { data: { action: "start", id } })));
    expect(starts.map(r => r.status()).sort()).toEqual([200, 409]);
    expect((await db().from("oob_queue_tickets").select("id").eq("status", "active")).data).toHaveLength(1);
    const phone = await second.request.get("/api/participant/queue/ticket").then(r => r.json()); expect(phone.ahead).toBe(1);
    await action(request, "end", a.id);
  } finally { await first.close(); await second.close(); }
});
test("private credentials, public counts, RLS, origin and name validation protect the queue", async ({ request, browser }) => {
  await open(request); const phone = await browser.newContext(), thief = await browser.newContext();
  try {
    const ticket = await join(phone);
    expect((await thief.request.get("/api/participant/queue?view=operator")).status()).toBe(401);
    expect((await thief.request.get("/api/participant/queue/artwork?id=" + ticket.id)).status()).toBe(401);
    expect((await thief.request.post("/api/participant/queue/action", { data: { action: "call" } })).status()).toBe(401);
    expect((await thief.request.post("/api/participant/queue/ticket", { headers: { Origin: "https://elsewhere.example" } })).status()).toBe(403);
    expect((await phone.request.post("/api/participant/queue/upload", { headers: { "Content-Type": "image/png", "X-Participant-Name": "a".repeat(41) }, data: drawing })).status()).toBe(400);
    await upload(phone, "<Alex>");
    const publicInfo = await thief.request.get("/api/participant/queue").then(r => r.json()); expect(Object.keys(publicInfo).sort()).toEqual(["accepting", "capacity", "online", "waiting"]);
    const anonymous = createClient(settings.SUPABASE_URL!, settings.OOB_LOCAL_ANON_KEY!, { auth: { persistSession: false } });
    expect((await anonymous.from("oob_queue_tickets").select("*")).error).not.toBeNull();
    expect((await anonymous.rpc("oob_queue_action", { p_action: "call" })).error).not.toBeNull();
  } finally { await phone.close(); await thief.close(); }
});
test("upload retries do not replace drawings, and a cancelled in-flight upload cannot publish", async ({ request, browser }) => {
  await open(request); const phone = await browser.newContext();
  try {
    const ticket = await join(phone);
    const responses = await Promise.all([upload(phone, "First"), phone.request.post("/api/participant/queue/upload", { headers: { "Content-Type": "image/png" }, data: drawing })]);
    expect([200, 409]).toContain((responses[1] as { status(): number }).status());
    const row = (await db().from("oob_queue_tickets").select("object_path,participant_name").eq("id", ticket.id).single()).data!;
    await upload(phone, "Replacement"); expect((await db().from("oob_queue_tickets").select("object_path,participant_name").eq("id", ticket.id).single()).data).toEqual(row);
    await phone.request.delete("/api/participant/queue/ticket");
    const published = await db().rpc("oob_queue_publish", { p_id: ticket.id, p_path: row.object_path, p_name: "Late", p_bytes: drawing.length }); expect(published.error).not.toBeNull();
  } finally { await phone.close(); }
});
test("expired tickets lose names and scheduled cleanup removes stored artwork", async ({ request, browser }) => {
  test.setTimeout(90000);
  await open(request); const phone = await browser.newContext();
  try {
    const ticket = await join(phone); await upload(phone);
    const row = (await db().from("oob_queue_tickets").select("object_path").eq("id", ticket.id).single()).data!;
    await db().from("oob_queue_tickets").update({ expires_at: new Date(Date.now() - 180_000).toISOString() }).eq("id", ticket.id);
    const expired = await phone.request.get("/api/participant/queue/ticket").then(r => r.json()); expect(expired.status).toBe("expired"); expect(expired.name).toBe("");
    await expect.poll(async () => (await db().from("oob_queue_tickets").select("id").eq("id", ticket.id).maybeSingle()).data, { timeout: 75000, intervals: [2000, 5000] }).toBeNull();
    expect((await db().storage.from("oob-temporary-artwork").download(row.object_path)).error).not.toBeNull();
  } finally { await phone.close(); }
});
test("legacy printed links fall back to permanent entry after expiry", async ({ page, request }) => {
  await open(request);
  await page.goto("/mobile#pair=12345678-1234-1234-1234-123456789abc." + "a".repeat(43));
  await expect(page.getByRole("button", { name: "Upload drawing", exact: true })).toBeEnabled();
  await expect(page.getByText(/printed pairing link now opens/)).toBeVisible(); expect(new URL(page.url()).hash).toBe("");
});
test("an unexpired printed pairing link also enters the shared queue, never a stranded legacy upload", async ({ page, request }) => {
  await open(request);
  const legacy = await request.post("/api/participant/session", { headers: { Authorization: `Bearer ${settings.OOB_INSTALLATION_KEY}` } }).then(r => r.json());
  try {
    await page.goto(legacy.pairingUrl); await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
    await expect(page.getByTestId("mobile-photo")).toBeVisible();
    const ticket = await page.request.get("/api/participant/queue/ticket").then(r => r.json()); created.add(ticket.id); expect(ticket.status).toBe("preparing");
    expect(new URL(page.url()).hash).toBe("");
  } finally { await db().from("oob_sessions").delete().eq("id", legacy.id); }
});
test("a lost reservation response restores the same ticket using the private browser credential", async ({ request, browser }) => {
  await open(request); const phone = await browser.newContext();
  try {
    await phone.request.get("/api/participant/queue"); const first = await join(phone);
    await phone.clearCookies({ name: "oob_queue_ticket" });
    const restored = await join(phone); expect(restored.id).toBe(first.id); expect(restored.number).toBe(first.number);
    expect((await phone.request.get("/api/participant/queue/ticket").then(r => r.json())).id).toBe(first.id);
  } finally { await phone.close(); }
});
test("phone cleanup comparison and off control submit exactly the displayed configured result", async ({ page, request }) => {
  await open(request); await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/mobile");
  await page.getByRole("button", { name: "Upload drawing", exact: true }).click();
  await expect(page.getByTestId("mobile-photo")).toBeVisible();
  const ticket = await page.request.get("/api/participant/queue/ticket").then(r => r.json()); created.add(ticket.id);
  const shadowed = await sharp({ create: { width: 600, height: 900, channels: 3, background: { r: 195, g: 180, b: 160 } } }).png().toBuffer();
  await page.getByTestId("mobile-photo").setInputFiles({ name: "warm-paper.png", mimeType: "image/png", buffer: shadowed });
  const pixel = () => page.getByTestId("mobile-preview").evaluate(el => Array.from((el as HTMLCanvasElement).getContext("2d")!.getImageData(100, 100, 1, 1).data));
  await page.getByRole("slider", { name: "Cleanup amount", exact: true }).fill("1");
  await expect.poll(pixel).toEqual([250, 248, 243, 255]);
  await page.getByRole("button", { name: "Original", exact: true }).click(); await expect.poll(pixel).toEqual([195, 180, 160, 255]);
  await page.getByRole("button", { name: "Cleaned", exact: true }).click(); await expect.poll(pixel).toEqual([250, 248, 243, 255]);
  await page.getByRole("button", { name: "Turn off cleanup", exact: true }).click(); await expect.poll(pixel).toEqual([195, 180, 160, 255]);
  await page.getByRole("button", { name: "Send to installation", exact: true }).click(); await expect(page.getByTestId("queue-ticket")).toBeVisible();
  const row = (await db().from("oob_queue_tickets").select("object_path").eq("id", ticket.id).single()).data!;
  const uploaded = await db().storage.from("oob-temporary-artwork").download(row.object_path);
  const raw = await sharp(Buffer.from(await uploaded.data!.arrayBuffer())).ensureAlpha().raw().toBuffer();
  expect(Array.from(raw.subarray((100 * 600 + 100) * 4, (100 * 600 + 100) * 4 + 4))).toEqual([195, 180, 160, 255]);
});
