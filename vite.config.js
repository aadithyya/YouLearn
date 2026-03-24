import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/chat': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api/upload': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api/rag': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:5178',
        changeOrigin: true,
      },
    },
  },
})