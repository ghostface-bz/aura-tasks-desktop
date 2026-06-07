# Building Aura Tasks

Cross-platform desktop build via Tauri v2 (Rust backend + React/Vite frontend).
The same source builds on Windows, macOS, and Linux — but **each OS must build its
own installer**; there is no clean cross-compile from Linux to Windows.

## Prerequisites (all platforms)

- **Node.js** LTS (18+)
- **Rust** via [rustup](https://rustup.rs)

### Windows extras

- **Microsoft C++ Build Tools** — install "Visual Studio Build Tools" and tick
  *Desktop development with C++* (provides the MSVC linker Rust needs).
- **WebView2** — preinstalled on Windows 10/11. If missing, grab the Evergreen
  bootstrapper from Microsoft.

### Linux extras (Fedora)

```bash
sudo dnf5 install webkit2gtk4.1-devel openssl-devel gtk3-devel \
  libappindicator-gtk3-devel librsvg2-devel
```

## Run it live (any OS)

```bash
npm install
npm run tauri dev
```

## Build an installer

```bash
npm install
npm run tauri build
```

Output lands in `src-tauri/target/release/bundle/`:

- **Windows** → `msi/*.msi` and `nsis/*-setup.exe`
- **Linux**   → `appimage/*.AppImage` and `deb/*.deb`
- **macOS**   → `dmg/*.dmg` and `macos/*.app`

First build is slow (compiles the whole Rust dependency tree); later builds are
incremental.

## Notes

- SQLite is bundled into the binary (`rusqlite` `bundled` feature) — no system
  SQLite needed on any platform.
- The task database is stored per-OS in the app data dir:
  - Windows: `%APPDATA%\com.auratasks.app`
  - Linux:   `~/.local/share/com.auratasks.app`
  - macOS:   `~/Library/Application Support/com.auratasks.app`
</content>
</invoke>
