"use client";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction, type PointerEvent, type KeyboardEvent } from "react";
import { DEFAULT_ALIGNMENT, type Alignment } from "@/lib/artwork";
import { boundedAlignment, photoPoint, startPhotoGesture, updatePhotoGesture, zoomPhoto, type PhotoGesture, type PhotoPoint } from "@/lib/photo-alignment";

export function usePhotoGestures(alignment: Alignment, setAlignment: Dispatch<SetStateAction<Alignment>>, disabled: boolean, image: HTMLImageElement | null) {
  const surface = useRef<HTMLDivElement>(null), points = useRef(new Map<number, PhotoPoint>());
  const start = useRef<PhotoGesture | null>(null), current = useRef(alignment);
  const [active, setActive] = useState(false);
  current.current = alignment;
  const publish = (next: Alignment) => { current.current = next; setAlignment(next); };
  const rebase = () => { start.current = points.current.size ? startPhotoGesture(current.current, [...points.current.values()]) : null; };
  const cancel = useCallback(() => {
    const captured = [...points.current.keys()]; points.current.clear(); start.current = null; setActive(false);
    for (const id of captured) if (surface.current?.hasPointerCapture(id)) surface.current.releasePointerCapture(id);
  }, []);
  useEffect(() => {
    cancel();
    window.addEventListener("resize", cancel);
    window.addEventListener("blur", cancel);
    return () => { window.removeEventListener("resize", cancel); window.removeEventListener("blur", cancel); };
  }, [image, disabled, cancel]);
  const position = (event: PointerEvent<HTMLDivElement>) => photoPoint({ x: event.clientX, y: event.clientY }, event.currentTarget.getBoundingClientRect());
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !image || points.current.size >= 2 || event.pointerType === "mouse" && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    if (event.pointerType === "mouse") event.currentTarget.focus({ preventScroll: true });
    points.current.set(event.pointerId, position(event)); rebase(); setActive(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !points.current.has(event.pointerId) || !start.current) return;
    event.preventDefault(); points.current.set(event.pointerId, position(event));
    publish(updatePhotoGesture(start.current, [...points.current.values()]));
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (!points.current.has(event.pointerId)) return;
    if (event.type === "pointerup") onPointerMove(event);
    points.current.delete(event.pointerId); rebase(); setActive(points.current.size > 0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const zoom = (factor: number) => { if (!disabled) { cancel(); publish(zoomPhoto(current.current, factor)); } };
  const reset = () => { if (!disabled) { cancel(); publish({ ...DEFAULT_ALIGNMENT }); } };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || event.ctrlKey || event.metaKey || event.altKey) return;
    const amount = event.shiftKey ? 40 : 10;
    const move = { ArrowLeft: [-amount, 0], ArrowRight: [amount, 0], ArrowUp: [0, -amount], ArrowDown: [0, amount] }[event.key];
    if (move) { event.preventDefault(); cancel(); publish(boundedAlignment({ ...current.current, x: current.current.x + move[0], y: current.current.y + move[1] })); }
    else if (event.key === "+" || event.key === "=") { event.preventDefault(); zoom(1.2); }
    else if (event.key === "-") { event.preventDefault(); zoom(1 / 1.2); }
  };
  return { surface, active, zoom, reset, handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end,
    onLostPointerCapture: end, onKeyDown, onContextMenu: (event: React.MouseEvent) => event.preventDefault() } };
}
