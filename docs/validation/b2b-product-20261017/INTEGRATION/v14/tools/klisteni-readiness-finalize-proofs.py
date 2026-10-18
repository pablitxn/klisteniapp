from pathlib import Path
import collections, datetime, hashlib, json, subprocess

ROOT = Path('/tmp/klisteni-readiness-runtime')
REPO = Path('/workspace/klisteni-readiness')
FINAL = '831203470d4c21322b8bc3ce7c4dedb7f84fe5d7'
RUN = 'c8a5aaa5fab4206a646a644601481713d42f4a65'
APP = 'd2adf75d3fee18740ef38632a361c91203d77dc6'
OLD_SPEC = 'apps/b2c-web/e2e/support/product-readiness.contract.spec.ts'
NEW_SPEC = 'apps/b2c-web/test/browser-readiness/readiness.spec.ts'
CONFIG = 'apps/b2c-web/playwright.product-readiness.config.ts'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=REPO)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def save(name, data):
    (ROOT / name).write_text(json.dumps(data, indent=2) + '\n')

def report(path):
    data = Path(path).read_text()
    offset = data.index('{\n  "config"')
    value, _ = json.JSONDecoder().raw_decode(data[offset:])
    return value

def rows(value):
    found = []
    def walk(suite):
        for spec in suite.get('specs', []):
            for test in spec.get('tests', []):
                found.append({'file': spec['file'], 'title': spec['title'], 'project': test['projectName'], 'results': test['results']})
        for child in suite.get('suites', []):
            walk(child)
    walk(value)
    return found

changes = git('diff', '--name-status', RUN, FINAL).decode().splitlines()
old = git('show', f'{RUN}:{OLD_SPEC}')
new = git('show', f'{FINAL}:{NEW_SPEC}')
assert old.replace(b"'../fixtures/b2b-product/readiness'", b"'../../e2e/fixtures/b2b-product/readiness'") == new
paths = git('ls-tree', '-r', '--name-only', RUN, 'apps/b2c-web/e2e', 'apps/b2c-web/playwright.b2b-product-unified.config.ts', 'apps/b2c-web/playwright.b2b-product-wl-http.config.ts', 'apps/b2c-web/playwright.b2b-product-wl-https.config.ts', 'apps/b2c-web/playwright.b2b-product-support.ts').decode().splitlines()
same = []
for path in paths:
    if path == OLD_SPEC:
        continue
    before = git('show', f'{RUN}:{path}')
    assert before == git('show', f'{FINAL}:{path}'), path
    same.append({'path': path, 'sha256': digest(before)})
save('source-applicability.json', {
    'productRunSha': RUN, 'finalCandidateSha': FINAL, 'changes': changes,
    'identicalProductQaFiles': same,
    'standaloneContractChange': {'oldPath': OLD_SPEC, 'newPath': NEW_SPEC,
        'oldSha256': digest(old), 'newSha256': digest(new), 'bodyUnchangedExceptRelativeImport': True,
        'dedicatedConfigDiff': git('diff', RUN, FINAL, '--', CONFIG).decode()},
    'qualification': 'Product cases executed at productRunSha. Final source only moves the standalone synthetic test outside e2e, adjusts its relative helper import and updates the dedicated config directory/match. All product helpers/scenarios/configs and runtime inputs are unchanged. Standalone tests and discovery are re-executed at finalCandidateSha. This applicability proof does not claim a full matrix at the final pin.'
})

runtime_paths = git('diff', '--name-only', APP, FINAL, '--', 'apps', 'packages', 'scripts', 'package.json', 'pnpm-lock.yaml').decode().splitlines()
allowed = lambda path: path.startswith('apps/b2c-web/e2e/') or path in [CONFIG, NEW_SPEC, 'packages/b2b-domain/tests/sessions.test.ts']
unexpected = [path for path in runtime_paths if not allowed(path)]
assert not unexpected, unexpected
save('application-runtime-identity.json', {
    'applicationRuntimeSha': APP, 'candidateSha': FINAL, 'changedPaths': runtime_paths,
    'nonQaOrRegressionChanges': unexpected,
    'qualification': 'Entire apps/packages/scripts plus root package and lockfile comparison. Differences are QA files and one domain regression test; production runtime and migration inputs are unchanged.'
})

discovery = []
for name, expected, helpers in [('demo', 101, 0), ('legacy', None, 0), ('contract', 8, 8), ('product', 528, 0)]:
    path = Path(f'/tmp/klisteni-readiness-final-{name}-discovery.json')
    data = report(path)
    found = rows(data)
    count = len([row for row in found if 'readiness.spec.ts' in row['file']])
    assert not data.get('errors'), name
    assert count == helpers, (name, count)
    if expected is not None:
        assert len(found) == expected, (name, len(found))
    discovery.append({'configuration': name, 'discovered': len(found), 'standaloneReadinessCells': count, 'errors': 0, 'exitCode': 0, 'rawReportSha256': digest(path.read_bytes())})
save('discovery-isolation.json', {'candidateSha': FINAL, 'configurations': discovery, 'qualification': 'Actual list-only runs. No product case execution or acceptance inferred from discovery.'})

path = ROOT / 'evidence/contracts-final-v2.raw.json'
data = report(path)
cells = rows(data)
assert len(cells) == 8 and not data.get('errors')
assert data['config']['workers'] == 1 and data['config'].get('maxFailures', 0) == 0
assert all(project['retries'] == 0 for project in data['config']['projects'])
safe = []
for cell in cells:
    assert len(cell['results']) == 1
    result = cell['results'][0]
    assert result['status'] == 'passed' and result['retry'] == 0
    safe.append({key: value for key, value in cell.items() if key != 'results'} | {key: result[key] for key in ['status', 'startTime', 'duration', 'retry']})
save('contracts-final-v2-summary.json', {'candidateSha': FINAL, 'passed': 8, 'failed': 0, 'retries': 0, 'skipped': 0, 'timedOut': 0, 'workers': 1, 'cells': safe, 'rawReportSha256': digest(path.read_bytes()), 'qualification': 'Standalone synthetic DOM in real Chromium/WebKit430. Expected helper deadline rejection is asserted by a passing test, not a timed-out case. Not product/full-matrix acceptance.'})

script = Path('/tmp/klisteni-readiness-assertion-audit.mjs')
script.write_text(script.read_text().replace('92a7c3ba0805a870cdecc47a81666b76fafbc221', FINAL))
subprocess.run(['node', str(script)], check=True, stdout=subprocess.DEVNULL)
print(json.dumps({'finalCandidateSha': FINAL, 'unchangedProductQaFiles': len(same), 'contractsPassed': 8, 'discovery': discovery}, indent=2))
