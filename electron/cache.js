import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

let cacheBaseDir = null;

export function initializeCache(baseDir) {
  cacheBaseDir = path.join(baseDir, 'cache');
  fs.mkdirSync(cacheBaseDir, { recursive: true });
}

function createCacheKeyForFile(filePath, options = {}) {
  const stat = fs.statSync(filePath);
  const payload = JSON.stringify({
    path: path.resolve(filePath),
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    options
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function getCachedOutputPath(filePath, options = {}, extension = '.flac') {
  if (!cacheBaseDir) throw new Error('Cache not initialized');
  const key = createCacheKeyForFile(filePath, options);
  return path.join(cacheBaseDir, `${key}${extension}`);
}

export function hasCache(filePath, options = {}, extension = '.flac') {
  const outPath = getCachedOutputPath(filePath, options, extension);
  return fs.existsSync(outPath);
}

export function writeCacheFromTemp(tempPath, finalPath) {
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  fs.copyFileSync(tempPath, finalPath);
}


