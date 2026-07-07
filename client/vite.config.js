import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5715,
    strictPort: true, // Don't try other ports if 5715 is busy
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }
          if (id.includes('/vue') || id.includes('/vue-router') || id.includes('/pinia')) {
            return 'vue'
          }
          if (id.includes('/chart.js') || id.includes('/vue-chartjs')) {
            return 'charts'
          }
          if (id.includes('/exceljs') || id.includes('/jszip')) {
            return 'exports'
          }
          if (id.includes('/pinyin')) {
            return 'pinyin'
          }
        }
      }
    }
  }
})
