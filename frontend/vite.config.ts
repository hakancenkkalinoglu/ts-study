import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Cloudflare Quick Tunnel ile test için (rastgele-isim.trycloudflare.com)
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Tünelde tarayıcı Origin'i trycloudflare adresi olur ve backend CORS'u 403 verir.
        // Proxy'de Origin'i sabitleyerek backend'i değiştirmeden çözüyoruz.
        headers: { Origin: 'http://localhost:5173' },
      },
    },
  },
})
