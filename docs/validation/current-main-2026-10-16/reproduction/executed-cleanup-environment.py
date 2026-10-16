import datetime,json,os,pathlib,signal,subprocess
root=pathlib.Path('/workspace/qa-20261016');docs=pathlib.Path('/workspace/klisteniapp/docs/validation/current-main-2026-10-16')
report=json.loads((root/'b2b-brand-admin-final/report.json').read_text());assert report['stats']['expected']==162 and report['stats']['unexpected']==0 and report['stats']['skipped']==0,report['stats']
def run(args):return subprocess.check_output(args,text=True).strip()
db='klisteni-qa-20261016-db';browser='klisteni-qa-20261016-browser';network='klisteni-qa-20261016-net'
objects={n:json.loads(run(['docker','inspect',n]))[0] for n in (db,browser)}
assert objects[db]['Image']=='sha256:79bd7c99e923138f136f8009d6bffa66e21e9d4fda5c0c561b00fc9c90cfe537'
assert objects[browser]['Image']=='sha256:fb70e03db1c00327d2a5626fa6eea50ef9adc333e90c415b104722bb53df58d5'
volumes=[m['Name'] for m in objects[db]['Mounts'] if m['Type']=='volume'];assert len(volumes)==1
sql="SELECT json_build_object('version', version(), 'database', current_database(), 'nonSystemSchemas', (SELECT json_agg(nspname ORDER BY nspname) FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'), 'fixtureSchemaCount', (SELECT count(*) FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN ('information_schema','public')));"
metadata=[json.loads(run(['docker','exec',db,'psql','-U','qa','-d',name,'-Atc',sql])) for name in ('klisteni_b2c_test','klisteni_b2b_test')]
receipt={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Only disposable task-owned resources; existing development containers/volumes, browser caches and Atlas preserved.','finalDatabaseMetadata':metadata,'containers':{n:{'id':o['Id'],'image':o['Image']} for n,o in objects.items()},'databaseAnonymousVolumes':volumes,'network':network,'actions':[]}
for proc in pathlib.Path('/proc').glob('[0-9]*/cmdline'):
 try:args=proc.read_bytes().split(b'\0')
 except (FileNotFoundError,ProcessLookupError,PermissionError):continue
 if args[:2]==[b'python3',b'/workspace/qa-20261016/fixture-relay.py']:
  os.kill(int(proc.parent.name),signal.SIGTERM);receipt['actions'].append({'relayPid':int(proc.parent.name),'signal':'SIGTERM'})
for name in (browser,db):
 run(['docker','stop','--time','10',name]);run(['docker','rm','-v',name]);receipt['actions'].append({'container':name,'removed':True})
net=json.loads(run(['docker','network','inspect',network]))[0];assert not net['Containers'],net['Containers']
run(['docker','network','rm',network]);receipt['actions'].append({'network':network,'removed':True})
for name in (db,browser):assert subprocess.run(['docker','container','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0
for name in volumes:assert subprocess.run(['docker','volume','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0
assert subprocess.run(['docker','network','inspect',network],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0
receipt['status']='complete';receipt['completedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for directory in (root,docs):(directory/'environment-cleanup.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'status':receipt['status'],'databaseMetadata':metadata,'removedContainers':2,'removedVolumes':len(volumes),'removedNetworks':1}))
