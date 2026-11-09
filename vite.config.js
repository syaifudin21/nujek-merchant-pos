import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: {
      // Proxy dev: request ke /api/open/v1/... diteruskan ke API staging
      // (tanpa CORS). Signature HMAC tetap dihitung atas path ASLI
      // (/open/v1/...) — lihat src/lib/openapi.js (fetchUrl vs path).
      '/api': {
        target: 'https://staging-merchant-api.nujek.co.id',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
