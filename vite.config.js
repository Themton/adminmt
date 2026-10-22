import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// ════════════════════════════════════════════
// แก้ 'saleshub' ให้ตรงกับชื่อ GitHub repo ของคุณ
// เช่น repo ชื่อ my-sales → base: '/my-sales/'
// ════════════════════════════════════════════
const buildVersion = process.env.GITHUB_SHA || new Date().toISOString()

export default defineConfig({
  define: { __APP_BUILD_VERSION__: JSON.stringify(buildVersion) },
  base: '/adminmt/',
  plugins: [react(), {
    name: 'app-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'app-version.json', source: JSON.stringify({ version: buildVersion }) })
    },
  }],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        boss: resolve(__dirname, 'boss.html'),
      },
    },
  },
})
