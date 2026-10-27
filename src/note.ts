import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { call, context, listWorkspaces } from "./herdr.js";
import { ago, applyTokens, load, localDateTime, update, type Note } from "./store.js";

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

interface Target {
  id: string;
  label: string;
}

/** The workspace under the popup, else the focused one. */
async function target(): Promise<Target> {
  const ctx = context();
  if (ctx.workspace_id && ctx.workspace_label) return { id: ctx.workspace_id, label: ctx.workspace_label };
  if (ctx.workspace_id) {
    const res = await call("workspace.get", { workspace_id: ctx.workspace_id });
    return { id: ctx.workspace_id, label: res.workspace.label };
  }
  const focused = (await listWorkspaces()).find((w) => w.focused);
  if (!focused) throw new Error("no focused workspace");
  return { id: focused.workspace_id, label: focused.label };
}

// ---------- editor ----------

function editorCommand(): string {
  const env = process.env.VISUAL || process.env.EDITOR;
  if (env) return env;
  for (const name of ["nano", "vim", "vi"]) {
    if (spawnSync("sh", ["-c", `command -v ${name}`], { stdio: "ignore" }).status === 0) return name;
  }
  return "vi";
}

/** Edits `text` in the user's editor. Returns the new text (trailing whitespace stripped), or null if the editor failed. */
function edit(text: string): string | null {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-note-"));
  const file = path.join(dir, "note.md");
  try {
    // Trailing newline so text appended by the editor starts on its own line.
    fs.writeFileSync(file, text ? text + "\n" : "");
    const res = spawnSync("sh", ["-c", `${editorCommand()} "$1"`, "sh", file], { stdio: "inherit" });
    if (res.status !== 0) return null;
    return fs.readFileSync(file, "utf8").replace(/\s+$/, "");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- store operations ----------

async function saveNote(t: Target, text: string): Promise<Note | undefined> {
  const note = update((s) => {
    s.ids[t.id] = t.label;
    if (!text) {
      delete s.notes[t.label];
      return undefined;
    }
    const prev = s.notes[t.label];
    if (prev?.text === text) return prev;
    return (s.notes[t.label] = { text, updatedAt: Date.now() });
  });
  await applyTokens(t.id, note);
  return note;
}

// ---------- view mode ----------

/** Resolves with the next keypress in raw mode. Escape sequences (arrows etc.) are skipped. */
function readKey(): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    const onData = (buf: Buffer) => {
      const key = buf.toString("utf8");
      if (key.startsWith("\x1b") && key.length > 1) return;
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      resolve(key);
    };
    stdin.on("data", onData);
  });
}

function render(t: Target, note: Note): void {
  const width = Math.max(20, process.stdout.columns ?? 80);
  const rule = dim("─".repeat(width));
  process.stdout.write("\x1b[2J\x1b[H");
  console.log(`${bold(t.label)}  ${dim(`updated ${ago(note.updatedAt)} (${localDateTime(note.updatedAt)})`)}`);
  console.log(rule);
  console.log(note.text);
  console.log(rule);
  console.log(dim("e edit · d delete · q/esc close"));
}

const CLOSE = new Set(["q", "Q", "\x1b", "\r", "\n", "\x03"]);

async function main(): Promise<void> {
  const t = await target();
  let note: Note | undefined = load().notes[t.label];
  if (!note) {
    const text = edit("");
    if (!text) return;
    note = await saveNote(t, text);
    if (!note) return;
  }

  for (;;) {
    render(t, note);
    const key = await readKey();
    if (CLOSE.has(key)) return;
    if (key === "e") {
      const text = edit(note.text);
      if (text === null) continue;
      const saved = await saveNote(t, text);
      if (!saved) return; // emptied → deleted
      note = saved;
    } else if (key === "d") {
      process.stdout.write("\nDelete this note? (y/N) ");
      if ((await readKey()).toLowerCase() === "y") {
        await saveNote(t, "");
        return;
      }
    }
  }
}

try {
  await main();
  process.exit(0);
} catch (e) {
  console.error(`workspace-notes: ${(e as Error).message}`);
  console.error(dim("press any key to close"));
  await readKey();
  process.exit(1);
}
