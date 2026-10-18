from pathlib import Path
import subprocess,os,json,hashlib,time,sys
base=Path('/tmp/klisteni-readiness-runtime');app=base/'app';name=sys.argv[1]
assert name in ['b2b-web','b2c-web']
receipt=json.loads((base/'snapshot-setup.json').read_text());assert not receipt['productionMismatches']
env={k:os.environ[k] for k in ['PATH','HOME','LANG','TMPDIR'] if k in os.environ}
env.update(VITE_APP_MODE='instance',KLISTENI_PUBLIC_PROFILE_FILE='instance-profile.example.json',CI='1',DO_NOT_TRACK='1',TURBO_TELEMETRY_DISABLED='1')
cmd=['node','node_modules/vite/bin/vite.js','build'];started=time.monotonic()
with (base/(name+'-build.log')).open('w') as log:r=subprocess.run(cmd,cwd=app/'apps'/name,env=env,stdout=log,stderr=subprocess.STDOUT)
files={}
if r.returncode==0:
 for p in sorted((app/'apps'/name/'dist').rglob('*')):
  if p.is_file():
   h=hashlib.sha256()
   with p.open('rb') as f:
    while chunk:=f.read(1024*1024):h.update(chunk)
   files[str(p.relative_to(app))]=h.hexdigest()
result={'app':name,'command':cmd,'cwd':str(app/'apps'/name),'exitCode':r.returncode,'durationSeconds':round(time.monotonic()-started,3),'node':subprocess.check_output(['node','--version'],text=True).strip(),'buildMode':'instance; repository example public profile','productionMatches':'d2adf75d3fee18740ef38632a361c91203d77dc6','outputFiles':len(files),'qualification':'Fresh task snapshot build only; QA source remains provisional until parent freeze/refresh.'}
(base/(name+'-build.json')).write_text(json.dumps(result,indent=2)+'\n');(base/(name+'-dist-sha256.json')).write_text(json.dumps(files,indent=2)+'\n')
print(json.dumps(result));sys.exit(r.returncode)
