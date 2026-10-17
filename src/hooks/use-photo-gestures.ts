"use client";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction, type PointerEvent, type KeyboardEvent } from "react";
import { DEFAULT_ALIGNMENT, type Alignment } from "@/lib/artwork";
import { boundedAlignment, photoPoint, startPhotoGesture, updatePhotoGesture, zoomPhoto, type PhotoGesture, type PhotoPoint } from "@/lib/photo-alignment";

export function usePhotoGestures(alignment: Alignment, setAlignment: Dispatch<SetStateAction<Alignment>>, disabled: boolean, image: HTMLImageElement | null) {
  const surface = useRef<HTMLDivElement>(null), points = useRef(new Map<number, PhotoPoint>());
  const start = useRef<PhotoGesture | null>(null), current = useRef(alignment);
  const input = useRef(""), [active, setActive] = useState(false), [adjusted, setAdjusted] = useState(false);
  current.current = alignment;
  const publish = (next: Alignment) => {
    if (Math.abs(next.x - current.current.x) + Math.abs(next.y - current.current.y) + Math.abs(next.scale - current.current.scale) > .01) setAdjusted(true);
    current.current = next; setAlignment(next);
  };
  const rebase = () => {
    const enough = points.current.size >= (input.current === "touch" ? 2 : 1);
    start.current = enough ? startPhotoGesture(current.current, [...points.current.values()]) : null;
    setActive(enough);
  };
  const cancel = useCallback(() => {
    const captured = [...points.current.keys()]; points.current.clear(); start.current = null; setActive(false);
    for (const id of captured) if (surface.current?.hasPointerCapture(id)) surface.current.releasePointerCapture(id);
  }, []);
  useEffect(() => {
    cancel();
    const observer = new ResizeObserver(cancel);
    if (surface.current) observer.observe(surface.current);
    window.addEventListener("resize", cancel);
    window.addEventListener("blur", cancel);
    return () => { observer.disconnect(); window.removeEventListener("resize", cancel); window.removeEventListener("blur", cancel); };
  }, [image, disabled, cancel]);
  useEffect(() => { setAdjusted(false); }, [image]);
  const position = (event: PointerEvent<HTMLDivElement>) => photoPoint({ x: event.clientX, y: event.clientY }, event.currentTarget.getBoundingClientRect());
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !image || points.current.size >= 2 || event.pointerType === "mouse" && event.button !== 0) return;
    if (points.current.size && input.current !== event.pointerType) return;
    const rect = event.currentTarget.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    if (event.pointerType === "mouse") event.currentTarget.focus({ preventScroll: true });
    input.current = event.pointerType;
    points.current.set(event.pointerId, position(event)); rebase();
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !points.current.has(event.pointerId)) return;
    event.preventDefault(); points.current.set(event.pointerId, position(event));
    if (start.current) publish(updatePhotoGesture(start.current, [...points.current.values()]));
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (!points.current.has(event.pointerId)) return;
    if (event.type === "pointerup") onPointerMove(event);
    points.current.delete(event.pointerId); rebase();
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
  return { surface, active, adjusted, zoom, reset, handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end,
    onLostPointerCapture: end, onKeyDown, onContextMenu: (event: React.MouseEvent) => event.preventDefault() } };
}
