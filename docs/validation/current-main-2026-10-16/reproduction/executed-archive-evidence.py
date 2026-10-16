"""Freeze task-owned raw evidence locally; do not imply durable remote delivery."""
import gzip,hashlib,json,pathlib,subprocess,tarfile
root=pathlib.Path('/workspace/qa-20261016');repo=pathlib.Path('/workspace/klisteniapp');docs=repo/'docs/validation/current-main-2026-10-16'
subprocess.run(['python3',str(root/'package-evidence.py'),'--final'],check=True)
out=pathlib.Path('/workspace/shared/klisteni-current-main-qa-20261016-c4fb918');out.mkdir(exist_ok=False)
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for part in iter(lambda:f.read(1024*1024),b''):h.update(part)
 return h.hexdigest()
def role(label):
 if label.startswith(('selfservice-','extras-')):return 'selfservice'
 if label.startswith('visitor-'):return 'visitor'
 for name in ('member','trainer','anonymous','brand-admin'):
  if label.startswith('b2b-'+name):return name
 if label=='b2c-admin':return label
 return None
roles={k:[] for k in ('selfservice','b2c-admin','visitor','member','trainer','anonymous','brand-admin')}
for path in root.iterdir():
 key=role(path.name)
 if path.is_dir() and key and not path.name.endswith('discovery'):
  roles[key].extend(p for p in path.rglob('*') if p.is_file())
manifest=[];archives=[]
for key,files in roles.items():
 archive=out/(key+'-evidence.tar.gz')
 with tarfile.open(archive,'w:gz',compresslevel=1) as tar:
  for file in sorted(files):
   assert not file.is_symlink(), f'Inspect symlink before archiving: {file}'
   rel=file.relative_to(root);tar.add(file,arcname=str(rel),recursive=False)
   manifest.append({'role':key,'path':str(rel),'bytes':file.stat().st_size,'sha256':sha(file)})
 with gzip.open(archive,'rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):pass
 archives.append({'role':key,'path':str(archive),'bytes':archive.stat().st_size,'sha256':sha(archive),'files':len(files),'gzipValidated':True,'retention':'local task workspace only; no durable remote retrieval or expiry receipt'})
(docs/'raw-evidence-manifest.json').write_text(json.dumps({'localRoot':str(root),'files':manifest},indent=2)+'\n')
(docs/'archives.json').write_text(json.dumps(archives,indent=2)+'\n')
print(json.dumps({'archives':len(archives),'files':len(manifest),'bytes':sum(a['bytes'] for a in archives),'localDirectory':str(out)}))
