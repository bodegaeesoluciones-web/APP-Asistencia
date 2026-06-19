import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        technician: './src/pages/technician/index.html',
        admin: './src/pages/admin/index.html',
        qr: './src/pages/admin/qr.html'
      }
    }
  }
});
