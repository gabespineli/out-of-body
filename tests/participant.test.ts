import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { pairingUrl, parsePairing, MAX_UPLOAD_BYTES } from "../src/lib/participant-session";
import { authorizedOperator, operatorProof, newToken, tokenHash, requireSameOrigin, credential, SessionError } from "../src/server/session-security";
import { readArtwork } from "../src/server/upload-validation";

test("pairing uses a URL fragment, a 256-bit token and distinct hashed credentials", () => {
  const token = newToken(), second = newToken(), id = "2b2c4167-d1ea-4f9f-a720-698e90ca1d53";
  assert.equal(token.length, 43); assert.notEqual(token, second);
  const url = new URL(pairingUrl("https://example.com/", { id, pairToken: token }));
  assert.equal(url.search, ""); assert.equal(url.pathname, "/mobile");
  assert.deepEqual(parsePairing(url.hash), { id, token });
  assert.equal(parsePairing("#pair=broken"), null); assert.equal(tokenHash(token).length, 64);
  assert.notEqual(tokenHash(token), tokenHash(second));
});
test("operator proofs expire and tampering/incorrect keys cannot authorize a new session", () => {
  const previous = process.env.OOB_INSTALLATION_KEY; process.env.OOB_INSTALLATION_KEY = "unit-test-only-operator-key-32-characters";
  try {
    const request = (proof: string) => new NextRequest("https://example.com/api/participant/session", { headers: { Cookie: `oob_operator=${proof}` } });
    assert.equal(authorizedOperator(request(operatorProof())), true);
    assert.equal(authorizedOperator(request(operatorProof(Date.now() - 1))), false);
    assert.equal(authorizedOperator(request(operatorProof(Date.now() + 9 * 3600_000))), false);
    assert.equal(authorizedOperator(request(operatorProof().slice(0, -1) + "!")), false);
    assert.equal(authorizedOperator(new NextRequest("https://example.com/api/participant/session", { headers: { Authorization: "Bearer wrong" } })), false);
  } finally { if (previous === undefined) delete process.env.OOB_INSTALLATION_KEY; else process.env.OOB_INSTALLATION_KEY = previous; }
});
test("origin checks accept the browser-facing local host and reject cross-origin changes", () => {
  requireSameOrigin(new NextRequest("http://localhost:3202/api/participant/session", { headers: { Host: "127.0.0.1:3202", Origin: "http://127.0.0.1:3202" } }));
  assert.throws(() => requireSameOrigin(new NextRequest("https://example.com/api/participant/session", { headers: { Origin: "https://another.example" } })), (cause: unknown) => cause instanceof SessionError && cause.status === 403);
  assert.throws(() => credential(new NextRequest("https://example.com/api/participant/session"), "oob_desktop"), (cause: unknown) => cause instanceof SessionError && cause.status === 401);
});
test("server accepts only the prepared opaque 600x900 PNG and preserves uploaded colors", async () => {
  const bytes = await sharp({ create: { width: 600, height: 900, channels: 4, background: { r: 39, g: 154, b: 163, alpha: 1 } } }).png().toBuffer();
  const prepared = await readArtwork(new Request("https://example.com", { method: "POST", headers: { "Content-Type": "image/png" }, body: bytes }));
  const image = sharp(prepared); const meta = await image.metadata(); assert.equal(meta.width, 600); assert.equal(meta.height, 900);
  const raw = await image.ensureAlpha().raw().toBuffer(); assert.deepEqual(Array.from(raw.subarray(0, 4)), [39, 154, 163, 255]);
});
test("wrong formats, invalid dimensions and excessive streams are rejected before storage", async () => {
  const request = (data: Buffer, type = "image/png") => new Request("https://example.com", { method: "POST", headers: { "Content-Type": type }, body: new Uint8Array(data) });
  await assert.rejects(readArtwork(request(Buffer.from("<svg/>"), "image/svg+xml")), (cause: unknown) => cause instanceof SessionError && cause.status === 415);
  await assert.rejects(readArtwork(request(Buffer.from("invalid"))), (cause: unknown) => cause instanceof SessionError && cause.status === 400);
  const wrongSize = await sharp({ create: { width: 100, height: 100, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(readArtwork(request(wrongSize)), (cause: unknown) => cause instanceof SessionError && cause.status === 400);
  await assert.rejects(readArtwork(request(Buffer.alloc(MAX_UPLOAD_BYTES + 1))), (cause: unknown) => cause instanceof SessionError && cause.status === 413);
});
