"use client";
import { useEffect, useState } from "react";
import { QueueMobileFlow } from "./queue-mobile-flow";
export function MobileFlow() {
  const [opened, setOpened] = useState(false), [notice, setNotice] = useState("");
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setNotice("This printed pairing link now opens the installation queue. Join below for a new private ticket.");
    }
    setOpened(true);
  }, []);
  if (!opened) return <p role="status">Opening upload…</p>;
  return <QueueMobileFlow notice={notice} />;
}
