import collections,hashlib,json,re,subprocess
from pathlib import Path
R=Path('/workspace/wp12-runtime-v11');b=R/'review/docs/validation/b2b-product-20261017/INTEGRATION/v14';repo=Path('/workspace/klisteniapp');product='c8a5aaa5fab4206a646a644601481713d42f4a65';qa='831203470d4c21322b8bc3ce7c4dedb7f84fe5d7';rows=[];schemas=[];runs=[]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def leaves(report):
 out=[]
 def walk(s):
  for sp in s.get('specs',[]):
   for t in sp.get('tests',[]):
    assert len(t['results'])==1;r=t['results'][0];out.append((sp['id'],re.match(r'B2BP-[A-Z]+-\d{3}',sp['title'])[0],t['projectName'],r['status'],r['retry'],r['startTime'],r['duration']))
  for c in s.get('suites',[]):walk(c)
 for s in report['suites']:walk(s)
 return out
for p in sorted((b/'runs').glob('*-summary.json')):
 if p.name=='terminal-summary.json':continue
 name=p.name.removesuffix('-summary.json');s=json.loads(p.read_text());raw=b/'runs'/f'{name}.raw.json';report=json.loads(raw.read_text());actual=leaves(report);declared=json.loads((b/'runs'/f'{name}-cells.json').read_text());tuples=[(x['instanceId'],x['id'],x['project'],x['status'],x['retry'],x['startTime'],x['duration']) for x in declared];assert actual==tuples;assert all(x[3]=='passed' and x[4]==0 for x in actual);assert len(actual)==s['attempted'];assert digest(raw)==s['rawReportSha256'];assert digest(b/'runs'/f'{name}.raw.log')==s['rawLogSha256'];assert s['candidateSha']==product and s['exitCode']==0 and not report.get('errors')
 live=json.loads((b/'runs'/f'{name}-live-schemas.json').read_text());owned={x['schema'] for x in live['schemas']};clean=json.loads((b/'runs'/f'{name}-cleanup.json').read_text());assert len(owned)==6 and owned==set(clean['owned']);assert not clean['ownedRemaining'] and not clean['manualCleanup'];schemas.extend(owned)
 for phase in ['before','after']:
  x=json.loads((b/'runs'/f'{name}-{phase}-source-verification.json').read_text());assert x['candidateSha']==product and x['checked']==2132 and not x['mismatches']
 rows.extend((name,*x) for x in actual);runs.append({'name':name,'cells':len(actual),'schemas':len(owned)})
assert len(rows)==132 and len(schemas)==len(set(schemas))==48
published=json.loads((b/'actual-instances.json').read_text());assert collections.Counter((x['run'],x['instanceId'],x['id'],x['project'],x['status'],x['retry'],x['startTime'],x['duration']) for x in published)==collections.Counter(rows)
files=json.loads((b/'candidate-source-proof.json').read_text())['files'];batch=subprocess.Popen(['git','cat-file','--batch'],cwd=repo,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
for f in files:
 batch.stdin.write((product+':'+f['path']+'\n').encode());batch.stdin.flush();header=batch.stdout.readline().decode().strip().split();assert header[-1]!='missing';size=int(header[-1]);data=batch.stdout.read(size);assert batch.stdout.read(1)==b'\n';assert hashlib.sha256(data).hexdigest()==f['sha256'],f['path']
batch.stdin.close();assert batch.wait()==0
changes=subprocess.check_output(['git','diff','--name-status','--find-renames',product,qa],cwd=repo,text=True).splitlines();assert len(changes)==2 and all('playwright.product-readiness.config.ts' in x or 'readiness.spec.ts' in x for x in changes)
old=subprocess.check_output(['git','show',product+':apps/b2c-web/e2e/support/product-readiness.contract.spec.ts'],cwd=repo).decode();new=subprocess.check_output(['git','show',qa+':apps/b2c-web/test/browser-readiness/readiness.spec.ts'],cwd=repo).decode();assert old.replace("'../fixtures/b2b-product/readiness'","'../../e2e/fixtures/b2b-product/readiness'")==new
contracts=json.loads((b/'runs/contracts-final-v2.raw.json').read_text());ct=leaves(contracts) if False else []
def results(s):
 for sp in s.get('specs',[]):
  for t in sp.get('tests',[]):
   assert len(t['results'])==1
   yield t['results'][0]
 for child in s.get('suites',[]):yield from results(child)
ct=[x for s in contracts['suites'] for x in results(s)];assert len(ct)==8 and all(x['status']=='passed' and x['retry']==0 for x in ct)
x={'verifiedAt':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'evidenceSha':'f89edc6bf78d91f01d29ac9c34c6f25587d7a526','productExecutionSha':product,'finalQaSha':qa,'rawProductRowsMatched':len(rows),'runs':runs,'distinctSchemasWithCleanup':len(schemas),'sourceGitBlobsVerified':len(files),'standaloneFinalResultsMatched':len(ct),'applicabilityChanges':changes,'sourceApplicabilityAccepted':True,'mismatches':[],'qualification':'Independent immutable-Git/receipt audit of supplied evidence; not fresh product executions.'};(R/'evidence/independent-v14-audit.json').write_text(json.dumps(x,indent=2)+'\n');print(json.dumps(x))
