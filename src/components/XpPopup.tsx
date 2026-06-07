import { useState, useEffect, useCallback } from "react";

export default function XpPopup() {
  const [amount, setAmount] = useState(0);
  const [visible, setVisible] = useState(false);
  const [key, setKey] = useState(0);

  const show = useCallback((xp: number) => {
    setAmount(xp);
    setKey((k) => k + 1);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 1200);
    return () => clearTimeout(timer);
  }, [visible, key]);

  // Expose show globally
  useEffect(() => {
    (window as any).__xpPopup = show;
    return () => { delete (window as any).__xpPopup; };
  }, [show]);

  if (!visible) return null;

  return (
    <div
      key={key}
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 1000,
        pointerEvents: "none",
        animation: "xpFloat 1200ms ease-out forwards",
      }}
    >
      <span
        style={{
          color: "var(--gd)",
          fontFamily: "var(--font)",
          fontSize: 12,
          letterSpacing: 1,
          opacity: 0.8,
        }}
      >
        +{amount} xp
      </span>
    </div>
  );
}

export function showXp(amount: number) {
  (window as any).__xpPopup?.(amount);
}
