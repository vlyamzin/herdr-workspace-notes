import { listWorkspaces } from "./herdr.js";
import { applyTokens, update } from "./store.js";

// Startup + workspace event hook. Herdr drops metadata tokens on server restart and the
// popup only touches the current workspace, so this keeps every workspace's tokens in sync.

function eventData(): any {
  try {
    return JSON.parse(process.env.HERDR_PLUGIN_EVENT_JSON ?? "{}")?.data ?? {};
  } catch {
    return {};
  }
}

async function startup(): Promise<void> {
  const workspaces = await listWorkspaces();
  const notes = update((s) => {
    s.ids = Object.fromEntries(workspaces.map((w) => [w.workspace_id, w.label]));
    return s.notes;
  });
  for (const w of workspaces) {
    const note = notes[w.label];
    // Also clear stale tokens, e.g. after notes.json was edited by hand.
    if (note || w.tokens?.note) await applyTokens(w.workspace_id, note);
  }
}

async function created(data: any): Promise<void> {
  const { workspace_id: id, label } = data.workspace ?? {};
  if (!id || !label) return;
  const note = update((s) => {
    s.ids[id] = label;
    return s.notes[label];
  });
  if (note) await applyTokens(id, note);
}

async function renamed(data: any): Promise<void> {
  const { workspace_id: id, label } = data;
  if (!id || !label) return;
  const note = update((s) => {
    const old = s.ids[id];
    if (old && old !== label && s.notes[old] && !s.notes[label]) {
      s.notes[label] = s.notes[old];
      delete s.notes[old];
    }
    s.ids[id] = label;
    return s.notes[label];
  });
  await applyTokens(id, note);
}

function closed(data: any): void {
  const id = data.workspace_id;
  if (!id) return;
  update((s) => {
    delete s.ids[id]; // the note itself stays, keyed by label
  });
}

const event = process.env.HERDR_PLUGIN_EVENT;
try {
  switch (event) {
    case "workspace.created":
      await created(eventData());
      break;
    case "workspace.renamed":
      await renamed(eventData());
      break;
    case "workspace.closed":
      closed(eventData());
      break;
    default:
      await startup();
  }
} catch (e) {
  console.error(`workspace-notes sync (${event ?? "startup"}): ${(e as Error).message}`);
  process.exit(1);
}
