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
    cors: true
  },
  base: process.env.NODE_ENV === 'production' ? '/AutoShortsWeb/' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['@tensorflow/tfjs', 'face-api.js'],
          ffmpeg: ['@ffmpeg/ffmpeg', '@ffmpeg/core-mt']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
