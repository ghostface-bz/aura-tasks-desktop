import type { BadgeInfo } from "../lib/api";

interface Props {
  badges: BadgeInfo[];
  onClose: () => void;
}

export default function BadgesPopup({ badges, onClose }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, zIndex: 100,
        background: "color-mix(in srgb, var(--bg) 95%, transparent)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 24, width: "calc(100% - 64px)",
      }}>
        <span style={{
          fontFamily: "var(--font)", fontSize: 11,
          letterSpacing: 4, textTransform: "uppercase",
          color: "var(--ac)",
        }}>
          BADGES
        </span>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: "20px 24px", justifyItems: "center",
        }}>
          {badges.map((b) => (
            <div key={b.id} style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 6, width: 56,
            }}>
              <span style={{ fontSize: 28, color: "var(--gd)" }}>{b.icon}</span>
              <span style={{
                fontFamily: "var(--font)", fontSize: 9,
                letterSpacing: 0.5, color: "var(--ts)", textAlign: "center",
              }}>
                {b.label}
              </span>
            </div>
          ))}
        </div>

        {badges.length === 0 && (
          <span style={{
            fontFamily: "var(--font)", fontSize: 12,
            letterSpacing: 0.5, color: "var(--ts)", opacity: 0.4,
          }}>
            No badges earned yet
          </span>
        )}

        <span style={{
          fontFamily: "var(--font)", fontSize: 9,
          letterSpacing: 1, color: "var(--ts)", opacity: 0.3,
        }}>
          tap to close
        </span>
      </div>
    </div>
  );
}
