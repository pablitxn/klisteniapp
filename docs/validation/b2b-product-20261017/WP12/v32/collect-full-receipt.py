import base64,collections,datetime,hashlib,json,re,shutil,subprocess,sys
from pathlib import Path
from importlib.util import spec_from_file_location,module_from_spec
spec=spec_from_file_location('sanitizer',Path(__file__).with_name('sanitize-evidence.py'));sanitizer=module_from_spec(spec);spec.loader.exec_module(sanitizer)
redactions=[]
def safe_bytes(raw,name,is_json=False):
 s=sanitizer.Sanitizer();text=raw.decode();safe=json.dumps(s.value(json.loads(text)),indent=2,ensure_ascii=False)+'\n' if is_json else s.text(text)
 data=safe.encode();redactions.append({'publishedFile':name,'privateOriginalSha256':hashlib.sha256(raw).hexdigest(),'publishedDecodedSha256':hashlib.sha256(data).hexdigest(),'redactions':s.report(),'representation':'sanitized JSON' if is_json else 'sanitized text','privateOriginalRetained':True});return data
repo=Path('/workspace/klisteniapp');e=Path('/workspace/wp12-runtime-v7/evidence');version=sys.argv[1] if len(sys.argv)>1 else 'v31';assert re.fullmatch('v[0-9]+',version)
numbers=[int(n) for n in sys.argv[2:]] or [34,35];assert numbers and len(set(numbers))==len(numbers) and set(numbers)<={34,35}
hold=e/'publication-hold.json';local_only=hold.exists() and json.loads(hold.read_text()).get('active') is True
out=(e/'local-receipts' if local_only else repo/'docs/validation/b2b-product-20261017/WP12')/version;assert not out.exists()
app='bd30eab5b2a33c3f3e8a7692649632ec85103431';qa='1374b94ed441365789d2756742afa8306022c0a0'
ids=sorted({v for f in (repo/'apps/b2c-web/e2e').glob('b2b-product-*.spec.ts') for v in re.findall(r"test\(scenarioTitle\('(B2BP-[A-Z]+-\d+)'\)",f.read_text())});assert len(ids)==88
prepared=[];checkpoints=[]
for n in numbers:
 mode={34:'unified-http',35:'white-label-http'}[n]
 run=f'candidatebd30-full-r{n}';assert (e/f'r{n}.state').read_text().strip()=='complete'
 raw=(e/f'{run}.json').read_bytes()
 x=json.loads(raw);projects={p['name']:p['metadata']['b2bProduct'] for p in x['config']['projects']};assert len(projects)==6 and all(p['mode']==mode for p in projects.values())
 expected={(id,p) for id in ids for p in projects};rows=[]
 def walk(s):
  for spec in s.get('specs',[]):
   match=re.search(r'^B2BP-[A-Z]+-\d{3}\b',spec['title']);assert match,spec['title'];id=match[0]
   for test in spec.get('tests',[]):
    results=test.get('results',[]);last=results[-1] if results else {};meta=projects[test['projectName']]
    row={'id':id,'project':test['projectName'],'engine':meta['engine'],'width':meta['width'],'status':last.get('status','neverRun'),'resultAttempts':len(results),'errors':last.get('errors',[])};rows.append(row)
    for result in results:
     for a in result.get('attachments',[]):
      if a.get('contentType')=='application/json' and a.get('body') and (a['name'].startswith('authenticated-close-') or a['name']=='synthetic-duration-fixture-provenance'):
       checkpoints.append({'run':run,'id':id,'project':row['project'],'caseStatus':row['status'],'qaSha':qa,'attachment':a['name'],'observed':json.loads(base64.b64decode(a['body']))})
  for sub in s.get('suites',[]):walk(sub)
 walk(x);actual=[(r['id'],r['project']) for r in rows];assert len(rows)==528 and len(set(actual))==528 and set(actual)==expected
 own=json.loads((e/f'r{n}-owned-schemas-after.json').read_text());assert not own['ownedRemaining']
 q=json.loads((e/f'r{n}-qa-source-proof.json').read_text());assert q['qaSha']==qa and q['applicationSha']==app and len(q['files'])==26 and all(f['matches'] for f in q['files'])
 a=json.loads((e/f'r{n}-application-source-proof.json').read_text());assert a['applicationSha']==app and a['checkedFiles']==1218 and not a['mismatches']
 log=(e/f'{run}.log').read_bytes();ledger={'run':run,'mode':mode,'applicationSha':app,'acceptedIntegrationEvidenceSha':'89409dcdbd4faedccfeec8ee236932191c6195d3','qaSha':qa,'expectedCells':528,'stats':x['stats'],'counts':dict(collections.Counter(r['status'] for r in rows)),'runErrors':x.get('errors',[]),'exitCode':int((e/f'{run}.exit').read_text()),'wrapperTimes':(e/f'{run}.times').read_text().splitlines(),'globalSchemasAfter':int((e/f'{run}-schemas-after.txt').read_text()),'ownedSchemasAfter':0,'rawJsonSha256':hashlib.sha256(raw).hexdigest(),'decodedLogSha256':hashlib.sha256(log).hexdigest(),'cells':rows};prepared.append((n,run,raw,log,ledger))
out.mkdir(parents=True)
for n,run,raw,log,ledger in prepared:
 (out/f'playwright-r{n}.json').write_bytes(safe_bytes(raw,f'playwright-r{n}.json',True));(out/f'playwright-r{n}.log.b64').write_text(base64.b64encode(safe_bytes(log,f'playwright-r{n}.log.b64')).decode()+'\n')
 for name in [f'r{n}-qa-source-proof.json',f'r{n}-application-source-proof.json',f'r{n}-schema-inventory.json',f'r{n}-owned-schemas-after.json',f'r{n}-discovery-validation.json']:
  (out/name).write_bytes(safe_bytes((e/name).read_bytes(),name,True))
 for suffix in ['json','log']:
  p=e/f'{run}-discovery.{suffix}'
  if suffix=='json':(out/f'discovery-r{n}.json').write_bytes(safe_bytes(p.read_bytes(),f'discovery-r{n}.json',True))
  else:(out/f'discovery-r{n}.log.b64').write_text(base64.b64encode(safe_bytes(p.read_bytes(),f'discovery-r{n}.log.b64')).decode()+'\n')
 artroot=e/f'{run}-artifacts';arts=[{'path':str(p.relative_to(artroot)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(artroot.rglob('*')) if p.is_file()];(out/f'r{n}-artifacts.json').write_text(json.dumps({'root':str(artroot),'files':arts},indent=2)+'\n')
 for p in artroot.rglob('*error-context.md'):
  name=f'r{n}-{p.parent.name}-error-context.md.b64';(out/name).write_text(base64.b64encode(safe_bytes(p.read_bytes(),name)).decode()+'\n')
(out/'runs.json').write_bytes(safe_bytes(json.dumps([l for *_,l in prepared],indent=2).encode(),'runs.json',True));(out/'native-and-duration-checkpoints.json').write_bytes(safe_bytes(json.dumps({'qualification':'Native observations and synthetic fixture provenance, not additional passed cases. Individual/aggregate attachments may repeat observations. Each enclosing full-case status stays explicit.','checkpoints':checkpoints},indent=2).encode(),'native-and-duration-checkpoints.json',True))
sanitizer_source=Path(__file__).with_name('sanitize-evidence.py').read_bytes();(out/'sanitizer-source.py').write_bytes(sanitizer_source)
(out/'sanitization-ledger.json').write_text(json.dumps({'collectedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'qualification':'Published reports, CLI logs and error contexts are sanitized copies. Counts and statuses are computed from untouched task-local originals; their original hashes remain in runs.json and this ledger. Full private traces are not published.','sanitizerSourceSha256':hashlib.sha256(sanitizer_source).hexdigest(),'files':redactions},indent=2)+'\n')
print(json.dumps([{'run':l['run'],'counts':l['counts'],'exitCode':l['exitCode'],'runErrorCount':len(l['runErrors']),'globalSchemasAfter':l['globalSchemasAfter']} for *_,l in prepared],indent=2))
