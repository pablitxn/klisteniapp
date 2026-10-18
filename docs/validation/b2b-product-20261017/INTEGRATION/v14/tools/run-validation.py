from pathlib import Path
import collections, concurrent.futures, datetime, hashlib, json, subprocess, time
ROOT=Path('/tmp/klisteni-readiness-runtime'); APP=ROOT/'app'; E=ROOT/'evidence'
BROWSER='klisteni-readiness-browser-v1'; PG='klisteni-readiness-pg-v1'
PROJECTS=['product-chromium-320','product-chromium-430','product-chromium-desktop','product-webkit-320','product-webkit-430','product-webkit-desktop']
TARGETS=['B2BP-SYNC-002','B2BP-HEALTH-002','B2BP-WEEK-009']
REGRESSIONS=['B2BP-HISTORY-001','B2BP-HISTORY-002','B2BP-HISTORY-009','B2BP-WEEK-008','B2BP-SYNC-006','B2BP-INACTIVE-003']
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def save(path,value):path.write_text(json.dumps(value,indent=2)+'\n')
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def prove(label):
 proof=json.loads((ROOT/'candidate-source-proof.json').read_text());built=json.loads((ROOT/'fresh-build-proof.json').read_text())
 entries=proof['files']+built['files']; mismatches=[v['path'] for v in entries if digest(APP/v['path'])!=v['sha256']]
 save(E/(label+'-source-verification.json'),{'at':now(),'candidateSha':proof['candidateSha'],'checked':len(entries),'mismatches':mismatches})
 assert not mismatches
 return proof['candidateSha']
def rows(report):
 out=[]
 def walk(s):
  for spec in s.get('specs',[]):
   for test in spec.get('tests',[]):
    results=test.get('results',[])
    out.append({'instanceId':spec['id'],'id':spec['title'].split()[0],'title':spec['title'],'project':test['projectName'],'results':results,'status':results[-1]['status'] if results else 'notExecuted'})
  for child in s.get('suites',[]):walk(child)
 walk(report);return out
def inventory(label,mode):
 port=5600 if mode=='unified' else 5700
 js="const http=require('http');Promise.all(Array.from({length:6},(_,i)=>new Promise((ok,no)=>{http.get('http://127.0.0.1:'+process.argv[1]+'/fixtures?project='+i,r=>{let s='';r.on('data',b=>s+=b);r.on('end',()=>{try{const x=JSON.parse(s);ok({project:i,schema:x.schema,phase:x.phase,featuresActivated:x.featuresActivated})}catch(e){no(e)}})}).on('error',no)}))).then(x=>process.stdout.write(JSON.stringify(x)))"
 r=subprocess.run(['docker','exec',BROWSER,'node','-e',js,str(port)],capture_output=True,text=True,timeout=10)
 if r.returncode:return False
 value=json.loads(r.stdout)
 assert len(value)==len({x['schema'] for x in value})==6
 save(E/(label+'-live-schemas.json'),{'at':now(),'mode':mode,'schemas':value});return True
def cleanup(label):
 schemas=json.loads((E/(label+'-live-schemas.json')).read_text())['schemas'];owned={x['schema'] for x in schemas}
 names=set(subprocess.check_output(['docker','exec',PG,'psql','-U','readiness','-d','klisteni_b2b_readiness_test','-Atc',"select schema_name from information_schema.schemata where schema_name like 'b2b_product_browser_%'"],text=True).splitlines())
 save(E/(label+'-cleanup.json'),{'at':now(),'owned':sorted(owned),'ownedRemaining':sorted(owned&names),'allBrowserSchemaCount':len(names),'manualCleanup':False});assert not owned&names

def execute(mode,phase,ids,projects):
 label=phase+'-'+mode
 pin=prove(label+'-before')
 config='playwright.b2b-product-'+mode+'.config.ts'
 base=['docker','exec','-e',f'B2B_PRODUCT_OUTPUT=/tmp/readiness-evidence/{label}','-e',f'PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/readiness-evidence/{label}.raw.json','-w','/task/app/apps/b2c-web',BROWSER,'node','node_modules/@playwright/test/cli.js','test',f'--config={config}','--grep','('+'|'.join(ids)+') ','--workers=1','--retries=0']+[f'--project={p}' for p in projects]
 discovery=base+['--list','--reporter=json']
 with (E/(label+'-discovery.log')).open('w') as log:r=subprocess.run(discovery,stdout=log,stderr=subprocess.STDOUT)
 assert r.returncode==0
 report=json.loads((E/(label+'.raw.json')).read_text()); found=rows(report)
 want=collections.Counter((i,p) for i in ids for p in projects)
 assert collections.Counter((x['id'],x['project']) for x in found)==want
 assert report['config']['workers']==1 and all(p['retries']==0 for p in report['config']['projects'])
 assert report['config'].get('maxFailures',0)==0
 save(E/(label+'-discovery.json'),{'at':now(),'candidateSha':pin,'mode':mode,'phase':phase,'count':len(found),'ids':ids,'projects':projects,'workers':1,'retries':0,'failureCap':None})
 started=now();captured=False
 with (E/(label+'.raw.log')).open('w') as log:
  process=subprocess.Popen(base+['--reporter=list,json'],stdout=log,stderr=subprocess.STDOUT)
  save(E/(label+'-state.json'),{'at':started,'phase':'running','hostPid':process.pid,'candidateSha':pin})
  while process.poll() is None:
   if not captured:captured=inventory(label,mode)
   time.sleep(3)
  code=process.wait()
 assert captured,'No live schema inventory captured'
 cleanup(label);prove(label+'-after')
 report=json.loads((E/(label+'.raw.json')).read_text());actual=rows(report)
 assert collections.Counter((x['id'],x['project']) for x in actual)==want
 assert all(len(x['results'])==1 and x['results'][0]['retry']==0 for x in actual)
 assert not report.get('errors')
 safe=[]; observations=[]
 for x in actual:
  r=x['results'][0]
  safe.append({k:v for k,v in x.items() if k!='results'}|{'retry':r['retry'],'startTime':r['startTime'],'duration':r['duration'],'errors':r.get('errors',[])})
  for a in r.get('attachments',[]):
   if a['name'].startswith('product-readiness-') and a.get('body'):
    import base64
    observations.append({'id':x['id'],'project':x['project'],'observation':json.loads(base64.b64decode(a['body']))})
 save(E/(label+'-cells.json'),safe);save(E/(label+'-readiness.json'),observations)
 summary={'startedAt':started,'finishedAt':now(),'candidateSha':pin,'mode':mode,'phase':phase,'attempted':len(actual),'counts':dict(collections.Counter(x['status'] for x in actual)),'exitCode':code,'retries':0,'failureCap':None,'ownedRemaining':0,'rawReportSha256':digest(E/(label+'.raw.json')),'rawLogSha256':digest(E/(label+'.raw.log'))}
 save(E/(label+'-summary.json'),summary);save(E/(label+'-state.json'),{'at':now(),'phase':'complete'});print(json.dumps(summary),flush=True)
 return summary
if __name__=='__main__':
 all_results=[]
 for round in range(1,4):
  with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
   futures=[pool.submit(execute,m,'affected-r'+str(round),TARGETS,PROJECTS) for m in ['unified','wl-http']]
   values=[f.result() for f in futures];all_results.extend(values)
  if any(v['counts']!={'passed':18} for v in values):
   save(E/'terminal-summary.json',{'at':now(),'status':'affected-failure-investigate','runs':all_results});raise SystemExit(1)
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  futures=[pool.submit(execute,m,'regression',REGRESSIONS,['product-chromium-desktop','product-webkit-430']) for m in ['unified','wl-http']]
  all_results.extend(f.result() for f in futures)
 save(E/'terminal-summary.json',{'at':now(),'status':'complete','runs':all_results,'qualification':'Targeted/repeated and supporting regression runs only. Full same-pin HTTP matrix and trusted HTTPS remain separate.'})
