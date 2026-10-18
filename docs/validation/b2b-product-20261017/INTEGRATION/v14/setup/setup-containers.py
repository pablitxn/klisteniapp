from pathlib import Path
import subprocess,os,json,secrets,time
base=Path('/tmp/klisteni-readiness-runtime');app=base/'app';evidence=base/'evidence';evidence.mkdir(exist_ok=True);evidence.chmod(0o777);base.chmod(0o755)
names={'network':'klisteni-readiness-network-v1','browser':'klisteni-readiness-browser-v1','postgres':'klisteni-readiness-pg-v1'}
user='readiness';database='klisteni_b2b_readiness_test';password=secrets.token_hex(24)
url=f'postgresql://{user}:{password}@127.0.0.1:5432/{database}'
private=base/'private-connection.json';private.touch(mode=0o600,exist_ok=False);private.write_text(json.dumps({'user':user,'database':database,'password':password,'url':url},indent=2)+'\n')
env=os.environ.copy();env.update(POSTGRES_PASSWORD=password,B2B_TEST_DATABASE_URL=url,PGPASSWORD=password)
commands=[]
def run(args):
 commands.append(args)
 r=subprocess.run(args,env=env,check=True,capture_output=True,text=True)
 return r.stdout.strip()
# Refuse all collisions; never replace/remove a pre-existing container/network.
for kind,name in [('network',names['network']),('container',names['browser']),('container',names['postgres'])]:
 if subprocess.run(['docker',kind,'inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:raise RuntimeError('Refusing existing task name '+name)
try:
 network=run(['docker','network','create',names['network']])
 browser=run(['docker','run','--pull=never','-d','--name',names['browser'],'--network',names['network'],'--init','--user','pwuser','--security-opt','no-new-privileges','--security-opt','seccomp=/workspace/.onboarding/browser-support/seccomp_profile.json','--shm-size=1g','--mount',f'type=bind,src={app},dst=/task/app,readonly','--mount','type=bind,src=/tmp/b2b-integration-v13/browser-runtime,dst=/runtime,readonly','--mount',f'type=bind,src={evidence},dst=/tmp/readiness-evidence','--workdir','/task/app','-e','B2B_TEST_DATABASE_URL','-e','B2B_PRODUCT_TEST_ACTIVATE=1','-e','B2B_PRODUCT_USE_BUILT=1','-e','PLAYWRIGHT_BROWSERS_PATH=/runtime/browsers','-e','CI=1','-e','NO_PROXY=127.0.0.1,localhost,atlas.b2b.test,sur.b2b.test,alias.b2b.test,unknown.b2b.test','-e','no_proxy=127.0.0.1,localhost,atlas.b2b.test,sur.b2b.test,alias.b2b.test,unknown.b2b.test','sha256:fb70e03db1c00327d2a5626fa6eea50ef9adc333e90c415b104722bb53df58d5','node','-e','setInterval(() => {}, 60000)'])
 pg=run(['docker','run','--pull=never','-d','--name',names['postgres'],'--network','container:'+names['browser'],'--tmpfs','/var/lib/postgresql/data:rw,size=768m','-e','POSTGRES_USER='+user,'-e','POSTGRES_DB='+database,'-e','POSTGRES_PASSWORD','sha256:79bd7c99e923138f136f8009d6bffa66e21e9d4fda5c0c561b00fc9c90cfe537','-c','listen_addresses=127.0.0.1'])
 deadline=time.monotonic()+45
 while time.monotonic()<deadline:
  r=subprocess.run(['docker','exec',names['postgres'],'pg_isready','-U',user,'-d',database],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  if r.returncode==0:break
  time.sleep(1)
 else:raise RuntimeError('Task PostgreSQL did not become ready')
 version=run(['docker','exec','-e','PGPASSWORD',names['postgres'],'psql','-h','127.0.0.1','-U',user,'-d',database,'-Atc','SELECT version()'])
 result={'names':names,'containerIds':{'browser':browser,'postgres':pg},'networkId':network,'databaseVersion':version,'databaseLoopbackPort':5432,'publishedPorts':[],'databaseStorage':'task tmpfs768m','appMount':'/task/app (readonly)','runtimeMount':'/runtime (readonly)','evidenceMount':'/tmp/readiness-evidence (writable task-only)','passwordHandling':'task-only private-connection.json mode0600; no values in command logs','status':'containers ready; no tests/browser launch performed','qualification':'Ordinary task bridge has Docker outbound capability; no egress-firewall claim. Existing containers/databases untouched.'}
 (base/'containers-setup.json').write_text(json.dumps(result,indent=2)+'\n')
 (base/'setup-commands.json').write_text(json.dumps(commands,indent=2)+'\n')
 print(json.dumps(result))
except Exception:
 (base/'setup-commands.json').write_text(json.dumps(commands,indent=2)+'\n')
 raise
