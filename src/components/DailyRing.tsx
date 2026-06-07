import { useRef, useEffect } from "react";

interface Props {
  done: number;
  total: number;
}

export default function DailyRing({ done, total }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progress = total > 0 ? done / total : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 28 * dpr;
    canvas.height = 28 * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, 28, 28);

    const cx = 14, cy = 14, r = 12;
    const bd = getComputedStyle(document.documentElement).getPropertyValue("--bd").trim();
    const ac = getComputedStyle(document.documentElement).getPropertyValue("--ac").trim();

    // Background track
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.lineWidth = 2;
    ctx.strokeStyle = bd;
    ctx.globalAlpha = 0.3;
    ctx.stroke();

    // Progress arc
    if (progress > 0) {
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * progress);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = ac;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, [done, total, progress]);

  return (
    <div style={{ position: "relative", width: 28, height: 28, flexShrink: 0 }}>
      <canvas ref={canvasRef} style={{ width: 28, height: 28 }} />
      <span
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: 8,
          color: "var(--ts)",
          opacity: 0.6,
          fontFamily: "var(--font)",
        }}
      >
        {done}/{total}
      </span>
    </div>
  );
}
