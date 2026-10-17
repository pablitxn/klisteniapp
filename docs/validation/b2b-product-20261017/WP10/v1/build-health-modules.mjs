import { build } from '/workspace/wp10-health/apps/b2b-web/node_modules/vite/dist/node/index.js'
import react from '/workspace/wp10-health/apps/b2b-web/node_modules/@vitejs/plugin-react/dist/index.js'
await build({
  root: '/workspace/wp10-health/apps/b2b-web', configFile: false, plugins: [react()],
  build: { outDir: '/tmp/wp10-health-module-build', emptyOutDir: true,
    lib: { entry: {
      HealthSettings: '/workspace/wp10-health/apps/b2b-web/src/features/health/HealthSettings.tsx',
      TrainerHealthView: '/workspace/wp10-health/apps/b2b-web/src/features/health/TrainerHealthView.tsx',
    }, formats: ['es'] },
    rolldownOptions: { external: ['react', 'react/jsx-runtime'] },
  },
})
