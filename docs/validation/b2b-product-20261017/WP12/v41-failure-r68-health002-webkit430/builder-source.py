import base64,datetime,hashlib,json,shutil,subprocess,zipfile
from pathlib import Path
from urllib.parse import urlsplit
R=Path('/workspace/wp12-runtime-v10');E=R/'evidence';private=E/'r68-b2bp-health-002-product-webkit-430-e06e83a56b-verified';repo=Path('/workspace/klisteniapp');out=repo/'docs/validation/b2b-product-20261017/WP12/v41-failure-r68-health002-webkit430';assert not out.exists();assert not subprocess.check_output(['git','status','--porcelain'],cwd=repo,text=True).strip()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
with zipfile.ZipFile(private/'trace.zip') as z:
 test=[json.loads(l) for l in z.read('test.trace').splitlines()];browser=[json.loads(l) for l in z.read('3-trace.trace').splitlines()]
 tb=next(x for x in test if x.get('callId')=='expect@121' and x['type']=='before');ta=next(x for x in test if x.get('callId')=='expect@121' and x['type']=='after');bb=next(x for x in browser if x.get('callId')=='call@2541' and x['type']=='before');ba=next(x for x in browser if x.get('callId')=='call@2541' and x['type']=='after');frames=[]
 for x in browser:
  if x.get('type')=='frame-snapshot':
   s=x['snapshot'];h=json.dumps(s.get('html'),ensure_ascii=False)
   if s.get('timestamp',0)>=bb['startTime']:frames.append({'timestamp':s['timestamp'],'mainFrame':s.get('isMainFrame'),'navigationDomLiteralPresent':'Secciones del gimnasio' in h,'gateCheckingLiteralPresent':'Verificando tu acceso actual' in h})
 access=[]
 for l in z.read('3-trace.network').splitlines():
  s=json.loads(l).get('snapshot',{});request=s.get('request',{});path=urlsplit(request.get('url','')).path
  if path.endswith('/product/v2/access'):
   headers={h['name'].lower():h['value'] for h in request.get('headers',[])};access.append({'path':path,'selectedRole':headers.get('x-klisteni-b2b-role'),'status':s.get('response',{}).get('status'),'rawMonotonicTime':s.get('_monotonicTime'),'rawTime':s.get('time'),'startedDateTime':s.get('startedDateTime')})
proof={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'run':68,'mode':'white-label-http','id':'B2BP-HEALTH-002','project':'product-webkit-430','applicationSha':'d2adf75d3fee18740ef38632a361c91203d77dc6','qaSha':'4ec0273151194acb189ac6ed327033d66366dbd5','status':'failed','retry':0,'assertion':{'file':'apps/b2c-web/e2e/fixtures/b2b-product/app-fixture.ts','line':294,'selector':'navigation, exact accessible name Secciones del gimnasio','timeoutMs':5000,'testTraceStart':tb['startTime'],'testTraceEnd':ta['endTime'],'browserTraceStart':bb['startTime'],'browserTraceEnd':ba['endTime'],'testTraceStack':tb.get('stack',[])},'retainedFrames':frames,'accessNetworkEntries':access,'privateTraceSha256':sha(private/'trace.zip'),'qualification':'Literal DOM membership in retained snapshots is not a later visibility assertion or a passing case. Network monotonicTime/time are retained raw fields; no body-completion ordering inferred. Product or harness root cause remains unproven. Full matrices continue uncapped and unchanged.'}
source=json.loads((E/'source-proof.json').read_text());build=json.loads((E/'fresh-build-proof.json').read_text());files=source['applicationFiles']+source['qaFiles']+build['files'];assert all(sha(R/'app'/f['path'])==f['sha256'] for f in files);proof['sourceAndBuiltFilesReverified']=len(files);proof['sourceMismatches']=[]
out.mkdir();save(out/'diagnosis.json',proof);shutil.copyfile(private/'capture-proof.json',out/'capture-proof.json');(out/'error-context.sanitized.md.b64').write_bytes(base64.b64encode((private/'error-context.sanitized.md').read_bytes())+b'\n');(out/'builder-source.py').write_bytes(Path(__file__).read_bytes())
(out/'README.md').write_text('''# R68 HEALTH-002 failure: White Label WebKit 430

Application `d2adf75d3fee18740ef38632a361c91203d77dc6`; QA `4ec0273151194acb189ac6ed327033d66366dbd5`.

The actual complete HEALTH-002 instance failed, without retry, at the unchanged login helper's five-second navigation visibility check (`app-fixture.ts:294`) while an admin work context was being admitted. The failure snapshot shows the current-access verification gate. This is an actual failed cell; remaining health-denial assertions after the failing login were not completed and are not credited as passes.

The browser assertion began at 7540765.079 ms and ended with failure at 7546421.869 ms. The retained main-frame snapshot at 7541373.728 ms contains the verification gate and no literal navigation label. A later retained snapshot at 7546455.007 ms contains the navigation DOM and no literal verification-gate text, 33.138 ms after the browser assertion ended. This DOM snapshot is not a later visibility assertion, a passing retest or proof of an application/harness root cause. The enclosing test assertion ended at 7546464.171 ms.

The selected admin access requests have status 200. Raw trace network timing fields are retained in diagnosis.json without inferring response-body completion order. No access, privacy, consent or role check was weakened. All 2,103 source and built-file hashes still match. The full uncapped matrices continue on the same frozen source/build pair; no mid-wave fix, retry, source swap or runtime/security change occurred.

The sanitized error context is base64 encoded to preserve its exact bytes without formatting changes. Original trace and screenshots remain task-private; hashes and exact test-info-name capture proof are included. Original v40/v41 evidence remains immutable. A safe follow-up is to review the positive login-navigation readiness boundary after these matrices terminate, with observed bounded readiness and all denial assertions preserved. No change or passing follow-up is claimed here.

HTTPS remains unexecuted without existing trusted task-owned TLS inputs. GitGuardian's configured size-limit skip is neutral, not clean. Parent retains orchestration, integration and main-merge authority.
''')
save(out/'manifest.json',{'sealedAt':proof['capturedAt'],'files':[{'path':str(p.relative_to(out)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(out.iterdir())]})
subprocess.run(['python3','/workspace/sysadmin-workspace/tools/cloud_git_identity.py','--repo',str(repo)],check=True,stdout=subprocess.DEVNULL);subprocess.run(['git','add',str(out.relative_to(repo))],cwd=repo,check=True);subprocess.run(['git','diff','--cached','--check'],cwd=repo,check=True);subprocess.run(['git','commit','--quiet','-m','docs(qa): preserve White Label health admission failure'],cwd=repo,check=True);subprocess.run(['git','push','origin','test/b2b-product-acceptance-v1'],cwd=repo,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE);head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip();save(E/'published-health-failure.json',{'sha':head,'version':out.name,'url':f'https://github.com/pablitxn/klisteniapp/blob/{head}/'+str((out/'README.md').relative_to(repo))});print((E/'published-health-failure.json').read_text())
