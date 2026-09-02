# Expanded agent catalogs

Version 0.2.0 adds on-demand parent-addressed subagent lists to task cards. The Session Controller catalog owns membership, child mode, navigation address, and running activity. Expanded lists subscribe through its existing catalog-interest API and release interest on unmount. Nested lists expand only when requested; the board never loads child transcripts just to fill metadata.

Available summary projections supply next-model selection, preset, usage, and goals. Missing model details are explicitly unavailable and never copied from a parent. Inactive is not completion. Top-level summary counts and filters retain their existing task scope; each expanded catalog reports its own direct-child running count.

Tests cover catalog-only children absent from the global session list, subscription cleanup, durable navigation, activity updates, optional model data, diagnostics, refresh rejection, and bilingual presentation snapshots.
