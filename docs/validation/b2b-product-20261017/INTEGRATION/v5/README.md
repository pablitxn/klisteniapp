# Integration v5: exact invitation and returned UI checkpoint

Parent source: `349299f` on `integrate/b2b-product-v1`, draft PR21. This checkpoint
adds amendment008 and migration011. The full API suite and composed HTTP harness
are running; a subsequent evidence receipt will pin their actual completed result.
No browser, HTTPS, physical, production activation or deployment is claimed.

## Composed owner inputs

- WP08 PR25 `bbc7a9d0038cfb27b20b404a32b0b34cb28118a0`: atomic occurrence/enrollment
  pairs, exact issued-period details and retained legacy/inactive history.
  The branch retained its older ancestry; five merge conflicts were resolved
  with its supplied exact incremental candidate-owned.patch against591feb.
  All18 owner source hashes matched before commit. Its root roster binding is
  applied and all existing start/edit/original-routine callbacks remain bound.
- WP01 PR28 `0fd84e61354261dfcb050aabae1951702a3935e3`: role/grant editors,
  supported invitation form, retries/denial recovery and scoped audit drawer.
  PeopleWorkspace is bound in root. Owner source/evidence remains unchanged.
- Legacy shared API source `efbed2dd1c7ed06092463a3eec4531c2a3e10075`: amendment007.
  Parent has dispatched adoption UI to WP07 and correction binding to WP09.

## Invitation changes and completed checks

Migration011 adds nullable explicit invitation grants without rewriting old rows.
Creation/acceptance retain exact arrays, including no grants and inactive grants.
Fresh token/password acceptance positively binds the session and consumes the
invitation in one transaction. Bound joins recheck realm under organization lock.
The real invitation entry uses explicit token consent in both runtime modes and
invalidates this tab's previous authority after credentials change.

- New synthetic invitation/API tests: **4 passed, 0 failed, 0 skipped**; real
  unified HTTP admission/cleanup and queued revoked join are included.
- Existing migration/audit/bootstrap/white-label HTTP regressions: **23 passed,
  0 failed, 0 skipped**.
- Combined web **220 passed** and React **18 passed**, zero failures/skips.
- Root typecheck **14**, lint **14** plus boundaries/format, build **16** passed;
  both web consumers rebuilt. Existing large-chunk warnings remain.
- Initial new-test failure was a fixture-only PostgreSQL prepared statement with
  two commands. Split setup statements; the unchanged failed log is retained.
- Read-only architecture review found no remaining grant/realm blocker.

No old migration text, migration006, original history or lockfile change.
Only isolated synthetic local PostgreSQL was migrated.

## Pending parent-owned work

The current People invitation UI intentionally still offers its earlier subset.
Amendment008 includes the exact UI follow-up prompt for full grant arrays; do not
claim hidden controls complete. Parent owns that dispatch. WP07 adoption and WP09
retained corrections/local recovery remain in flight. Root owns their eventual
entry bindings. QA owns actual browser matrix and final acceptance.
