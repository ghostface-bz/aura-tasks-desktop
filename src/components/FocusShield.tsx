import { useState, useEffect, useRef } from "react";
import type { Task } from "../lib/api";
import { parseTags, formatDueDate, isDueOverdue } from "../lib/api";
import CompletionBurst from "./CompletionBurst";

interface Props {
  tasks: Task[];
  completedToday: number;
  onComplete: (id: string) => void;
  onSkip: () => void;
  onPomodoroTick: (id: string) => void;
  onPomodoroPhase: (id: string, phase: string, session: number) => void;
}

function priorityColor(p: number): string {
  switch (p) {
    case 1: return "var(--ts)";
    case 3: return "var(--ac)";
    case 4: return "var(--no)";
    default: return "var(--tp)";
  }
}

export default function FocusShield({ tasks, completedToday, onComplete, onSkip, onPomodoroTick, onPomodoroPhase }: Props) {
  const burstRef = useRef<(() => void) | null>(null);
  const [checkHovered, setCheckHovered] = useState(false);
  const [skipHovered, setSkipHovered] = useState(false);

  // Pomodoro
  const [pomState, setPomState] = useState<"idle" | "work" | "shortBreak" | "longBreak">("idle");
  const [pomSession, setPomSession] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [pomHovered, setPomHovered] = useState(false);

  useEffect(() => {
    if (pomState === "idle") return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 0) return prev - 1;
        if (pomState === "work") {
          const newSession = pomSession + 1;
          if (tasks.length > 0) onPomodoroTick(tasks[0].id);
          if (newSession >= 4) {
            setPomState("longBreak");
            setPomSession(0);
            onPomodoroPhase(tasks[0]?.id || "", "allDone", 4);
            return 15 * 60;
          } else {
            setPomSession(newSession);
            setPomState("shortBreak");
            onPomodoroPhase(tasks[0]?.id || "", "break", newSession);
            return 5 * 60;
          }
        } else {
          setPomState("work");
          onPomodoroPhase(tasks[0]?.id || "", "work", pomSession);
          return 25 * 60;
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pomState, pomSession, tasks, onPomodoroTick, onPomodoroPhase]);

  const task = tasks[0] || null;

  if (!task) {
    return (
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 12,
      }}>
        <span style={{ fontSize: 64, color: "var(--ts)", opacity: 0.12 }}>円</span>
        <span style={{
          fontFamily: "var(--font)", fontSize: 16, letterSpacing: 1,
          fontWeight: 300, color: "var(--ts)", opacity: 0.5,
        }}>
          All clear
        </span>
        <span style={{
          fontFamily: "var(--font)", fontSize: 10, letterSpacing: 0.5,
          color: "var(--ts)", opacity: 0.3,
        }}>
          {completedToday} completed today
        </span>
      </div>
    );
  }

  const tags = parseTags(task.tags);
  const dueText = formatDueDate(task.due_date);
  const overdue = isDueOverdue(task.due_date);
  const pomActive = pomState !== "idle";

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m + ":" + (s < 10 ? "0" + s : s);
  };

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 20,
    }}>
      {/* Priority dot */}
      <div style={{
        width: 6, height: 6, borderRadius: 3,
        background: priorityColor(task.priority),
      }} />

      {/* Zen title */}
      <div style={{
        fontFamily: "var(--font)", fontSize: 24, fontWeight: 300,
        letterSpacing: 1, lineHeight: 1.4, color: "var(--tp)",
        textAlign: "center", maxWidth: "calc(100% - 40px)",
        wordWrap: "break-word",
      }}>
        {task.title}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div style={{ display: "flex", gap: 8 }}>
          {tags.map((tag) => (
            <span key={tag} style={{
              fontFamily: "var(--font)", fontSize: 10, letterSpacing: 0.5,
              color: "var(--ac)", opacity: 0.6,
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Due date */}
      {dueText && (
        <span style={{
          fontFamily: "var(--font)", fontSize: 10, letterSpacing: 0.5,
          color: overdue ? "var(--no)" : "var(--ts)", opacity: 0.6,
        }}>
          {dueText}
        </span>
      )}

      {/* Check circle with breathing pulse */}
      <div style={{ position: "relative", width: 40, height: 40 }}>
        <div
          onMouseEnter={() => setCheckHovered(true)}
          onMouseLeave={() => setCheckHovered(false)}
          onClick={() => {
            burstRef.current?.();
            onComplete(task.id);
          }}
          style={{
            width: 40, height: 40, borderRadius: 20,
            border: `1.5px solid ${checkHovered ? "var(--ac)" : "var(--bd)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            transition: "border-color 150ms",
            animation: checkHovered ? "none" : "breathe 4s ease-in-out infinite",
          }}
        >
          <span style={{
            fontSize: 16,
            color: checkHovered ? "var(--ac)" : "var(--ts)",
            transition: "color 150ms",
          }}>
            ✓
          </span>
        </div>
        <CompletionBurst triggerRef={(fn) => { burstRef.current = fn; }} />
      </div>

      {/* Focus pomodoro */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <span
          onMouseEnter={() => setPomHovered(true)}
          onMouseLeave={() => setPomHovered(false)}
          onClick={() => {
            if (pomState === "idle") {
              setPomState("work");
              setPomSession(0);
              setSecondsLeft(25 * 60);
            } else {
              setPomState("idle");
              setPomSession(0);
              setSecondsLeft(25 * 60);
            }
          }}
          style={{
            fontFamily: "var(--font)",
            fontSize: pomActive ? 13 : 10,
            letterSpacing: 1,
            color: pomState === "work" ? "var(--ac)" : pomState === "idle" ? "var(--ts)" : "var(--ok)",
            opacity: pomState === "idle" ? (pomHovered ? 0.7 : 0.3) : 0.8,
            cursor: "pointer",
            transition: "opacity 150ms, color 200ms",
          }}
          title={pomState === "idle" ? "Start Pomodoro" : pomState === "work" ? `Working · session ${pomSession + 1}/4 · click to stop` : "Break · click to stop"}
        >
          {pomState === "idle" ? "▶" : (
            <>
              {formatTime(secondsLeft)}
              {[0, 1, 2, 3].map((i) => (
                <span key={i}> {i < pomSession ? "●" : "○"}</span>
              ))}
            </>
          )}
        </span>
        {pomActive && (
          <span style={{
            fontFamily: "var(--font)", fontSize: 9, letterSpacing: 1.5,
            textTransform: "uppercase", color: "var(--ts)", opacity: 0.3,
          }}>
            {pomState === "work" ? "focus" : "break"}
          </span>
        )}
      </div>

      {/* Skip button */}
      {tasks.length > 1 && (
        <span
          onMouseEnter={() => setSkipHovered(true)}
          onMouseLeave={() => setSkipHovered(false)}
          onClick={onSkip}
          style={{
            fontSize: 18, fontFamily: "var(--font)",
            color: "var(--ts)",
            opacity: skipHovered ? 0.8 : 0.3,
            cursor: "pointer",
            transition: "opacity 150ms",
          }}
          title="Skip to next"
        >
          ›
        </span>
      )}
    </div>
  );
}
