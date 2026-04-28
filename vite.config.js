import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// ════════════════════════════════════════════
// แก้ 'saleshub' ให้ตรงกับชื่อ GitHub repo ของคุณ
// เช่น repo ชื่อ my-sales → base: '/my-sales/'
// ════════════════════════════════════════════
export default defineConfig({
  base: '/adminmt/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        boss: resolve(__dirname, 'boss.html'),
      },
    },
  },
})
