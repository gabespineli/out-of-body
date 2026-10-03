"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { captureHipOrigin, motionFromLandmarks, REST, type Motion, type HipOrigin } from "@/lib/pose";

export type CameraStatus = "idle" | "permission" | "loading" | "live" | "error";
export type MotionSource = { motion: Motion; time: number };

export function cameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera permission was denied. Allow camera access in your browser’s site settings, then try again. Manual mode is available below.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "No webcam was found. Connect a camera and try again, or use manual mode.";
  if (name === "NotReadableError" || name === "TrackStartError") return "The camera is busy or unavailable. Close other apps using it, then try again. You can still use manual mode.";
  if (name === "OverconstrainedError") return "This camera could not provide a usable video stream. Try another camera or use manual mode.";
  return error instanceof Error ? error.message : "Camera tracking could not start. Try again or use manual mode.";
}

export function useCamera(source: React.RefObject<MotionSource>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<PoseLandmarker | null>(null);
  const frameRef = useRef<number>(0);
  const generation = useRef(0);
  const hipOrigin = useRef<HipOrigin | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState(false);
  const [fps, setFps] = useState(0);

  const release = useCallback(() => {
    generation.current++;
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    modelRef.current?.close(); modelRef.current = null;
    hipOrigin.current = null;
    source.current = { motion: { ...REST }, time: 0 };
  }, [source]);

  const stop = useCallback(() => {
    release(); setStatus("idle"); setTracking(false); setFps(0); setError("");
  }, [release]);

  const start = useCallback(async () => {
    release(); setError(""); setTracking(false); setFps(0);
    const token = generation.current;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is unavailable in this view. Open this Site directly in Chrome or Edge, or use manual demo.");
      }
      setStatus("permission");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } });
      if (token !== generation.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      setStatus("loading");
      await video.play();
      if (token !== generation.current) return;
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks("/vision");
      if (token !== generation.current) return;
      // A cancellation/timeout closes a model that finishes initializing late.
      const creation = PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: "/vision/pose_landmarker_lite.task", delegate: "CPU" },
        runningMode: "VIDEO", numPoses: 1,
        minPoseDetectionConfidence: .55, minPosePresenceConfidence: .55, minTrackingConfidence: .55,
        outputSegmentationMasks: false,
      }).then(model => {
        if (token !== generation.current) { model.close(); return null; }
        return model;
      });
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let model: PoseLandmarker | null;
      try {
        model = await Promise.race([creation, new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("The pose model took too long to load. Try again, or use manual mode.")), 20000);
        })]);
      } finally { clearTimeout(timeout); }
      if (!model || token !== generation.current) return;
      modelRef.current = model;
      setStatus("live");
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (token !== generation.current) return;
        release(); setTracking(false); setStatus("error"); setError("The webcam disconnected. Reconnect it and try again, or use manual mode.");
      }, { once: true });
      let lastInference = -Infinity, lastVideoTime = -1, lastUi = 0, lastHips = 0, count = 0, fpsTime = performance.now();
      const tick = (now: number) => {
        if (token !== generation.current) return;
        try {
          // Lite inference is limited to 20 Hz; the avatar renders independently at display rate.
          if (!document.hidden && now - lastInference >= 50 && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime; lastInference = now;
            const result = model.detectForVideo(video, now);
            const points = result.landmarks[0] ?? [], aspect = video.videoWidth / video.videoHeight;
            const candidate = captureHipOrigin(points, aspect);
            if (candidate) {
              if (!hipOrigin.current || now - lastHips > 1000) hipOrigin.current = candidate;
              lastHips = now;
            } else if (now - lastHips > 1000) hipOrigin.current = null;
            const motion = motionFromLandmarks(points, aspect, hipOrigin.current);
            source.current = { motion, time: performance.now() };
            count++;
            if (now - lastUi > 200) { setTracking(motion.tracked); lastUi = now; }
            if (now - fpsTime >= 1000) { setFps(Math.round(count * 1000 / (now - fpsTime))); count = 0; fpsTime = now; }
          }
          if (now - source.current.time > 300 && now - lastUi > 200) { setTracking(false); setFps(0); lastUi = now; }
          frameRef.current = requestAnimationFrame(tick);
        } catch {
          release(); setTracking(false); setStatus("error");
          setError("Pose tracking stopped unexpectedly. Restart the camera or use manual mode.");
        }
      };
      frameRef.current = requestAnimationFrame(tick);
    } catch (caught) {
      if (token !== generation.current) return;
      const message = cameraError(caught);
      release(); setStatus("error"); setTracking(false);
      setError(message.includes("fetch") || message.includes("model") || message.includes("WASM")
        ? "The pose model could not load. Reload the page and try again. Manual demo still works."
        : message);
    }
  }, [release, source]);

  useEffect(() => () => release(), [release]);
  const recenter = useCallback(() => { hipOrigin.current = null; }, []);
  return { videoRef, status, error, tracking, fps, start, stop, recenter };
}
