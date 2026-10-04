"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildArtwork, DEFAULT_ALIGNMENT, loadImage, normalizePhoto, type Alignment, type Artwork } from "@/lib/artwork";
import { silhouetteSvg } from "@/lib/rig";

export function useArtwork() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"upload" | "sample" | null>(null);
  const [alignment, setAlignment] = useState<Alignment>({ ...DEFAULT_ALIGNMENT });
  const [art, setArt] = useState<Artwork | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const version = useRef(0);

  const open = useCallback(async (url: string, filename: string, type: "upload" | "sample") => {
    const token = ++version.current;
    setBusy(true); setError("");
    try {
      const loaded = await loadImage(url);
      if (token !== version.current) return;
      if (loaded.naturalWidth < 100 || loaded.naturalHeight < 100) throw new Error("This image is too small. Use a photo at least 100 × 100 pixels.");
      if (loaded.naturalWidth * loaded.naturalHeight > 50_000_000) throw new Error("This photo is very large. Resize it below 50 megapixels and try again.");
      setImage(loaded); setName(filename); setKind(type);
      setAlignment({ ...DEFAULT_ALIGNMENT });
    } catch (caught) {
      if (token === version.current) setError(caught instanceof Error ? caught.message : "The photo could not be opened.");
    } finally {
      URL.revokeObjectURL(url);
      if (token === version.current) setBusy(false);
    }
  }, []);

  const upload = useCallback((file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG or WebP image. HEIC and SVG uploads are not supported."); return;
    }
    if (file.size > 20 * 1024 * 1024) { setError("This photo is over 20 MB. Use a smaller JPG, PNG or WebP image."); return; }
    void open(URL.createObjectURL(file), file.name, "upload");
  }, [open]);

  const sample = useCallback(() => {
    const url = URL.createObjectURL(new Blob([silhouetteSvg(true)], { type: "image/svg+xml" }));
    void open(url, "Example drawing", "sample");
  }, [open]);

  const reset = useCallback(() => {
    version.current++; setImage(null); setArt(null); setName(""); setKind(null); setError(""); setBusy(false);
    setAlignment({ ...DEFAULT_ALIGNMENT });
  }, []);

  useEffect(() => {
    if (!image) return;
    const normalized = normalizePhoto(image, alignment);
    setArt(buildArtwork(normalized, name));
  }, [image, alignment, name]);
  useEffect(() => () => { version.current++; }, []);

  return { art, name, kind, alignment, setAlignment, busy, error, upload, sample, reset };
}
