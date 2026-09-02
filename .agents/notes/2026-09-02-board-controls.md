# Board controls

Live investigation confirmed Diagnostics, session navigation, status filters, and the new-task dialog work. Diagnostics describes capabilities rather than running health tests. Summary totals previously looked actionable but only cleared the status filter; they now render as informational tiles. Status buttons expose their selected state.

Manual drops now validate against all displayed cards instead of the destination column, rejecting unknown or automatically classified sessions. Refresh, setting-write, and move rejections reach the existing error banner. Reverse Tab from a newly focused dialog stays inside it.

Validation includes focused control, projection, and focus tests plus a client build. Live checks do not cancel, archive, or create user sessions.
