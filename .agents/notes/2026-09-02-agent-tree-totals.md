# Whole-tree agent totals

Visible task cards now observe reachable descendant catalogs while collapsed. Traversal counts each child once, excludes the root, follows hasChildren, and terminates on repeated ids. Missing, loading, failed, and diagnostic catalogs produce an explicitly partial count. Card removal releases observed catalogs; collapsing rows retains the observation needed for live totals.

Running and waiting filters preserve ancestor paths and expand those paths automatically. Mode labels distinguish one-shot and continuable children. Top-level board totals still describe top-level tasks.

Tests cover collapsed nested totals, loading and failed catalogs, membership removal, duplicate and cyclic references, filtered ancestor paths, and subscription cleanup. The projection consumes existing catalogs without adding polling or opening transcripts.
