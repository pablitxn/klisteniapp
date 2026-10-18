# Original full browser matrix receipt

Local-only evidence under the active remote publication hold. No acceptance pass is claimed for a matrix with failed cells.

Application `bd30eab5b2a33c3f3e8a7692649632ec85103431`; QA `1374b94ed441365789d2756742afa8306022c0a0`; accepted integration evidence `89409dcdbd4faedccfeec8ee236932191c6195d3`.

Each mode independently executes 88 scenario IDs across Chromium and WebKit at widths 320, 430, and 1440. One worker, zero retries, no max-failure cap. Pending cells never count as passes.

| Run | Mode | Cells | Observed leaf results | Exit | Owned schemas remaining |
| --- | --- | ---: | --- | ---: | ---: |
| candidatebd30-full-r35 | white-label-http | 528 | {'passed': 513, 'timedOut': 2, 'failed': 13} | 1 | 0 |

Raw report/log hashes, individual leaf statuses, start times in the raw report, and per-run schema inventories are preserved. Sanitized copies redact authentication material; full private traces remain task-local and are represented by hashes. Other concurrent runs may retain their own schemas, so a global nonzero schema count is recorded without claiming a leak in this run.

Independent corrected-QA or later application-fix regressions stay separate and do not replace original failed cells. The planning overflow source fix remains assigned to WP07.

Historical baseline browser counts and Yoga preview provenance are outside this run and are not claimed as freshly executed.
