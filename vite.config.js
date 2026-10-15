import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // `npm run dev` starts json-server on :3001; the browser only ever talks to /api.
    proxy: { '/api': { target: 'http://localhost:' + (process.env.API_PORT || 3001), changeOrigin: true } },
  },
  build: {
    rollupOptions: {
      output: { manualChunks: (id) => (id.includes('node_modules/d3') ? 'd3' : id.includes('node_modules') ? 'vendor' : undefined) },
    },
  },
});
