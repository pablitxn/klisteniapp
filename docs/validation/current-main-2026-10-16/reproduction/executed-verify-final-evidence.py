import collections,hashlib,json,pathlib,re,subprocess,datetime
repo=pathlib.Path('/workspace/klisteniapp');root=pathlib.Path('/workspace/qa-20261016');docs=repo/'docs/validation/current-main-2026-10-16'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
r=json.loads((docs/'results.json').read_text());assert r['status']=='pass' and r['uniqueCases']==1218 and r['latestOutcomes']=={'passed':1218},r
for p in docs.glob('*.json'):json.loads(p.read_text())
for a in json.loads((docs/'gaps.json').read_text())['historicalArchives']:assert a['status']=='missing' and not pathlib.Path(a['file']).exists(),a['file']
cases=[json.loads(s) for s in (docs/'case-attempts.jsonl').read_text().splitlines()];assert len(cases)==r['attempts']
for c in json.loads((docs/'review-captures.json').read_text()):
 p=docs/'captures'/c['file'];assert p.stat().st_size==c['bytes'] and sha(p)==c['sha256'],p
 assert sha(root/c['source'])==c['sha256'],c['source']
for c in json.loads((docs/'checks.json').read_text()):
 if 'logSha256' in c:assert sha(docs/c['log'])==c['logSha256'],c['log']
for f in json.loads((docs/'inputs.json').read_text())['files']:assert sha(repo/f['path'])==f['sha256'],f['path']
for f in json.loads((docs/'raw-evidence-manifest.json').read_text())['files']:
 p=root/f['path'];assert p.stat().st_size==f['bytes'] and sha(p)==f['sha256'],p
for a in json.loads((docs/'archives.json').read_text()):
 p=pathlib.Path(a['path']);assert p.stat().st_size==a['bytes'] and sha(p)==a['sha256'],p
for report in r['reports']:assert sha(root/report['run']/'report.json')==report['reportSha256'],report['run']
owned=[repo/'docs/README.md',repo/'docs/integration/qa-20261013/README.md',*sorted((repo/'docs/integration/qa-20261013/fichas').glob('*.md')),repo/'docs/integration/qa-20261016/intake.md',docs/'README.md',docs/'reproduction/README.md']
links=0
for p in owned:
 for target in re.findall(r'(?<!!)\[[^\]]*\]\(([^)]+)\)',p.read_text()):
  target=target.split('#')[0]
  if not target or re.match(r'[a-z]+:',target):continue
  assert (p.parent/target).exists(),(p,target)
  links+=1
changed=subprocess.check_output(['git','diff','--name-only',r['productBaseRevision'],'HEAD'],cwd=repo,text=True).splitlines()
source=[p for p in changed if not p.startswith('docs/')]
assert source==['apps/b2c-web/e2e/brand-admin.spec.ts','apps/b2c-web/e2e/member-qa.spec.ts'],source
assert not subprocess.check_output(['git','diff','c4fb918498d07b3d7bd43cf0adec8c65983ddb4d','HEAD','--','apps','packages','scripts','package.json','pnpm-lock.yaml'],cwd=repo), 'non-documentation change after tested fix'
print(json.dumps({'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'pass','jsonDocuments':len(list(docs.glob('*.json'))),'caseRecords':len(cases),'reviewCaptures':7,'relativeLinks':links,'sourceChanges':source,'rawOutcomes':dict(collections.Counter(c['status'] for c in cases)),'failedCategories':dict(collections.Counter(c['category'] for c in cases if c['status'] in ('failed','timedOut')))},indent=2))
