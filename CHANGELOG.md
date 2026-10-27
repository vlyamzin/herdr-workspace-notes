# Changelog

All notable changes to this plugin. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions: [SemVer](https://semver.org/).

## [Unreleased]

### Added

- MIT license.

## [0.1.0] - 2026-10-27

### Added

- Hotkey popup to view, edit and delete one sticky note per workspace.
- Sidebar indicator via `$note` / `$note_text` workspace tokens, with a configurable icon.
- Notes keyed by workspace label: they survive closing/reopening and follow renames.
- Startup and workspace event hooks keep tokens in sync across server restarts.
