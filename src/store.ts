import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { call } from "./herdr.js";

// Notes are keyed by workspace label (what the sidebar shows), so they survive closing and
// reopening a workspace. `ids` only maps live workspace ids to labels to follow renames.

export interface Note {
  text: string;
  updatedAt: number;
}

export interface Store {
  notes: Record<string, Note>;
  ids: Record<string, string>;
}

const PLUGIN_ID = process.env.HERDR_PLUGIN_ID || "vlyamzin.workspace-notes";
const SOURCE = `plugin:${PLUGIN_ID}`;
const DEFAULT_ICON = "📝";

export const stateDir = () => process.env.HERDR_PLUGIN_STATE_DIR || path.join(os.homedir(), ".local/state/herdr/plugins", PLUGIN_ID);
export const configDir = () => process.env.HERDR_PLUGIN_CONFIG_DIR || path.join(os.homedir(), ".config/herdr/plugins/config", PLUGIN_ID);
export const storePath = () => path.join(stateDir(), "notes.json");

export function load(): Store {
  let text: string;
  try {
    text = fs.readFileSync(storePath(), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { notes: {}, ids: {} };
    throw e;
  }
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    // Never overwrite a file we can't read; the user may want to fix it by hand.
    throw new Error(`${storePath()}: ${(e as Error).message}`);
  }
  return { notes: raw?.notes ?? {}, ids: raw?.ids ?? {} };
}

/** Atomic write: hooks and the popup may run at the same time. */
export function save(store: Store): void {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

/** Load, mutate, save. Re-reads right before writing to keep concurrent hook updates. */
export function update<T>(fn: (store: Store) => T): T {
  const store = load();
  const result = fn(store);
  save(store);
  return result;
}

export function icon(): string {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(configDir(), "config.json"), "utf8"));
    if (typeof cfg?.icon === "string" && cfg.icon.trim()) return cfg.icon.trim();
  } catch {
    // missing or invalid config → default
  }
  return DEFAULT_ICON;
}

/** First non-empty line, at most 78 chars + "…" (token values are capped at 80). */
export function snippet(text: string): string {
  const line = text.split("\n").map((l) => l.trim()).find((l) => l) ?? "";
  const chars = [...line];
  return chars.length > 78 ? chars.slice(0, 78).join("") + "…" : line;
}

/** Shows the note icon + first line on the workspace, or clears them when `note` is undefined. */
export async function applyTokens(workspaceId: string, note: Note | undefined): Promise<void> {
  const tokens = note ? { note: icon(), note_text: snippet(note.text) } : { note: null, note_text: null };
  await call("workspace.report_metadata", { workspace_id: workspaceId, source: SOURCE, tokens });
}

export function ago(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  const units: [number, string][] = [
    [365 * 86400, "year"],
    [30 * 86400, "month"],
    [7 * 86400, "week"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  for (const [size, name] of units) {
    const n = Math.floor(s / size);
    if (n >= 1) return `${n} ${name}${n === 1 ? "" : "s"} ago`;
  }
  return "just now";
}

export function localDateTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
