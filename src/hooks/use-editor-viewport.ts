"use client";
import { useEffect, type RefObject } from "react";

/** Keep the photo workspace steady; only dock the name field above a keyboard. */
export function useEditorViewport(enabled: boolean, main: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = main.current;
    if (!enabled || !root) return;
    const viewport = window.visualViewport;
    let baselineHeight = viewport?.height ?? window.innerHeight;
    let baselineWidth = viewport?.width ?? window.innerWidth;
    let keyboardSeen = false;
    let restoreFrame = 0;
    let scrollBeforeFocus = window.scrollY;
    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      const width = viewport?.width ?? window.innerWidth;
      const focused = document.activeElement === root.querySelector(".participant-name input");
      // Rotation and ordinary resizing still reflow the editor. A keyboard only
      // shortens the visual viewport, so retain the pre-keyboard photo geometry.
      if (Math.abs(width - baselineWidth) > 40 || (!focused && !keyboardSeen)) {
        baselineHeight = height; baselineWidth = width; keyboardSeen = false;
      }
      const raised = focused && baselineHeight - height > 100 && (viewport?.scale ?? 1) <= 1.05;
      if (raised && !keyboardSeen) {
        keyboardSeen = true;
        restoreFrame = requestAnimationFrame(() => window.scrollTo({ top: scrollBeforeFocus, behavior: "instant" }));
      }
      if (keyboardSeen && height >= baselineHeight - 40) keyboardSeen = false;
      root.style.setProperty("--editor-height", `${baselineHeight}px`);
      root.dataset.keyboard = String(raised);
      if (raised) {
        const bounds = root.getBoundingClientRect();
        root.style.setProperty("--name-field-top", `${height + (viewport?.offsetTop ?? 0) - 64}px`);
        root.style.setProperty("--name-field-left", `${bounds.left + 16}px`);
        root.style.setProperty("--name-field-width", `${bounds.width - 32}px`);
      }
    };
    const focus = () => { scrollBeforeFocus = window.scrollY; update(); };
    update();
    viewport?.addEventListener("resize", update); viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update); root.addEventListener("focusin", focus); root.addEventListener("focusout", update);
    return () => {
      cancelAnimationFrame(restoreFrame);
      viewport?.removeEventListener("resize", update); viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update); root.removeEventListener("focusin", focus); root.removeEventListener("focusout", update);
      for (const property of ["--editor-height", "--name-field-top", "--name-field-left", "--name-field-width"]) root.style.removeProperty(property);
      delete root.dataset.keyboard;
    };
  }, [enabled, main]);
}
