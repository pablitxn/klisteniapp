# Capture preservation during extraction

Exercise and yoga images retain their original bytes, capture timestamps, renderer records and `sourceHash` values. They were not rendered again as part of this extraction. All 24 isolated body-region previews were rendered again with the shared code and pass their normal source and artifact checks.

`extraction-2026-10-10.json` is an explicit extraction receipt. It records the immutable original revision, the original input hashes and entry hashes, the new input hashes, and the mapping from original modules to shared modules. It does not relabel an old capture as a new one.

The verifier reconstructs the old Model and Stage source using only the listed import-path changes, explicit `/models` resolver injection and known-ID guard removal; the normalized bytes must match the original recorded SHA-256 exactly. Rig, mesh preparation, morphology, camera, lighting, catalog, GLB and landmarks compare byte-for-byte. The capture scripts compare after the finite output-directory, source-inventory and verification additions are reversed. The complete filename adapter domain is checked against the original artifact references. Original runtime dependency and transitive lock records must remain identical; new application dependencies do not replace them.

Checks use this receipt and files in the working tree, without Git history. Every current input hash is pinned. An unexpected source change, altered capture metadata or changed output bytes fails verification and calls for a real new capture. The existing size, animation, provenance and artifact hash checks remain active. A future partial regeneration can coexist with retained entries: fresh entries use the current source hash; retained entries must match the receipt exactly.

To reproduce the reviewed receipt once, use `node scripts/record-preview-extraction.mjs 81e7369bdd4583349df5e4fb4f66bac1cba181f1`. This authoring command requires the original Git commit and refuses non-mechanical renderer changes. It is not a command to refresh failed checks after changing rendering behavior.

Run `node --test scripts/preview-provenance.test.mjs`, then the existing exercise, yoga and body preview `--check` commands. The checks explicitly report retained original captures.
