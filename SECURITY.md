# DS Kanban security and privacy

DS Kanban trusts the same loopback and authenticated connection established by Harness Web. The package creates no HTTP or WebSocket endpoint. Session creation, preset selection, rename, prompt admission, cancellation, archive, settings writes, and navigation use existing typed Harness Client services and authenticated RPC namespaces.

The Host accepts only the `ds-kanban` versioned settings record through the Harness Settings schema. The provider owns atomic persistence and revision fencing. The Client decoder refuses unknown versions, invalid manual columns, invalid enums, wrong scalar types, and out-of-range context thresholds; it preserves the last accepted value and does not repair the original document.

The board consumes task-list metadata, lifecycle flags, pending-interaction presence, Workspace metadata, and selected projections. It does not request message content, prompts, complete transcripts, credentials, API keys, attachment bytes, tool-result payloads, or Workspace files. Explicit exports use a fixed summary allowlist. The package sends no telemetry and makes no request outside the local Harness connection.

The browser cannot ask this package to execute a shell command. Archive and cancellation require explicit confirmation. The first version provides no delete operation. Lifecycle cleanup removes registrations, subscriptions, dictionaries, and styles; it owns no timer or background worker.
