import datetime,hashlib,json,subprocess
from pathlib import Path
R=Path('/workspace/wp12-runtime-v12');p=R/'review/docs/validation/b2b-product-20261017/INTEGRATION/v15';repo='/workspace/klisteniapp';m=json.loads((p/'manifest.json').read_text())
for f in m['files']:
 b=(p/f['path']).read_bytes();assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256']
s=json.loads((p/'source-hashes.json').read_text());proc=subprocess.Popen(['git','-C',repo,'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
for name,sha in s['files'].items():
 proc.stdin.write((s['sourceCommit']+':'+name+'\n').encode());proc.stdin.flush();header=proc.stdout.readline().decode().split();assert header[1]=='blob',name;b=proc.stdout.read(int(header[2]));assert proc.stdout.read(1)==b'\n';assert hashlib.sha256(b).hexdigest()==sha,name
proc.stdin.close();assert proc.wait()==0
r=json.loads((p/'browser-results.json').read_text());candidate=next(x for x in r['runs'] if x['name']=='candidate');rows=candidate['cases'];assert len(rows)==14 and all(x['status']=='passed' and x['retry']==0 for x in rows);assert not candidate['errors'];baseline=next(x for x in r['runs'] if x['name']=='baseline');assert len(baseline['cases'])==1 and baseline['cases'][0]['status']=='failed'

diff=subprocess.check_output(['git','-C',repo,'diff','--name-only',s['sourceCommit'],'76dcab2d28bd58072dc492bf6a994eb4995896e4'],text=True).splitlines();assert all(x.startswith('docs/') for x in diff)
x={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'candidateDocumentationSha':'76dcab2d28bd58072dc492bf6a994eb4995896e4','applicationSha':s['sourceCommit'],'evidenceManifestFilesVerified':len(m['files']),'sourceGitBlobsVerified':len(s['files']),'producerBrowserCells':rows,'producerBrowserReceiptFormat':'Reduced report with raw report hashes; raw bytes are not in this public receipt','producerBaseline':baseline,'sourceToDocumentationHeadOnlyDocs':diff,'qualification':'Producer immutable receipt audited, not counted as independently executed tests. Baseline control retained as expected failure; static-stream changes are not proven historical cause.'};(R/'evidence/producer-audit.json').write_text(json.dumps(x,indent=2)+'\n');print(json.dumps({k:x[k] for k in ['evidenceManifestFilesVerified','sourceGitBlobsVerified']}))
