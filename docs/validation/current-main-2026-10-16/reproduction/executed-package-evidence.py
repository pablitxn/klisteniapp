"""Package small review evidence; raw traces remain local and explicitly scoped."""
import collections,hashlib,json,pathlib,shutil,subprocess,sys
root=pathlib.Path('/workspace/qa-20261016');dst=pathlib.Path('/workspace/klisteniapp/docs/validation/current-main-2026-10-16')
subprocess.run(['python3',str(root/'summarize.py')],check=True,stdout=subprocess.DEVNULL)
data=json.loads((root/'browser-attempts.json').read_text())
def role(c):
 label=c['run']
 for name in ('member','trainer','anonymous','brand-admin'):
  if label.startswith('b2b-'+name):return 'b2b-'+name
 return 'selfservice' if label.startswith(('selfservice','extras')) else 'visitor-instance' if label.startswith('visitor-instance') else 'visitor-demo' if label.startswith('visitor-demo') else label.removesuffix('-fixed')
latest={}
for c in sorted(data['cases'],key=lambda c:(c.get('runStartedAt') or '',c.get('startedAt') or '')): latest[(role(c),c['project'],c['file'],c['title'])]=c
expected={'selfservice':288,'b2c-admin':84,'visitor-demo':108,'visitor-instance':108,'b2b-member':96,'b2b-trainer':120,'b2b-anonymous':252,'b2b-brand-admin':162}
rows={}
for key,count in expected.items():
 group=[c for c in latest.values() if role(c)==key]
 rows[key]={'expected':count,'observed':len(group),'outcomes':dict(collections.Counter(c['status'] for c in group))}
complete=all(r['observed']==r['expected'] and r['outcomes']=={'passed':r['expected']} for r in rows.values())
if '--final' in sys.argv: assert complete,rows
summary={'productBaseRevision':'1258642b4543b6acc598d6e72ccf1c50e75b7a67','testedRevisions':sorted(set(c['testedRevision'] for c in data['cases'])),'status':'pass' if complete else 'in-progress','browserRoles':rows,'uniqueCases':len(latest),'latestOutcomes':dict(collections.Counter(c['status'] for c in latest.values())),'methods':dict(collections.Counter(c['method'] for c in latest.values())),'attempts':len(data['cases']),'failedAttempts':sum(c['status'] in ('failed','timedOut') for c in data['cases']),'interruptedAttempts':sum(c['status']=='interrupted' for c in data['cases']),'skippedAttempts':sum(c['status']=='skipped' for c in data['cases']),'launchFailures':sum(c['launchFailure'] for c in data['cases']),'reports':data['reports'],'releaseGate':'fail: pre-existing Yoga extraction receipt','coverageNote':'Consolidated serial runs on the same product revision, including explicit manual environment retries; not one monolithic all-green execution.'}
(dst/'results.json').write_text(json.dumps(summary,indent=2)+'\n')
with (dst/'case-attempts.jsonl').open('w') as out:
 for c in data['cases']:out.write(json.dumps(c,separators=(',',':'),ensure_ascii=False)+'\n')
for name in ['checks.json','gaps.json','yoga-audit.json','inputs.json','database-receipt.json','browser-environment.json','setup-attempts.json','source-delta.json','ci-tested-head.json','ci-checkpoint-head.json','resume-health.json','completed-role-checkpoint.json','relay-ready.json','relay-controls.json']:
 shutil.copyfile(root/name,dst/name)
logs=dst/'logs';logs.mkdir(exist_ok=True)
for path in sorted(root.glob('*.log')):
 shutil.copyfile(path,logs/(path.stem+'.txt'))
checks=json.loads((dst/'checks.json').read_text())
for check in checks:
 if 'log' in check:check['originalLog']=check['log'];check['log']='logs/'+pathlib.Path(check['log']).stem+'.txt'
(dst/'checks.json').write_text(json.dumps(checks,indent=2)+'\n')
print(json.dumps({'complete':complete,'latest':summary['latestOutcomes'],'methods':summary['methods'],'reports':len(data['reports'])}))
