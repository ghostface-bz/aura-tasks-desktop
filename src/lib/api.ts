import { invoke } from "@tauri-apps/api/core";

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: number;
  tags: string; // JSON array
  due_date: number;
  completed: boolean;
  created_at: number;
  completed_at: number;
  estimated_min: number;
  recurrence: string;
  pomodoros: number;
  xp_value: number;
}

export interface Stats {
  total_xp: number;
  level: number;
  level_name: string;
  streak: number;
  tasks_done: number;
  xp_fraction: number;
}

export interface BadgeInfo {
  id: string;
  label: string;
  icon: string;
  earned_at: number;
}

export interface CompleteResult {
  xp_gained: number;
  new_badges: string[];
}

export function parseTags(tagsStr: string): string[] {
  if (!tagsStr) return [];
  try {
    const arr = JSON.parse(tagsStr);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function collectAllTags(tasks: Task[]): string[] {
  const set = new Set<string>();
  for (const t of tasks) parseTags(t.tags).forEach(tag => set.add(tag));
  return [...set].sort();
}

export function formatDueDate(timestamp: number): string {
  if (!timestamp || timestamp === 0) return "";
  const d = new Date(timestamp * 1000);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return diff + "d";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[d.getMonth()] + " " + d.getDate();
}

export function isDueOverdue(timestamp: number): boolean {
  if (!timestamp || timestamp === 0) return false;
  const d = new Date(timestamp * 1000);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d < today;
}

export const api = {
  addTask: (text: string) => invoke<string>("add_task", { text }),
  updateTask: (id: string, title: string, priority: number) => invoke<void>("update_task", { id, title, priority }),
  completeTask: (id: string) => invoke<CompleteResult>("complete_task", { id }),
  uncompleteTask: (id: string) => invoke<void>("uncomplete_task", { id }),
  deleteTask: (id: string) => invoke<void>("delete_task", { id }),
  listActive: () => invoke<Task[]>("list_active"),
  listCompletedToday: () => invoke<Task[]>("list_completed_today"),
  incrementPomodoro: (id: string) => invoke<void>("increment_pomodoro", { id }),
  getStats: () => invoke<Stats>("get_stats"),
  listBadges: () => invoke<BadgeInfo[]>("list_badges"),
};
