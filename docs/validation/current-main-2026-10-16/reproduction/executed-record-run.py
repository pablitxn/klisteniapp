import hashlib,json,pathlib,subprocess,sys
root=pathlib.Path('/workspace/klisteniapp');out=pathlib.Path('/workspace/qa-20261016');label=sys.argv[1]
files=['apps/b2c-web/e2e/member-qa.spec.ts','apps/b2c-web/e2e/brand-admin.spec.ts']
meta={'testedRevision':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'testSourceRevision':'c4fb918498d07b3d7bd43cf0adec8c65983ddb4d','productBaseRevision':'1258642b4543b6acc598d6e72ccf1c50e75b7a67','uncommittedSourceDelta':subprocess.check_output(['git','diff','--name-only','HEAD','--','apps','packages','scripts'],cwd=root,text=True).splitlines(),'testFiles':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in files},'externalConfigSha256':hashlib.sha256((out/'integration-http.config.ts').read_bytes()).hexdigest(),'relaySha256':hashlib.sha256((out/'fixture-relay.py').read_bytes()).hexdigest()}
assert not meta['uncommittedSourceDelta']
(out/'run-revisions'/f'{label}.json').write_text(json.dumps(meta,indent=2)+'\n')
