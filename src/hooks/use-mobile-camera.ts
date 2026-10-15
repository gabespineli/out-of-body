"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { cameraAlreadyAllowed } from "./use-camera-devices";
function cameraError(cause: unknown) {
  const name = cause instanceof Error ? cause.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera permission was denied. Allow it in browser settings, or choose a photo.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "No camera was found. Choose a photo instead.";
  if (name === "NotReadableError" || name === "TrackStartError") return "The camera is busy. Close other camera apps or choose a photo.";
  return cause instanceof Error ? cause.message : "The camera could not open. Choose a photo instead.";
}
export function useMobileCamera() {
  const video = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null), generation = useRef(0);
  const [status, setStatus] = useState<"idle" | "requesting" | "live">("idle"), [error, setError] = useState("");
  const latestStatus = useRef(status); latestStatus.current = status;
  const release = useCallback(() => {
    generation.current++; stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);
  const stop = useCallback(() => { release(); setStatus("idle"); }, [release]);
  const start = useCallback(async () => {
    release(); setError(""); setStatus("requesting"); const token = generation.current;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("The camera needs HTTPS. You can choose a photo instead.");
      const current = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1920 } } });
      if (token !== generation.current) { current.getTracks().forEach(track => track.stop()); return; }
      stream.current = current;
      if (!video.current) { release(); setStatus("idle"); return; }
      video.current.srcObject = current; await video.current.play();
      if (token !== generation.current) return;
      current.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (token === generation.current) { stop(); setError("The camera disconnected. Retry or choose a photo."); }
      }, { once: true });
      setStatus("live");
    } catch (cause) {
      if (token !== generation.current) return;
      release(); setStatus("idle"); setError(cameraError(cause));
    }
  }, [release, stop]);
  const startAllowed = useCallback(async () => {
    if (latestStatus.current !== "idle") return;
    const token = generation.current;
    if (await cameraAlreadyAllowed() && token === generation.current && !stream.current && !document.hidden) await start();
  }, [start]);
  const capture = useCallback(async () => {
    const element = video.current;
    if (!element || element.readyState < 2 || !element.videoWidth) throw new Error("Wait for the camera preview, then try again.");
    const canvas = document.createElement("canvas"); canvas.width = 600; canvas.height = 900;
    const sourceWidth = Math.min(element.videoWidth, element.videoHeight * 2 / 3);
    const sourceHeight = Math.min(element.videoHeight, element.videoWidth * 3 / 2);
    canvas.getContext("2d")!.drawImage(element, (element.videoWidth - sourceWidth) / 2, (element.videoHeight - sourceHeight) / 2, sourceWidth, sourceHeight, 0, 0, 600, 900);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("The photo could not be captured.")), "image/png"));
    stop(); return new File([blob], "drawing-camera.png", { type: "image/png" });
  }, [stop]);
  useEffect(() => release, [release]);
  return { video, status, error, start, stop, capture, startAllowed };
}
