"""Collect executed Playwright results; preserve attempts and transport boundaries."""
import hashlib,json,pathlib,re
root=pathlib.Path('/workspace/qa-20261016')
revision='1258642b4543b6acc598d6e72ccf1c50e75b7a67'
simulated={'health.spec.ts','yoga-account.spec.ts','account-access.spec.ts','forgot-password.spec.ts'}
reports=[];cases=[]
for path in sorted(root.glob('*/report.json')):
 if path.parent.name.endswith('discovery'): continue
 data=json.loads(path.read_text()); label=path.parent.name
 metaPath=root/'run-revisions'/(label+'.json')
 metadata=json.loads(metaPath.read_text()) if metaPath.exists() else {'testedRevision':revision,'productBaseRevision':revision}
 runRevision=metadata['testedRevision']
 def visit(suites):
  for suite in suites:
   visit(suite.get('suites',[]))
   for spec in suite.get('specs',[]):
    for test in spec.get('tests',[]):
     file=spec.get('file',suite.get('file','')); file=pathlib.Path(file).name
     method='local-storage' if label.startswith('visitor') else 'simulated-transport-ui-contract' if label.startswith('selfservice') and file in simulated else 'api-postgresql'
     for result in (test.get('results') or [{'status':'skipped','duration':0,'retry':0}]):
      error=result.get('error',{}).get('message',''); plain=re.sub(r'\x1b\[[0-9;]*m','',error)
      cases.append({'run':label,'testedRevision':runRevision,'testSourceRevision':metadata.get('testSourceRevision',runRevision),'productBaseRevision':revision,'project':test.get('projectName'),'file':file,'line':spec.get('line'),'title':spec['title'],'method':method,'status':result['status'],'retry':result.get('retry',0),'durationMs':result.get('duration'),'runStartedAt':data.get('stats',{}).get('startTime'),'startedAt':result.get('startTime'),'workerIndex':result.get('workerIndex'),'category':'operator-interruption' if result['status']=='interrupted' else 'remote-download-harness-failure' if 'Path is not available when connecting remotely' in plain else 'unexecuted' if result['status']=='skipped' else 'worker-configuration-failure' if 'exports is not defined' in plain else 'environment-launch-failure' if ('browserType.connect' in plain or 'browserType.launch' in plain) else 'environment-proxy-failure' if ('ERR_PROXY_CONNECTION_FAILED' in plain or 'Could not connect to proxy server' in plain) else 'executed-pass' if result['status']=='passed' else 'functional-failure','attachments':[{'name':a.get('name'),'path':a.get('path','').removeprefix(str(root)+'/')} for a in result.get('attachments',[]) if a.get('path')],'error':plain[:2000] if plain else None,'errorTruncated':len(plain)>2000,'launchFailure':('browserType.connect' in plain or 'browserType.launch' in plain)})
 visit(data.get('suites',[]))
 reports.append({'run':label,'testedRevision':runRevision,'testSourceRevision':metadata.get('testSourceRevision',runRevision),'productBaseRevision':revision,'reportSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'stats':data.get('stats',{}),'errors':data.get('errors',[]),'command':data.get('config',{}).get('configFile'),'revisionMetadata':metadata})
(root/'browser-attempts.json').write_text(json.dumps({'reports':reports,'cases':cases},indent=2)+'\n')
print(json.dumps([{'run':r['run'],**{k:v for k,v in r['stats'].items() if k in ['expected','unexpected','skipped','flaky']}} for r in reports],indent=2))
