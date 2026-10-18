import base64,datetime,hashlib,json,re,shutil,subprocess,zipfile
from pathlib import Path
from urllib.parse import urlsplit
R=Path('/workspace/wp12-runtime-v11');E=R/'evidence';repo=Path('/workspace/klisteniapp');out=repo/'docs/validation/b2b-product-20261017/WP12/v45-failures-roles-chromium430';assert not out.exists();assert not subprocess.check_output(['git','status','--porcelain'],cwd=repo,text=True).strip()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
source=json.loads((E/'source-proof.json').read_text());build=json.loads((E/'fresh-build-proof.json').read_text());files=source['applicationFiles']+source['qaFiles']+build['files'];assert all(sha(R/'app'/f['path'])==f['sha256'] for f in files)
out.mkdir();proofs=[]
for n,id,folder,expected,line,budget in [(72,'B2BP-ROLES-003','r72-b2bp-roles-003-product-chromium-430-7eb05abf9b-verified','organization combobox visible after real password admission',266,30000),(71,'B2BP-ROLES-009','r71-b2bp-roles-009-product-chromium-430-6adbd099b8-verified','programming heading visible after opening programming',610,5000)]:
 private=E/folder;dest=out/f'r{n}-{id.lower()}';dest.mkdir();actions=[];network=[];frames=[]
 with zipfile.ZipFile(private/'trace.zip') as z:
  for entry in z.namelist():
   if entry.endswith('.trace'):
    rows=[json.loads(l) for l in z.read(entry).splitlines()];bad={x['callId'] for x in rows if x.get('type')=='after' and x.get('error')}
    for x in rows:
     if x.get('callId') in bad and x.get('type') in ['before','after']:actions.append({'entry':entry,'type':x['type'],'callId':x['callId'],'startTime':x.get('startTime'),'endTime':x.get('endTime'),'stack':x.get('stack'),'method':x.get('method')})
    frame_rows=[x['snapshot'] for x in rows if x.get('type')=='frame-snapshot']
    for s in frame_rows[-3:]:
     h=json.dumps(s.get('html'),ensure_ascii=False);frames.append({'entry':entry,'timestamp':s.get('timestamp'),'organizationLabelLiteralPresent':'Organización' in h,'navigationLiteralPresent':'Secciones del gimnasio' in h,'genericLoadingLiteralPresent':'Cargando…' in h,'planningLoadingLiteralPresent':'Cargando programación y permisos' in h,'planningHeadingLiteralPresent':'Rutinas y programas por objetivo' in h})
   if entry.endswith('.network'):
    for l in z.read(entry).splitlines():
     s=json.loads(l).get('snapshot',{});req=s.get('request',{});path=urlsplit(req.get('url','')).path
     if '/api/b2b/' in path:network.append({'entry':entry,'path':re.sub(r'[a-f0-9]{8}-[a-f0-9-]{27,}','[synthetic-id]',path),'method':req.get('method'),'rawStatus':s.get('response',{}).get('status'),'rawMonotonicTime':s.get('_monotonicTime'),'rawTime':s.get('time')})
 proof={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'run':n,'mode':'white-label-http' if n==72 else 'unified-http','id':id,'project':'product-chromium-430','applicationSha':'d2adf75d3fee18740ef38632a361c91203d77dc6','qaSha':'831203470d4c21322b8bc3ce7c4dedb7f84fe5d7','status':'failed','retry':0,'expected':expected,'sourceLine':line,'assertionTimeoutMs':budget,'failedTraceActions':actions,'lastRetainedFramesByTrace':frames,'normalizedNetworkEntries':network,'sourceAndBuiltFilesReverified':len(files),'sourceMismatches':[],'privateTraceSha256':sha(private/'trace.zip'),'qualification':'Observed loading UI and failed predicate. Product/harness/environment cause remains unproven. Network status-1 is not an HTTP server status; raw timing does not infer body completion. All uncompleted scenario assertions remain uncredited.'};save(dest/'diagnosis.json',proof);shutil.copyfile(private/'capture-proof.json',dest/'capture-proof.json');(dest/'error-context.sanitized.md.b64').write_bytes(base64.b64encode((private/'error-context.sanitized.md').read_bytes())+b'\n');proofs.append({k:proof[k] for k in ['run','mode','id','project','status','expected','assertionTimeoutMs']})
shutil.copyfile(E/'monitoring-read-delay-incident.json',out/'monitoring-read-delay-incident.json');save(out/'summary.json',{'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'cases':proofs,'bothFullMatricesContinue':True,'noRetryOrSourceChange':True,'rootCauseEstablished':False});(out/'builder-source.py').write_bytes(Path(__file__).read_bytes())
(out/'README.md').write_text('''# Additional full-run role failures: Chromium 430

Application `d2adf75d3fee18740ef38632a361c91203d77dc6`; QA `831203470d4c21322b8bc3ce7c4dedb7f84fe5d7`.

Two actual cells failed without retry:

- White Label R72, ROLES-003: the existing 30-second organization-combobox visibility assertion (`app-fixture.ts:266`) failed after real password admission. The retained failure snapshot shows only “Cargando…”. The later role/invitation assertions were not all completed and are not credited as passing. This assertion precedes the new shared workspace-admission phase.
- Unified R71, ROLES-009: the unchanged five-second programming-heading assertion (`b2b-product-roles.spec.ts:610`) failed after opening programming. The snapshot contains the selected coach context and navigation, with “Cargando programación y permisos…” instead of the expected heading. The final heading and viewport assertions did not pass.

Exact test-info names, private trace/screenshot hashes, normalized selected network entries, retained frame observations and failed trace action timings are preserved per case. Raw status -1 is not an HTTP server status; response/timing entries are not proof of rendered UI or body completion. Eventual ready UI and product/harness ownership remain unproven.

During the overlapping 20:57–20:59 UTC interval, several host progress/process/filesystem reads were delayed and subsequently completed successfully. The observed load/memory/storage facts and limits are recorded in monitoring-read-delay-incident.json. Temporal overlap does not establish a resource or filesystem cause. No environment-related pass override is applied. Both runner processes remained active and monitoring recovered.

All 2,106 source/build hashes still match. The complete uncapped matrices continue on the frozen pair, with no test retry, source/app change, larger deadline, automatic navigation/authentication recovery or security relaxation. These failures remain separate from independent focused passes and all old failed waves. Task-local Git publication commands now disable automatic Git maintenance per call to avoid starting unrelated maintenance during tests; repository/global Git configuration and application/runtime policy are unchanged, and this is not claimed as a cause or fix.

A safe follow-up is to investigate cold workspace admission and programming-permission loading with the exact source and retained traces, while preserving all role/host/branch/denial predicates. No product defect, harness-only cause or passing remediation is asserted. Raw traces remain task-private; sanitized error contexts are base64 encoded. HTTPS remains unexecuted without existing trusted TLS inputs. GitGuardian size-limit skip is neutral, not clean. Parent retains orchestration, integration and main-merge authority.
''')
save(out/'manifest.json',{'sealedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':[{'path':str(p.relative_to(out)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(out.rglob('*')) if p.is_file()]});subprocess.run(['python3','/workspace/sysadmin-workspace/tools/cloud_git_identity.py','--repo',str(repo)],check=True,stdout=subprocess.DEVNULL);subprocess.run(['git','add',str(out.relative_to(repo))],cwd=repo,check=True);subprocess.run(['git','diff','--cached','--check'],cwd=repo,check=True);subprocess.run(['git','-c','gc.auto=0','-c','maintenance.auto=false','commit','--quiet','-m','docs(qa): preserve full-run role loading failures'],cwd=repo,check=True);subprocess.run(['git','-c','gc.auto=0','-c','maintenance.auto=false','push','origin','test/b2b-product-acceptance-v1'],cwd=repo,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE);head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip();save(E/'published-roles-failure.json',{'sha':head,'version':out.name,'url':f'https://github.com/pablitxn/klisteniapp/blob/{head}/'+str((out/'README.md').relative_to(repo))});print((E/'published-roles-failure.json').read_text())
