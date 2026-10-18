from pathlib import Path
import base64, collections, datetime, hashlib, json, shutil

ROOT = Path('/tmp/klisteni-readiness-runtime')
E = ROOT / 'evidence'
OUT = Path('/workspace/klisteni-readiness/docs/validation/b2b-product-20261017/INTEGRATION/v14')
RUN = 'c8a5aaa5fab4206a646a644601481713d42f4a65'
FINAL = '831203470d4c21322b8bc3ce7c4dedb7f84fe5d7'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def read(path):
    return json.loads(path.read_text())

def save(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')

private = read(ROOT / 'private-connection.json')
secrets = [private[key].encode() for key in ['password', 'url']]

def safe(data, name):
    assert all(secret not in data for secret in secrets), f'Task secret in {name}'
    if name.endswith('.json'):
        try:
            value = json.loads(data)
        except json.JSONDecodeError:
            return
        def walk(item):
            if isinstance(item, dict):
                for key, value in item.items():
                    if key == 'body' and isinstance(value, str):
                        try:
                            decoded = base64.b64decode(value, validate=True)
                            assert all(secret not in decoded for secret in secrets), f'Task secret in attachment {name}'
                        except ValueError:
                            pass
                    walk(value)
            elif isinstance(item, list):
                for value in item:
                    walk(value)
        walk(value)

def copy(source, relative=None):
    relative = relative or source.name
    data = source.read_bytes()
    safe(data, str(source))
    destination = OUT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)

terminal = read(E / 'terminal-summary.json')
assert terminal['status'] == 'complete' and len(terminal['runs']) == 8
cleanup = read(ROOT / 'terminal-cleanup.json')
assert cleanup['remainingBrowserSchemas'] == 0
assert cleanup['remainingTaskContainers'] == cleanup['remainingTaskNetworks'] == []
assert cleanup['nonTaskContainerIdsPreserved'] is True
assert cleanup['cleanupCommandTargets'] == ['klisteni-readiness-pg-v1', 'klisteni-readiness-browser-v1', 'klisteni-readiness-network-v1']
contracts = read(ROOT / 'contracts-final-v2-summary.json')
assert contracts['candidateSha'] == FINAL and contracts['passed'] == 8
assert all(contracts[key] == 0 for key in ['failed', 'retries', 'skipped', 'timedOut'])
assert len(contracts['cells']) == len({(cell['project'], cell['title']) for cell in contracts['cells']}) == 8
assert all(cell['status'] == 'passed' and cell['retry'] == 0 for cell in contracts['cells'])
assert contracts['rawReportSha256'] == digest((E / 'contracts-final-v2.raw.json').read_bytes())
static = read(ROOT / 'static-validation.json')
assert static['candidateSha'] == FINAL
assert static['regression']['tests'] == static['regression']['passed'] == 61
assert all(static['regression'][key] == 0 for key in ['failed', 'skipped', 'exitCode'])
assert static['regression']['executionPin'] == '92a7c3ba0805a870cdecc47a81666b76fafbc221'
assert all(static[key]['executionPin'] == FINAL and static[key]['exitCode'] == 0 for key in ['typecheck', 'scopedLint'])
for log in static['logs']:
    assert digest((ROOT / log['path']).read_bytes()) == log['sha256']
discovery = read(ROOT / 'discovery-isolation.json')
assert discovery['candidateSha'] == FINAL
assert {value['configuration']: (value['discovered'], value['standaloneReadinessCells']) for value in discovery['configurations']} == {'demo': (101, 0), 'legacy': (540, 0), 'product': (528, 0), 'contract': (8, 8)}
for value in discovery['configurations']:
    assert value['errors'] == value['exitCode'] == 0
    assert value['rawReportSha256'] == digest(Path(f"/tmp/klisteni-readiness-final-{value['configuration']}-discovery.json").read_bytes())
expected_runs = {(f'affected-r{round}', mode): 18 for round in range(1,4) for mode in ['unified', 'wl-http']}
expected_runs |= {('regression', mode): 12 for mode in ['unified', 'wl-http']}
assert {(run['phase'], run['mode']): run['attempted'] for run in terminal['runs']} == expected_runs
actual = []
observations = []
for run in terminal['runs']:
    assert run['candidateSha'] == RUN
    assert run['counts'] == {'passed': run['attempted']}
    assert run['exitCode'] == run['retries'] == run['ownedRemaining'] == 0 and run['failureCap'] is None
    label = run['phase'] + '-' + run['mode']
    assert digest((E / (label + '.raw.json')).read_bytes()) == run['rawReportSha256']
    assert digest((E / (label + '.raw.log')).read_bytes()) == run['rawLogSha256']
    for point in ['before', 'after']:
        proof = read(E / f'{label}-{point}-source-verification.json')
        assert proof['candidateSha'] == RUN and proof['checked'] == 2132 and not proof['mismatches']
    cleanup = read(E / (label + '-cleanup.json'))
    live = read(E / (label + '-live-schemas.json'))
    assert not cleanup['ownedRemaining'] and not cleanup['manualCleanup']
    assert len(cleanup['owned']) == len({schema['schema'] for schema in live['schemas']}) == 6
    cells = read(E / (label + '-cells.json'))
    assert len(cells) == run['attempted']
    for cell in cells:
        assert cell['status'] == 'passed' and cell['retry'] == 0 and not cell['errors']
        actual.append({'run': label, 'mode': run['mode'], 'phase': run['phase'], **cell})
    observed = read(E / (label + '-readiness.json'))
    assert all(item['observation']['ready'] for item in observed)
    observations.extend({'run': label, 'mode': run['mode'], **item} for item in observed)

assert len(actual) == 132
assert len({(cell['run'], cell['instanceId']) for cell in actual}) == 132
assert len({schema['schema'] for path in E.glob('*-live-schemas.json') for schema in read(path)['schemas']}) == 48
assert not OUT.exists(), 'Use a fresh versioned artifact; never overwrite published evidence'
OUT.mkdir(parents=True)

for name in [
    'candidate-source-proof.json', 'candidate-git-binding.json', 'fresh-build-proof.json', 'application-runtime-identity.json',
    'source-applicability.json', 'assertion-preservation.json', 'discovery-isolation.json',
    'static-validation.json', 'static-validation-intermediate.json', 'runtime-isolation.json',
    'terminal-cleanup.json', 'independent-historical-audit.json', 'independent-source-review.json',
    'independent-final-contract-audit.json', 'independent-product-audit.json', 'independent-regression-audit.json', 'contracts-final-v2-summary.json',
    'contract-final-v2-source-proof.json', 'browser-runtime-reference.json',
    'b2b-web-build.json', 'b2b-web-build.log', 'b2b-web-dist-sha256.json',
    'b2c-web-build.json', 'b2c-web-build.log', 'b2c-web-dist-sha256.json',
    'production-input-sha256.json', 'snapshot-setup.json', 'containers-setup.json',
    'setup-commands.json', 'setup-readiness.log',
]:
    copy(ROOT / name)
setup_manifest = read(ROOT / 'setup-artifacts-sha256.json')
for name, expected_hash in setup_manifest.items():
    assert digest((ROOT / name).read_bytes()) == expected_hash
    copy(ROOT / name, Path('setup') / name)
copy(ROOT / 'setup-artifacts-sha256.json', Path('setup') / 'setup-artifacts-sha256.json')
for path in (ROOT / 'static').iterdir():
    copy(path, Path('static') / path.name)
for path in E.iterdir():
    if path.is_file() and (path.name.startswith(('affected-', 'regression-')) or path.name in ['runner.log', 'terminal-summary.json', 'contracts-final-v2.raw.json', 'contracts-final-v2.raw.log']):
        copy(path, Path('runs') / path.name)
for path in (E / 'discovery-preflight-1').iterdir():
    copy(path, Path('discovery-preflight-1') / path.name)
for name in ['contracts-final-summary.json', 'contract-final-source-proof.json']:
    copy(ROOT / name, Path('intermediate-92a7c3b-contracts') / name)
for name in ['contracts-final.raw.json', 'contracts-final.raw.log']:
    copy(E / name, Path('intermediate-92a7c3b-contracts') / name)
for name in ['demo', 'legacy', 'contract', 'product']:
    copy(Path(f'/tmp/klisteni-readiness-final-{name}-discovery.json'), f'discovery/{name}.json')
for source in [ROOT / 'run-validation.py', ROOT / 'build-snapshot.py', ROOT / 'prepare-snapshot.py', Path('/tmp/klisteni-readiness-finalize-proofs.py'), Path('/tmp/klisteni-readiness-assertion-audit.mjs'), Path('/tmp/klisteni-readiness-package-evidence.py'), Path('/tmp/klisteni-readiness-cleanup.py')]:
    copy(source, Path('tools') / source.name)

groups = {}
for item in observations:
    value = item['observation']
    key = (item['mode'], value['phase'])
    groups.setdefault(key, []).append(value['elapsedMs'])
stats = [{'mode': mode, 'phase': phase, 'observations': len(values), 'minimumMs': min(values), 'maximumMs': max(values)} for (mode, phase), values in sorted(groups.items())]
save(OUT / 'readiness-statistics.json', {'productRunSha': RUN, 'groups': stats, 'qualification': 'Observed targeted/regression timing only; not historical latency reproduction or a performance guarantee.'})
save(OUT / 'actual-instances.json', actual)
save(OUT / 'validation-summary.json', {
    'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'applicationRuntimeSha': 'd2adf75d3fee18740ef38632a361c91203d77dc6',
    'finalSourceCandidateSha': FINAL, 'productExecutionSha': RUN,
    'affectedRepeated': {'passed': 108, 'failed': 0, 'retries': 0, 'skipped': 0, 'timedOut': 0, 'roundsPerMode': 3, 'profilesPerMode': 6},
    'supportingRegression': {'passed': 24, 'failed': 0, 'retries': 0, 'skipped': 0, 'timedOut': 0, 'scenarios': 6, 'profilesPerMode': 2},
    'finalStandaloneContracts': {'passed': 8, 'failed': 0, 'retries': 0, 'skipped': 0, 'timedOut': 0},
    'staticRegression': {'passed': 61, 'failed': 0, 'executionPin': '92a7c3ba0805a870cdecc47a81666b76fafbc221', 'qualification': 'Unchanged test/runtime applicability to final candidate documented separately.'},
    'sourceBuildFilesCheckedPerRunBoundary': 2132, 'sourceBuildMismatches': 0,
    'freshSchemas': 48, 'remainingBrowserSchemas': 0,
    'qualification': 'Targeted repeats and supporting regressions; both full uncapped HTTP 528 matrices on one accepted app/QA pair and trusted HTTPS remain separate gates. Intermediate standalone runs are not pooled.'
})

table = '''| Check | Actual result | Executed source |
| --- | --- | --- |
| SYNC-002, HEALTH-002, WEEK-009; three fresh-fixture rounds × both HTTP modes × six Chromium/WebKit320/430/1440 profiles | **108/108 passed**, no retries/skips/timeouts | `c8a5aaa` |
| HISTORY-001/002/009, WEEK-008, SYNC-006, INACTIVE-003; both modes × Chromium1440/WebKit430 | **24/24 passed**, no retries/skips/timeouts | `c8a5aaa` |
| Synthetic readiness contracts; Chromium/WebKit430 | **8/8 passed**, no retries/skips/timeouts | Final `8312034` Git bytes |
| Relevant Node domain/client/harness/stream regressions | **61/61 passed**, no skips | `92a7c3b`; unchanged test/runtime applicability verified at final candidate |
| Final typecheck, scoped ESLint and discovery isolation | Passed; product 528/demo 101/legacy 540 exclude the eight dedicated contracts | Final `8312034` |
| Source/build verification and schema teardown | **0 mismatches**, 2,132 files checked before/after every product run; 48 distinct fresh schemas, all removed | `c8a5aaa` runtime |

Actual result tuples and original reports/logs are retained in [actual-instances.json](actual-instances.json) and `runs/`; [validation-summary.json](validation-summary.json) provides totals. [source-applicability.json](source-applicability.json) distinguishes the frozen product execution from the final standalone-discovery follow-up. The intermediate `92a7c3b` standalone eight-case run is retained separately and is not counted again.

The task-owned database ended with zero browser schemas before its container was removed. Task containers and network were removed; existing containers were untouched. See [terminal-cleanup.json](terminal-cleanup.json).'''
report = Path('/tmp/klisteni-readiness-report.md').read_text()
assert 'FINAL_RESULTS' in report
report = report.replace('FINAL_RESULTS', table)
report += '''
## Dispatch prompt for independent QA

Review draft PR #34 without merging. Application runtime is `d2adf75d3fee18740ef38632a361c91203d77dc6`; proposed final QA source is `831203470d4c21322b8bc3ce7c4dedb7f84fe5d7`, narrow correction range `471bea1c2bf9446a69865ef091840ebada23d2f9..831203470d4c21322b8bc3ce7c4dedb7f84fe5d7`. Verify initial autosave receipt preservation and accepted-time correction semantics; shared positive admission/history/week deadlines and listener cleanup; unchanged denial, consent, revocation, historical linkage and viewport predicates; final standalone discovery isolation. Audit this v14 manifest, actual instances, source applicability, source/build checks and teardown against historical WP12/v44. Report accept/reject and exact accepted source pair. Do not launch another full matrix until review is accepted by the parent. If accepted, the parent separately dispatches both complete uncapped HTTP 528 matrices on that one immutable pair, zero retries/failure cap, retaining every actual result and failed-run evidence. Do not bypass TLS or change any gate.

Evidence files contain synthetic fixture metadata only. The task database password/URL and raw browser traces/storage are excluded; the published files and decoded inline attachments were checked for the task connection secret. The independent contract audit predates final packaging and intentionally preserves its intermediate-receipt warning. Final applicability records resolve that distinction explicitly.
'''
(OUT / 'README.md').write_text(report)
for path in OUT.rglob('*'):
    if path.is_file():
        safe(path.read_bytes(), str(path))
files = [{'path': str(path.relative_to(OUT)), 'bytes': path.stat().st_size, 'sha256': digest(path.read_bytes())} for path in sorted(OUT.rglob('*')) if path.is_file()]
save(OUT / 'manifest.json', {'algorithm': 'SHA-256', 'files': files, 'qualification': 'Manifest excludes itself. Historical evidence is preserved at its original commits; these are new v14 receipts.'})
print(json.dumps({'artifact': str(OUT), 'files': len(files), 'bytes': sum(value['bytes'] for value in files), 'productPassed': 132, 'finalContractsPassed': 8}))
