import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { loadDeployment } from './config/deployment.ts'

const root = fileURLToPath(new URL('.', import.meta.url))
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, root, ''), ...process.env }
  const deployment = loadDeployment(env, root)
  const disabledAnalytics = fileURLToPath(new URL('./src/lib/analytics.disabled.ts', import.meta.url))
  const localStore = fileURLToPath(new URL('./src/lib/store.local.ts', import.meta.url))
  const proxy = deployment.instanceMode ? { '/api': { target: env.KLISTENI_API_URL ?? 'http://127.0.0.1:3001', changeOrigin: false } } : undefined
  return {
    plugins: [react(), ...(!deployment.instanceMode ? [{
      name: 'enforce-local-demo-boundary',
      generateBundle(_options, bundle) {
        const forbidden = /\/src\/(?:lib\/(?:store|account-api|analytics)\.ts|components\/(?:AccountPanel|AdminAccounts|BillingPanel|AccountAccessPage|ForgotPasswordPage)\.tsx)$/
        for (const output of Object.values(bundle)) {
          if (output.type !== 'chunk') continue
          for (const id of Object.keys(output.modules)) {
            if (forbidden.test(id.split('?')[0]!)) this.error(`The demo cannot include instance module: ${id.split('/src/')[1]}`)
          }
        }
      },
    } satisfies import('vite').Plugin] : [])],
    resolve: { alias: deployment.instanceMode ? [] : [{ find: /^(?:\.\.\/lib|\.\/lib)\/store(?:\.ts)?$/, replacement: localStore }, { find: /^(?:\.\.\/lib|\.\/lib)\/analytics(?:\.ts)?$/, replacement: disabledAnalytics }] },
    define: {
      'import.meta.env.VITE_APP_MODE': JSON.stringify(deployment.instanceMode ? 'instance' : 'demo'),
      __KLISTENI_INSTANCE_MODE__: JSON.stringify(deployment.instanceMode),
      __KLISTENI_PUBLIC_PROFILE__: JSON.stringify(deployment.publicProfile),
      ...(!deployment.instanceMode ? Object.fromEntries(['VITE_UMAMI_SCRIPT_URL', 'VITE_UMAMI_HOST_URL', 'VITE_UMAMI_WEBSITE_ID', 'VITE_UMAMI_ALLOWED_HOSTNAME'].map(key => [`import.meta.env.${key}`, JSON.stringify('')])) : {}),
    },
    server: { proxy },
    preview: { proxy },
  }
})
