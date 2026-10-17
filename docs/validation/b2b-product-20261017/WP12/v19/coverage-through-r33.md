# WP12 HTTP cell ledger at bd30eab5

Planning inventory of latest observed cell outcomes on this application source across separately pinned QA revisions; not a new run or final acceptance total. Every earlier failure remains in attempts. Earlier application heads are excluded. In-flight/unpublished runs are excluded. neverRun means no actual result in included completed receipts. Trusted HTTPS input block is separate.

Sources: R32 (`1374b94e`), R33 (`1374b94e`).

| Mode             | Engine   | Width | Passed | Failed | Timed out | Never run |
| ---------------- | -------- | ----: | -----: | -----: | --------: | --------: |
| unified-http     | chromium |   320 |      5 |      0 |         0 |        83 |
| unified-http     | chromium |   430 |      5 |      0 |         0 |        83 |
| unified-http     | chromium |  1440 |      5 |      0 |         0 |        83 |
| unified-http     | webkit   |   320 |      5 |      0 |         0 |        83 |
| unified-http     | webkit   |   430 |      5 |      0 |         0 |        83 |
| unified-http     | webkit   |  1440 |      5 |      0 |         0 |        83 |
| white-label-http | chromium |   320 |      5 |      0 |         0 |        83 |
| white-label-http | chromium |   430 |      5 |      0 |         0 |        83 |
| white-label-http | chromium |  1440 |      5 |      0 |         0 |        83 |
| white-label-http | webkit   |   320 |      5 |      0 |         0 |        83 |
| white-label-http | webkit   |   430 |      5 |      0 |         0 |        83 |
| white-label-http | webkit   |  1440 |      5 |      0 |         0 |        83 |

Each scenario cell is `unified / White Label`: P=passed, F=failed, T=timed out, N=never run. Historical failed attempts stay in the JSON ledger even when a later QA correction passes.

| Scenario              | Chromium320 | Chromium430 | Chromium1440 | WebKit320 | WebKit430 | WebKit1440 |
| --------------------- | ----------- | ----------- | ------------ | --------- | --------- | ---------- |
| B2BP-ALTERNATIVES-001 | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-ALTERNATIVES-002 | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-ALTERNATIVES-003 | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-ALTERNATIVES-004 | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-ALTERNATIVES-005 | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-ALTERNATIVES-006 | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-ALTERNATIVES-007 | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-ALTERNATIVES-008 | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-ALTERNATIVES-009 | P / P       | P / P       | P / P        | P / P     | P / P     | P / P      |
| B2BP-ALTERNATIVES-010 | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-ALTERNATIVES-011 | P / P       | P / P       | P / P        | P / P     | P / P     | P / P      |
| B2BP-HEALTH-001       | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HEALTH-002       | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HEALTH-003       | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HEALTH-004       | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HEALTH-005       | P / P       | P / P       | P / P        | P / P     | P / P     | P / P      |
| B2BP-HEALTH-006       | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HEALTH-007       | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HEALTH-008       | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HEALTH-009       | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HEALTH-010       | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HEALTH-011       | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HISTORY-001      | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HISTORY-002      | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HISTORY-003      | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HISTORY-004      | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HISTORY-005      | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HISTORY-006      | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HISTORY-007      | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HISTORY-008      | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-HISTORY-009      | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-INACTIVE-001     | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-INACTIVE-002     | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-INACTIVE-003     | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-INACTIVE-004     | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-INACTIVE-005     | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-INACTIVE-006     | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-INACTIVE-007     | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-INACTIVE-008     | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-INACTIVE-009     | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-INACTIVE-010     | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-INACTIVE-011     | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-INACTIVE-012     | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-PROGRAMMING-001  | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-PROGRAMMING-002  | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-PROGRAMMING-003  | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-PROGRAMMING-004  | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-PROGRAMMING-005  | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-PROGRAMMING-006  | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-PROGRAMMING-007  | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-PROGRAMMING-008  | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-PROGRAMMING-009  | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-PROGRAMMING-010  | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-PROGRAMMING-011  | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-PROGRAMMING-012  | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-ROLES-001        | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-ROLES-002        | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-ROLES-003        | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-ROLES-004        | P / P       | P / P       | P / P        | P / P     | P / P     | P / P      |
| B2BP-ROLES-005        | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-ROLES-006        | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-ROLES-007        | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-ROLES-008        | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-ROLES-009        | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-SYNC-001         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-SYNC-002         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-SYNC-003         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-SYNC-004         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-SYNC-005         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-SYNC-006         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-SYNC-007         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-SYNC-008         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-SYNC-009         | P / P       | P / P       | P / P        | P / P     | P / P     | P / P      |
| B2BP-SYNC-010         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-SYNC-011         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-SYNC-012         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-WEEK-001         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-WEEK-002         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-WEEK-003         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-WEEK-004         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-WEEK-005         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-WEEK-006         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-WEEK-007         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-WEEK-008         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-WEEK-009         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-WEEK-010         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-WEEK-011         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
| B2BP-WEEK-012         | N / N       | N / N       | N / N        | N / N     | N / N     | N / N      |
