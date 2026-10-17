# WP01 explicit invitation grants UI amendment

Status: supported full explicit-array UI implemented; already-archived initial branch discovery and composed browser/admission acceptance remain qualified below. This additive receipt supersedes the former deliberate single-branch invitation UI limitation. Prior receipts remain immutable.

## Revisions and lease

- Dependency: `2d0df2797d7876070372bc7808d582604ca3bbf0`, PR21, source `b9ae8d8dcd61ad62ee9285ad86ee0c829c224679`.
- UI code head: `8db53a111b0e43c312d37f0919f371b02d8825b4` on isolated `feat/b2b-invitation-grants-ui-v3`.
- Authority: amendment008-explicit-invitation-grants.md, original plan `447d77ebb5587e319018e7b56003f0ef7299bb6c`, Atlas `ce45d206a2ed4035f8003a3303abd1fff98e09b8`. Existing repository/Atlas instructions and navigation skill remain applicable and were read earlier; the unchanged Atlas revision was verified again.
- Read the new invitation JSONB/admission contract, actual SQL/service validation, strict request/response/client/bootstrap schemas and already composed root before editing.
- Only People/invitation UI and dedicated tests changed. Exact eleven code/test files and hashes are in code-files.txt / code-files.sha256. No shared contracts, API/ACCESS, root, migrations, lockfile, QA specs or Atlas edits.
- The integration branch later moved to `6a479f00f6941e0ec7fb89cc399a7569e3b08e04`. Its intervening diff is QA/spec/fixture/evidence only; People, API/bootstrap, contracts and product client seams are unchanged. This branch retains the explicitly supplied dependency and its owned diff; parent owns combined checks.

## New behavior

The invitation editor loads current server-provided branch choices using the existing authenticated bootstrap client. It validates exact account, opaque realm, organization membership/access revision and selected role before displaying the catalog. Another organization is excluded. Failed or revoked discovery is not a successful empty list; current authority loss clears roster, branch metadata and private invitation projections. Late/superseded replies remain fenced by scope, epoch and abort signals.

Every available branch has independently labelled trainer and member selectors: do not include / include active / include inactive. The initial array is empty. Organization role selection does not infer, activate, sort or add grants; mixed roles and several branches are allowed. Full-array validation preserves order and explicit inactive flags, rejects duplicates/foreign/missing branches, and never drops a disappeared choice. Unavailable selected rows remain visible for explicit removal after revalidation. Archived options, when supplied by an authorized metadata source, permit only inactive grants.

An explicit confirmation permits exactly `[]`, with a clear warning that no trainer/member branch functions are being granted and that administrative brand authority is separate. There is no current/Principal fallback and no administrative trainer-health bypass. Name/email validation and new expired/used/account/membership/realm/branch admission errors are meaningful. Actual acceptance remains with the existing root callback; this feature creates an invitation snapshot/link, not a user account.

Uncertain creation freezes the exact request, IDs, expected revision and array until explicit retry. Competing edits are blocked; changed-operation conflict is surfaced without blind replay. Accepted grant snapshots are displayed beside the private link, including explicit no-grants results, after the form resets. Role safeguards, last-superadmin protections, other-branch membership preservation and scoped audit remain intact.

## Validation

Node24.19.0, pnpm12.7.0, frozen installation, no dependency change. All executed tests use synthetic fixtures and mocked scoped UI transports; no real invitation send, account creation, provider or production operation occurred.

| Check | Actual result |
| --- | --- |
| Focused invitation/People model, controller and SSR component tests | **24 passed, 0 failed, 0 skipped** |
| Full B2B web test suite | **228 passed, 0 failed, 0 skipped** |
| Frozen install | Passed, unchanged lockfile |
| Root lint / format / boundary checks | Passed, 14 package tasks |
| Root typecheck | Passed, 14 package tasks |
| Standalone B2B build | Passed, existing large-chunk warning |
| Synthetic-profile unified instance build | Passed, existing large-chunk warning |
| Explicit owned TS/TSX/CSS formatting | Passed |
| Scoped diff, identity, commit/PR metadata and source hashes | Passed; metadata receipt retained |
| New PostgreSQL/API or real-browser/admission execution | **Not run by this UI-only amendment** |

Focused coverage includes exact mixed multi-branch/inactive/privileged arrays, all-role empty arrays, duplicate/foreign/missing/archived checks, no implicit selection, selected-role/realm/revision validation, stale and revoked catalogs, byte-identical replay, changed-operation conflict, admission feedback, labelled controls and unavailable-choice rendering. Existing People/audit regression tests remain in the full suite.

During implementation old helper callers needed explicit grant arrays, and the new revoked-bootstrap test exposed that the old roster survived catalog revocation. The final fix clears it; all final results above pass with no skips. Text logs normalize only trailing whitespace/terminal blank lines before freezing, with original/retained hashes in log-provenance.json; results/counts are unchanged.

## Remaining integration requirements

Root already composes PeopleWorkspace, so **no root binding patch is required** for the delivered multi-branch/active/inactive/no-grants controls. Both consumer builds include the new UI directly. Parent composes this isolated source and QA executes qa-scenarios.md against the actual current candidate. SSR/native markup and controller tests do not establish viewport, focus, credential/consent, same-tab admission or database persistence acceptance.

Current bootstrap lists only active branches. Arbitrary active/inactive functions on every provided active branch are implemented, and the view/model can represent inactive grants on archived metadata. **A branch already archived before discovery cannot currently be enumerated.** No ID/status is inferred from another source. owner-requests.md supplies the exact additive authorized metadata endpoint request for CONTRACT/ACCESS if complete archived discovery is required. This is an explicit remaining coverage dependency, not silent rejection of otherwise supported arrays or a claim that the new API lacks multi-grant storage.

The UI lease is returned at the published final head; Astra retains ACCESS/root and the parent retains dispatch/acceptance/merge. Freeze this evidence after publication. No main merge, runtime activation/deployment, real health/user data, paid call, credential/security change, force push or new Cloud dispatch occurred.
