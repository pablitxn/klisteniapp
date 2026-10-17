from pathlib import Path
import subprocess,json,os
os.environ['COREPACK_HOME']='/workspace/.cache/corepack'
commands=[('web','--filter @klisteniapp/b2b-web test'),('typecheck','typecheck'),('lint','lint'),('boundaries','check:b2b:boundaries'),('build-b2b','build:b2b')]
results=[]
for name,cmd in commands:
 with open('/workspace/wp09-tools/correction-v6/'+name+'.log','w') as log:
  result=subprocess.run('corepack pnpm@12.7.0 '+cmd,shell=True,cwd='/workspace/wp09-correction-efbed',stdout=log,stderr=subprocess.STDOUT)
 results.append({'command':'corepack pnpm@12.7.0 '+cmd,'exitCode':result.returncode})
 Path('/workspace/wp09-tools/correction-v6/results.json').write_text(json.dumps(results,indent=2)+'\n')
