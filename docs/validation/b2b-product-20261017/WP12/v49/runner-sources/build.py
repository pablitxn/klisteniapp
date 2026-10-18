import datetime,hashlib,json,subprocess
from pathlib import Path
R=Path('/workspace/wp12-runtime-v12');E=R/'evidence';results=[]
for app in ['b2b-web','b2c-web']:
 with (E/f'fresh-{app[:3]}-build.log').open('w') as log:
  x=subprocess.run(['docker','exec','-w','/task/app/apps/'+app,'wp12-v12-browser','node','node_modules/vite/bin/vite.js','build'],stdout=log,stderr=subprocess.STDOUT)
 results.append({'application':app,'exitCode':x.returncode});print(json.dumps(results[-1]),flush=True);assert x.returncode==0
files=[]
for app in ['b2b-web','b2c-web']:
 for p in sorted((R/'app/apps'/app/'dist').rglob('*')):
  if p.is_file():files.append({'path':str(p.relative_to(R/'app')),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
assert files
(E/'fresh-build-proof.json').write_text(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'applicationSha':'3f8ccba573c08045c809dc73c186158878a2dafa','qaSha':'831203470d4c21322b8bc3ce7c4dedb7f84fe5d7','builds':results,'files':files,'qualification':'Fresh Vite CLI builds in the new isolated source export, not retained historical bundles.'},indent=2)+'\n');print(json.dumps({'freshBuiltFiles':len(files)}),flush=True)
