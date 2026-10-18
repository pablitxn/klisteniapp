import base64,collections,datetime,hashlib,importlib.util,json,re,shutil,sys
from pathlib import Path

root=Path('/workspace/wp12-runtime-v12');e=root/'evidence';n=int(sys.argv[1]);assert n in range(74,78)
assert (e/f'r{n}.state').read_text().strip()=='complete'
x=json.loads((e/f'r{n}-summary.json').read_text());run=x['run'];out=e/'receipts'/f'r{n}';assert not out.exists()
raw=(e/f'{run}.json').read_bytes();report=json.loads(raw);rows=[];native=[];readiness=[];headings=[];phases=[]
meta={p['name']:p['metadata']['b2bProduct'] for p in report['config']['projects']}
assert all(p['mode']==x['mode'] for p in meta.values())
def walk(s):
 for sp in s.get('specs',[]):
  scenario=re.match(r'^B2BP-[A-Z]+-\d{3}',sp['title'])[0]
  for t in sp.get('tests',[]):
   assert len(t['results'])==1
   r=t['results'][0];rows.append({'instanceId':sp['id'],'workerIndex':r.get('workerIndex'),'id':scenario,'project':t['projectName'],**meta[t['projectName']],'status':r['status'],'startTime':r['startTime'],'durationMs':r['duration'],'retry':r['retry'],'errors':r.get('errors',[]),'annotations':t.get('annotations',[])})
   for a in r.get('attachments',[]):
    if a.get('contentType')=='application/json' and a.get('body') and a['name'].startswith('product-readiness-'):
     phases.append({'instanceId':sp['id'],'id':scenario,'project':t['projectName'],'caseStatus':r['status'],'attachment':a['name'],'observed':json.loads(base64.b64decode(a['body']))})
    if a.get('contentType')=='application/json' and a.get('body') and a['name'].startswith('history-page-readiness-'):
     headings.append({'instanceId':sp['id'],'id':scenario,'project':t['projectName'],'caseStatus':r['status'],'attachment':a['name'],'observed':json.loads(base64.b64decode(a['body']))})
    if a.get('contentType')=='application/json' and a.get('body') and a['name'].startswith('history-continuity-readiness-'):
     readiness.append({'instanceId':sp['id'],'id':scenario,'project':t['projectName'],'caseStatus':r['status'],'attachment':a['name'],'observed':json.loads(base64.b64decode(a['body']))})
    if a.get('contentType')=='application/json' and a.get('body') and (a['name'].startswith('authenticated-close-') or a['name']=='synthetic-duration-fixture-provenance'):
     native.append({'id':scenario,'project':t['projectName'],'caseStatus':r['status'],'attachment':a['name'],'observed':json.loads(base64.b64decode(a['body']))})
 for child in s.get('suites',[]):walk(child)
walk(report);assert len(rows)==x['expectedCells'];assert dict(collections.Counter(r['status'] for r in rows))==x['counts']
assert len({(r['instanceId'],r['id'],r['project']) for r in rows})==len(rows)
source=json.loads((e/'source-proof.json').read_text());build=json.loads((e/'fresh-build-proof.json').read_text())
assert x['applicationSha']==source['applicationSha']=='3f8ccba573c08045c809dc73c186158878a2dafa';assert x['qaSha']==source['qaSha']=='831203470d4c21322b8bc3ce7c4dedb7f84fe5d7'
own=json.loads((e/f'r{n}-owned-schemas-after.json').read_text());assert not own['ownedRemaining']
spec=importlib.util.spec_from_file_location('sanitizer',root/'sanitize-evidence.py');sanitizer=importlib.util.module_from_spec(spec);spec.loader.exec_module(sanitizer)
out.mkdir(parents=True);redactions=[]
def publish(data,name,is_json=False,b64=False):
 s=sanitizer.Sanitizer();safe=(json.dumps(s.value(json.loads(data)),indent=2,ensure_ascii=False)+'\n' if is_json else s.text(data.decode())).encode();(out/name).write_bytes(base64.b64encode(safe)+b'\n' if b64 else safe)
 redactions.append({'file':name,'privateOriginalSha256':hashlib.sha256(data).hexdigest(),'sanitizedDecodedSha256':hashlib.sha256(safe).hexdigest(),'redactions':s.report()})
publish(raw,'playwright.json',True);publish((e/f'{run}.log').read_bytes(),'playwright.log.b64',b64=True)
for name in ['source-proof.json','fresh-build-proof.json','runtime-versions.json',f'r{n}-before-source-verification.json',f'r{n}-after-source-verification.json',f'r{n}-discovery-validation.json',f'r{n}-schema-inventory.json',f'r{n}-owned-schemas-after.json',f'{run}-times.json',f'{run}-artifact-export.json']:
 publish((e/name).read_bytes(),name,True)
for name in ['fresh-b2b-build.log','fresh-b2c-build.log','dependency-links.log']:
 publish((e/name).read_bytes(),name+'.b64',b64=True)
receipt={**x,'cells':rows,'rawJsonSha256':hashlib.sha256(raw).hexdigest(),'nativeObservationCount':len(native),'globalBrowserSchemasAfter':own['allBrowserSchemaCount'],'qualification':x['qualification']+' Private raw traces stay task-local; shared report/log/error copies are sanitized. Native observations are not additional test passes.'}
publish(json.dumps(receipt,ensure_ascii=False).encode(),'receipt.json',True)
publish(json.dumps({'qualification':'Native checkpoint observations and synthetic duration provenance; not additional passes. Enclosing case status remains explicit.','checkpoints':native},ensure_ascii=False).encode(),'native-checkpoints.json',True)
art=e/f'{run}-artifacts';manifest=[{'path':str(p.relative_to(art)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(art.rglob('*')) if p.is_file()]
(out/'private-artifact-manifest.json').write_text(json.dumps({'root':str(art),'files':manifest},indent=2)+'\n')
for p in art.rglob('error-context.md'):publish(p.read_bytes(),p.parent.name+'-error-context.md.b64',b64=True)
publish(json.dumps({'qualification':'Real continuity-region acknowledgments and selected response statuses; observations are not additional test passes. An acknowledgment taking over five seconds is measured timing, not proof that historical UI remained absent at that exact deadline.','observations':readiness},ensure_ascii=False).encode(),'continuity-readiness-observations.json',True)
publish(json.dumps({'qualification':'Actual positive history heading acknowledgments; not extra passes or historical causal proof.','observations':headings},ensure_ascii=False).encode(),'history-readiness-observations.json',True)
publish(json.dumps({'qualification':'Named positive phase observations; not additional test passes. HTTP events are not rendered readiness. Continuity region timing may follow shared history readiness and is not total history load time.','observations':phases},ensure_ascii=False).encode(),'product-readiness-observations.json',True)
phase_summary=[]
for phase in sorted({r['observed']['phase'] for r in phases}):
 observations=[r for r in phases if r['observed']['phase']==phase];times=[r['observed']['elapsedMs'] for r in observations];phase_summary.append({'phase':phase,'observations':len(observations),'ready':sum(r['observed']['ready'] for r in observations),'notReady':sum(not r['observed']['ready'] for r in observations),'minimumElapsedMs':min(times),'maximumElapsedMs':max(times),'over5000ms':sum(t>5000 for t in times),'budgetMs':30000})
publish(json.dumps(phase_summary).encode(),'product-readiness-summary.json',True)
waits=[r['observed']['regionWaitMs'] for r in readiness if r['observed']['regionWaitMs'] is not None]
readiness_summary={'observationCount':len(readiness),'regionVisibleCount':sum(r['observed']['regionVisible'] for r in readiness),'notObservedReadyCount':sum(not r['observed']['regionVisible'] for r in readiness),'maxObservedRegionWaitMs':max(waits,default=None),'minObservedRegionWaitMs':min(waits,default=None),'acknowledgmentsOver5000ms':sum(w>5000 for w in waits),'maximumAllowedRegionWaitMs':30000,'qualification':'Region acknowledgment may follow shared positive history readiness; it is not total load time. Actual observations on this exact source pair. Preserve failed enclosing case status. No root-cause or historical eventual-readiness inference.'}
publish(json.dumps(readiness_summary).encode(),'continuity-readiness-summary.json',True)
(out/'collector-source.py').write_bytes(Path(__file__).read_bytes())
(out/'sanitization-ledger.json').write_text(json.dumps(redactions,indent=2)+'\n');shutil.copyfile(root/'sanitize-evidence.py',out/'sanitizer-source.py')
(out/'README.md').write_text(f'# Proposed-pair focused browser run R{n}\n\nApplication `{x["applicationSha"]}`; QA `{x["qaSha"]}`; integration evidence `{x["acceptedIntegrationEvidenceSha"]}`.\n\nMode: {x["mode"]}; phase: {x["phase"]}. Actual results: {x["counts"]}; expected cells: {x["expectedCells"]}; exit {x["exitCode"]}.\n\nOne worker, zero retries, no failure cap. All six actual owned schema IDs were captured live and absent after teardown. Global schemas after this run: {own["allBrowserSchemaCount"]}; concurrent other-mode schemas are recorded separately.\n\nSource and fresh bundle hashes verified before and after execution. Original v40/v41/v44 and all previous failed waves remain unchanged. Repeated complete targeted instances are never pooled into full acceptance. HTTPS remains unexecuted pending existing trusted TLS inputs.\n')
files=[{'path':str(p.relative_to(out)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(out.rglob('*')) if p.is_file()]
(out/'manifest.json').write_text(json.dumps({'sealedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':files},indent=2)+'\n');print(json.dumps({'receipt':str(out),'counts':x['counts'],'ownedSchemasRemaining':0,'files':len(files)}))
