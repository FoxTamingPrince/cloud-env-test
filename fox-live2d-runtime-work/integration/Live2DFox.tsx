"use client";
import { useEffect, useRef, useState } from "react";

type Props = { speaking: boolean; level: number; listening: boolean };

export default function Live2DFox({ speaking, level, listening }: Props) {
  const host = useRef<HTMLSpanElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const current = useRef({ speaking, level, listening });
  current.current = { speaking, level, listening };
  const send = () => frame.current?.contentWindow?.postMessage({ type: "fox-mouth", ...current.current }, window.location.origin);
  useEffect(() => { send(); }, [speaking, level, listening, ready]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.type !== "fox-live2d-state") return;
      setReady(event.data.state === "ready");
      if (event.data.state === "ready") send();
    };
    let lastGaze = 0;
    const gaze = (event: PointerEvent) => {
      const now = performance.now();
      if (now - lastGaze < 70) return;
      const bounds = host.current?.getBoundingClientRect();
      if (!bounds?.width || !bounds.height) return;
      lastGaze = now;
      const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, 1 - (event.clientY - bounds.top) / bounds.height * 2));
      frame.current?.contentWindow?.postMessage({ type: "fox-gaze", x, y }, window.location.origin);
    };
    window.addEventListener("message", receive);
    window.addEventListener("pointermove", gaze, { passive: true });
    return () => {
      window.removeEventListener("message", receive);
      window.removeEventListener("pointermove", gaze);
    };
  }, []);
  return <span ref={host} className={`illustrated-fox ${listening ? "attentive" : ""}`} data-live2d-ready={ready}>
    {!ready && <img className="fox-live2d-poster" src="/fox-live2d/fox-poster.png" alt="小狐狸" />}
    <iframe ref={frame} src="/fox-live2d/index.html" title="麦田里的水彩狐狸" tabIndex={-1} onLoad={send} style={{ opacity: ready ? 1 : 0 }} />
  </span>;
}
