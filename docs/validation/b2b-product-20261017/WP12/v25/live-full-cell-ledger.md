# WP12 in-flight full HTTP cell ledger

Provisional in-flight CLI observations cross-checked against exact discovery. No final failure/timeout subtype is inferred from a CLI cross. PendingOrRunning means no completed CLI result yet; it is not a pass or a claim that every such cell has never started. Final raw reports supersede this snapshot. Corrected diagnostic waves are not added.

Observed: 2026-10-17T20:00:53.031763+00:00. App `bd30eab5b2a33c3f3e8a7692649632ec85103431`, QA `1374b94ed441365789d2756742afa8306022c0a0`.

| Run | Mode             | Project                  | Passed | Nonpassing | Pending/running |
| --: | ---------------- | ------------------------ | -----: | ---------: | --------------: |
|  34 | unified-http     | product-chromium-320     |     86 |          2 |               0 |
|  34 | unified-http     | product-chromium-430     |     75 |          0 |              13 |
|  34 | unified-http     | product-chromium-desktop |      0 |          0 |              88 |
|  34 | unified-http     | product-webkit-320       |      0 |          0 |              88 |
|  34 | unified-http     | product-webkit-430       |      0 |          0 |              88 |
|  34 | unified-http     | product-webkit-desktop   |      0 |          0 |              88 |
|  35 | white-label-http | product-chromium-320     |     87 |          1 |               0 |
|  35 | white-label-http | product-chromium-430     |     64 |          3 |              21 |
|  35 | white-label-http | product-chromium-desktop |      0 |          0 |              88 |
|  35 | white-label-http | product-webkit-320       |      0 |          0 |              88 |
|  35 | white-label-http | product-webkit-430       |      0 |          0 |              88 |
|  35 | white-label-http | product-webkit-desktop   |      0 |          0 |              88 |

Each cell shows unified / White Label: P=observed pass, F=observed nonpass, U=pending or running. Full failed outcomes remain explicit in the eventual raw receipts.

| Scenario              | Chromium320 | Chromium430 | Chromium1440 | WebKit320 | WebKit430 | WebKit1440 |
| --------------------- | ----------- | ----------- | ------------ | --------- | --------- | ---------- |
| B2BP-ALTERNATIVES-001 | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ALTERNATIVES-002 | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ALTERNATIVES-003 | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ALTERNATIVES-004 | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ALTERNATIVES-005 | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ALTERNATIVES-006 | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ALTERNATIVES-007 | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ALTERNATIVES-008 | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ALTERNATIVES-009 | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ALTERNATIVES-010 | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ALTERNATIVES-011 | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HEALTH-001       | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HEALTH-002       | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HEALTH-003       | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HEALTH-004       | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HEALTH-005       | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HEALTH-006       | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HEALTH-007       | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HEALTH-008       | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HEALTH-009       | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HEALTH-010       | P / P       | P / F       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HEALTH-011       | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HISTORY-001      | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HISTORY-002      | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HISTORY-003      | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HISTORY-004      | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HISTORY-005      | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HISTORY-006      | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HISTORY-007      | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HISTORY-008      | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-HISTORY-009      | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-INACTIVE-001     | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-INACTIVE-002     | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-INACTIVE-003     | P / F       | P / F       | U / U        | U / U     | U / U     | U / U      |
| B2BP-INACTIVE-004     | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-INACTIVE-005     | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-INACTIVE-006     | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-INACTIVE-007     | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-INACTIVE-008     | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-INACTIVE-009     | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-INACTIVE-010     | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-INACTIVE-011     | F / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-INACTIVE-012     | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-PROGRAMMING-001  | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-PROGRAMMING-002  | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-PROGRAMMING-003  | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-PROGRAMMING-004  | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-PROGRAMMING-005  | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-PROGRAMMING-006  | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-PROGRAMMING-007  | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-PROGRAMMING-008  | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-PROGRAMMING-009  | P / P       | P / F       | U / U        | U / U     | U / U     | U / U      |
| B2BP-PROGRAMMING-010  | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-PROGRAMMING-011  | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-PROGRAMMING-012  | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ROLES-001        | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ROLES-002        | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ROLES-003        | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ROLES-004        | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ROLES-005        | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ROLES-006        | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ROLES-007        | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ROLES-008        | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-ROLES-009        | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-SYNC-001         | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-SYNC-002         | F / P       | P / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-SYNC-003         | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-SYNC-004         | P / P       | P / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-SYNC-005         | P / P       | P / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-SYNC-006         | P / P       | P / P       | U / U        | U / U     | U / U     | U / U      |
| B2BP-SYNC-007         | P / P       | P / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-SYNC-008         | P / P       | P / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-SYNC-009         | P / P       | P / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-SYNC-010         | P / P       | P / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-SYNC-011         | P / P       | P / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-SYNC-012         | P / P       | U / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-WEEK-001         | P / P       | U / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-WEEK-002         | P / P       | U / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-WEEK-003         | P / P       | U / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-WEEK-004         | P / P       | U / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-WEEK-005         | P / P       | U / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-WEEK-006         | P / P       | U / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-WEEK-007         | P / P       | U / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-WEEK-008         | P / P       | U / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-WEEK-009         | P / P       | U / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-WEEK-010         | P / P       | U / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-WEEK-011         | P / P       | U / U       | U / U        | U / U     | U / U     | U / U      |
| B2BP-WEEK-012         | P / P       | U / U       | U / U        | U / U     | U / U     | U / U      |
