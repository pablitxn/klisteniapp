import collections, datetime, hashlib, json, re, sys
from pathlib import Path

root = Path('/workspace/wp12-runtime-v7')
e = root / 'evidence'
version = sys.argv[1]
assert re.fullmatch(r'v\d+', version)
out = e / 'local-receipts' / version
assert json.loads((e / 'publication-hold.json').read_text())['active']
assert out.exists() and not (out / 'manifest.json').exists()
runs = json.loads((out / 'runs.json').read_text())
lines = ['# Original full browser matrix receipt', '',
         'Local-only evidence under the active remote publication hold. No acceptance pass is claimed for a matrix with failed cells.', '',
         'Application `bd30eab5b2a33c3f3e8a7692649632ec85103431`; QA `1374b94ed441365789d2756742afa8306022c0a0`; accepted integration evidence `89409dcdbd4faedccfeec8ee236932191c6195d3`.', '',
         'Each mode independently executes 88 scenario IDs across Chromium and WebKit at widths 320, 430, and 1440. One worker, zero retries, no max-failure cap. Pending cells never count as passes.', '']
table = ['| Run | Mode | Cells | Observed leaf results | Exit | Owned schemas remaining |',
         '| --- | --- | ---: | --- | ---: | ---: |']
failures = []
for run in runs:
    assert run['expectedCells'] == len(run['cells']) == 528
    assert len({(r['id'], r['project']) for r in run['cells']}) == 528
    counts = dict(collections.Counter(r['status'] for r in run['cells']))
    assert counts == run['counts'] and sum(counts.values()) == 528
    assert run['ownedSchemasAfter'] == 0
    table.append(f'| {run["run"]} | {run["mode"]} | 528 | {counts} | {run["exitCode"]} | 0 |')
    for cell in run['cells']:
        if cell['status'] != 'passed':
            failures.append({'run': run['run'], 'mode': run['mode'],
                             'applicationSha': run['applicationSha'], 'qaSha': run['qaSha'],
                             **cell, 'originalOutcomePreserved': True})
lines += table + ['',
    'Raw report/log hashes, individual leaf statuses, start times in the raw report, and per-run schema inventories are preserved. Sanitized copies redact authentication material; full private traces remain task-local and are represented by hashes. Other concurrent runs may retain their own schemas, so a global nonzero schema count is recorded without claiming a leak in this run.', '',
    'Independent corrected-QA or later application-fix regressions stay separate and do not replace original failed cells. The planning overflow source fix remains assigned to WP07.', '',
    'Historical baseline browser counts and Yoga preview provenance are outside this run and are not claimed as freshly executed.', '']
(out / 'README.md').write_text('\n'.join(lines))
(out / 'nonpassing-cells.json').write_text(json.dumps(failures, indent=2) + '\n')
for source in ['collect-full-receipt.py', 'classify-full-receipt.py', 'seal-full-receipt.py']:
    (out / source).write_bytes((root / source).read_bytes())
manifest = [{'path': str(p.relative_to(out)), 'bytes': p.stat().st_size,
             'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
            for p in sorted(out.rglob('*')) if p.is_file()]
(out / 'manifest.json').write_text(json.dumps({'sealedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                                             'publicationHold': True, 'files': manifest}, indent=2) + '\n')
assert all(hashlib.sha256((out / f['path']).read_bytes()).hexdigest() == f['sha256'] for f in manifest)
print(json.dumps({'sealedLocalReceipt': str(out), 'runs': [r['run'] for r in runs],
                  'nonpassingCells': len(failures), 'verifiedFiles': len(manifest)}))
