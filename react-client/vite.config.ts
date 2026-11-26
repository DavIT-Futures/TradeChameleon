/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The dev proxy forwards API calls to Spring Boot; the tenant travels in X-Tenant-Id.
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
    // ../shared/styles is imported from outside the project root.
    fs: { allow: ['..'] },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    css: false,
  },
})
