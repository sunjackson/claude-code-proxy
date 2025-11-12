/**
 * Vite 配置文件
 * 配置 React、Tauri 集成和开发服务器
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // 解析配置
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // 开发服务器配置
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },

  // 构建配置
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'i18n-vendor': ['i18next', 'react-i18next'],
          'ui-vendor': ['react-hot-toast'],
        },
      },
    },
  },

  // 防止 Vite 清除 Rust 错误输出
  clearScreen: false,

  // Tauri 环境变量
  envPrefix: ['VITE_', 'TAURI_'],
});
