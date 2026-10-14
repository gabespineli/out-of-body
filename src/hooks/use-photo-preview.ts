"use client";
import { useCallback, useRef, useState } from "react";
import { DEFAULT_ALIGNMENT, loadImage, normalizePhoto } from "@/lib/artwork";
import { MAX_UPLOAD_BYTES } from "@/lib/participant-session";
import { cleanDrawingCanvas } from "@/lib/drawing-cleanup";
export function usePhotoPreview() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [alignment, setAlignment] = useState({ ...DEFAULT_ALIGNMENT }), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const version = useRef(0);
  const [cleanupStrength, setCleanupStrength] = useState(.75), [showOriginal, setShowOriginal] = useState(false);
  const open = useCallback(async (file: File) => {
    const token = ++version.current; setError(""); setBusy(true);
    const url = URL.createObjectURL(file);
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG or WebP photo.");
      if (file.size > 20 * 1024 * 1024) throw new Error("Choose a photo smaller than 20 MB.");
      const loaded = await loadImage(url);
      if (loaded.naturalWidth < 100 || loaded.naturalHeight < 100 || loaded.naturalWidth * loaded.naturalHeight > 50_000_000) throw new Error("Use a photo at least 100 pixels wide, below 50 megapixels.");
      if (token !== version.current) return false;
      setImage(loaded); setAlignment({ ...DEFAULT_ALIGNMENT }); setCleanupStrength(.75); setShowOriginal(false); return true;
    } catch (cause) { if (token === version.current) setError(cause instanceof Error ? cause.message : "The photo could not be opened."); return false; }
    finally { URL.revokeObjectURL(url); if (token === version.current) setBusy(false); }
  }, []);
  const prepared = useCallback(async () => {
    if (!image) throw new Error("Choose or capture your drawing first.");
    const canvas = normalizePhoto(image, alignment);
    cleanDrawingCanvas(canvas, cleanupStrength);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("The preview could not be prepared.")), "image/png"));
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error("The prepared photo is too large. Use a smaller or clearer photo.");
    return blob;
  }, [image, alignment, cleanupStrength]);
  const clear = useCallback(() => { version.current++; setImage(null); setError(""); setBusy(false); setAlignment({ ...DEFAULT_ALIGNMENT }); }, []);
  return { image, alignment, setAlignment, cleanupStrength, setCleanupStrength, showOriginal, setShowOriginal, error, busy, open, prepared, clear };
}
