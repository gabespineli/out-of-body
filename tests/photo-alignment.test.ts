import test from "node:test";
import assert from "node:assert/strict";
import { photoPoint, startPhotoGesture, updatePhotoGesture, zoomPhoto } from "../src/lib/photo-alignment";
const rest = { scale: 1, x: 0, y: 0, rotation: 0 };
test("drag coordinates follow the 600x900 photo at different display sizes", () => {
  assert.deepEqual(photoPoint({ x: 166, y: 317 }, { left: 16, top: 92, width: 300, height: 450 }), { x: 300, y: 450 });
  const start = startPhotoGesture(rest, [{ x: 200, y: 300 }]);
  assert.deepEqual(updatePhotoGesture(start, [{ x: 230, y: 320 }]), { ...rest, x: 30, y: 20 });
});
test("off-center pinch keeps the photo point beneath the moving finger midpoint", () => {
  const start = startPhotoGesture({ ...rest, x: 30, y: 20, rotation: 17 }, [{ x: 290, y: 405 }, { x: 370, y: 405 }]);
  const result = updatePhotoGesture(start, [{ x: 260, y: 420 }, { x: 420, y: 420 }]);
  assert.deepEqual(result, { scale: 2, x: 40, y: 100, rotation: 17 });
  // The original photo point is (0,-65) from its transformed center.
  assert.equal(300 + result.x, 340);
  assert.equal(450 + result.y - 65 * result.scale, 420);
});
test("lifting one finger rebases the next drag without moving the photo", () => {
  const pinched = updatePhotoGesture(startPhotoGesture(rest, [{ x: 200, y: 450 }, { x: 400, y: 450 }]), [{ x: 150, y: 450 }, { x: 450, y: 450 }]);
  const remaining = startPhotoGesture(pinched, [{ x: 450, y: 450 }]);
  assert.deepEqual(updatePhotoGesture(remaining, [{ x: 450, y: 450 }]), pinched);
  assert.deepEqual(updatePhotoGesture(remaining, [{ x: 475, y: 420 }]), { ...pinched, x: 25, y: -30 });
});
test("gesture limits prevent disappearing photos and degenerate pinches stay finite", () => {
  const start = startPhotoGesture(rest, [{ x: 100, y: 450 }, { x: 500, y: 450 }]);
  assert.deepEqual(updatePhotoGesture(start, [{ x: -1000, y: -1000 }, { x: 2000, y: -1000 }]), { scale: 3, x: 200, y: -400, rotation: 0 });
  assert.equal(updatePhotoGesture(start, [{ x: 299, y: 450 }, { x: 301, y: 450 }]).scale, .5);
  const overlapping = startPhotoGesture(rest, [{ x: 200, y: 300 }, { x: 200, y: 300 }]);
  assert.deepEqual(updatePhotoGesture(overlapping, [{ x: 190, y: 310 }, { x: 230, y: 310 }]), { ...rest, x: 10, y: 10 });
});
test("gesture snapshots are independent of live points and contact changes need a new baseline", () => {
  const original = [{ x: 200, y: 300 }];
  const start = startPhotoGesture(rest, original); original[0].x = 900;
  assert.deepEqual(updatePhotoGesture(start, [{ x: 200, y: 300 }]), rest);
  assert.deepEqual(updatePhotoGesture(start, []), rest);
});
test("quick zoom uses the same focal behavior and respects both zoom limits", () => {
  assert.deepEqual(zoomPhoto({ ...rest, x: 30, y: 20 }, 2, { x: 330, y: 405 }), { ...rest, scale: 2, x: 30, y: 85 });
  assert.equal(zoomPhoto(rest, 10).scale, 3); assert.equal(zoomPhoto(rest, .01).scale, .5);
});
