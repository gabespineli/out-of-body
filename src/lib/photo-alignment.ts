import type { Alignment } from "./artwork";
import { WIDTH, HEIGHT } from "./rig";
export type PhotoPoint = { x: number; y: number };
export type PhotoGesture = { alignment: Alignment; points: PhotoPoint[] };
export const PHOTO_LIMITS = { scale: [.5, 3], x: [-250, 250], y: [-400, 400], rotation: [-30, 30] } as const;
const clamp = (value: number, [min, max]: readonly [number, number]) => Math.max(min, Math.min(max, value));
const center = (points: PhotoPoint[]) => points.length === 1 ? points[0]
  : { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
const distance = (points: PhotoPoint[]) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
export function boundedAlignment(alignment: Alignment): Alignment {
  return { scale: clamp(alignment.scale, PHOTO_LIMITS.scale), x: clamp(alignment.x, PHOTO_LIMITS.x),
    y: clamp(alignment.y, PHOTO_LIMITS.y), rotation: clamp(alignment.rotation, PHOTO_LIMITS.rotation) };
}
export function photoPoint(client: PhotoPoint, rect: { left: number; top: number; width: number; height: number }): PhotoPoint {
  return { x: (client.x - rect.left) * WIDTH / rect.width, y: (client.y - rect.top) * HEIGHT / rect.height };
}
export function startPhotoGesture(alignment: Alignment, points: PhotoPoint[]): PhotoGesture {
  return { alignment: { ...alignment }, points: points.slice(0, 2).map(point => ({ ...point })) };
}
export function updatePhotoGesture(start: PhotoGesture, points: PhotoPoint[]): Alignment {
  if (!start.points.length || points.length !== start.points.length) return { ...start.alignment };
  const previous = center(start.points), current = center(points);
  const originalDistance = points.length === 2 ? distance(start.points) : 0;
  const scale = points.length === 2 && originalDistance > .001
    ? clamp(start.alignment.scale * distance(points) / originalDistance, PHOTO_LIMITS.scale) : start.alignment.scale;
  // Keep the same photo point under the fingers, including while their midpoint moves.
  const ratio = scale / start.alignment.scale;
  return boundedAlignment({ ...start.alignment, scale,
    x: current.x - WIDTH / 2 - (previous.x - WIDTH / 2 - start.alignment.x) * ratio,
    y: current.y - HEIGHT / 2 - (previous.y - HEIGHT / 2 - start.alignment.y) * ratio });
}
export function zoomPhoto(alignment: Alignment, factor: number, anchor: PhotoPoint = { x: WIDTH / 2, y: HEIGHT / 2 }): Alignment {
  const scale = clamp(alignment.scale * factor, PHOTO_LIMITS.scale), ratio = scale / alignment.scale;
  return boundedAlignment({ ...alignment, scale,
    x: anchor.x - WIDTH / 2 - (anchor.x - WIDTH / 2 - alignment.x) * ratio,
    y: anchor.y - HEIGHT / 2 - (anchor.y - HEIGHT / 2 - alignment.y) * ratio });
}
