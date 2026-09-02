---
description: "Install and operate the DS Kanban live task board in a DeepSeek Harness Web profile."
kind: "package-bundle"
---

# dsh-ds-kanban

English | [中文](README.zh.md)

## Summary

DS Kanban is an external bundle-format plugin for DeepSeek Harness Web 0.1.2-alpha.1. It adds a sidebar action and a full-shell live board without replacing the Harness application shell or storing a second task database. Session, Workspace, projection, pending-interaction, and connection services remain authoritative; the plugin stores only Inbox/Ready placement and presentation preferences in the existing authenticated settings capability. The current checkout installs the layer into the local `web` profile with the commands below.

## Table of Contents

- [Use this package](#use-this-package)
- [Operate the board](#operate-the-board)
- [Understand the implementation](#understand-the-implementation)
- [Security and privacy](#security-and-privacy)
- [Supported and unavailable capabilities](#supported-and-unavailable-capabilities)
- [Troubleshooting](#troubleshooting)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

### Install dependencies, verify, and build

Run these commands from the DeepSeek Harness repository root:

```text
pnpm install --dir plugins/ds-kanban
pnpm --dir plugins/ds-kanban typecheck
pnpm --dir plugins/ds-kanban build
pnpm --dir plugins/ds-kanban test
```

The test command reads the built Client artifact, so build it before testing after a clean checkout. The browser compatibility check rejects the removed `@deepseek-ai/dsh-client-runtime` import and any unexpected external `require()` call.

### Install into the local Web profile

```text
pnpm dsh plugin --profile web add ./plugins/ds-kanban
pnpm dsh --profile web --port 3080
```

Open the printed loopback URL, then select **DS Kanban** in the sidebar. An already-running Host must be restarted after an install, update, or removal because profile composition and Client bundle discovery happen during Host startup.

### Update or remove

Rebuild and repeat the `add` command to reconcile an updated checkout. Remove the package and its ordered profile layer without deleting Harness sessions or Workspace data:

```text
pnpm dsh plugin --profile web remove dsh-ds-kanban
```

Removing the package stops loading the board. The `ds-kanban` settings section remains user-owned data unless the operator explicitly removes it.

### What you get

The sidebar badge counts waiting, failed, and high-context-pressure tasks. The full board provides Inbox, Ready, Running, Waiting, Blocked or Failed, and Done columns; live statistics; search and filters; Workspace grouping; density and timestamp controls; explicit JSON/CSV export; diagnostics; task creation; existing-task navigation; cancellation; archive; and task-ID copy. Automatic state always overrides manual Inbox/Ready placement.

<a id="operate-the-board"></a>
## Operate the board

Click a card or focus it and press Enter to open its existing Harness task. Left and Right Arrow move focus between populated columns, `/` focuses search, and Escape closes the active board layer or dialog. The board covers the whole shell, including the sidebar, so its return paths never depend on the covered UI: opening the board moves focus onto the toolbar's **Back to session** control, and that control or a document-level Escape closes the board and restores focus to the sidebar action. Only blank Inbox/Ready cards are draggable; runtime, waiting, failed, completed, and archived facts cannot be overwritten by drag-and-drop. Archive and cancellation require confirmation. Failed archive, cancellation, or ID-copy actions surface an inline error banner with a dismiss control. Export contains the explicit card summary allowlist and never includes prompts, transcripts, credentials, tool results, or file contents.

<a id="understand-the-implementation"></a>
## Understand the implementation

The package declares `dsh.bundle.patch` in [`package.json`](package.json). [`cordis.patch.yml`](cordis.patch.yml) inserts the Host settings registration. [`src/client/index.ts`](src/client/index.ts) contributes one sidebar footer action and one shell overlay through lifecycle-owned slots. [`src/client/board.ts`](src/client/board.ts) is the pure authoritative-state projection, while [`src/settings.ts`](src/settings.ts) owns the versioned manual placement and view preferences. [`ARCHITECTURE.md`](ARCHITECTURE.md) documents the ownership and update flow.

The Host adds no HTTP route. Browser mutations reuse authenticated Session, Workspace, Agent Preset, and settings RPC services already exposed by the Web profile. The existing settings provider validates the registered schema, revision-fences writes, and commits the plugin-owned section atomically.

<a id="security-and-privacy"></a>
## Security and privacy

The plugin makes no external network request, starts no server, executes no browser-supplied shell command, and emits no telemetry. It reads list summaries and lightweight lifecycle/projection state rather than task content. Malformed or unknown-version settings are rejected without rewriting the stored section; the Client retains its last accepted snapshot. Lifecycle disposal removes Session subscriptions, slot rows, locale dictionaries, and the injected style element. See [`SECURITY.md`](SECURITY.md) for the threat and data summary.

<a id="supported-and-unavailable-capabilities"></a>
## Supported and unavailable capabilities

Current Harness APIs expose live Session state, Workspace membership and archive state, pending user interactions, model and preset projections, completed steps, token usage, context pressure, cancellation, Session navigation, and direct subagent Session counts.

The current APIs do not expose authoritative cost, task start/runtime history, durable completion timestamps for “completed today,” tool-call totals, Git branch/worktree, changed-file count, or short final-result summaries in the task list projection. They also do not expose pin/unpin or unarchive actions. DS Kanban labels aggregate cost, runtime sorting, and completed-today statistics unavailable, omits unavailable card metrics, and never synthesizes them.

<a id="troubleshooting"></a>
## Troubleshooting

- **No sidebar entry:** rebuild, repeat the profile `add` command, and restart the Web Host. Inspect Host startup output for a failed bundle row.
- **Preferences show memory only:** the Host profile does not expose the settings namespace to this Client connection. Board operation continues, but preference writes are not durable.
- **Disconnected indicator:** the board preserves the last received snapshots while the existing Harness connection loop reconnects. Use Refresh after connection recovery if the list remains stale.
- **A metric or action is missing:** open Diagnostics in the board. Unsupported capabilities stay disabled or absent by design.
- **Client loader failure:** run `pnpm --dir plugins/ds-kanban build` and `pnpm --dir plugins/ds-kanban test`; the bundle test lists the supported external modules.

<a id="model-experience"></a>
## Model Experience

None. DS Kanban is an operator-facing Client projection and does not add model-visible tools, prompt content, or request inputs.

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

The board projects top-level tasks and counts direct subagent Sessions; it does not render subagent Sessions as independent cards. Each column initially renders 60 cards and reveals further cards in 60-card pages, while filters and statistics continue to cover the complete authoritative set. Runtime and cost sort options are disabled in the dropdown because authoritative values are absent. Archive is one-way in the current supported Client API. The sidebar attention badge requires lightweight cached Session faces even while the full overlay is closed; it does not open transcript windows or poll the Host.

### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The bundle targets the 0.1.2-alpha.1 Client service vocabulary and deliberately has no compatibility path for the removed `dsh-client-runtime` package.

</details>
