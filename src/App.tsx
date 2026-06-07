import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { api, parseTags, collectAllTags } from "./lib/api";
import type { Task, Stats, BadgeInfo } from "./lib/api";
import { applyTheme, themeOrder, themeLabels } from "./lib/themes";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import TaskCard from "./components/TaskCard";
import FocusShield from "./components/FocusShield";
import DailyRing from "./components/DailyRing";
import XpPopup, { showXp } from "./components/XpPopup";
import LevelUpBanner, { showLevelUp } from "./components/LevelUpBanner";
import BadgesPopup from "./components/BadgesPopup";
import TagFilterBar from "./components/TagFilterBar";
import "./styles/app.css";

function xpFraction(lv: number, xp: number): number {
  const t = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 99999];
  const lo = t[Math.min(lv - 1, t.length - 2)];
  const hi = t[Math.min(lv, t.length - 1)];
  if (hi <= lo) return 1.0;
  return Math.min(1.0, (xp - lo) / (hi - lo));
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats>({ total_xp: 0, level: 1, level_name: "Novice", streak: 0, tasks_done: 0, xp_fraction: 0 });
  const [badges, setBadges] = useState<BadgeInfo[]>([]);
  const [themeName, setThemeName] = useState(() => localStorage.getItem("aura-theme") || "sumi");
  const [tab, setTab] = useState<"active" | "done">("active");
  const [focusMode, setFocusMode] = useState(false);
  const [badgesOpen, setBadgesOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [notifReady, setNotifReady] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Init notifications
  useEffect(() => {
    (async () => {
      try {
        let perm = await isPermissionGranted();
        if (!perm) perm = (await requestPermission()) === "granted";
        setNotifReady(perm);
      } catch (e) {
        console.warn("Notifications not available:", e);
      }
    })();
  }, []);

  const notify = useCallback((title: string, body: string) => {
    if (notifReady) sendNotification({ title, body });
  }, [notifReady]);

  const allTags = useMemo(() => collectAllTags(tasks), [tasks]);
  const visibleTasks = useMemo(() =>
    selectedTag
      ? tasks.filter(t => parseTags(t.tags).includes(selectedTag))
      : tasks,
    [tasks, selectedTag]
  );

  // Apply theme
  useEffect(() => {
    applyTheme(themeName);
    localStorage.setItem("aura-theme", themeName);
  }, [themeName]);

  const cycleTheme = () => {
    const idx = themeOrder.indexOf(themeName);
    setThemeName(themeOrder[(idx + 1) % themeOrder.length]);
  };

  // Refresh data from backend
  const refresh = useCallback(async () => {
    try {
      const [active, done, st, bg] = await Promise.all([
        api.listActive(),
        api.listCompletedToday(),
        api.getStats(),
        api.listBadges(),
      ]);
      setTasks(active);
      setCompleted(done);
      setStats(st);
      setBadges(bg);
    } catch (e) {
      console.error("Failed to refresh:", e);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Handlers
  const addTask = async () => {
    const text = inputText.trim();
    if (!text) return;
    await api.addTask(text);
    setInputText("");
    refresh();
  };

  const handleComplete = async (id: string) => {
    const prevLevel = stats.level;
    const result = await api.completeTask(id);
    await refresh();
    if (result.xp_gained > 0) showXp(result.xp_gained);

    // Check level up
    const newStats = await api.getStats();
    if (newStats.level > prevLevel) {
      showLevelUp(newStats.level);
      notify("Level Up!", `You reached Lv.${newStats.level} — ${newStats.level_name}`);
    }

    // Check new badges
    if (result.new_badges.length > 0) {
      const allBadges = await api.listBadges();
      const newest = allBadges[allBadges.length - 1];
      if (newest) notify("Badge Unlocked", `${newest.icon} ${newest.label}`);
    }
  };

  const handleDelete = async (id: string) => {
    await api.deleteTask(id);
    refresh();
  };

  const handleEdit = async (id: string, title: string, priority: number) => {
    await api.updateTask(id, title, priority);
    refresh();
  };

  const handleUncomplete = async (id: string) => {
    await api.uncompleteTask(id);
    refresh();
  };

  const handlePomodoroTick = async (id: string) => {
    await api.incrementPomodoro(id);
  };

  const handlePomodoroPhase = (_id: string, phase: string, session: number) => {
    if (phase === "break") notify("Time for a break", `Session ${session}/4 complete. Take 5.`);
    else if (phase === "allDone") notify("Pomodoro complete!", "All 4 sessions done. Take a long break.");
    else if (phase === "work") notify("Back to focus", `Break's over. Ready for session ${session + 1}?`);
  };

  const handleSkip = () => {
    if (tasks.length > 1) {
      setTasks((prev) => {
        const copy = [...prev];
        const first = copy.shift()!;
        copy.push(first);
        return copy;
      });
    }
  };

  const totalDaily = tasks.length + completed.length;

  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      padding: 16, position: "relative", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        height: 36, flexShrink: 0,
      }}>
        {/* Streak */}
        <span
          style={{
            fontFamily: "var(--font)", fontSize: 11, letterSpacing: 1.5,
            fontWeight: 500, color: "var(--ts)", opacity: 0.7,
          }}
          title={`${stats.streak} day streak`}
        >
          {stats.streak}d
        </span>

        {/* Level */}
        <span
          style={{
            fontFamily: "var(--font)", fontSize: 13, fontWeight: 600,
            letterSpacing: 0.5, color: "var(--ac)",
          }}
          title={`${stats.level_name} · ${stats.total_xp} XP`}
        >
          Lv.{stats.level}
        </span>

        {/* XP bar */}
        <div style={{
          flex: 1, height: 3, borderRadius: 1.5,
          background: "var(--bd)",
        }}>
          <div style={{
            width: `${xpFraction(stats.level, stats.total_xp) * 100}%`,
            height: "100%", borderRadius: 1.5, background: "var(--ac)",
            transition: "width 500ms ease-out",
          }} />
        </div>

        {/* Daily ring */}
        <DailyRing done={completed.length} total={Math.max(1, totalDaily)} />

        {/* Badges */}
        {badges.length > 0 && (
          <span
            onClick={() => setBadgesOpen(true)}
            style={{
              fontFamily: "var(--font)", fontSize: 10, letterSpacing: 0.5,
              color: "var(--gd)", opacity: 0.6, cursor: "pointer",
            }}
          >
            {badges.length}★
          </span>
        )}

        <LevelUpBanner />

        {/* Theme toggle */}
        <div
          onClick={cycleTheme}
          style={{
            width: 8, height: 8, borderRadius: 4,
            background: "var(--ac)", cursor: "pointer",
            opacity: 0.5, transition: "opacity 150ms",
          }}
          title={themeLabels[themeName] || themeName}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
        />

        {/* Focus toggle */}
        <span
          onClick={() => setFocusMode(!focusMode)}
          style={{
            fontFamily: "var(--font)", fontSize: 11,
            color: focusMode ? "var(--ac)" : "var(--ts)",
            opacity: focusMode ? 0.9 : 0.4,
            cursor: "pointer", transition: "color 200ms, opacity 150ms",
          }}
          title={focusMode ? "Exit Focus" : "Focus Shield"}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = focusMode ? "0.9" : "0.4")}
        >
          集
        </span>
      </div>

      {/* Divider */}
      {!focusMode && (
        <div style={{
          height: 1, background: "var(--bd)", opacity: 0.4,
          margin: "10px 0",
          transition: "opacity 250ms",
        }} />
      )}

      {/* Input row */}
      {!focusMode && (
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Add task...  #tag !high tomorrow"
              className="task-input"
              style={{
                width: "100%", height: 36, border: "none", outline: "none",
                background: "transparent", color: "var(--tp)",
                fontFamily: "var(--font)", fontSize: 13,
                padding: "0", paddingBottom: 6,
              }}
            />
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              height: inputFocused ? 1.5 : 1,
              background: inputFocused ? "var(--ac)" : "var(--bd)",
              opacity: inputFocused ? 1 : 0.4,
              transition: "all 200ms",
            }} />
          </div>
          <div
            onClick={addTask}
            className="add-btn"
            style={{
              width: 28, height: 28, borderRadius: 2,
              border: "1px solid var(--ac)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", alignSelf: "center",
            }}
          >
            <span style={{
              fontFamily: "var(--font)", fontSize: 16, fontWeight: 500,
            }}>
              +
            </span>
          </div>
        </div>
      )}

      {/* Tab bar */}
      {!focusMode && (
        <div style={{
          display: "flex", gap: 24, marginTop: 14, marginBottom: 6, flexShrink: 0,
        }}>
          {(["active", "done"] as const).map((t) => {
            const count = t === "active" ? tasks.length : completed.length;
            const label = t === "active" ? "Active" : "Done";
            const isActive = tab === t;
            return (
              <div
                key={t}
                onClick={() => { setTab(t); setSelectedTag(null); }}
                style={{
                  position: "relative", cursor: "pointer",
                  paddingBottom: 6,
                }}
              >
                <span style={{
                  fontFamily: "var(--font)", fontSize: 10,
                  letterSpacing: 2, textTransform: "uppercase", fontWeight: 500,
                  color: isActive ? "var(--tp)" : "var(--ts)",
                  opacity: isActive ? 1 : 0.5,
                  transition: "opacity 200ms",
                }}>
                  {label}{count > 0 ? `  ${count}` : ""}
                </span>
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  height: 2, borderRadius: 1, background: "var(--ac)",
                  opacity: isActive ? 1 : 0,
                  transition: "opacity 200ms",
                }} />
              </div>
            );
          })}
        </div>
      )}

      {!focusMode && (
        <div style={{ height: 1, background: "var(--bd)", opacity: 0.3, flexShrink: 0 }} />
      )}

      {/* Focus Shield */}
      {focusMode && (
        <FocusShield
          tasks={tasks}
          completedToday={completed.length}
          onComplete={handleComplete}
          onSkip={handleSkip}
          onPomodoroTick={handlePomodoroTick}
          onPomodoroPhase={handlePomodoroPhase}
        />
      )}

      {/* Tag filter */}
      {!focusMode && tab === "active" && (
        <TagFilterBar
          tags={allTags}
          selected={selectedTag}
          onSelect={(tag) => setSelectedTag(prev => prev === tag ? null : tag)}
        />
      )}

      {/* Task views */}
      {!focusMode && (
        <div style={{ flex: 1, overflow: "auto", marginTop: 4 }}>
          {tab === "active" && (
            <>
              {visibleTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={handleComplete}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onPomodoroTick={handlePomodoroTick}
                  onPomodoroPhase={handlePomodoroPhase}
                />
              ))}
              {visibleTasks.length === 0 && (
                <div style={{
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  height: 160, gap: 12,
                }}>
                  <span style={{ fontSize: 32, color: "var(--ts)", opacity: 0.15 }}>◯</span>
                  <span style={{
                    fontFamily: "var(--font)", fontSize: 13, letterSpacing: 0.5,
                    fontWeight: 300, color: "var(--ts)", opacity: 0.6,
                  }}>
                    {tasks.length > 0 ? `No #${selectedTag} tasks` : "No tasks yet"}
                  </span>
                  <span style={{
                    fontFamily: "var(--font)", fontSize: 10, letterSpacing: 1,
                    fontWeight: 300, color: "var(--ts)", opacity: 0.3,
                  }}>
                    {tasks.length > 0 ? "clear filter or add one" : "press enter to add one"}
                  </span>
                </div>
              )}
            </>
          )}

          {tab === "done" && (
            <>
              {completed.map((task) => (
                <div
                  key={task.id}
                  style={{
                    display: "flex", alignItems: "center", height: 40,
                    padding: "0 12px", gap: 10,
                    borderBottom: "1px solid var(--bd)",
                    transition: "background 150ms",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sf)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span
                    onClick={() => handleUncomplete(task.id)}
                    style={{
                      fontSize: 12, color: "var(--ok)",
                      cursor: "pointer", transition: "color 150ms",
                    }}
                    title="Undo"
                    onMouseEnter={(e) => { e.currentTarget.textContent = "↩"; e.currentTarget.style.color = "var(--ac)"; }}
                    onMouseLeave={(e) => { e.currentTarget.textContent = "✓"; e.currentTarget.style.color = "var(--ok)"; }}
                  >
                    ✓
                  </span>
                  <span style={{
                    flex: 1, fontFamily: "var(--font)", fontSize: 13,
                    textDecoration: "line-through", color: "var(--ts)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    opacity: 0.7,
                  }}>
                    {task.title}
                  </span>
                  <span style={{
                    fontFamily: "var(--font)", fontSize: 10,
                    color: "var(--gd)", opacity: 0.4,
                  }}>
                    +{task.xp_value}
                  </span>
                </div>
              ))}
              {completed.length === 0 && (
                <div style={{
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  height: 160, gap: 12,
                }}>
                  <span style={{ fontSize: 32, color: "var(--ts)", opacity: 0.15 }}>◯</span>
                  <span style={{
                    fontFamily: "var(--font)", fontSize: 13, letterSpacing: 0.5,
                    fontWeight: 300, color: "var(--ts)", opacity: 0.6,
                  }}>
                    Nothing completed today
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Badges popup */}
      {badgesOpen && (
        <BadgesPopup badges={badges} onClose={() => setBadgesOpen(false)} />
      )}

      {/* XP popup overlay */}
      <XpPopup />
    </div>
  );
}
