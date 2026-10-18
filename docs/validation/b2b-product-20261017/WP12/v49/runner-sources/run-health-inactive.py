import collections, concurrent.futures, datetime, hashlib, json, re, subprocess, sys, time
from pathlib import Path

ROOT = Path('/workspace/wp12-runtime-v12')
E = ROOT / 'evidence'
CONTAINER = 'wp12-v12-browser'
PG = 'wp12-v12-postgres'
APP = '3f8ccba573c08045c809dc73c186158878a2dafa'
QA = '831203470d4c21322b8bc3ce7c4dedb7f84fe5d7'
SOURCE = json.loads((E / 'source-proof.json').read_text())
BUILDS = json.loads((E / 'fresh-build-proof.json').read_text())
IDS = sorted(set(re.findall(r"test\(scenarioTitle\('(B2BP-[A-Z]+-\d+)'\)", '\n'.join(
    p.read_text() for p in (ROOT / 'app/apps/b2c-web/e2e').glob('b2b-product-*.spec.ts')))))
assert len(IDS) == 88
PROJECTS = ['product-chromium-320', 'product-chromium-430', 'product-chromium-desktop',
            'product-webkit-320', 'product-webkit-430', 'product-webkit-desktop']
TARGETS = ['B2BP-HEALTH-002','B2BP-INACTIVE-003']

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def save(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')

def state(n, phase):
    (E / f'r{n}.state').write_text(phase + '\n')

def prove(n, phase):
    for f in SOURCE['applicationFiles'] + SOURCE['qaFiles'] + BUILDS['files']:
        assert hashlib.sha256((ROOT / 'app' / f['path']).read_bytes()).hexdigest() == f['sha256'], f['path']
    save(E / f'r{n}-{phase}-source-verification.json', {
        'verifiedAt': now(), 'applicationSha': APP, 'qaSha': QA,
        'applicationFiles': len(SOURCE['applicationFiles']), 'qaFiles': len(SOURCE['qaFiles']),
        'freshBuiltFiles': len(BUILDS['files']), 'mismatches': [],
        'sourceManifestSha256': hashlib.sha256((E / 'source-proof.json').read_bytes()).hexdigest(),
        'buildManifestSha256': hashlib.sha256((E / 'fresh-build-proof.json').read_bytes()).hexdigest()})

def command(n, mode, phase, discovery=False):
    config = 'playwright.b2b-product-unified.config.ts' if mode == 'unified-http' else 'playwright.b2b-product-wl-http.config.ts'
    run = f'readiness-{phase}-r{n}'
    cmd = ['docker', 'exec', '-e', 'B2B_TEST_DATABASE_URL=[REDACTED task database URL]',
           '-e', 'B2B_PRODUCT_TEST_ACTIVATE=1', '-e', 'B2B_PRODUCT_USE_BUILT=1',
           '-e', f'B2B_PRODUCT_OUTPUT=/tmp/{run}', '-e', f'PLAYWRIGHT_JSON_OUTPUT_NAME=/task/evidence/{run}{"-discovery" if discovery else ""}.json',
           '-w', '/task/app/apps/b2c-web', CONTAINER, 'node', 'node_modules/@playwright/test/cli.js',
           'test', f'--config={config}', '--timeout=180000', '--reporter=json' if discovery else '--reporter=list,json']
    cmd.extend(f'--project={p}' for p in (PROJECTS if phase=='full' else ['product-webkit-430']))
    if phase=='focused':cmd.append('--grep='+ '|'.join(TARGETS))
    if discovery:
        cmd.append('--list')
    return run, cmd

def rows(report):
    out = []
    def walk(s):
        for spec in s.get('specs', []):
            match = re.match(r'^B2BP-[A-Z]+-\d{3}\b', spec['title'])
            assert match, spec['title']
            for t in spec.get('tests', []):
                results = t.get('results', [])
                out.append({'instanceId': spec['id'], 'id': match[0], 'project': t['projectName'], 'status': results[-1]['status'] if results else 'notExecuted',
                            'attempts': len(results), 'results': results})
        for child in s.get('suites', []):
            walk(child)
    walk(report)
    return out

def expected(phase):
    return collections.Counter({(scenario,project):1 for scenario in (IDS if phase=='full' else TARGETS) for project in (PROJECTS if phase=='full' else ['product-webkit-430'])})

def inventory(n, mode):
    port = 5600 if mode == 'unified-http' else 5700
    js = "const http=require('http');Promise.all(Array.from({length:6},(_,i)=>new Promise((resolve,reject)=>{http.get('http://127.0.0.1:'+process.argv[1]+'/fixtures?project='+i,r=>{let s='';r.on('data',b=>s+=b);r.on('end',()=>{try{const x=JSON.parse(s);resolve({project:i,schema:x.schema,phase:x.phase,featuresActivated:x.featuresActivated})}catch(e){reject(e)}})}).on('error',reject)}))).then(x=>process.stdout.write(JSON.stringify(x)))"
    result = subprocess.run(['docker', 'exec', CONTAINER, 'node', '-e', js, str(port)], capture_output=True, text=True, timeout=10)
    if result.returncode:
        return False
    data = json.loads(result.stdout)
    assert len(data) == len({r['schema'] for r in data}) == 6
    assert all(re.fullmatch(r'b2b_product_browser_[a-f0-9]{32}', r['schema']) for r in data)
    save(E / f'r{n}-schema-inventory.json', {'capturedAt': now(), 'mode': mode, 'controlPort': port, 'schemas': data})
    return True

def cleanup(n, mode):
    captured = json.loads((E / f'r{n}-schema-inventory.json').read_text())
    owned = {r['schema'] for r in captured['schemas']}
    for attempt in range(7):
        names = set(subprocess.check_output(['docker', 'exec', PG, 'psql', '-U', 'wp12', '-d', 'wp12_b2b_test', '-Atc',
                    "select schema_name from information_schema.schemata where schema_name like 'b2b_product_browser_%'"], text=True).splitlines())
        remaining = owned & names
        if not remaining:
            break
        time.sleep(3)
    save(E / f'r{n}-owned-schemas-after.json', {'checkedAt': now(), 'run': n, 'mode': mode,
        'ownedSchemaCount': 6, 'ownedRemaining': sorted(remaining), 'allBrowserSchemaCount': len(names),
        'otherBrowserSchemas': sorted(names - owned), 'manualCleanupApplied': False})
    assert not remaining, 'Owned schema cleanup failed'

def execute(n, mode, phase):
    state(n, 'verifying-source')
    prove(n, 'before')
    run, discover = command(n, mode, phase, True)
    with (E / f'{run}-discovery.log').open('w') as log:
        result = subprocess.run(discover, stdout=log, stderr=subprocess.STDOUT)
    assert result.returncode == 0, 'Discovery failed'
    report = json.loads((E / f'{run}-discovery.json').read_text())
    found = rows(report)
    want = expected(phase)
    assert collections.Counter((r['id'], r['project']) for r in found) == want
    expected_instances = {(r['instanceId'], r['id'], r['project']) for r in found}
    assert len(expected_instances) == len(found) == sum(want.values())
    assert report['config']['workers'] == 1 and all(p['retries'] == 0 for p in report['config']['projects'])
    assert report['config'].get('maxFailures', 0) == 0
    save(E / f'r{n}-discovery-validation.json', {'validatedAt': now(), 'applicationSha': APP, 'qaSha': QA,
        'mode': mode, 'phase': phase, 'expectedCells': sum(want.values()), 'actualInstances': len(found), 'uniqueScenarioContexts': len(want), 'repetitionsPerScenarioContext': 1,
        'scenarioIds': sorted({s for s, _ in want}), 'projects': sorted({p for _, p in want}),
        'workers': 1, 'retries': 0, 'failureCap': None})
    state(n, 'executing')
    started = now()
    _, cmd = command(n, mode, phase)
    captured = False
    with (E / f'{run}.log').open('w') as log:
        process = subprocess.Popen(cmd, stdout=log, stderr=subprocess.STDOUT)
        save(E / f'r{n}-process.json', {'hostPid': process.pid, 'run': run, 'mode': mode, 'phase': phase, 'startedAt': started})
        while process.poll() is None:
            if not captured:
                captured = inventory(n, mode)
            time.sleep(3)
        code = process.wait()
    (E / f'{run}.exit').write_text(str(code) + '\n')
    save(E / f'{run}-times.json', {'startedAt': started, 'finishedAt': now()})
    copy = subprocess.run(['docker', 'cp', f'{CONTAINER}:/tmp/{run}/artifacts', str(E / f'{run}-artifacts')], capture_output=True, text=True)
    save(E / f'{run}-artifact-export.json', {'exitCode': copy.returncode, 'destination': str(E / f'{run}-artifacts')})
    assert captured, 'No actual live schema inventory captured; no cleanup attestation possible'
    cleanup(n, mode)
    prove(n, 'after')
    report = json.loads((E / f'{run}.json').read_text())
    actual = rows(report)
    assert len(actual) == sum(want.values()) and {(r['instanceId'], r['id'], r['project']) for r in actual} == expected_instances
    assert collections.Counter((r['id'], r['project']) for r in actual) == want
    assert all(r['attempts'] == 1 for r in actual), 'Unexpected skipped/unexecuted/retried result'
    assert not report.get('errors'), 'Top-level runner error; inspect before accepting completeness'
    summary = {'run': run, 'number': n, 'mode': mode, 'phase': phase, 'applicationSha': APP, 'qaSha': QA,
               'acceptedIntegrationEvidenceSha': '76dcab2d28bd58072dc492bf6a994eb4995896e4',
               'expectedCells': sum(want.values()), 'uniqueScenarioContexts': len(want), 'repetitionsPerScenarioContext': 1, 'actualCells': len(actual), 'counts': dict(collections.Counter(r['status'] for r in actual)),
               'stats': report['stats'], 'exitCode': code, 'ownedSchemasRemaining': 0,
               'qualification': 'Independent focused PR35 candidate run on the proposed pair; not a replacement full matrix. Original failed waves remain unchanged; no replacement or pooled acceptance.'}
    save(E / f'r{n}-summary.json', summary)
    state(n, 'complete')
    print(json.dumps(summary), flush=True)
    return summary

def group(jobs):
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures = {pool.submit(execute, *job): job for job in jobs}
        results = []
        for f in concurrent.futures.as_completed(futures):
            job = futures[f]
            try:
                results.append(f.result())
            except BaseException as error:
                state(job[0], 'blocked')
                save(E / f'r{job[0]}-blocker.json', {'at': now(), 'errorClass': type(error).__name__, 'reason': str(error)})
                print(json.dumps({'run': job[0], 'blocked': type(error).__name__, 'reason': str(error)}), flush=True)
        assert len(results) == len(jobs), 'Stage contains an actual execution/provenance/cleanup blocker'
        return results

if __name__ == '__main__':
    phase=sys.argv[1];assert phase == 'focused'
    jobs=[(76,'unified-http','focused'),(77,'white-label-http','focused')] if phase=='focused' else [(71,'unified-http','full'),(72,'white-label-http','full')]
    results=group(jobs)
    save(E/f'{phase}-runs-terminal.json',{'at':now(),'runs':[j[0] for j in jobs],'applicationSha':APP,'qaSha':QA,'allPassed':all(x['counts']=={'passed':x['expectedCells']} for x in results),'qualification':'Independent exact-final-source execution. Targeted, helper-contract and historical outcomes remain separate; all original failures preserved.'})
