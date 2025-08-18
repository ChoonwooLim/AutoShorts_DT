import fs from 'node:fs';
import path from 'node:path';

const sourceDir = path.resolve('node_modules/@ffmpeg/core-mt/dist/esm');
const targetDir = path.resolve('ffmpeg');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyAll(src, dst) {
  ensureDir(dst);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyAll(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

try {
  console.log(`Copying FFmpeg core from: ${sourceDir}`);
  copyAll(sourceDir, targetDir);
  console.log(`FFmpeg core copied to: ${targetDir}`);
} catch (e) {
  console.warn('Failed to copy FFmpeg assets:', e.message);
  process.exitCode = 0;
}


