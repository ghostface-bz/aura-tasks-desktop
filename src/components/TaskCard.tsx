import { useState, useRef, useEffect } from "react";
import type { Task } from "../lib/api";
import { parseTags, formatDueDate, isDueOverdue } from "../lib/api";
import CompletionBurst from "./CompletionBurst";

interface Props {
  task: Task;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, title: string, priority: number) => void;
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

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m + ":" + (s < 10 ? "0" + s : s);
}

export default function TaskCard({ task, onComplete, onDelete, onEdit, onPomodoroTick, onPomodoroPhase }: Props) {
  const [hovered, setHovered] = useState(false);
  const [checkHovered, setCheckHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editPriority, setEditPriority] = useState(task.priority);
  const editRef = useRef<HTMLInputElement>(null);
  const burstRef = useRef<(() => void) | null>(null);

  // Pomodoro
  const [pomState, setPomState] = useState<"idle" | "work" | "shortBreak" | "longBreak">("idle");
  const [pomSession, setPomSession] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);

  useEffect(() => {
    if (pomState === "idle") return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 0) return prev - 1;
        // Timer hit zero — transition
        if (pomState === "work") {
          const newSession = pomSession + 1;
          onPomodoroTick(task.id);
          if (newSession >= 4) {
            setPomState("longBreak");
            setPomSession(0);
            onPomodoroPhase(task.id, "allDone", 4);
            return 15 * 60;
          } else {
            setPomSession(newSession);
            setPomState("shortBreak");
            onPomodoroPhase(task.id, "break", newSession);
            return 5 * 60;
          }
        } else {
          setPomState("work");
          onPomodoroPhase(task.id, "work", pomSession);
          return 25 * 60;
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pomState, pomSession, task.id, onPomodoroTick, onPomodoroPhase]);

  useEffect(() => {
    if (editing) {
      editRef.current?.focus();
      editRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    setEditTitle(task.title);
    setEditPriority(task.priority);
    setEditing(true);
  };

  const saveEdit = () => {
    const t = editTitle.trim();
    if (t.length > 0) onEdit(task.id, t, editPriority);
    setEditing(false);
  };

  const handleComplete = () => {
    burstRef.current?.();
    onComplete(task.id);
  };

  const tags = parseTags(task.tags);
  const dueText = formatDueDate(task.due_date);
  const overdue = isDueOverdue(task.due_date);
  const pomActive = pomState !== "idle";

  if (editing) {
    return (
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--bd)", opacity: 0.5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            onClick={() => {
              const order = [1, 2, 3, 4];
              const idx = order.indexOf(editPriority);
              setEditPriority(order[(idx + 1) % 4]);
            }}
            style={{
              width: 10, height: 10, borderRadius: 5,
              background: priorityColor(editPriority),
              cursor: "pointer", flexShrink: 0,
              transition: "background 150ms",
            }}
          />
          <input
            ref={editRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            style={{
              flex: 1, background: "transparent", border: "none", borderBottom: "1px solid var(--ac)",
              color: "var(--tp)", fontFamily: "var(--font)", fontSize: 13, outline: "none",
              paddingBottom: 4,
            }}
          />
        </div>
        <div style={{ fontSize: 9, color: "var(--ts)", opacity: 0.5, marginTop: 6, letterSpacing: 0.5 }}>
          Enter to save · Esc to cancel
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        height: 40,
        padding: "0 12px",
        gap: 10,
        background: hovered ? "var(--sf)" : "transparent",
        borderBottom: "1px solid color-mix(in srgb, var(--bd) 50%, transparent)",
        transition: "background 150ms",
        animation: "slideIn 300ms ease-out",
      }}
    >
      {/* Priority dot */}
      <div
        style={{
          width: 5, height: 5, borderRadius: 2.5, flexShrink: 0,
          background: priorityColor(task.priority),
          opacity: overdue ? 1 : 0.8,
        }}
      />

      {/* Check circle */}
      <div
        onMouseEnter={() => setCheckHovered(true)}
        onMouseLeave={() => setCheckHovered(false)}
        onClick={handleComplete}
        style={{
          width: 18, height: 18, borderRadius: 9, flexShrink: 0,
          border: `1.5px solid ${checkHovered ? "var(--ac)" : "var(--bd)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          transform: checkHovered ? "scale(1.1)" : "scale(1)",
          transition: "border-color 150ms, transform 150ms",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute", inset: 4, borderRadius: 5,
            background: checkHovered ? "var(--ac)" : "transparent",
            opacity: checkHovered ? 0.4 : 0,
            transition: "opacity 150ms, background 150ms",
          }}
        />
      </div>

      <CompletionBurst triggerRef={(fn) => { burstRef.current = fn; }} />

      {/* Title */}
      <span
        style={{
          flex: 1, fontSize: 13, fontFamily: "var(--font)",
          color: "var(--tp)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {task.title}
      </span>

      {/* Tags */}
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            fontSize: 9, fontFamily: "var(--font)", letterSpacing: 0.5,
            color: "var(--ac)", opacity: 0.6,
          }}
        >
          {tag}
        </span>
      ))}

      {/* Due date */}
      {dueText && (
        <span
          style={{
            fontSize: 9, fontFamily: "var(--font)", letterSpacing: 0.5,
            color: overdue ? "var(--no)" : "var(--ts)",
          }}
        >
          {dueText}
        </span>
      )}

      {/* XP (hover) */}
      <span
        style={{
          fontSize: 10, fontFamily: "var(--font)",
          color: "var(--gd)",
          opacity: hovered ? 0.6 : 0,
          transition: "opacity 200ms",
        }}
      >
        +{task.xp_value}
      </span>

      {/* Pomodoro timer */}
      {pomActive && (
        <span
          onClick={() => { setPomState("idle"); setPomSession(0); setSecondsLeft(25 * 60); }}
          style={{
            fontSize: 9, fontFamily: "var(--font)", letterSpacing: 0.5,
            color: pomState === "work" ? "var(--ac)" : "var(--ok)",
            cursor: "pointer",
          }}
          title={pomState === "work" ? `Working · session ${pomSession + 1}/4 · click to stop` : "Break · click to stop"}
        >
          {formatTime(secondsLeft)}
          {[0, 1, 2, 3].map((i) => (
            <span key={i}> {i < pomSession ? "●" : "○"}</span>
          ))}
        </span>
      )}

      {/* Pomodoro start (hover) */}
      {!pomActive && (
        <span
          onClick={() => { setPomState("work"); setPomSession(0); setSecondsLeft(25 * 60); }}
          style={{
            fontSize: 9, color: "var(--ts)",
            opacity: hovered ? 0.6 : 0,
            transition: "opacity 200ms",
            cursor: "pointer",
          }}
          title="Start Pomodoro"
        >
          ▶
        </span>
      )}

      {/* Edit */}
      <span
        onClick={startEdit}
        style={{
          fontSize: 11, color: "var(--ts)",
          opacity: hovered ? 0.8 : 0,
          transition: "opacity 200ms",
          cursor: "pointer",
        }}
      >
        ✎
      </span>

      {/* Delete */}
      <span
        onClick={() => onDelete(task.id)}
        style={{
          fontSize: 14, color: "var(--no)",
          opacity: hovered ? 0.8 : 0,
          transition: "opacity 200ms",
          cursor: "pointer",
        }}
      >
        ×
      </span>
    </div>
  );
}
