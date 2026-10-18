# Integration v4: legacy shared binding checkpoint

Base: `591feb1fd6a29306b5dc08a70ae5335a0ce01422` on `integrate/b2b-product-v1`.
This source checkpoint freezes amendment007 for the producer UI owners. The
parent retains dispatch. No UI implementation or browser acceptance is claimed.

- Focused PostgreSQL/API regressions: **21 passed, 0 failed, 0 skipped**.
- Contracts: **22 passed**. Client: **29 passed**, including the new binding.
- API/contracts/client typecheck and lint passed.
- Follow-up branch-bearing legacy fixture: **4 passed, 0 failed, 0 skipped**;
  API typecheck/lint rerun passed after explicit v2 field construction. Old
  `branchId`/`branchName` remain in raw legacy history, not the strict v2 DTO.
- Tests use isolated synthetic schemas in loopback disposable PostgreSQL only.
- The initial run's one failure was an invalid new test fixture (legacy partial
  execution with zero sets). The corrected fixture retains one original actual;
  the initial failure log remains attached unchanged.
- Original program and execution JSON plus earlier session revision bytes are
  compared across adoption/correction. Exact replay and revoked access are covered.
- Existing reviewed producer tests still verify **37 exercises / 42 directed
  relations** and each target's own dose.

No dependency, schema, migration006, original history or lockfile change. Full
combined API/browser QA remains required after pending UI owner amendments.
Invitation grant storage/admission is the next independent root amendment.
