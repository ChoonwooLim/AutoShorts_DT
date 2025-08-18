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
    strictPort: true,
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
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@ffmpeg/core-mt']
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
