import datetime,hashlib,json,subprocess
from pathlib import Path
R=Path('/workspace/wp12-runtime-v12');E=R/'evidence';results=[]
def cells(report):
 out=[]
 def walk(s):
  for spec in s.get('specs',[]):
   for t in spec.get('tests',[]):out.append({'title':spec['title'],'project':t['projectName'],'attempts':len(t['results']),'status':t['results'][-1]['status'],'retry':t['results'][-1]['retry']})
  for x in s.get('suites',[]):walk(x)
 walk(report);return out
for name,dist,expected in [('candidate','/task/app/apps/b2b-web/dist',14),('baseline-control','/baseline/apps/b2b-web/dist',1)]:
 started=datetime.datetime.now(datetime.timezone.utc).isoformat()
 cmd=['docker','exec','-e','B2B_WORKSPACE_LOADING_DIST='+dist,'-e','B2B_WORKSPACE_LOADING_RESULTS=/tmp/wp12-loading-'+name,'-e','PLAYWRIGHT_JSON_OUTPUT_NAME=/task/evidence/loading-'+name+'.json','-w','/task/app/apps/b2c-web','wp12-v12-browser','node','node_modules/@playwright/test/cli.js','test','--config=playwright.workspace-loading.config.ts','--reporter=list,json','--max-failures=0']
 if name=='baseline-control':cmd+=['--project=chromium430','--grep=an unrelated production chunk']
 with (E/('loading-'+name+'.log')).open('w') as log:p=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT)
 x=json.loads((E/('loading-'+name+'.json')).read_text());rows=cells(x);assert len(rows)==expected and not x.get('errors');assert all(r['attempts']==1 and r['retry']==0 for r in rows)
 copied=subprocess.run(['docker','cp','wp12-v12-browser:/tmp/wp12-loading-'+name,str(E/('loading-'+name+'-artifacts'))],capture_output=True);assert copied.returncode==0
 row={'name':name,'startedAt':started,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':p.returncode,'expectedCells':expected,'cells':rows,'stats':x['stats'],'rawJsonSha256':hashlib.sha256((E/('loading-'+name+'.json')).read_bytes()).hexdigest()};results.append(row);print(json.dumps(row),flush=True)
(E/'loading-summary.json').write_text(json.dumps(results,indent=2)+'\n')
assert results[0]['exitCode']==0 and all(x['status']=='passed' for x in results[0]['cells'])
assert results[1]['exitCode']==1 and results[1]['cells'][0]['status']=='failed'
