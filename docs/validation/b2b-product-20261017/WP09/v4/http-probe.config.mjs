import react from '@vitejs/plugin-react'
export default {plugins:[react()],define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{outDir:'/workspace/wp09-tools/http-v4/runtime/dist',emptyOutDir:true,lib:{entry:'/workspace/wp09-tools/http-v4/runtime/probe.tsx',name:'WP09HttpProbe',formats:['iife'],fileName:'probe'},minify:false}}
