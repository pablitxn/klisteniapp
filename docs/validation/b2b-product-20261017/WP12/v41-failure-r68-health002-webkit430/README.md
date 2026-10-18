# R68 HEALTH-002 failure: White Label WebKit 430

Application `d2adf75d3fee18740ef38632a361c91203d77dc6`; QA `4ec0273151194acb189ac6ed327033d66366dbd5`.

The actual complete HEALTH-002 instance failed, without retry, at the unchanged login helper's five-second navigation visibility check (`app-fixture.ts:294`) while an admin work context was being admitted. The failure snapshot shows the current-access verification gate. This is an actual failed cell; remaining health-denial assertions after the failing login were not completed and are not credited as passes.

The browser assertion began at 7540765.079 ms and ended with failure at 7546421.869 ms. The retained main-frame snapshot at 7541373.728 ms contains the verification gate and no literal navigation label. A later retained snapshot at 7546455.007 ms contains the navigation DOM and no literal verification-gate text, 33.138 ms after the browser assertion ended. This DOM snapshot is not a later visibility assertion, a passing retest or proof of an application/harness root cause. The enclosing test assertion ended at 7546464.171 ms.

The selected admin access requests have status 200. Raw trace network timing fields are retained in diagnosis.json without inferring response-body completion order. No access, privacy, consent or role check was weakened. All 2,103 source and built-file hashes still match. The full uncapped matrices continue on the same frozen source/build pair; no mid-wave fix, retry, source swap or runtime/security change occurred.

The sanitized error context is base64 encoded to preserve its exact bytes without formatting changes. Original trace and screenshots remain task-private; hashes and exact test-info-name capture proof are included. Original v40/v41 evidence remains immutable. A safe follow-up is to review the positive login-navigation readiness boundary after these matrices terminate, with observed bounded readiness and all denial assertions preserved. No change or passing follow-up is claimed here.

HTTPS remains unexecuted without existing trusted task-owned TLS inputs. GitGuardian's configured size-limit skip is neutral, not clean. Parent retains orchestration, integration and main-merge authority.
