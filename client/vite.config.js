import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:80',
      '/uploads': 'http://localhost:80',
      '/socket.io': { target: 'http://localhost:80', ws: true },
    },
  },
});
