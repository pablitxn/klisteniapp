import collections,datetime,json,runpy,subprocess
from pathlib import Path
r=Path('/workspace/wp12-runtime-v11');e=r/'evidence';ns=runpy.run_path(str(r/'run-accepted.py'));ns['prove'](73,'before')
cmd=['docker','exec','-e','PLAYWRIGHT_JSON_OUTPUT_NAME=/task/evidence/helper-contracts.json','-w','/task/app/apps/b2c-web','wp12-v11-browser','node','node_modules/@playwright/test/cli.js','test','--config=playwright.product-readiness.config.ts','--reporter=list,json']
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
with (e/'helper-contracts.log').open('w') as f:x=subprocess.run(cmd,stdout=f,stderr=subprocess.STDOUT)
ns['prove'](73,'after');report=json.loads((e/'helper-contracts.json').read_text());results=[]
def walk(s):
 for sp in s.get('specs',[]):
  for t in sp.get('tests',[]):
   assert len(t['results'])==1
   v=t['results'][0];results.append({'title':sp['title'],'project':t['projectName'],'status':v['status'],'retry':v['retry'],'startTime':v['startTime'],'duration':v['duration']})
 for c in s.get('suites',[]):walk(c)
for s in report['suites']:walk(s)
assert len(results)==8 and not report.get('errors') and all(v['retry']==0 for v in results)
summary={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'startedAt':started,'applicationSha':ns['APP'],'qaSha':ns['QA'],'exitCode':x.returncode,'counts':dict(collections.Counter(v['status'] for v in results)),'actualInstances':results,'qualification':'Fresh synthetic DOM helper contracts in real browsers, separate from product matrices. Expected predicate/deadline rejections are asserted contract behavior, not timed-out product cases.'};(e/'helper-contracts-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary));assert x.returncode==0 and summary['counts']=={'passed':8}
