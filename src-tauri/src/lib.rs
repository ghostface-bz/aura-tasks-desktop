mod db;

use db::{badge_icon, badge_label, level_name, Database, THRESHOLDS};
use serde::Serialize;
use std::sync::Mutex;
use tauri::Manager;

struct AppState {
    db: Database,
}

// ── Response types ───────────────────────────────────────────────────

#[derive(Serialize)]
struct CompleteResult {
    xp_gained: i32,
    new_badges: Vec<String>,
}

#[derive(Serialize)]
struct BadgeInfo {
    id: String,
    label: &'static str,
    icon: &'static str,
    earned_at: i64,
}

#[derive(Serialize)]
struct StatsResponse {
    total_xp: i64,
    level: i32,
    level_name: &'static str,
    streak: i32,
    tasks_done: i64,
    xp_fraction: f64,
}

// ── Tauri Commands ───────────────────────────────────────────────────

#[tauri::command]
fn add_task(state: tauri::State<'_, Mutex<AppState>>, text: String) -> String {
    let s = state.lock().unwrap();
    s.db.add_task_parsed(&text)
}

#[tauri::command]
fn update_task(state: tauri::State<'_, Mutex<AppState>>, id: String, title: String, priority: i32) {
    let s = state.lock().unwrap();
    s.db.update_task(&id, &title, priority);
}

#[tauri::command]
fn complete_task(state: tauri::State<'_, Mutex<AppState>>, id: String) -> CompleteResult {
    let s = state.lock().unwrap();
    let (xp, badges) = s.db.complete_task(&id);
    CompleteResult {
        xp_gained: xp,
        new_badges: badges,
    }
}

#[tauri::command]
fn uncomplete_task(state: tauri::State<'_, Mutex<AppState>>, id: String) {
    let s = state.lock().unwrap();
    s.db.uncomplete_task(&id);
}

#[tauri::command]
fn delete_task(state: tauri::State<'_, Mutex<AppState>>, id: String) {
    let s = state.lock().unwrap();
    s.db.delete_task(&id);
}

#[tauri::command]
fn list_active(state: tauri::State<'_, Mutex<AppState>>) -> Vec<db::Task> {
    let s = state.lock().unwrap();
    s.db.list_active()
}

#[tauri::command]
fn list_completed_today(state: tauri::State<'_, Mutex<AppState>>) -> Vec<db::Task> {
    let s = state.lock().unwrap();
    s.db.list_completed_today()
}

#[tauri::command]
fn increment_pomodoro(state: tauri::State<'_, Mutex<AppState>>, id: String) {
    let s = state.lock().unwrap();
    s.db.increment_pomodoro(&id);
}

#[tauri::command]
fn get_stats(state: tauri::State<'_, Mutex<AppState>>) -> StatsResponse {
    let s = state.lock().unwrap();
    let stats = s.db.get_stats();
    let xp_frac = {
        let lv = stats.level as usize;
        let lo = THRESHOLDS[lv.saturating_sub(1).min(THRESHOLDS.len() - 1)];
        let hi = THRESHOLDS[lv.min(THRESHOLDS.len() - 1)];
        if hi <= lo {
            1.0
        } else {
            ((stats.total_xp - lo) as f64 / (hi - lo) as f64).min(1.0)
        }
    };
    StatsResponse {
        total_xp: stats.total_xp,
        level: stats.level,
        level_name: level_name(stats.level),
        streak: stats.streak,
        tasks_done: stats.tasks_done,
        xp_fraction: xp_frac,
    }
}

#[tauri::command]
fn list_badges(state: tauri::State<'_, Mutex<AppState>>) -> Vec<BadgeInfo> {
    let s = state.lock().unwrap();
    s.db
        .list_badges()
        .into_iter()
        .map(|b| BadgeInfo {
            label: badge_label(&b.id),
            icon: badge_icon(&b.id),
            earned_at: b.earned_at,
            id: b.id,
        })
        .collect()
}

// ── App Entry ────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            let db = Database::new(app_dir);
            app.manage(Mutex::new(AppState { db }));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            add_task,
            update_task,
            complete_task,
            uncomplete_task,
            delete_task,
            list_active,
            list_completed_today,
            increment_pomodoro,
            get_stats,
            list_badges,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
