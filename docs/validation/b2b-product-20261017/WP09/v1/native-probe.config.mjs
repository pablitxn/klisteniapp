import react from '@vitejs/plugin-react'
export default {define:{'process.env.NODE_ENV':JSON.stringify('development')},plugins:[react()],build:{outDir:'/workspace/wp09-tools/runtime/dist',emptyOutDir:true,lib:{entry:'/workspace/wp09-tools/runtime/probe.tsx',name:'WP09Probe',formats:['iife'],fileName:'probe'},minify:false}}
