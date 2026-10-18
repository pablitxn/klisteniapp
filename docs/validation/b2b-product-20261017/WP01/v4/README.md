# UI binding artifact amendment

This additive artifact-only amendment supersedes the v3 root-binding patch representation, preserving all v3 evidence and tested UI code `912f603b0f268da795c042b493bb407eab6eb6c4` unchanged. V3 was published at `467a975f20ed068608c899ac87911f1c81b86389`.

Use [root-binding.patch](root-binding.patch) for Astra's unchanged root lease. It has the identical proposed implementation, with the final redundant blank context line removed and both hunk counts adjusted. It apply-checks against candidate591feb1 and the current branch. It remains **unapplied**. No root source, API, contract or QA fixture was edited.

The original v3 patch remains immutable and has one whole-range `git diff --check` EOF-context diagnostic. The v3 metadata check passed for the then-tracked code diff before that artifact was added; it does not establish a green final whole-range documentation check. UI code and the v4 replacement have no whitespace diagnostics. No functional test is failed or skipped by this artifact amendment.

All v3 results remain applicable: 16 focused/201 web tests pass with zero skips; static, configured consumer and independent feature builds pass. Composed root binding, both post-binding consumer builds and QA's real mobile/desktop/keyboard/browser/API journeys remain required. Parent retains orchestration/merge; Astra retains ACCESS/root and this UI lease is returned at the final published head. No runtime activation or deployment occurred.
