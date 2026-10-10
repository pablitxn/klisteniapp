import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sharedModelAssetsPlugin } from '@klisteniapp/model-assets/vite'
export default defineConfig({ plugins: [react(), sharedModelAssetsPlugin()], base: '/backoffice/', server: { hmr: { path: '/__backoffice_hmr', clientPort: Number(process.env.B2B_GATEWAY_PORT ?? 4200), host: '127.0.0.1' }, proxy: { '/api/b2b': { target: process.env.KLISTENI_B2B_API_URL ?? 'http://127.0.0.1:4201', changeOrigin: false } } } })
