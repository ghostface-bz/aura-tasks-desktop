import { useState, useEffect, useCallback } from "react";

export default function LevelUpBanner() {
  const [level, setLevel] = useState(0);
  const [visible, setVisible] = useState(false);
  const [key, setKey] = useState(0);

  const show = useCallback((newLevel: number) => {
    setLevel(newLevel);
    setKey((k) => k + 1);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 3400);
    return () => clearTimeout(timer);
  }, [visible, key]);

  useEffect(() => {
    (window as any).__levelUpBanner = show;
    return () => { delete (window as any).__levelUpBanner; };
  }, [show]);

  if (!visible) return null;

  return (
    <div
      key={key}
      style={{
        padding: "4px 12px",
        borderRadius: 4,
        backgroundColor: "var(--ac)",
        opacity: 0,
        animation: "levelPop 400ms ease-out forwards",
      }}
    >
      <span
        style={{
          color: "var(--bg)",
          fontFamily: "var(--font)",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 1.5,
        }}
      >
        Lv.{level}
      </span>
    </div>
  );
}

export function showLevelUp(level: number) {
  (window as any).__levelUpBanner?.(level);
}
