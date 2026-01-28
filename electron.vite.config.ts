import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  // 메인 프로세스 설정
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/main',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main/index.ts'),
        },
        output: {
          format: 'cjs',
          entryFileNames: 'index.cjs',
        },
      },
    },
    resolve: {
      alias: {
        '@electron': resolve(__dirname, 'electron'),
      },
    },
  },

  // 프리로드 스크립트 설정
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/preload',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload/index.ts'),
        },
      },
    },
  },

  // 렌더러 프로세스 설정 (React)
  renderer: {
    root: resolve(__dirname, 'electron/renderer'),
    build: {
      outDir: 'dist-electron/renderer',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/renderer/index.html'),
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'electron/renderer/src'),
      },
    },
    server: {
      port: 5174,
      strictPort: false,
    },
  },
});
