import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
  },
  server: {
    port: 5173,
    historyApiFallback: true,
    proxy: {
      '/api': 'http://localhost:8000',
      '/verify-id': 'http://localhost:8000',
      '/submit': 'http://localhost:8000',
      '/media': 'http://localhost:8000',
    },
  },
})
