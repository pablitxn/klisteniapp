import datetime,hashlib,io,json,subprocess,tarfile
from pathlib import Path
R=Path('/workspace/wp12-runtime-v12');E=R/'evidence';repo=Path('/workspace/klisteniapp');app='3f8ccba573c08045c809dc73c186158878a2dafa';qa='831203470d4c21322b8bc3ce7c4dedb7f84fe5d7';head='76dcab2d28bd58072dc492bf6a994eb4995896e4';stage=R/'source-stage';stage.mkdir()
paths=[p for p in subprocess.check_output(['git','ls-tree','-rz','--name-only',app],cwd=repo).decode().split('\0') if p and ('/' not in p or p.startswith(('apps/','packages/','scripts/')))]
raw=subprocess.check_output(['git','archive',app,'--',*paths],cwd=repo)
with tarfile.open(fileobj=io.BytesIO(raw)) as t:t.extractall(stage,filter='data')
qfiles=[f['path'] for f in json.loads(Path('/workspace/wp12-runtime-v11/evidence/source-proof.json').read_text())['qaFiles']];assert len(qfiles)==30
appfiles=[];qrows=[]
for p in paths:
 f=stage/p
 if not f.is_file():continue
 data=f.read_bytes();row={'path':p,'sha256':hashlib.sha256(data).hexdigest()}
 assert subprocess.check_output(['git','show',head+':'+p],cwd=repo)==data,p
 if p in qfiles:
  assert subprocess.check_output(['git','show',qa+':'+p],cwd=repo)==data,p;qrows.append(row)
 else:appfiles.append(row)
assert len(qrows)==30
old=Path('/workspace/wp12-runtime-v7/app');fields=['dependencies','devDependencies','peerDependencies','optionalDependencies','pnpm','packageManager','engines'];packages=[]
for p in [stage/'package.json',*stage.glob('apps/*/package.json'),*stage.glob('packages/*/package.json')]:
 rel=p.relative_to(stage);a=json.loads(p.read_text());b=json.loads((old/rel).read_text());assert all(a.get(k)==b.get(k) for k in fields),str(rel);packages.append(str(rel))
for name in ['pnpm-lock.yaml','pnpm-workspace.yaml']:assert (stage/name).read_bytes()==(old/name).read_bytes()
(E/'source-proof.json').write_text(json.dumps({'applicationSha':app,'qaSha':qa,'candidateDocumentationSha':head,'acceptedIntegrationEvidenceSha':head,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'applicationFileCount':len(appfiles),'qaFileCount':len(qrows),'applicationFiles':appfiles,'qaFiles':qrows,'qualification':'Exact candidate source3f8ccba, also identical at evidence-only head76dcab2. All30existing product-QA/helper/config/regression files independently match accepted QA8312034. New app/unit/standalone tests are candidate inputs; no runtime/QA source altered by this task.','frozenDependencies':{'lockfileAndWorkspaceBytesIdentical':True,'dependencySectionsIdenticalForManifests':packages,'externalDependencySource':'read-only /workspace/wp12-runtime-v7/app; workspace links rebound to candidate'}},indent=2)+'\n')
with tarfile.open(R/'source.tar','w') as t:
 for p in sorted(stage.rglob('*')):
  if p.is_file():t.add(p,arcname=str(p.relative_to(stage)),recursive=False)
(E/'source-archive.json').write_text(json.dumps({'sha256':hashlib.sha256((R/'source.tar').read_bytes()).hexdigest(),'bytes':(R/'source.tar').stat().st_size},indent=2)+'\n');(R/'link-dependencies.cjs').write_bytes(Path('/workspace/wp12-runtime-v11/link-dependencies.cjs').read_bytes());(R/'source.tar').chmod(0o644);(R/'link-dependencies.cjs').chmod(0o644);R.chmod(0o777);E.chmod(0o777)
prefix='docs/validation/b2b-product-20261017/INTEGRATION/v15';raw=subprocess.check_output(['git','archive',head,'--',prefix],cwd=repo)
with tarfile.open(fileobj=io.BytesIO(raw)) as t:t.extractall(R/'review',filter='data')
print(json.dumps({'candidateApp':app,'qa':qa,'appInputs':len(appfiles),'qaInputs':len(qrows),'candidateCodeIdenticalAtDocumentationHead':True,'allProductQaBytesUnchanged':True,'dependencyManifests':len(packages)}))
