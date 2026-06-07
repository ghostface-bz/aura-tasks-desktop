use chrono::Local;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use uuid::Uuid;

// ── Types ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: String,
    pub priority: i32,
    pub tags: String, // JSON array string
    pub due_date: i64,
    pub completed: bool,
    pub created_at: i64,
    pub completed_at: i64,
    pub estimated_min: i32,
    pub recurrence: String,
    pub pomodoros: i32,
    pub xp_value: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stats {
    pub total_xp: i64,
    pub level: i32,
    pub streak: i32,
    pub tasks_done: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Badge {
    pub id: String,
    pub earned_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedTask {
    pub title: String,
    pub priority: i32,
    pub tags: Vec<String>,
    pub due_date: i64,
    pub recurrence: String,
}

// ── Database ─────────────────────────────────────────────────────────

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_dir: PathBuf) -> Self {
        std::fs::create_dir_all(&app_dir).ok();
        let db_path = app_dir.join("aura_tasks.db");
        let conn = Connection::open(db_path).expect("Failed to open database");
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.migrate();
        db
    }

    fn migrate(&self) {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS tasks (
                id           TEXT PRIMARY KEY,
                title        TEXT NOT NULL,
                description  TEXT NOT NULL DEFAULT '',
                priority     INTEGER NOT NULL DEFAULT 2,
                tags         TEXT NOT NULL DEFAULT '[]',
                due_date     INTEGER,
                completed    INTEGER NOT NULL DEFAULT 0,
                created_at   INTEGER NOT NULL,
                completed_at INTEGER,
                estimated_min INTEGER,
                recurrence   TEXT,
                pomodoros    INTEGER NOT NULL DEFAULT 0,
                xp_value     INTEGER NOT NULL DEFAULT 25
            );
            CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
            CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
            CREATE TABLE IF NOT EXISTS user_stats (
                id           INTEGER PRIMARY KEY DEFAULT 1,
                total_xp     INTEGER NOT NULL DEFAULT 0,
                level        INTEGER NOT NULL DEFAULT 1,
                streak_days  INTEGER NOT NULL DEFAULT 0,
                last_active  INTEGER,
                tasks_done   INTEGER NOT NULL DEFAULT 0
            );
            INSERT OR IGNORE INTO user_stats (id) VALUES (1);
            CREATE TABLE IF NOT EXISTS badges (
                id        TEXT PRIMARY KEY,
                earned_at INTEGER NOT NULL
            );",
        )
        .expect("Failed to run migrations");
    }

    // ── Task CRUD ────────────────────────────────────────────────────

    pub fn add_task_parsed(&self, text: &str) -> String {
        let parsed = parse_task_input(text);
        if parsed.title.is_empty() {
            return String::new();
        }
        let id = Uuid::new_v4().to_string();
        let xp = xp_for_priority(parsed.priority);
        let now = Local::now().timestamp();
        let tags_json = serde_json::to_string(&parsed.tags).unwrap_or_else(|_| "[]".into());
        let due = if parsed.due_date > 0 {
            Some(parsed.due_date)
        } else {
            None
        };
        let recurrence = if parsed.recurrence.is_empty() {
            None
        } else {
            Some(parsed.recurrence.as_str())
        };

        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO tasks (id, title, priority, tags, due_date, recurrence, completed, created_at, xp_value) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8)",
            params![id, parsed.title, parsed.priority, tags_json, due, recurrence, now, xp],
        ).ok();
        id
    }

    pub fn update_task(&self, id: &str, title: &str, priority: i32) {
        let xp = xp_for_priority(priority);
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE tasks SET title = ?1, priority = ?2, xp_value = ?3 WHERE id = ?4",
            params![title, priority, xp, id],
        )
        .ok();
    }

    pub fn complete_task(&self, id: &str) -> (i32, Vec<String>) {
        let conn = self.conn.lock().unwrap();
        let now = Local::now().timestamp();

        conn.execute(
            "UPDATE tasks SET completed = 1, completed_at = ?1 WHERE id = ?2",
            params![now, id],
        )
        .ok();

        let xp: i32 = conn
            .query_row("SELECT xp_value FROM tasks WHERE id = ?1", params![id], |r| {
                r.get(0)
            })
            .unwrap_or(0);

        conn.execute(
            "UPDATE user_stats SET total_xp = total_xp + ?1, tasks_done = tasks_done + 1 WHERE id = 1",
            params![xp],
        )
        .ok();

        let total_xp: i64 = conn
            .query_row("SELECT total_xp FROM user_stats WHERE id = 1", [], |r| {
                r.get(0)
            })
            .unwrap_or(0);

        conn.execute(
            "UPDATE user_stats SET level = ?1 WHERE id = 1",
            params![xp_to_level(total_xp)],
        )
        .ok();

        update_streak(&conn, now);
        spawn_recurring(&conn, id);

        // Check badges
        drop(conn);
        let new_badges = self.check_and_award_badges();
        (xp, new_badges)
    }

    pub fn uncomplete_task(&self, id: &str) {
        let conn = self.conn.lock().unwrap();
        let xp: i32 = conn
            .query_row("SELECT xp_value FROM tasks WHERE id = ?1", params![id], |r| {
                r.get(0)
            })
            .unwrap_or(0);

        conn.execute(
            "UPDATE tasks SET completed = 0, completed_at = NULL WHERE id = ?1",
            params![id],
        )
        .ok();

        conn.execute(
            "UPDATE user_stats SET total_xp = MAX(0, total_xp - ?1), tasks_done = MAX(0, tasks_done - 1) WHERE id = 1",
            params![xp],
        )
        .ok();

        let total_xp: i64 = conn
            .query_row("SELECT total_xp FROM user_stats WHERE id = 1", [], |r| {
                r.get(0)
            })
            .unwrap_or(0);

        conn.execute(
            "UPDATE user_stats SET level = ?1 WHERE id = 1",
            params![xp_to_level(total_xp)],
        )
        .ok();
    }

    pub fn delete_task(&self, id: &str) {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])
            .ok();
    }

    pub fn list_active(&self) -> Vec<Task> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT id, title, description, priority, tags, due_date, completed, \
                 created_at, completed_at, estimated_min, recurrence, pomodoros, xp_value \
                 FROM tasks WHERE completed = 0 ORDER BY priority DESC, created_at ASC",
            )
            .unwrap();

        stmt.query_map([], |row| {
            Ok(Task {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get::<_, String>(2).unwrap_or_default(),
                priority: row.get(3)?,
                tags: row.get::<_, String>(4).unwrap_or_else(|_| "[]".into()),
                due_date: row.get::<_, i64>(5).unwrap_or(0),
                completed: false,
                created_at: row.get(7)?,
                completed_at: row.get::<_, i64>(8).unwrap_or(0),
                estimated_min: row.get::<_, i32>(9).unwrap_or(0),
                recurrence: row.get::<_, String>(10).unwrap_or_default(),
                pomodoros: row.get::<_, i32>(11).unwrap_or(0),
                xp_value: row.get(12)?,
            })
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
    }

    pub fn list_completed_today(&self) -> Vec<Task> {
        let conn = self.conn.lock().unwrap();
        let ts = today_start_timestamp();
        let mut stmt = conn
            .prepare(
                "SELECT id, title, description, priority, tags, due_date, completed, \
                 created_at, completed_at, estimated_min, recurrence, pomodoros, xp_value \
                 FROM tasks WHERE completed = 1 AND completed_at >= ?1 ORDER BY completed_at DESC",
            )
            .unwrap();

        stmt.query_map(params![ts], |row| {
            Ok(Task {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get::<_, String>(2).unwrap_or_default(),
                priority: row.get(3)?,
                tags: row.get::<_, String>(4).unwrap_or_else(|_| "[]".into()),
                due_date: row.get::<_, i64>(5).unwrap_or(0),
                completed: true,
                created_at: row.get(7)?,
                completed_at: row.get::<_, i64>(8).unwrap_or(0),
                estimated_min: row.get::<_, i32>(9).unwrap_or(0),
                recurrence: row.get::<_, String>(10).unwrap_or_default(),
                pomodoros: row.get::<_, i32>(11).unwrap_or(0),
                xp_value: row.get(12)?,
            })
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
    }

    pub fn increment_pomodoro(&self, id: &str) {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE tasks SET pomodoros = pomodoros + 1 WHERE id = ?1",
            params![id],
        )
        .ok();
    }

    pub fn get_stats(&self) -> Stats {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT total_xp, level, streak_days, tasks_done FROM user_stats WHERE id = 1",
            [],
            |row| {
                Ok(Stats {
                    total_xp: row.get(0)?,
                    level: row.get(1)?,
                    streak: row.get(2)?,
                    tasks_done: row.get(3)?,
                })
            },
        )
        .unwrap_or(Stats {
            total_xp: 0,
            level: 1,
            streak: 0,
            tasks_done: 0,
        })
    }

    // ── Badges ───────────────────────────────────────────────────────

    pub fn check_and_award_badges(&self) -> Vec<String> {
        let stats = self.get_stats();
        let conn = self.conn.lock().unwrap();
        let now = Local::now().timestamp();
        let hour = Local::now().hour_naive();

        let badge_checks: Vec<(&str, bool)> = vec![
            ("first_task", stats.tasks_done >= 1),
            ("ten_tasks", stats.tasks_done >= 10),
            ("centurion", stats.tasks_done >= 100),
            ("streak_3", stats.streak >= 3),
            ("streak_7", stats.streak >= 7),
            ("streak_30", stats.streak >= 30),
            ("night_owl", stats.tasks_done >= 1 && hour >= 22),
            ("early_bird", stats.tasks_done >= 1 && hour < 7),
        ];

        let mut new_badges = Vec::new();
        for (id, earned) in badge_checks {
            if earned {
                let exists: bool = conn
                    .query_row(
                        "SELECT COUNT(*) > 0 FROM badges WHERE id = ?1",
                        params![id],
                        |r| r.get(0),
                    )
                    .unwrap_or(true);
                if !exists {
                    conn.execute(
                        "INSERT INTO badges (id, earned_at) VALUES (?1, ?2)",
                        params![id, now],
                    )
                    .ok();
                    new_badges.push(id.to_string());
                }
            }
        }
        new_badges
    }

    pub fn list_badges(&self) -> Vec<Badge> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT id, earned_at FROM badges ORDER BY earned_at ASC")
            .unwrap();
        stmt.query_map([], |row| {
            Ok(Badge {
                id: row.get(0)?,
                earned_at: row.get(1)?,
            })
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
    }
}

// ── Helper functions ─────────────────────────────────────────────────

trait NaiveHour {
    fn hour_naive(&self) -> u32;
}
impl NaiveHour for chrono::DateTime<Local> {
    fn hour_naive(&self) -> u32 {
        self.format("%H").to_string().parse().unwrap_or(0)
    }
}

pub const THRESHOLDS: [i64; 10] = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];

pub fn xp_to_level(xp: i64) -> i32 {
    for i in (0..THRESHOLDS.len()).rev() {
        if xp >= THRESHOLDS[i] {
            return (i + 1) as i32;
        }
    }
    1
}

pub fn level_name(level: i32) -> &'static str {
    match level {
        1 => "Novice",
        2 => "Apprentice",
        3 => "Adept",
        4 => "Expert",
        5 => "Master",
        6 => "Grandmaster",
        7 => "Astral",
        8 => "Nebula",
        9 => "Cosmic",
        10 => "Singularity",
        _ => "Singularity",
    }
}

pub fn xp_for_priority(p: i32) -> i32 {
    match p {
        1 => 10,
        3 => 50,
        4 => 100,
        _ => 25,
    }
}

pub fn badge_label(id: &str) -> &'static str {
    match id {
        "first_task" => "First Task",
        "ten_tasks" => "10 Tasks",
        "centurion" => "100 Tasks",
        "streak_3" => "3-Day Streak",
        "streak_7" => "7-Day Streak",
        "streak_30" => "30-Day Streak",
        "night_owl" => "Night Owl",
        "early_bird" => "Early Bird",
        _ => "Unknown",
    }
}

pub fn badge_icon(id: &str) -> &'static str {
    match id {
        "first_task" => "\u{4e00}",
        "ten_tasks" => "\u{5341}",
        "centurion" => "\u{767e}",
        "streak_3" => "\u{706b}",
        "streak_7" => "\u{708e}",
        "streak_30" => "\u{9f8d}",
        "night_owl" => "\u{6708}",
        "early_bird" => "\u{671d}",
        _ => "\u{25cf}",
    }
}

fn today_start_timestamp() -> i64 {
    let today = Local::now().date_naive();
    today
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_local_timezone(Local)
        .unwrap()
        .timestamp()
}

fn update_streak(conn: &Connection, now: i64) {
    let last_active: Option<i64> = conn
        .query_row(
            "SELECT last_active FROM user_stats WHERE id = 1",
            [],
            |r| r.get(0),
        )
        .ok()
        .flatten();

    let today_start = today_start_timestamp();
    let yesterday_start = today_start - 86400;

    match last_active {
        None => {
            conn.execute(
                "UPDATE user_stats SET streak_days = 1, last_active = ?1 WHERE id = 1",
                params![now],
            )
            .ok();
        }
        Some(la) if la >= today_start => { /* already counted today */ }
        Some(la) if la >= yesterday_start => {
            conn.execute(
                "UPDATE user_stats SET streak_days = streak_days + 1, last_active = ?1 WHERE id = 1",
                params![now],
            )
            .ok();
        }
        _ => {
            conn.execute(
                "UPDATE user_stats SET streak_days = 1, last_active = ?1 WHERE id = 1",
                params![now],
            )
            .ok();
        }
    }
}

fn spawn_recurring(conn: &Connection, id: &str) {
    let result = conn.query_row(
        "SELECT title, priority, tags, recurrence, xp_value FROM tasks WHERE id = ?1",
        params![id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i32>(1)?,
                row.get::<_, String>(2).unwrap_or_else(|_| "[]".into()),
                row.get::<_, Option<String>>(3)?,
                row.get::<_, i32>(4)?,
            ))
        },
    );

    if let Ok((title, priority, tags, Some(recurrence), xp_value)) = result {
        let new_id = Uuid::new_v4().to_string();
        let now = Local::now().timestamp();
        let due: Option<i64> = match recurrence.as_str() {
            "daily" => Some(now + 86400),
            "weekly" => Some(now + 7 * 86400),
            _ => None,
        };
        conn.execute(
            "INSERT INTO tasks (id, title, priority, tags, due_date, recurrence, completed, created_at, xp_value) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8)",
            params![new_id, title, priority, tags, due, recurrence, now, xp_value],
        ).ok();
    }
}

// ── Natural Language Parser ──────────────────────────────────────────

pub fn parse_task_input(text: &str) -> ParsedTask {
    let mut title = text.to_string();
    let mut priority = 2;
    let mut tags = Vec::new();
    let mut due_date: i64 = 0;
    let mut recurrence = String::new();

    // Extract tags: #work #personal
    let tag_re = regex_lite::Regex::new(r"#(\w+)").unwrap();
    for cap in tag_re.captures_iter(text) {
        tags.push(cap[1].to_string());
    }
    title = tag_re.replace_all(&title, "").trim().to_string();

    // Extract priority
    if title.to_lowercase().contains("!urgent") {
        priority = 4;
        title = title
            .replace("!urgent", "")
            .replace("!Urgent", "")
            .replace("!URGENT", "")
            .trim()
            .to_string();
    } else if title.to_lowercase().contains("!high") {
        priority = 3;
        title = title
            .replace("!high", "")
            .replace("!High", "")
            .replace("!HIGH", "")
            .trim()
            .to_string();
    } else if title.to_lowercase().contains("!low") {
        priority = 1;
        title = title
            .replace("!low", "")
            .replace("!Low", "")
            .replace("!LOW", "")
            .trim()
            .to_string();
    }

    // Extract due date
    let now = Local::now();
    let today = now.date_naive();
    if title.to_lowercase().contains("tomorrow") {
        let tom = today.succ_opt().unwrap_or(today);
        due_date = tom
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_local_timezone(Local)
            .unwrap()
            .timestamp();
        title = regex_lite::Regex::new(r"(?i)\btomorrow\b")
            .unwrap()
            .replace_all(&title, "")
            .trim()
            .to_string();
    } else if title.to_lowercase().contains("next week") {
        let nw = today + chrono::Duration::days(7);
        due_date = nw
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_local_timezone(Local)
            .unwrap()
            .timestamp();
        title = regex_lite::Regex::new(r"(?i)\bnext week\b")
            .unwrap()
            .replace_all(&title, "")
            .trim()
            .to_string();
    } else if title.to_lowercase().contains("today") {
        due_date = today
            .and_hms_opt(23, 59, 0)
            .unwrap()
            .and_local_timezone(Local)
            .unwrap()
            .timestamp();
        title = regex_lite::Regex::new(r"(?i)\btoday\b")
            .unwrap()
            .replace_all(&title, "")
            .trim()
            .to_string();
    }

    // Extract recurrence
    if regex_lite::Regex::new(r"(?i)\b(every\s*day|daily)\b")
        .unwrap()
        .is_match(&title)
    {
        recurrence = "daily".to_string();
        title = regex_lite::Regex::new(r"(?i)\b(every\s*day|daily)\b")
            .unwrap()
            .replace_all(&title, "")
            .trim()
            .to_string();
    } else if regex_lite::Regex::new(r"(?i)\b(every\s*week|weekly)\b")
        .unwrap()
        .is_match(&title)
    {
        recurrence = "weekly".to_string();
        title = regex_lite::Regex::new(r"(?i)\b(every\s*week|weekly)\b")
            .unwrap()
            .replace_all(&title, "")
            .trim()
            .to_string();
    }

    // Clean up extra spaces
    title = regex_lite::Regex::new(r"\s+")
        .unwrap()
        .replace_all(&title, " ")
        .trim()
        .to_string();

    ParsedTask {
        title,
        priority,
        tags,
        due_date,
        recurrence,
    }
}
