import {build} from '/workspace/klisteniapp/apps/b2b-web/node_modules/vite/dist/node/index.js'
import react from '/workspace/klisteniapp/apps/b2b-web/node_modules/@vitejs/plugin-react/dist/index.js'
import {readFile,readdir,chmod} from 'node:fs/promises'
import path from 'node:path'
const base='/tmp/b2b-health-readiness-v11',root='/workspace/klisteniapp',alias=[]
for(const name of await readdir(root+'/packages')){
 const dir=root+'/packages/'+name,manifest=JSON.parse(await readFile(dir+'/package.json','utf8'))
 for(const [key,target] of Object.entries(manifest.exports||{}))if(typeof target==='string')alias.push({find:manifest.name+(key==='.'?'':key.slice(1)),replacement:path.join(dir,target)})
}
alias.push({find:'react-dom/client',replacement:root+'/apps/b2b-web/node_modules/react-dom/client.js'},{find:'react/jsx-runtime',replacement:root+'/apps/b2b-web/node_modules/react/jsx-runtime.js'},{find:'react',replacement:root+'/apps/b2b-web/node_modules/react/index.js'})
alias.sort((a,b)=>b.find.length-a.find.length)
await build({configFile:false,root:base,plugins:[react()],define:{'process.env.NODE_ENV':'"production"'},resolve:{alias},build:{outDir:base+'/dist',emptyOutDir:true,lib:{entry:base+'/probe.tsx',name:'RouteProof',formats:['iife'],fileName:()=> 'probe.js',cssFileName:'probe'},minify:false}})

for(const file of await readdir(base+'/dist'))await chmod(base+'/dist/'+file,0o644)
await chmod(base+'/dist',0o755)
