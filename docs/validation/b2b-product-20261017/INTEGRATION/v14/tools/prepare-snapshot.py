from pathlib import Path
import subprocess,shutil,os,json,hashlib,time
root=Path('/workspace/klisteni-readiness'); dest=Path('/tmp/klisteni-readiness-runtime/app'); out=dest.parent
assert not dest.exists();dest.mkdir()
files=subprocess.check_output(['git','ls-files','-co','--exclude-standard','-z'],cwd=root).decode().split('\0')
files=sorted(set(x for x in files if x)); copied=[];before=time.monotonic()
for name in files:
 p=Path(name)
 if p.parts[0] in {'.git','docs','node_modules'} or 'node_modules' in p.parts or p.name=='.env' or p.name.startswith('.env.') or p.parts[0].startswith('.cache'):continue
 source=root/name;target=dest/name
 if not source.exists() and not source.is_symlink():continue
 target.parent.mkdir(parents=True,exist_ok=True)
 if source.is_symlink():target.symlink_to(os.readlink(source))
 elif source.is_file():shutil.copy2(source,target)
 else:continue
 copied.append(name)
deps=[Path('node_modules')]+[p.relative_to(root) for section in ['apps','packages'] for p in (root/section).glob('*/node_modules') if p.is_dir()]
for dep in deps:shutil.copytree(root/dep,dest/dep,symlinks=True)
# Only task-owned copied public files: never change source/store hardlink modes.
for current,dirs,names in os.walk(dest,followlinks=False):
 os.chmod(current,0o755)
 for n in names:
  p=Path(current)/n
  if not p.is_symlink():os.chmod(p,0o755 if p.stat().st_mode&0o111 else 0o644)
symlink_escapes=[]
for current,dirs,names in os.walk(dest,followlinks=False):
 for name in dirs+names:
  p=Path(current)/name
  if p.is_symlink():
   try:p.resolve().relative_to(dest)
   except ValueError:symlink_escapes.append(str(p.relative_to(dest)))
if symlink_escapes:raise RuntimeError('Task dependency links escape copied source: '+repr(symlink_escapes[:8]))
prefixes=('apps/b2b-api/src/','apps/b2b-web/src/','apps/b2c-api/src/','apps/b2c-web/src/','packages/','scripts/')
production={};mismatches=[]
for name in copied:
 if not name.startswith(prefixes):continue
 p=dest/name
 if not p.is_file() or p.is_symlink():continue
 actual=hashlib.sha256(p.read_bytes()).hexdigest();production[name]=actual
 git=subprocess.run(['git','show','d2adf75:'+name],cwd=root,capture_output=True)
 if git.returncode or hashlib.sha256(git.stdout).hexdigest()!=actual:mismatches.append(name)
receipt={'sourceRoot':str(root),'sourceHeadAtCopy':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'expectedProductionRevision':'d2adf75d3fee18740ef38632a361c91203d77dc6','productionInputsChecked':len(production),'productionMismatches':mismatches,'copiedFiles':len(copied),'dependencyTrees':[str(x) for x in deps],'escapedLinks':symlink_escapes,'durationSeconds':round(time.monotonic()-before,3),'qualification':'Provisional QA copy while parent edits; parent must freeze/refresh QA before any test. No private env/git/docs copied. No tests started.'}
(out/'snapshot-setup.json').write_text(json.dumps(receipt,indent=2)+'\n');(out/'production-input-sha256.json').write_text(json.dumps(production,indent=2)+'\n')
print(json.dumps(receipt))
assert not mismatches
