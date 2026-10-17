import react from '@vitejs/plugin-react'
import {readFileSync} from 'node:fs'
const before=process.env.WP09_CLOSE_BASELINE==='1'
export default {plugins:[...(before?[{name:'frozen-close-producer',enforce:'pre',load(id){for(const n of ['ProductTrainingSession.tsx','useProductTrainingSession.ts'])if(id.endsWith('/features/training/sync/'+n))return readFileSync('/workspace/wp09-tools/close-v7/'+n+'.before','utf8')}}]:[]),react()],define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{outDir:'/workspace/wp09-tools/close-v7/runtime/'+(before?'before':'dist'),emptyOutDir:true,lib:{entry:'/workspace/wp09-tools/close-v7/runtime/probe.tsx',name:'WP09CloseProbe',formats:['iife'],fileName:'probe',cssFileName:'probe'},minify:false}}
