import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    basicSsl(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@ffmpeg/core-mt/dist/esm/*',
          dest: 'ffmpeg'
        },
        {
          src: 'node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js',
          dest: 'ffmpeg'
        },
        {
          src: 'public/models/*',
          dest: 'models'
        }
      ]
    })
  ],
  server: {
    port: 5173,
    https: true,
    host: true,
    cors: true,
    // 포트 점유 시 자동으로 다음 포트 사용
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin'
    }
  },
  base: process.env.BUILD_TARGET === 'electron'
    ? './'
    : (process.env.NODE_ENV === 'production' ? '/AutoShortsWeb/' : '/'),
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2020',
    sourcemap: false,
    minify: 'esbuild',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['@tensorflow/tfjs', 'face-api.js'],
          ffmpeg: ['@ffmpeg/ffmpeg', '@ffmpeg/core-mt']
        }
      }
    }
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  },
  optimizeDeps: {
    // ffmpeg.wasm는 최적화에서 제외해야 corePath 경로 로직이 안정적으로 작동
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@ffmpeg/core-mt']
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
