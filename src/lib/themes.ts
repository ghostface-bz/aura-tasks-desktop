export interface Theme {
  bg: string;
  sf: string;
  bd: string;
  tp: string;
  ts: string;
  ac: string;
  ok: string;
  gd: string;
  no: string;
  light: boolean;
}

export const themes: Record<string, Theme> = {
  sumi:   { bg: "#0f0f0f", sf: "#1a1a1a", bd: "#262626", tp: "#e8e4df", ts: "#6b6560", ac: "#c8956c", ok: "#7a9e7e", gd: "#c8a96c", no: "#b85c5c", light: false },
  kon:    { bg: "#0C0E18", sf: "#151827", bd: "#222842", tp: "#D8DDE8", ts: "#5B6178", ac: "#6B7FD7", ok: "#6A9E7A", gd: "#C9A84E", no: "#C45B5B", light: false },
  matsu:  { bg: "#0B100D", sf: "#151D17", bd: "#243028", tp: "#DAE0D8", ts: "#6B7568", ac: "#6A9E72", ok: "#8AAE7E", gd: "#C4A85C", no: "#B85C5C", light: false },
  sakura: { bg: "#12100F", sf: "#1E1A19", bd: "#302928", tp: "#E8DFD8", ts: "#7A6E68", ac: "#C48A8A", ok: "#7A9E7E", gd: "#C8A96C", no: "#B85050", light: false },
  ishi:   { bg: "#111111", sf: "#1C1C1C", bd: "#2A2A2A", tp: "#E0E0E0", ts: "#6B6B6B", ac: "#8A8ABA", ok: "#7A9E7E", gd: "#C4B078", no: "#B85C5C", light: false },
  washi:  { bg: "#F5F0E7", sf: "#EBE6DC", bd: "#D6D0C4", tp: "#2C2825", ts: "#8A8279", ac: "#B07D4F", ok: "#5C7A5E", gd: "#B89B5E", no: "#A84E4E", light: true },
};

export const themeOrder = ["sumi", "kon", "matsu", "sakura", "ishi", "washi"];
export const themeLabels: Record<string, string> = {
  sumi: "Sumi 墨",
  kon: "Kon 紺",
  matsu: "Matsu 松",
  sakura: "Sakura 桜",
  ishi: "Ishi 石",
  washi: "Washi 和紙",
};

export function applyTheme(name: string) {
  const t = themes[name] || themes.sumi;
  const root = document.documentElement;
  root.style.setProperty("--bg", t.bg);
  root.style.setProperty("--sf", t.sf);
  root.style.setProperty("--bd", t.bd);
  root.style.setProperty("--tp", t.tp);
  root.style.setProperty("--ts", t.ts);
  root.style.setProperty("--ac", t.ac);
  root.style.setProperty("--ok", t.ok);
  root.style.setProperty("--gd", t.gd);
  root.style.setProperty("--no", t.no);
  root.style.setProperty("--light", t.light ? "1" : "0");
}
