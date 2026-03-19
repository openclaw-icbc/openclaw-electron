import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
    },
    hmr: {
      // 确保 HMR 在离线环境正常工作
      protocol: 'ws',
      host: 'localhost',
    },
  },
  base: './',
  // 确保离线环境安全运行
  optimizeDeps: {
    exclude: ['electron'],
    // 禁用自动预构建检测，使用已有的预构建依赖
    force: false,
  },
  // 指定缓存目录
  cacheDir: './node_modules/.vite',
  build: {
    outDir: '../dist/renderer',
    emptyOutDir: true,
    // 禁用 source map 以减少构建时间
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
