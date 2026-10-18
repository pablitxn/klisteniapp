import react from '@vitejs/plugin-react'
export default {plugins:[react()],define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{outDir:'/workspace/wp09-tools/feedback-v8/runtime/after',emptyOutDir:true,lib:{entry:'/workspace/wp09-tools/feedback-v8/runtime/probe.tsx',name:'WP09FeedbackProbe',formats:['iife'],fileName:'probe',cssFileName:'probe'},minify:false}}
