# workspace-notes

A [Herdr](https://herdr.dev) plugin: one sticky note per workspace, so coming back to a workspace
you can see where you left off. A hotkey opens a popup with the current workspace's note, and
workspaces with a note get an icon in the sidebar.

## Install

Requires Node.js ≥ 20 + npm, Herdr ≥ 0.9.0 (Linux/macOS). No runtime dependencies.

From GitHub (Herdr clones the repo and runs `npm ci && npm run build`):

```sh
herdr plugin install vlyamzin/herdr-workspace-notes               # follow main
herdr plugin install vlyamzin/herdr-workspace-notes --ref v0.1.0  # or pin a release
herdr plugin update vlyamzin.workspace-notes                      # fetch updates for the recorded ref
```

A pinned `--ref` stays on that tag; to move to a newer release, install again with the new tag.
Releases and their notes: https://github.com/vlyamzin/herdr-workspace-notes/releases

From a local checkout (for development; `link` doesn't run the build):

```sh
npm install && npm run build && herdr plugin link "$PWD"
```

Then bind a key in your Herdr `config.toml`:

```toml
[[keys.command]]
key = "prefix+shift+m"
type = "plugin_action"
command = "vlyamzin.workspace-notes.open"
description = "workspace note"
```

Show the note icon in the sidebar (`$note`), and optionally the note's first line (`$note_text`):

```toml
[ui.sidebar.spaces]
rows = [["state_icon", "workspace", "$note"], ["branch", "git_status"]]
# optional extra row with the note's first line:
# rows = [["state_icon", "workspace", "$note"], ["branch", "git_status"], [{ token = "$note_text", dim = true }]]
```

Then `herdr server reload-config`.

## Usage

- **No note yet:** the popup opens your editor right away. Save some text to create the note; save
  an empty file to cancel.
- **Note exists:** the popup shows it with when it was last updated.
  - `e` edits it in your editor (saving an empty file deletes the note)
  - `d` deletes it (asks first)
  - `q`, `Esc`, `Enter` or `Ctrl-C` closes the popup

Editor: `$VISUAL`, then `$EDITOR`, then the first of `nano` / `vim` / `vi` found on `PATH`.
Values with arguments such as `code --wait` work.

## Notes are keyed by workspace label

A note belongs to the workspace **label** (the name in the sidebar), not to its internal id:

- closing a workspace keeps its note; opening a workspace with the same label later shows it
  again (handy with workspace-launcher, which labels workspaces after the template);
- renaming a workspace moves its note to the new label, unless that label already has a note;
- two open workspaces with the same label share one note.

Notes never expire; they're removed only by `d` or by saving an empty note.

Storage: `$HERDR_PLUGIN_STATE_DIR/notes.json`
(default `~/.local/state/herdr/plugins/vlyamzin.workspace-notes/notes.json`).

## Icon override

Some terminals draw emoji at the wrong width. To use another icon, create
`$HERDR_PLUGIN_CONFIG_DIR/config.json`
(default `~/.config/herdr/plugins/config/vlyamzin.workspace-notes/config.json`):

```json
{ "icon": "✎" }
```

It takes effect the next time a note is saved, a workspace is opened or renamed, or the server restarts.

## How the sidebar stays in sync

Herdr doesn't keep metadata tokens across a server restart, so `dist/sync.js` runs on startup and
on `workspace.created` / `workspace.renamed` / `workspace.closed` to re-apply them and to follow
renames. Hook failures show up in `herdr plugin log list --plugin vlyamzin.workspace-notes`.

## Releasing

Versions follow SemVer; `package.json`, `herdr-plugin.toml` and the `vX.Y.Z` tag always match.

1. Add changes under `## [Unreleased]` in `CHANGELOG.md` and commit.
2. `npm version patch` (or `minor` / `major`). This bumps `package.json`, copies the version into
   `herdr-plugin.toml`, turns `Unreleased` into the new version section, commits `Release vX.Y.Z`
   and tags `vX.Y.Z`.
3. `git push --follow-tags`. The Release workflow checks the versions match, builds, and publishes
   a GitHub release with that version's changelog section.

## License

[MIT](LICENSE)
