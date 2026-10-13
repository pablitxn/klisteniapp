# Klisteni English engineering audit — 2026-10-13

The seven source PRs and their primary authored QA reports now use English.
English guidance and Conventional Commits rules are persistent in AGENTS. All
seven source branches received new documentation-only commits with verified
remote SHAs. A separate language branch is stacked on the verified integration
baseline. **Repository-wide translation remains incomplete:** 29 older
Markdown candidates still require translation or section-level provenance review.
This report does not claim organization-wide compliance.

## Scope and authority

Repository `pablitxn/klisteniapp`; original checkout `/workspace/klisteniapp`, branch
`work`, clean at `7172041102a8a7029af5fb3e2527a1fa51611a86`. Isolated language checkout
`/workspace/klisteniapp-english`, branch `docs/english-audit-20261013`, starts at
verified remote `qa/klisteni-integration-20261013@6f7354bbc45e35bc9a74061e0176b30218feb48d`.
Main policy was read; AGENTS matched the integration's initial guidance.
Main and the integration branch were not modified. The separately blocked
integration PR against main was neither created nor bypassed.

Read repository AGENTS and actual mounted Atlas guidance, source policy, catalog
and Klisteniapp wiki. Read the local Atlas navigation skill explicitly from
`/workspace/sysadmin-workspace/.agents/skills/atlas-navigate/SKILL.md`; no local
Klisteni `.agents/skills` tree exists. Mounted Atlas stayed read-only at
`27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`. Historical reports' skill-use statements
remain historical source claims, not retroactive claims by this audit.

Canonical directive verified through GitHub at Atlas
`35be24cdef1275a3d850c9ccb999e11c3ffe6609`,
[path](https://github.com/pablitxn/sysadmin-workspace/blob/35be24cdef1275a3d850c9ccb999e11c3ffe6609/atlas/ops/standards/engineering-language-and-commits.md),
[draft PR #5](https://github.com/pablitxn/sysadmin-workspace/pull/5). Upstream merge/
adoption is pending; mounted main does not contain it. AGENTS references this
verified revision and provides a concise fallback instead of copying full policy.

Requested platform settings were GPT-6.1 Sol, medium effort, Standard. No controls
are exposed here to verify or change the active model/effort/service tier; those
settings are not claimed verified. No subordinate tasks were spawned per PR.

## Changes

- Translated all seven primary QA reports and their revised inventory/matrix prose,
  preserving original tested revisions, counts, failed attempts, reruns, skips,
  local/HTTPS/physical limits and manual reproduction commands. Code inside
  command examples is retained; authored comments are English.
- Translated integration README, working checkpoints, seven draft intake notes and
  authored GitGuardian explanation. No new triage or external alert disposition.
- Translated three reviewed technical guides: body models, personal dashboard and
  health-integration status. Existing dated provider claims remain dated claims;
  this audit did not refresh external provider availability.
- English AGENTS and documentation-index directive, pinned canonical policy,
  Conventional Commit subjects/bodies and human-review limits.
- Bounded standard-library structural checker without new hooks, CI workflows or
  branch-protection changes. Existing project validation conventions retained.
- Retained previous document heading fragments through explicit anchor aliases.
  Human review should verify rendered navigation; names and paths were not renamed.
- English PR titles/bodies reread immediately before updating, then verified.
  [Original metadata snapshot](english-pr-metadata-2026-10-13.json) deliberately
  preserves original Spanish descriptions as historical source quotations.
  Later PR appendices clearly distinguish language SHAs from original QA results.

No runtime code, test logic, API/schema contracts, configuration, localized UI,
fixture values, assets, preview manifests/receipts or raw QA outputs were changed.
No published Git history rewrite, force push, merge, deployment, credential/security
change, browser bypass or certificate trust change. Shared translations are byte-
identical across applicable source branches and the language branch; source-only
English audit notes describe each branch's own evidence.

## Branch and PR matrix

| PR | Exact source branch | Original QA head | English update | Audit state |
| --- | --- | --- | --- | --- |
| [2](https://github.com/pablitxn/klisteniapp/pull/2) | `codex/qa-b2c-selfservice-20261013` | `640ec502` | `9463dedb` | Corrected; legacy guides pending |
| [3](https://github.com/pablitxn/klisteniapp/pull/3) | `qa/b2c-admin-20261013-sol` | `478bcfb2` | `98e93357` | Corrected; legacy guides pending |
| [4](https://github.com/pablitxn/klisteniapp/pull/4) | `qa/b2b-trainer-20261013-cloud` | `ed53bbc4` | `724ebde7` | Corrected; legacy guides pending |
| [5](https://github.com/pablitxn/klisteniapp/pull/5) | `qa/b2b-member-20261013-session-b752` | `bafb7bf6` | `fb7cec40` | Corrected; legacy guides pending |
| [6](https://github.com/pablitxn/klisteniapp/pull/6) | `qa/b2b-anonymous-20261013-publicable` | `32a80111` | `b6458172` | Corrected; legacy guides pending |
| [7](https://github.com/pablitxn/klisteniapp/pull/7) | `qa/b2c-visitor-local-20261013` | `d35365c6` | `89cad957` | Corrected; legacy guides pending |
| [8](https://github.com/pablitxn/klisteniapp/pull/8) | `qa/b2b-brand-admin-20261013` | `a959fceb` | `6a5257ea` | Corrected; legacy guides pending |

[Machine-readable matrix](english-branch-matrix-2026-10-13.json) contains full SHAs,
remote verification, exceptions, local checks, remaining gaps and CI query limits.
Original QA heads are not claimed to be the exact product-code test commits: each
role report identifies the actual tested code/harness revisions and rerun cuts.
New SHAs preserve the runtime tree. Functional suites were not rerun for these
source documentation-only updates; original functional results remain historical.
The language branch does not merge the new source heads into the integration branch.
A later integrator can take the documentation commits without losing original QA ancestry.

## Executable verification

- `node --test scripts/preview-provenance.test.mjs scripts/preview-workspace-relocation.test.mjs scripts/b2b-boundaries.test.mjs scripts/dev-environment.test.mjs scripts/b2b-gateway.test.mjs`: **26 PASS**, zero fail/skip, on language worktree.
- `node --check scripts/check-technical-content.mjs`: PASS.
- `node scripts/check-technical-content.mjs --base BASE --commits BASE..HEAD`:
  PASS on all seven source updates. Checks documentation-only path scope and
  retention of historical 40-character SHAs, plus new Conventional Commit syntax.
- `git diff --check`: PASS for each source update and language changes.
- Source remote SHA checked immediately before push and after ordinary fast-forward
  push. No source head changed unexpectedly. Original and new runtime trees verified
  by changed-path checks; raw evidence/data/assets absent from diffs.
- [Inventory](english-audit-inventory-2026-10-13.json): 719 tracked UTF-8
  files inspected mechanically; binary files excluded from language detection and
  preserved. Language hints/provisional classes are review aids, not English certification.

An initial pnpm command used an unsupported option and did not run tests; the
existing root Node test command above executed successfully. The available pinned
pnpm binary is `/workspace/.onboarding/tools/node_modules/.bin/pnpm` (12.7.0).
GitHub CLI auth reported an invalid GH_TOKEN, but git push and connected GitHub
read/update actions succeeded; no credential was changed.

Full browser/type/build suites were not repeated for documentation-only changes.
A new successful test claim is limited to the checks above. The checker does not
prove fluent English, faithful numerical meaning, correct exception classification,
complete code-comment discovery or valid rendered anchors. Those require human review.

## Pre-existing failure and CI

`node scripts/generate-yoga-previews.mjs --check` reproduces
`Extraction receipt is stale` on both the language worktree and a separate exact
`6f7354bbc45e35bc9a74061e0176b30218feb48d` baseline worktree. Preview inputs and receipts
are unchanged; no regeneration, hash edit or weaker gate. Complete `check`,
`check:all` and `check:release` are not claimed passing. Physical-phone/camera/QR/
audio, valid-trust HTTPS/Secure cookies, providers and production remain unverified
as recorded in original QA reports.

Fresh CI queries for all seven updated source SHAs returned no PR-triggered GitHub
Actions runs and no commit statuses. This is **no observed CI result**, not PASS.
The Actions wrapper returns only PR-triggered runs/first page; GitLab pipelines
and separate check-run APIs were not queried. Language-PR CI is recorded in the
external final publication receipt after creation, avoiding self-referential SHAs.

## Exceptions and ambiguous review items

| Material | Treatment / review needed |
| --- | --- |
| `apps/b2c-web/src/i18n/**`, B2B UI strings/localized selectors | Preserve intended locale and matching tests; surrounding technical explanation English |
| `packages/catalog-base/src/**`, B2C educational data | Preserve user-facing Spanish exercise/yoga guidance; mixed editorial `review`/`adaptationNote` content needs owner review to distinguish product copy from technical prose |
| QA `.json`, `.txt`, archives, hashes, captures and fixture data | Preserve immutable output/data byte-for-byte; directory location does not exempt authored Markdown summaries |
| Sanskrit asanas, external attribution names, licenses/source titles/quotations | Preserve exact original spelling/content; e.g. Lluís Vinent Juanico |
| Paths, IDs, enums, serialized fields, URL fragments such as the B2B API README's Spanish heading link | Preserve contracts; no identifier/file renaming. Heading aliases preserve old fragments |
| Historical certificate exceptions and reproduction commands | Retain documented evidence; clearly distinguish from current no-bypass/no-trust-change rule. No new browser test used those exceptions |
| Preview/model NOTICE documents | Mixed attribution/legal provenance and authored explanation; do not translate wholesale. Section-level review pending; preview-hashed inputs unchanged |
| PR metadata snapshot | Original descriptions explicitly preserved as historical quotations; active PR text English |
| Existing stale product-plan wording in older guides | Separate factual reconciliation required. This language audit does not silently turn proposed features into newly verified releases |

## Remaining authored-content gap

These candidates remain pending; several contain mixed provenance and need review
before translation. They are not automatically exempt or considered compliant:

- `docs/anatomy-model-sources.md`
- `docs/architecture.md`
- `docs/b2b-browser-validation.md`
- `docs/b2b-release.md`
- `docs/b2b-runtime-validation.md`
- `docs/b2b-white-label-decisions.md`
- `docs/b2b-white-label-deployment.md`
- `docs/b2b-white-label-runtime.md`
- `docs/b2b-white-label-validation.md`
- `docs/b2b-white-label.md`
- `docs/b2b.md`
- `docs/development-macos.md`
- `docs/development-vps.md`
- `docs/development.md`
- `docs/exercise-planning.md`
- `docs/exercise-previews.md`
- `docs/exercise-sources.md`
- `docs/health-import.md`
- `docs/health-sync.md`
- `docs/public-demo.md`
- `docs/roadmap-implementacion.md`
- `docs/subscriptions.md`
- `docs/yoga-sources.md`
- `docs/yoga.md`
- `packages/model-assets/public/models/NOTICE.md`
- `packages/model-assets/public/previews/NOTICE.md`
- `packages/model-assets/public/previews/body/NOTICE.md`
- `packages/model-assets/public/previews/female/body/NOTICE.md`
- `packages/model-assets/public/previews/yoga/NOTICE.md`

Further prose review also remains for UTF-8 files with no detected Spanish hint,
inline code comments/docstrings and mixed structured records. No heuristic proves
exhaustive compliance. Broad content gaps, canonical-policy merge/adoption and
human translation/anchor acceptance remain separate from the preserved Yoga/TLS/
physical-test limits. Publication of the language draft does not close those gaps.
