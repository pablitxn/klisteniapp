import datetime,json,subprocess
from pathlib import Path
R=Path('/workspace/wp12-runtime-v12');E=R/'evidence';c='wp12-v12-browser'
checks=[('ui-state-tests',['node','--test',*['apps/b2b-web/tests/'+x+'.test.ts' for x in ['navigation-state','localWorkoutFlush','workoutSelection','workoutRecovery','restrictedAccess','product-stream-guard','healthConsentState']]]),('gateway-tests',['node','--test','scripts/b2b-gateway.test.mjs']),('ui-typecheck',['node','node_modules/typescript/bin/tsc','--noEmit','-p','apps/b2b-web/tsconfig.json']),('browser-typecheck',['node','node_modules/typescript/bin/tsc','--noEmit','--target','ES2022','--module','ESNext','--moduleResolution','bundler','--strict','--skipLibCheck','--types','node','apps/b2c-web/playwright.workspace-loading.config.ts','apps/b2c-web/test/workspace-loading/workspace-loading.spec.ts']),('boundaries',['node','scripts/check-b2b-boundaries.mjs']),('gateway-syntax',['node','--check','scripts/b2b-static-files.mjs'])]
results=[]
for name,cmd in checks:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat()
 with (E/(name+'.log')).open('w') as log:p=subprocess.run(['docker','exec','-w','/task/app',c,*cmd],stdout=log,stderr=subprocess.STDOUT)
 row={'name':name,'exitCode':p.returncode,'startedAt':start,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()};results.append(row);print(json.dumps(row),flush=True)
(E/'checks.json').write_text(json.dumps(results,indent=2)+'\n');assert all(x['exitCode']==0 for x in results)
