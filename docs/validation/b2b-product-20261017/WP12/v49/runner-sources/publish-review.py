import base64,datetime,hashlib,importlib.util,json,shutil,subprocess
from pathlib import Path
R=Path('/workspace/wp12-runtime-v12');E=R/'evidence';repo=Path('/workspace/klisteniapp');out=repo/'docs/validation/b2b-product-20261017/WP12/v49';assert not out.exists()
APP='3f8ccba573c08045c809dc73c186158878a2dafa';QA='831203470d4c21322b8bc3ce7c4dedb7f84fe5d7';DOC='76dcab2d28bd58072dc492bf6a994eb4995896e4';BASE='072e5fe3d97c57523cb0069f22ac834934b8f4af'
source=json.loads((E/'source-proof.json').read_text());build=json.loads((E/'fresh-build-proof.json').read_text());checks=json.loads((E/'checks.json').read_text());loading=json.loads((E/'loading-summary.json').read_text());runs=[json.loads((E/f'r{n}-summary.json').read_text()) for n in range(74,78)]
assert all(x['exitCode']==0 for x in checks);assert 'pass 65' in (E/'ui-state-tests.log').read_text() and 'pass 21' in (E/'gateway-tests.log').read_text();assert len(loading[0]['cells'])==14 and loading[0]['exitCode']==0 and loading[1]['exitCode']==1
assert [x['expectedCells'] for x in runs]==[6,6,2,2];assert all(x['applicationSha']==APP and x['qaSha']==QA for x in runs)
assert all(x['counts']=={'passed':x['expectedCells']} and x['ownedSchemasRemaining']==0 for x in runs);assert sum(x['actualCells'] for x in runs)==16
for f in source['applicationFiles']+source['qaFiles']+build['files']:assert hashlib.sha256((R/'app'/f['path']).read_bytes()).hexdigest()==f['sha256']
prior=Path('/workspace/wp12-runtime-v11');olds=json.loads((prior/'evidence/source-proof.json').read_text());oldb=json.loads((prior/'evidence/fresh-build-proof.json').read_text())
for f in olds['applicationFiles']+olds['qaFiles']+oldb['files']:assert hashlib.sha256((prior/'app'/f['path']).read_bytes()).hexdigest()==f['sha256']
inventories=[json.loads((E/f'r{n}-schema-inventory.json').read_text()) for n in range(74,78)]
assert len({x['schema'] for inventory in inventories for x in inventory['schemas']})==24
count=int(subprocess.check_output(['docker','exec','wp12-v12-postgres','psql','-U','wp12','-d','wp12_b2b_test','-Atc',"select count(*) from information_schema.schemata where schema_name like 'b2b_product_browser_%'"],text=True));assert count==0
out.mkdir(parents=True);spec=importlib.util.spec_from_file_location('s',R/'sanitize-evidence.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);ledger=[]
def write(name,data,structured=False,b64=False):
 s=m.Sanitizer();safe=(json.dumps(s.value(json.loads(data)),indent=2,ensure_ascii=False)+'\n' if structured else s.text(data.decode())).encode();target=out/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(base64.b64encode(safe)+b'\n' if b64 else safe);ledger.append({'file':name,'privateOriginalSha256':hashlib.sha256(data).hexdigest(),'sanitizedDecodedSha256':hashlib.sha256(safe).hexdigest(),'redactions':s.report()})
for name in ['source-proof.json','source-archive.json','fresh-build-proof.json','setup-source-and-runtime.json','previous-runtime-retirement.json','runtime-versions.json','runtime-isolation.json','producer-audit.json','checks.json','loading-summary.json']:
 write(name,(E/name).read_bytes(),True)
for x in checks:write(x['name']+'.log.b64',(E/(x['name']+'.log')).read_bytes(),b64=True)
for name in ['fresh-b2b-build.log','fresh-b2c-build.log','runtime-startup.log','dependency-links.log']:write(name+'.b64',(E/name).read_bytes(),b64=True)
product_phases=[];auth_pacing=[]
for n in range(74,78):
 product_phases.extend([{'run':n,**x} for x in json.loads((E/'receipts'/f'r{n}'/'product-readiness-summary.json').read_text())])
 receipt=json.loads((E/'receipts'/f'r{n}'/'receipt.json').read_text())
 for cell in receipt['cells']:
  for annotation in cell.get('annotations',[]):
   if annotation['type']=='auth-pacing':auth_pacing.append({'run':n,'id':cell['id'],'project':cell['project'],'testDurationMs':cell['durationMs'],'annotation':annotation})
write('focused-timing-observations.json',json.dumps({'positivePhases':product_phases,'authPacing':auth_pacing,'qualification':'Observed targeted phase acknowledgment timing, not broad performance certification or historical causality. Auth waits preserve the existing password limiter.'}).encode(),True)
phases=[]
for name in ['candidate','baseline-control']:
 raw=(E/('loading-'+name+'.json')).read_bytes();report=json.loads(raw);write('loading-'+name+'.json',raw,True);write('loading-'+name+'.log.b64',(E/('loading-'+name+'.log')).read_bytes(),b64=True)
 def walk(x):
  for sp in x.get('specs',[]):
   for t in sp['tests']:
    for result in t['results']:
     for a in result.get('attachments',[]):
      if a.get('name')=='synthetic-request-phases' and a.get('body'):phases.append({'run':name,'title':sp['title'],'project':t['projectName'],'status':result['status'],'observed':json.loads(base64.b64decode(a['body']))})
  for c in x.get('suites',[]):walk(c)
 walk(report)
 art=E/('loading-'+name+'-artifacts');files=[{'path':str(p.relative_to(art)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(art.rglob('*')) if p.is_file()];write('loading-'+name+'-private-artifact-manifest.json',json.dumps({'root':str(art),'files':files}).encode(),True)
 for p in art.rglob('error-context.md'):write(name+'-'+p.parent.name+'-error-context.md.b64',p.read_bytes(),b64=True)
write('loading-request-phases.json',json.dumps({'qualification':'Synthetic browser and server event observations, not extra passes or proof of historical causality. Browser network events and rendered readiness remain distinct.','observations':phases}).encode(),True)
for n in range(74,78):
 receipt=E/'receipts'/f'r{n}';manifest=json.loads((receipt/'manifest.json').read_text());assert all(hashlib.sha256((receipt/f['path']).read_bytes()).hexdigest()==f['sha256'] for f in manifest['files']);shutil.copytree(receipt,out/f'r{n}')
for name in ['prepare.py','setup.py','build.py','verify-runtime.py','audit-producer.py','checks.py','run-loading.py','run-focused.py','run-health-inactive.py','collect.py','sanitize-evidence.py','publish-review.py']:
 write('runner-sources/'+name,(R/name).read_bytes())
final={'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'applicationSha':APP,'qaSha':QA,'pr35DocumentationHead':DOC,'applicationFilesVerified':len(source['applicationFiles']),'qaFilesVerified':len(source['qaFiles']),'freshBuiltFilesVerified':len(build['files']),'preservedBaselineFilesVerified':len(olds['applicationFiles']+olds['qaFiles']+oldb['files']),'globalBrowserSchemasRemaining':count,'manualCleanupApplied':False,'candidateCompleteFullMatrixRun':False,'proposedFinalApplicationSourceSha':APP,'proposedFinalQaSha':QA,'parentApprovalAndCombinedHeadRequired':True};write('final-verification.json',json.dumps(final).encode(),True)
(out/'README.md').write_text(f'''# Independent PR35 loading review and focused validation

[PR35](https://github.com/pablitxn/klisteniapp/pull/35) reviewed head: `{DOC}`. Production source: `{APP}` (UI isolation commit `44b6ddd6d4b1b8670f0122df3541ef25d56e3976` plus separate gateway lifecycle commit). QA: `{QA}`. PR35 adds documentation only after the production source commit; exported app and QA files also match its exact final head. No source from PR35 was imported into the frozen baseline or this QA branch.

## Frozen baseline remains terminal

[Immutable R71/R72 terminal record](https://github.com/pablitxn/klisteniapp/blob/{BASE}/docs/validation/b2b-product-20261017/WP12/v48/README.md): R71 unified 527 passed / 1 failed; R72 White Label 526 passed / 2 failed. There were 1,056 unique full cells, zero retries, skips or whole-test timeouts. Full baseline acceptance was not met. All original reports, failures and v40/v41/v44/v45 history remain intact. The original 2,106 source/build files were reverified unchanged before retirement and after this candidate validation. Task-owned v11 containers were retired only after terminal reports, raw JSON/artifact hashes and zero browser schemas were verified; host source/evidence remains retained.

## Independent actual executions

| Check | Actual result | Scope |
| --- | --- | --- |
| Built-app synthetic loading | 14 passed, 0 failed/skipped/retried | Seven cases, Chromium 430 and 1440 |
| Same final test against retained baseline build | 1 expected failure, 0 retries | Chromium 430, unrelated reports chunk held |
| R74 unified product | 6 passed | ALTERNATIVES-004, ROLES-003, ROLES-009; Chromium 320/430 |
| R75 White Label product | 6 passed | Same three cases and viewports |
| R76 unified product | 2 passed | HEALTH-002, INACTIVE-003; WebKit 430 |
| R77 White Label product | 2 passed | Same two cases and viewport |
| UI state | 65 passed, 0 failed/skipped | Navigation, local flush, selection/recovery, restrictions, stream guard, consent |
| Gateway | 21 passed, 0 failed/skipped | Includes nested disconnect/error lifecycle cases |

Each browser suite uses one worker, zero retries and no failure cap. R74/R75 ALTERNATIVES-004 Chromium430 durations include recorded password-limiter idle waits of58,933/59,235ms. Those unchanged admission reservations remain explicit in cell annotations; they are not feature-readiness timing or relaxed authentication. Actual positive phase observations are retained separately. The 16 real-product instances are separate focused evidence, not a replacement 1,056-cell full matrix. No complete candidate matrix was run. All four product runs captured their six actual schema IDs live; all 24 owned schemas were removed by normal teardown. Final global browser-schema count: zero. No manual schema cleanup.

Fresh B2B and B2C production builds, B2B and standalone-browser type checks, package-boundary check and static-helper syntax check passed. Production build retains the existing large-chunk advisory. Producer lint/format results were audited as supplied evidence, not rerun or counted as independent checks. All {len(source['applicationFiles'])} app inputs, {len(source['qaFiles'])} exact QA/helper inputs and {len(build['files'])} fresh outputs matched their frozen hashes before/after the product runs and final publication. Dependency lock/workspace bytes and manifest dependency fields match the frozen installed tree. No dependency install, contract edit or shared config change.

The supported cached runtime remained nonroot UID1001 with Chromium sandbox enabled, existing seccomp/no-new-privileges, ordinary task network, no published ports and read-only platform CA/dependency mounts. Playwright1.63.0, Chromium153.0.8010.12 and WebKit26.6 were actually started; feature execution is limited to the cells listed above. The baseline build was mounted read-only.

## Review conclusion

The lazy imports remove unrelated feature dependencies from workspace admission and give the selected feature its own loading/error boundary. Navigation, current organization/branch controls, membership admission, stream authority, local recovery and navigation-flush ownership remain outside those boundaries. The direct workout imports re-export the exact same product components as the old legacy barrels. No DTO, authorization endpoint, role/capability guard, denial predicate or existing product assertion changed.

The baseline control fails at the exact organization combobox's five-second visibility assertion while the unrelated reports chunk is held. The candidate passes that test without requesting the reports chunk. Delayed and rejected selected chunks retain usable navigation; another section renders real fixture content. React.lazy caches a rejected import, so retrying that same feature requires a full page reload; resetting the scoped boundary does not refetch a rejected module. The UI directs users to another section and performs no silent retry. Branch/role changes during a pending import cannot reveal the old privileged marker or issue prohibited feature reads. Consent denial and revocation during a pending health import prevent mounting or reading health; inactive membership stays export-only. The fixture rejects unmodeled API reads. Its authentication/API responses are synthetic; it does not establish real-server authorization by itself. The separate real-product role/health/inactive scenarios provide focused integration evidence.

The gateway delta uses one open handle for metadata and body, transfers it to the read stream, preserves backpressure and cancels on downstream close/finish/error or request abort. Independent Node tests exercise complete GET/HEAD and empty files, MIME/security headers, path/method/fallback behavior, repeated disconnects and descriptor recovery, paused clients, disconnects during open/stat, replacement after stat, and open/stat/create/read errors. The synthetic loading fixture has its own static server and does not execute this gateway helper. No claim is made that stream cleanup caused the historical 20–53-second asset timings, bootstrap cancellation, or any specific R71/R72 failure.

Producer v15 audit verified all 27 manifest entries and 3,834 exact source Git blobs at `{APP}`. Its reduced browser report records14 candidate passes and one valid expected baseline failure, with private raw-report hashes. Producer setup/offline/locator failures are retained and not promoted to passes. Those supplied results remain separate from the executions above.

## Proposed pins and remaining gates

Proposed final application source: `{APP}`; proposed final QA: `{QA}`. PR35 head `{DOC}` has identical runtime source and adds only documentation. Parent retains the choice of the final combined integration head; this evidence does not fabricate or approve an unprovided combined SHA.

No blocking production-code finding was identified in this focused review. The candidate addresses the demonstrated eager-dependency failure mechanism and passes the selected regressions. Historical causality and broad performance remain unproven. Full candidate HTTP acceptance remains pending the parent's final accepted combined head and gate decision; baseline failures remain failures. Do not merge failing placeholder tests or waive full acceptance from these focused passes.

HTTPS remains unexecuted pending the existing trusted task certificate/key/hostname/trust inputs; no TLS or sandbox relaxation. Local viewports do not certify physical devices, Safari/iOS, production/provider data, deployment or main CI. Historical Yoga/model/Blender qualifications remain unchanged. Parent retains orchestration, integration and merge authority. No app source fix, main merge, external real-user message, provider or production action was performed.

## Evidence handling and Atlas

Public reports, request observations and logs are sanitized; private raw reports, traces and screenshots remain task-local with SHA256 manifests. Expected negative-control failure is retained without altering or rerunning it to obtain green. File manifests bind published bytes; runner-source sanitation is explicitly recorded and does not claim byte identity with private scripts.

Atlas context was read at `ce45d206a2ed4035f8003a3303abd1fff98e09b8`, using the mounted atlas-navigate skill and source-of-truth rules. The product repo governs implementation and contracts; dated runtime evidence governs these local results. Original plan pin: `447d77ebb5587e319018e7b56003f0ef7299bb6c`. All authored repository content and new Conventional Commits are English.
''')
(out/'sanitization-ledger.json').write_text(json.dumps(ledger,indent=2)+'\n')
files=[{'path':str(p.relative_to(out)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(out.rglob('*')) if p.is_file()];(out/'manifest.json').write_text(json.dumps({'sealedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'applicationSha':APP,'qaSha':QA,'files':files},indent=2)+'\n');print(json.dumps({'version':'v49','files':len(files),'productInstances':16,'loadingPassed':14,'baselineExpectedFailure':1,'globalBrowserSchemasRemaining':0}))
