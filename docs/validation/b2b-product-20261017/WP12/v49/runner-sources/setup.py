import datetime,hashlib,json,subprocess,time
from pathlib import Path
R=Path('/workspace/wp12-runtime-v12');E=R/'evidence'
def run(args,**kw):return subprocess.run(args,check=True,**kw)
def save(name,x):(E/name).write_text(json.dumps(x,indent=2)+'\n')
old=json.loads(subprocess.check_output(['docker','inspect','wp12-v11-browser'],text=True))[0]
pg=json.loads(subprocess.check_output(['docker','inspect','wp12-v11-postgres'],text=True))[0]
assert not old['HostConfig']['Privileged'] and old['Config']['User']=='pwuser' and old['HostConfig']['Init']
assert int(subprocess.check_output(['docker','exec','wp12-v11-postgres','psql','-U','wp12','-d','wp12_b2b_test','-Atc',"select count(*) from information_schema.schemata where schema_name like 'b2b_product_browser_%'"],text=True))==0
assert all((Path('/workspace/wp12-runtime-v11/evidence')/f'r{n}.state').read_text().strip()=='complete' for n in (71,72))
prior=Path('/workspace/wp12-runtime-v11');source=json.loads((prior/'evidence/source-proof.json').read_text());build=json.loads((prior/'evidence/fresh-build-proof.json').read_text());assert all(hashlib.sha256((prior/'app'/f['path']).read_bytes()).hexdigest()==f['sha256'] for f in source['applicationFiles']+source['qaFiles']+build['files'])
for n in (71,72):
 receipt=prior/'evidence/receipts'/f'r{n}';x=json.loads((receipt/'receipt.json').read_text());assert hashlib.sha256((prior/'evidence'/f'readiness-full-r{n}.json').read_bytes()).hexdigest()==x['rawJsonSha256'];manifest=json.loads((receipt/'private-artifact-manifest.json').read_text());assert all(hashlib.sha256((Path(manifest['root'])/f['path']).read_bytes()).hexdigest()==f['sha256'] for f in manifest['files'])
save('previous-runtime-retirement.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reason':'Both original matrices terminal, exact raw artifacts verified and global browser-schema count zero before task-only container retirement. Source/evidence directories and cached images retained.','containers':['wp12-v11-postgres','wp12-v11-browser']})
for name in ['wp12-v11-postgres','wp12-v11-browser']:run(['docker','stop','--time','10',name],stdout=subprocess.DEVNULL)
for name in ['wp12-v11-postgres','wp12-v11-browser']:run(['docker','rm',name],stdout=subprocess.DEVNULL)
run(['docker','network','rm','wp12-v11-browser-network'],stdout=subprocess.DEVNULL)
print('Original task containers retired after evidence preservation.',flush=True)
image=old['Config']['Image'];iid=subprocess.check_output(['docker','image','inspect','--format','{{.Id}}',image],text=True).strip();assert iid=='sha256:2c1f4e0fd6450f43ddb46d60c2a6df30855a8588e165b1f2559fb0eda8d7ff35'
profile=Path('/workspace/.onboarding/browser-support/seccomp_profile.json');assert hashlib.sha256(profile.read_bytes()).hexdigest()=='cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849'
run(['docker','network','create','wp12-v12-browser-network'],stdout=subprocess.DEVNULL)
cmd=['docker','run','-d','--name','wp12-v12-browser','--init','--user','pwuser','--shm-size','1g','--network','wp12-v12-browser-network','--security-opt','no-new-privileges','--security-opt','seccomp='+str(profile)]
cmd+=['--mount','type=bind,source=/workspace/wp12-runtime-v11/app,target=/baseline,readonly']
for m in old['Mounts']:
 source=str(R) if m['Destination']=='/task' else m['Source'];cmd+=['--mount',f'type=bind,source={source},target={m["Destination"]}'+('' if m['RW'] else ',readonly')]
allowed={'HTTP_PROXY','http_proxy','HTTPS_PROXY','https_proxy','NO_PROXY','no_proxy','NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','LANG','LC_ALL'}
for s in old['Config']['Env']:
 if s.split('=',1)[0] in allowed:cmd+=['-e',s]
run(cmd+[image,'sleep','infinity'],stdout=subprocess.DEVNULL)
cmd=['docker','run','-d','--name','wp12-v12-postgres','--network','container:wp12-v12-browser','--security-opt','no-new-privileges','--tmpfs','/tmp/wp12-pgdata:rw']
for s in pg['Config']['Env']:
 if s.split('=',1)[0] in {'POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_DB','PGDATA'}:cmd+=['-e',s]
run(cmd+[pg['Config']['Image'],'postgres'],stdout=subprocess.DEVNULL)
for attempt in range(30):
 if subprocess.run(['docker','exec','wp12-v12-postgres','pg_isready','-U','wp12','-d','wp12_b2b_test'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
 time.sleep(1)
else:raise RuntimeError('Fresh disposable PostgreSQL failed readiness')
run(['docker','exec','wp12-v12-browser','sh','-c','mkdir -p /task/app && tar xf /task/source.tar -C /task/app && node /task/link-dependencies.cjs'],stdout=(E/'dependency-links.log').open('w'),stderr=subprocess.STDOUT)
save('setup-source-and-runtime.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'imageId':iid,'imageDigest':image,'seccompProfileSha256':hashlib.sha256(profile.read_bytes()).hexdigest(),'browserContainer':'wp12-v12-browser','postgresContainer':'wp12-v12-postgres','user':'pwuser','sandboxPolicyUnchanged':True,'taskMount':str(R),'externalDependenciesReadOnly':True,'caTrustMountedReadOnly':True,'publishedPorts':[],'credentialMounts':[]})
print('Fresh source extracted and frozen dependencies rebound; database ready.',flush=True)
