import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const outdir = path.resolve('dist-app');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dst) {
  ensureDir(dst);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

async function optimize() {
  ensureDir(outdir);

  // 1) 정적 파일 복사
  for (const dir of ['image', 'public', 'ffmpeg', 'css']) {
    if (fs.existsSync(dir)) copyDir(dir, path.join(outdir, dir));
  }
  // FFmpeg vendor libs for worker import
  const vendorIn = path.resolve('src/vendor/ffmpeg');
  const vendorOut = path.join(outdir, 'vendor/ffmpeg-lib');
  if (fs.existsSync(vendorIn)) copyDir(vendorIn, vendorOut);
  if (fs.existsSync('index.html')) fs.copyFileSync('index.html', path.join(outdir, 'index.html'));

  // 2) JS 번들링/압축 (코드 스플릿)
  await esbuild.build({
    entryPoints: [
      'js/main.js',
      'js/ui-file.js',
      'js/ui-chat.js',
      'js/ui-options-modal.js',
      'js/ui-settings.js',
      'js/ui-processing.js'
    ],
    outdir: path.join(outdir, 'js'),
    bundle: true,
    splitting: true,
    format: 'esm',
    minify: true,
    sourcemap: false,
    target: ['chrome114'],
    external: [],
    loader: { '.png': 'file', '.webp': 'file' }
  });

  console.log('✅ Optimize complete →', outdir);
}

optimize().catch((e) => { console.error(e); process.exit(1); });


