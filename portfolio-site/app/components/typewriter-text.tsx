"use client";

import { useEffect, useState } from "react";

export function TypewriterText({
  text,
  speed = 22,
  onDone,
  onProgress,
}: {
  text: string;
  speed?: number;
  onDone?: () => void;
  onProgress?: () => void;
}) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    onProgress?.();
    if (visible >= text.length) {
      onDone?.();
      return;
    }
    const t = window.setTimeout(() => setVisible((v) => v + 1), speed);
    return () => window.clearTimeout(t);
  }, [onDone, onProgress, speed, text.length, visible]);

  return <span className="whitespace-pre-line">{text.slice(0, visible)}</span>;
}
