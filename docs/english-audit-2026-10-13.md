# Klisteni English engineering audit — 2026-10-13

Repository-authored technical prose has been corrected to English across the
reviewed repository and all seven source QA branches. The seven QA reports and
active PR titles/bodies are English. The continuation resolved all 29 previously
listed older candidates: 24 technical guides, two notices translated in place and
three byte-pinned capture notices with complete English companions. Persistent
AGENTS guidance covers English and Conventional Commits. Classified data, original
quotations and immutable evidence remain intentionally unchanged. Human acceptance
and one serialized editorial-data classification remain explicit review items;
this report does not claim organization-wide compliance.

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
- Translated the three initially reviewed guides and all 24 older technical guides
  listed in the continuation inventory. Architecture, B2B deployment/validation,
  development, exercises, subscriptions, health import/sync and Yoga are covered.
  Existing dated provider and release claims remain dated evidence; this audit
  did not refresh provider availability or certify another release.
- Translated model/general preview notices in place. Three capture-pinned originals
  remain byte-identical, with [complete English companions](asset-notices/README.md).
  Original license text, attribution names, source quotations and receipt hashes
  are retained; no regeneration was performed.
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
fixture values, model geometry/images, preview manifests/receipts or raw QA outputs
were changed. Two NOTICE files contain translated authored prose; three pinned
NOTICE originals remain unchanged.
No published Git history rewrite, force push, merge, deployment, credential/security
change, browser bypass or certificate trust change. Shared translations are byte-
identical across applicable source branches and the language branch; source-only
English audit notes describe each branch's own evidence.

## Branch and PR matrix

| PR | Exact source branch | Original QA head | English update | Audit state |
| --- | --- | --- | --- | --- |
| [2](https://github.com/pablitxn/klisteniapp/pull/2) | `codex/qa-b2c-selfservice-20261013` | `640ec502` | `30b7f0a8` | Corrected; classified exceptions |
| [3](https://github.com/pablitxn/klisteniapp/pull/3) | `qa/b2c-admin-20261013-sol` | `478bcfb2` | `89b2812f` | Corrected; classified exceptions |
| [4](https://github.com/pablitxn/klisteniapp/pull/4) | `qa/b2b-trainer-20261013-cloud` | `ed53bbc4` | `18d0e14c` | Corrected; classified exceptions |
| [5](https://github.com/pablitxn/klisteniapp/pull/5) | `qa/b2b-member-20261013-session-b752` | `bafb7bf6` | `6d61ac4f` | Corrected; classified exceptions |
| [6](https://github.com/pablitxn/klisteniapp/pull/6) | `qa/b2b-anonymous-20261013-publicable` | `32a80111` | `269d793e` | Corrected; classified exceptions |
| [7](https://github.com/pablitxn/klisteniapp/pull/7) | `qa/b2c-visitor-local-20261013` | `d35365c6` | `cead0fe8` | Corrected; classified exceptions |
| [8](https://github.com/pablitxn/klisteniapp/pull/8) | `qa/b2b-brand-admin-20261013` | `a959fceb` | `6b16a17c` | Corrected; classified exceptions |

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
  by changed-path checks; raw evidence/data/model geometry/image files absent from diffs; notice prose changes
  are explicitly classified.
- TypeScript scanner/AST audit of 465 source files: 574 comment tokens and 869
  literal test/describe/it descriptions; no Spanish hints. Shell/Python comments
  were also inspected. Dynamic/generated text and heuristic false negatives remain
  human-review limits; existing localization, selectors and fixtures are preserved.
- Continuation comparison retained prior source-link targets, uppercase API/env
  identifiers, historical 40-character SHAs and fenced executable commands. Only
  authored command comments were translated. All repository relative Markdown
  links/fragments pass a local target/heading/explicit-anchor check (zero invalid).
- [Inventory](english-audit-inventory-2026-10-13.json) records final UTF-8 file
  classifications and all 29 dispositions. Binary assets are excluded from language
  detection and preserved. Hints/classes assist review; they do not certify English.

The continuation first rerun lacked `typescript` in the isolated worktree and
reported 18 PASS/one module-loading failure. Temporary links to the original
checkout's existing dependencies resolved that setup failure; the complete rerun
passed all 26 tests with zero skips. Links were removed before publication.
Exercise preview verification passes 74/74 and body previews 24/24. The original
three NOTICE SHA-256 values match both baseline and final bytes. Logs are retained
in `/workspace/shared/klisteni-english-validation/`; these are local evidence,
not remote CI or a fresh physical-device matrix.

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

| Material | Disposition |
| --- | --- |
| `apps/b2c-web/src/i18n/**`, B2B UI strings and matching selectors | Intended localization preserved; technical explanation is English |
| Spanish exercise/yoga educational content and `planning.relations[].rationale` | Product catalog data; rationale is rendered by `ExercisePlanningDetails.tsx`; retained unchanged |
| `packages/catalog-base/src/exercise-planning.ts`: `planning.review.adaptationNote` | Serialized editorial evidence values are mixed product data/technical rationale. Narrow owner question submitted; preserved pending classification to avoid silent data changes. No clear guide/comment/test-description translation is blocked by this item |
| QA `.json`, `.txt`, archives, hashes, captures and fixture values | Immutable output/data retained byte-for-byte; authored Markdown summaries translated |
| Sanskrit asanas, external attribution names, license/source titles and original quotations | Exact originals retained, including Lluís Vinent Juanico, quoted user acceptance and original attribution text |
| Paths, IDs, enum/serialized fields, source URLs and old heading fragments | Contracts and names retained; explicit heading aliases preserve navigation |
| Historical certificate exceptions and reproduction commands | Existing evidence retained and marked historical; current rule prohibits new bypasses/trust changes. No new browser run used those exceptions |
| Three capture-pinned NOTICE originals | Specific historical-byte exception; English companions cover all technical prose and identify original path/SHA-256. No receipt/hash adjustment or blanket NOTICE exemption |
| `english-pr-metadata-2026-10-13.json` and published Git history | Original Spanish PR descriptions/commit messages remain historical quotations; active PR metadata and new commits are English |
| Older product plans and dated provider claims | Translated with original proposed/implemented/tested boundaries; later linked evidence remains separate. No newly verified provider/product claims |

## All 29 older candidates resolved

The inventory records each path separately. The 24 guides were translated in place:
architecture and anatomy sources; B2B product/release/browser/runtime guides;
white-label decisions/plan/runtime/validation/deployment; macOS/VPS/unified
development; exercise planning/previews/sources; health import/sync; public demo;
roadmap; subscriptions; Yoga/sources. The general model and preview notices were
also translated in place. The three body/female-body/Yoga capture notices have
complete [English companions](asset-notices/README.md), with their original bytes
preserved by the documented provenance exception.

No clearly in-scope older guide, authored code comment or literal test description
remains on the previous pending list. This is a reviewed-scope conclusion, not a
claim that a detector proves every sentence English. Human translation/anchor
acceptance, the concrete `adaptationNote` classification question and canonical
Atlas-policy merge/adoption remain. Yoga's stale receipt and original physical,
valid-trust HTTPS, provider and production verification limits remain unchanged.
The language draft neither merges nor deploys and does not unblock the separate
integration PR against main.

## Main integration update — 2026-10-14

PR #9 was merged into `qa/klisteni-integration-20261013` at
`f13e01d18e84d2a0be5a21bfe5dc49de1c27cab1`. This integration PR carries that
verified branch onto `main` while preserving the main-side role audit records for
PRs #2–#8. The PR #8 source-specific audit and the unmodified PR #9 audit source
are retained under [`english-audits/2026-10-13/`](english-audits/2026-10-13/).
See the PR #9 branch/matrix and the merge PR for the reconciled current state.
No claims in historical QA reports or CI evidence are upgraded by this merge.
