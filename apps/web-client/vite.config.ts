import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  envDir: path.resolve(__dirname, '../..'),
  plugins: [react({})],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/auth': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/marketplace': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/world': {
        target: 'http://127.0.0.1:3001',
        ws: true,
      },
    },
  },
});
