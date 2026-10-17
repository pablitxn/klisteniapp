import collections,json,re,sys
from pathlib import Path
repo=Path('/workspace/klisteniapp');root=repo/'docs/validation/b2b-product-20261017/WP12'
app=sys.argv[1] if len(sys.argv)>1 else 'a1ade61267506442bea99dd5110d73ed5e503283'
out=Path(sys.argv[2]) if len(sys.argv)>2 else Path('/tmp/wp12-coverage-through-r28')
max_run=int(sys.argv[3]) if len(sys.argv)>3 else 28
ids=sorted({v for f in (repo/'apps/b2c-web/e2e').glob('b2b-product-*.spec.ts') for v in re.findall(r"test\(scenarioTitle\('(B2BP-[A-Z]+-\d+)'\)",f.read_text())})
assert len(ids)==88,len(ids)
engines=['chromium','webkit'];widths=[320,430,1440];modes=['unified-http','white-label-http']
contexts=[(mode,engine,width) for mode in modes for engine in engines for width in widths]
cells={(id,*c):[] for id in ids for c in contexts}
sources=[]
for version in sorted(root.glob('v*'),key=lambda p:int(p.name[1:])):
 for ledger in [version/'runs.json',version/'run.json']:
  if not ledger.exists():continue
  data=json.loads(ledger.read_text());runs=data if isinstance(data,list) else [data]
  for run in runs:
   if run.get('applicationSha')!=app:continue
   n=re.search(r'-r(\d+)$',run['run'])
   if not n or int(n[1])>max_run:continue
   rawpath=version/f'playwright-r{n[1]}.json'
   if not rawpath.exists():raise RuntimeError(rawpath)
   raw=json.loads(rawpath.read_text());project={p['name']:p['metadata']['b2bProduct'] for p in raw['config']['projects']}
   sources.append({'run':run['run'],'runNumber':int(n[1]),'qaSha':run['qaSha'],'receipt':str(ledger.relative_to(repo)),'report':str(rawpath.relative_to(repo)),'startTime':raw['stats']['startTime']})
   def walk(s):
    for spec in s.get('specs',[]):
     id=re.search(r'B2BP-[A-Z]+-\d{3}',spec['title']).group()
     for t in spec.get('tests',[]):
      c=project[t['projectName']]
      key=(id,c['mode'],c['engine'],c['width'])
      for r in t.get('results',[]):
       if r['status']=='skipped':continue
       cells[key].append({'run':run['run'],'runNumber':int(n[1]),'qaSha':run['qaSha'],'status':r['status'],'report':str(rawpath.relative_to(repo))})
    for sub in s.get('suites',[]):walk(sub)
   walk(raw)
for attempts in cells.values(): attempts.sort(key=lambda r:r['runNumber'])
rows=[{'id':id,'mode':mode,'engine':engine,'width':width,'state':attempts[-1]['status'] if attempts else 'neverRun','attempts':attempts} for (id,mode,engine,width),attempts in cells.items()]
summary=[]
for mode,engine,width in contexts:
 counts=collections.Counter(r['state'] for r in rows if (r['mode'],r['engine'],r['width'])==(mode,engine,width))
 summary.append({'mode':mode,'engine':engine,'width':width,'counts':dict(counts)})
obj={'applicationSha':app,'executableScenarios':len(ids),'httpTargetCells':len(rows),'qualification':'Planning inventory of latest observed cell outcomes on this application source across separately pinned QA revisions; not a new run or final acceptance total. Every earlier failure remains in attempts. Earlier application heads are excluded. In-flight/unpublished runs are excluded. neverRun means no actual result in included completed receipts. Trusted HTTPS input block is separate.','sources':sources,'summary':summary,'cells':rows}
out.parent.mkdir(parents=True,exist_ok=True)
out.with_suffix('.json').write_text(json.dumps(obj,indent=2)+'\n')
md=[f'# WP12 HTTP cell ledger at {app[:8]}', '',obj['qualification'],'','Sources: '+', '.join('R'+str(s['runNumber'])+' (`'+s['qaSha'][:8]+'`)' for s in sources)+'.','','| Mode | Engine | Width | Passed | Failed | Timed out | Never run |','| --- | --- | ---: | ---: | ---: | ---: | ---: |']
for r in summary:
 c=r['counts'];md.append(f"| {r['mode']} | {r['engine']} | {r['width']} | {c.get('passed',0)} | {c.get('failed',0)} | {c.get('timedOut',0)} | {c.get('neverRun',0)} |")
md+=['','Each scenario cell is `unified / White Label`: P=passed, F=failed, T=timed out, N=never run. Historical failed attempts stay in the JSON ledger even when a later QA correction passes.','', '| Scenario | Chromium320 | Chromium430 | Chromium1440 | WebKit320 | WebKit430 | WebKit1440 |','| --- | --- | --- | --- | --- | --- | --- |']
code={'passed':'P','failed':'F','timedOut':'T','neverRun':'N','interrupted':'I'}
lookup={(r['id'],r['mode'],r['engine'],r['width']):r for r in rows}
for id in ids:
 vals=[' / '.join(code[lookup[(id,m,e,w)]['state']] for m in modes) for e in engines for w in widths]
 md.append('| '+id+' | '+' | '.join(vals)+' |')
out.with_suffix('.md').write_text('\n'.join(md)+'\n')
print(json.dumps({'applicationSha':app,'sourceRuns':[s['runNumber'] for s in sources],'uniqueCellStatesForPlanning':dict(collections.Counter(r['state'] for r in rows)),'contextSummary':summary,'out':str(out)},indent=2))
