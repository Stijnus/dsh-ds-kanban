# dsh-ds-kanban

English | [中文](README.zh.md)

## Summary

DS Kanban is an external bundle-format plugin for DeepSeek Harness Web. It adds a sidebar action and a full-shell live board without replacing the Harness application shell or storing a second task database. Session, Workspace, projection, pending-interaction, and connection services remain authoritative; the plugin stores only Inbox/Ready placement and presentation preferences in the existing authenticated settings capability. The package is installable into any profile with the `dsh plugin` commands below and requires a Harness release on the `0.1.2-alpha.1` service vocabulary or newer.

## Table of Contents

- [Install this package](#install-this-package)
- [Operate the board](#operate-the-board)
- [Understand the implementation](#understand-the-implementation)
- [Security and privacy](#security-and-privacy)
- [Supported and unavailable capabilities](#supported-and-unavailable-capabilities)
- [Build from source](#build-from-source)
- [Troubleshooting](#troubleshooting)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="install-this-package"></a>
## Install this package

Prerequisites: a DeepSeek Harness install with the `dsh` CLI and a target profile (the Web profile exposes the full board). Install, update, or removal changes profile composition and Client bundle discovery, so restart the profile's Host afterward. Choose one channel:

**npm (no build permission needed):**

```text
dsh plugin --profile <name> add dsh-ds-kanban
```

**Pinned git (source install; pnpm runs the package's `prepare` build once):**

```text
dsh plugin --profile <name> add github:Stijnus/dsh-ds-kanban#<sha-or-tag>
```

A git install fetches sources, so pnpm ≥10 refuses the `prepare` build until it is allowed: copy the exact package key pnpm prints into the profile's `pnpm-workspace.yaml` `allowBuilds` map and re-run the `add`. Pin a commit or tag so a later push cannot silently change what runs; treat the allowance as permission to execute the package's build on your machine.

**Release tarball (no build permission needed):**

Download `dsh-ds-kanban-<version>.tgz` from the [GitHub Releases](https://github.com/Stijnus/dsh-ds-kanban/releases) page, then:

```text
dsh plugin --profile <name> add ./dsh-ds-kanban-<version>.tgz
```

After the add and a Host restart, select **DS Kanban** in the sidebar. Update by adding the newer version of the package; remove the package and its ordered profile layer without deleting Harness sessions or Workspace data:

```text
dsh plugin --profile <name> remove dsh-ds-kanban
```

Removing the package stops loading the board. The `ds-kanban` settings section remains user-owned data unless the operator explicitly removes it.

### What you get

The sidebar badge counts waiting, failed, goal-blocked, and high-context-pressure tasks. The full board provides Inbox, Ready, Running, Waiting, Blocked or Failed, Idle, and Goal complete columns; live statistics; search and filters; Workspace grouping; density and timestamp controls; explicit JSON/CSV export; diagnostics; task creation; existing-task navigation; cancellation; archive; and task-ID copy. Automatic state always overrides manual Inbox/Ready placement.

<a id="operate-the-board"></a>
## Operate the board

Click a card or focus it and press Enter to open its existing Harness task. Left and Right Arrow move focus between populated columns, `/` focuses search, and Escape closes the active board layer or dialog. The board covers the whole shell, including the sidebar, so its return paths never depend on the covered UI: opening the board moves focus onto the toolbar's **Back to session** control, and that control or a document-level Escape closes the board and restores focus to the sidebar action. Only blank Inbox/Ready cards are draggable; runtime, waiting, failed, completed, and archived facts cannot be overwritten by drag-and-drop. Archive and cancellation require confirmation. Failed archive, cancellation, or ID-copy actions surface an inline error banner with a dismiss control. Export contains the explicit card summary allowlist and never includes prompts, transcripts, credentials, tool results, or file contents.

### Read execution and goal state

A stopped, nonblank session is **Idle** unless Harness supplies a completed goal. **Goal complete** means the current durable goal is complete; it does not mean a reviewer accepted the work. Pending interactions, current execution, and failures take precedence over goal completion; queued work keeps a stopped session in Idle. The sidebar's unread-completion reminder is not used as evidence of task success.

When Harness supplies the `goal` projection, cards show its objective, phase, rounds used against the cap, and recorded blocker explanation. Rounds measure continuation usage, not percentage complete. An active goal can be idle; the projection does not expose whether automatic continuation is armed. Open the session to use its existing goal controls. Missing or cleared goal projections remove the goal detail without affecting ordinary board operation.

Choose **Needs attention** in the Status filter to find pending approvals, questions, execution failures, blocked goals, and high context usage. Each attention card names the reason and opens the existing session's controls. Unknown interaction domains use a generic input-required action. These buttons navigate only: approval and answer submission remain with the current Harness interaction. Exports omit goal objectives and blocker explanations.

<a id="understand-the-implementation"></a>
## Understand the implementation

The package declares `dsh.bundle.patch` in [`package.json`](package.json). [`cordis.patch.yml`](cordis.patch.yml) inserts the Host settings registration. [`src/client/index.ts`](src/client/index.ts) contributes one sidebar footer action and one shell overlay through lifecycle-owned slots. [`src/client/board.ts`](src/client/board.ts) is the pure authoritative-state projection, while [`src/settings.ts`](src/settings.ts) owns the versioned manual placement and view preferences. [`ARCHITECTURE.md`](ARCHITECTURE.md) documents the ownership and update flow.

The Host adds no HTTP route. Browser mutations reuse authenticated Session, Workspace, Agent Preset, and settings RPC services already exposed by the Web profile. The existing settings provider validates the registered schema, revision-fences writes, and commits the plugin-owned section atomically.

<a id="security-and-privacy"></a>
## Security and privacy

The plugin makes no external network request, starts no server, executes no browser-supplied shell command, and emits no telemetry. It reads list summaries and lightweight lifecycle/projection state including available goal objectives and blocker explanations; it does not request transcript content. Malformed or unknown-version settings are rejected without rewriting the stored section; the Client retains its last accepted snapshot. Lifecycle disposal removes Session subscriptions, slot rows, locale dictionaries, and the injected style element. See [`SECURITY.md`](SECURITY.md) for the threat and data summary.

<a id="supported-and-unavailable-capabilities"></a>
## Supported and unavailable capabilities

Current Harness APIs expose live Session state, Workspace membership and archive state, pending interaction types, optional goal phases and round usage, model and preset projections, completed steps, token usage, context pressure, cancellation, Session navigation, and direct subagent Session counts.

The current APIs do not expose authoritative cost, task start/runtime history, durable completion timestamps for "completed today," tool-call totals, Git branch/worktree, changed-file count, or short final-result summaries in the task list projection. They also do not expose pin/unpin or unarchive actions. DS Kanban disables cost and runtime sorting, omits unavailable summary and card metrics, and never synthesizes them. The completion statistic counts cards in Goal complete across the current filters; it is not a daily count.

<a id="build-from-source"></a>
## Build from source

```text
pnpm install
pnpm typecheck
pnpm build
pnpm test
```

Run `pnpm exec vitest bench --run tests/runtime.bench.ts` to measure runtime publication with 1,000 sessions and 20 active agents. This benchmark excludes React rendering and network delivery. Behavior tests also assert per-session snapshot reads and stable identities, without timing thresholds.

The test command reads the built Client artifact, so build it before testing after a clean checkout. The browser compatibility check rejects the removed `@deepseek-ai/dsh-client-runtime` import and any unexpected external `require()` call. Development happens on the `main` branch; releases are tagged `vX.Y.Z` and shipped by the `ci.yml` and `release.yml` workflows.

<a id="troubleshooting"></a>
## Troubleshooting

- **No sidebar entry:** rebuild, repeat the profile `add` command, and restart the profile's Host. Inspect Host startup output for a failed bundle row.
- **Preferences show memory only:** the Host profile does not expose the settings namespace to this Client connection. Board operation continues, but preference writes are not durable.
- **Disconnected indicator:** the board preserves the last received snapshots while the existing Harness connection loop reconnects. Use Refresh after connection recovery if the list remains stale.
- **A metric or action is missing:** open Diagnostics in the board. Unsupported capabilities stay disabled or absent by design.
- **Client loader failure:** run `pnpm build` and `pnpm test`; the bundle test lists the supported external modules.

<a id="model-experience"></a>
## Model Experience

None. DS Kanban is an operator-facing Client projection and does not add model-visible tools, prompt content, or request inputs.

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

The board projects top-level tasks. Each displayed task automatically observes its reachable subagent catalogs and shows a total descendant count and running count while collapsed. Loading, failed, and diagnostic catalogs mark totals as partial. Show agents expands the hierarchy; Running agents and Waiting agents retain matching descendants with their ancestor paths. Rows show One-shot or Continuable mode and open the correct subagent session. Catalog interest is released when the card leaves the board. Catalog activity distinguishes Running from Inactive, while available pending interactions show Waiting for you. Inactive does not imply successful completion. Top-level filters and summary totals do not include child rows. Child model, preset, usage, and goal details appear only when available in the Harness session summary; the board does not open transcripts to retrieve missing details. Model selection is labeled Next model, not the model of an ongoing or past request. Each column initially renders 60 cards and reveals further cards in 60-card pages, while filters and statistics continue to cover the complete authoritative set. Runtime and cost sort options are disabled in the dropdown because authoritative values are absent. Archive is one-way in the current supported Client API. The sidebar attention badge requires lightweight cached Session faces even while the full overlay is closed; it does not open transcript windows or poll the Host.

### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The bundle targets the `0.1.2-alpha.1` Client service vocabulary and deliberately has no compatibility path for the removed `dsh-client-runtime` package. Standalone devDependencies pin the `@deepseek-ai/dsh-*` snapshot the code is proven against (`0.1.2-alpha.3`); peerDependencies stay `>=0.1.2-alpha.1`. The goal package is a type-only development dependency; the bundle does not mount it or require a new browser external. Goal presentation is validated against the published `0.1.2-alpha.3` projection. To pick up a newer alpha, bump the devDependencies to the newest published `0.1.2-alpha.x`, re-run the suite, and release the result as a new version.

</details>

Diagnostics is an API capability reference, not a live health check. Only the task-count tiles filter by status; token, context, and workspace totals are informational. Failed refreshes, filter writes, and manual moves report errors in the board banner. Manual moves accept only known blank Inbox/Ready cards.

The board keeps search, workspace, and status visible; View options contains the remaining filters and display preferences. Selecting a status focuses its column. Agent hierarchies scroll within the task card, with model and usage details behind a per-agent disclosure. Unsupported cost totals are omitted; Diagnostics still lists unavailable capabilities.
