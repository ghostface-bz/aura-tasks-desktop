import { useState, useCallback, useEffect } from "react";

interface Props {
  triggerRef?: (fn: () => void) => void;
}

export default function CompletionBurst({ triggerRef }: Props) {
  const [active, setActive] = useState(false);
  const [key, setKey] = useState(0);

  const trigger = useCallback(() => {
    setKey((k) => k + 1);
    setActive(true);
  }, []);

  useEffect(() => {
    triggerRef?.(trigger);
  }, [trigger, triggerRef]);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setActive(false), 400);
    return () => clearTimeout(timer);
  }, [active, key]);

  if (!active) return null;

  return (
    <div
      key={key}
      style={{
        position: "absolute",
        top: "50%",
        left: 42,
        transform: "translate(-50%, -50%)",
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "1.5px solid var(--ac)",
        animation: "burst 400ms ease-out forwards",
        pointerEvents: "none",
      }}
    />
  );
}
