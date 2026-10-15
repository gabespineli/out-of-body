"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export function useCameraDevices(storageKey: string) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]), [deviceId, setDeviceId] = useState("");
  const selected = useRef(""), mounted = useRef(false), version = useRef(0);
  const choose = useCallback((id: string) => {
    selected.current = id; setDeviceId(id);
    try { if (id) localStorage.setItem(storageKey, id); else localStorage.removeItem(storageKey); } catch { /* Optional preference only. */ }
  }, [storageKey]);
  const refresh = useCallback(async () => {
    if (document.hidden || !navigator.mediaDevices?.enumerateDevices) return;
    const turn = ++version.current;
    try {
      const cameras = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === "videoinput" && device.deviceId);
      if (!mounted.current || turn !== version.current) return;
      setDevices(cameras);
      // Do not discard a saved choice from the restricted list shown before permission.
      if (selected.current && cameras.some(camera => camera.label) && !cameras.some(camera => camera.deviceId === selected.current)) choose("");
    } catch { /* The default camera remains available if discovery is unsupported. */ }
  }, [choose]);
  useEffect(() => {
    mounted.current = true;
    try { const saved = localStorage.getItem(storageKey); if (saved) { selected.current = saved; setDeviceId(saved); } } catch { /* Optional preference only. */ }
    void refresh();
    const update = () => { void refresh(); };
    navigator.mediaDevices?.addEventListener?.("devicechange", update);
    document.addEventListener("visibilitychange", update);
    return () => { mounted.current = false; version.current++; navigator.mediaDevices?.removeEventListener?.("devicechange", update); document.removeEventListener("visibilitychange", update); };
  }, [storageKey, refresh]);
  return { devices, deviceId, selected, choose, refresh };
}

export async function cameraAlreadyAllowed() {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return false;
  try {
    if (navigator.permissions?.query) return (await navigator.permissions.query({ name: "camera" as PermissionName })).state === "granted";
  } catch { /* Some browsers do not support querying camera permission. */ }
  try { return (await navigator.mediaDevices.enumerateDevices()).some(device => device.kind === "videoinput" && !!device.label); }
  catch { return false; }
}

// One attempt per visit to setup. Stop/cancel must never cause an automatic restart.
export function useAutoCamera(enabled: boolean, startAllowed: () => Promise<void>) {
  useEffect(() => {
    if (!enabled) return;
    let attempted = false;
    const open = () => { if (document.hidden || attempted) return; attempted = true; void startAllowed(); };
    open(); document.addEventListener("visibilitychange", open);
    return () => document.removeEventListener("visibilitychange", open);
  }, [enabled, startAllowed]);
}
