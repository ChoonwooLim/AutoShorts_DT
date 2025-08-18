import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import http from 'node:http';
import handler from 'serve-handler';
import { ipcMain } from 'electron';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { spawn } from 'node:child_process';
import { initializeCache, getCachedOutputPath, hasCache, writeCacheFromTemp } from './cache.js';
import { detectHardwareEncoders, pickBestH264Encoder, buildTranscodeArgs, parseFfmpegProgress } from './ffmpeg-utils.js';
import getPort from 'get-port';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== 'production';
const rendererUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL;

// 개발 모드에서 Vite https 인증서 무시
if (isDev) {
  app.commandLine.appendSwitch('ignore-certificate-errors');
}

// SharedArrayBuffer 활성화를 위한 플래그 추가 (보완)
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');
// 디스크 캐시 경로 지정(권한 오류 완화)
const diskCacheDir = path.join(app.getPath('temp'), 'AutoShortsCache');
app.commandLine.appendSwitch('disk-cache-dir', diskCacheDir);

// 캐시/유저 데이터 경로 명시 설정으로 권한 이슈 완화
const userDataDir = path.join(app.getPath('appData'), 'AutoShorts');
app.setPath('userData', userDataDir);

function resolveRootPath(...segments) {
  return path.join(__dirname, '..', ...segments);
}

function resolveDistAppPath(...segments) {
  return path.join(__dirname, '..', 'dist', ...segments);
}

// 안전한 file:// 경로 생성
function toFileUrl(filePath) {
  return pathToFileURL(filePath).toString();
}

/**
 * Electron 보안 설정 참고:
 * - nodeIntegration: false
 * - contextIsolation: true
 * - enableRemoteModule: false
 */
async function createWindow() {
  const preload = path.join(__dirname, 'preload.js');

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, '..', 'image', 'AutoShortsIco.ico'),
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true
    }
  });

  // 외부 링크는 기본 브라우저에서 열기
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // dist가 있으면 우선 서빙, 없으면 프로젝트 루트 서빙
  const serveRoot = fs.existsSync(resolveDistAppPath('index.html')) ? resolveDistAppPath() : resolveRootPath();

  if (isDev) {
    const candidates = [];
    if (rendererUrl) {
      candidates.push(rendererUrl);
    }
    for (let p = 5173; p <= 5190; p++) {
      candidates.push(`https://localhost:${p}/index.html`);
    }

    for (const url of candidates) {
      try {
        await tryLoad(win, url);
        break;
      } catch (e) {
        // retry next URL after short delay
        await new Promise(r => setTimeout(r, 300));
      }
    }
  } else {
    // 모든 환경에서 로컬 HTTP 서버로 정적 자산 제공
    const port = await getPort({ port: [5123, 5124, 5125, 0] });
    const server = http.createServer((request, response) => {
      return handler(request, response, {
        public: serveRoot,
        cleanUrls: true,
        directoryListing: false,
        headers: [
          { source: '**/*', headers: [
            { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
            { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
            { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }
          ] },
          { source: '**/*.js', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
          { source: '**/*.css', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
          { source: '**/*.wasm', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }
        ]
      });
    });
    await new Promise((resolve, reject) => {
      server.listen(port, (err) => (err ? reject(err) : resolve()));
    });
    const appUrl = `http://localhost:${port}/index.html`;
    await win.loadURL(appUrl);
  }
  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

function tryLoad(win, url) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      win.webContents.removeListener('did-finish-load', onFinish);
      win.webContents.removeListener('did-fail-load', onFail);
    };
    const onFinish = () => { cleanup(); resolve(true); };
    const onFail = () => { cleanup(); reject(new Error('load failed')); };
    win.webContents.once('did-finish-load', onFinish);
    win.webContents.once('did-fail-load', onFail);
    win.loadURL(url).catch(() => {});
  });
}

// file 스킴에서 CORS/리소스 접근 이슈를 줄이기 위한 등록
app.whenReady().then(async () => {
  initializeCache(app.getPath('userData'));
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- Native FFmpeg IPC ---
ipcMain.handle('ffmpeg:version', async () => {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, ['-version']);
    let output = '';
    proc.stdout.on('data', (d) => (output += d.toString()))
    proc.stderr.on('data', (d) => (output += d.toString()))
    proc.on('close', () => resolve(output.trim()));
  });
});

ipcMain.handle('ffmpeg:extract-audio', async (_event, filePathArg) => {
  const options = { ar: 16000, ac: 1, codec: 'flac' };
  const cachedPath = getCachedOutputPath(filePathArg, options, '.flac');
  if (hasCache(filePathArg, options, '.flac')) {
    return { outPath: cachedPath, logs: 'cache hit' };
  }
  const tempDir = app.getPath('temp');
  const tempOut = path.join(tempDir, `as_audio_${Date.now()}.flac`);
  const args = ['-y', '-i', filePathArg, '-vn', '-ac', String(options.ac), '-ar', String(options.ar), '-acodec', options.codec, tempOut];
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let logs = '';
    proc.stdout.on('data', (d) => (logs += d.toString()))
    proc.stderr.on('data', (d) => (logs += d.toString()))
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code === 0) {
        try {
          writeCacheFromTemp(tempOut, cachedPath);
        } catch {}
        resolve({ outPath: cachedPath, logs });
      } else reject(new Error(`ffmpeg exited with code ${code}: ${logs}`));
    });
  });
});

// Transcode with hardware acceleration if available
ipcMain.handle('ffmpeg:transcode', async (_event, params) => {
  const { input, output, width, height, fps } = params;
  const hw = await detectHardwareEncoders(ffmpegPath);
  const vcodec = pickBestH264Encoder(hw);
  const args = buildTranscodeArgs({ input, output, width, height, fps, videoCodec: vcodec });
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let logs = '';
    proc.stderr.on('data', (d) => {
      const line = d.toString();
      logs += line;
      const prog = parseFfmpegProgress(line);
      if (prog) {
        _event.sender.send('ffmpeg:progress', prog);
      }
    });
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code === 0) resolve({ output, logs, vcodec });
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
});

// Secure file read to blob URL for renderer
ipcMain.handle('io:read-file-url', async (_event, absPath) => {
  // Only allow reading within user data or temp or project directory
  // For demo, allow absolute path but return file:// URL
  return pathToFileURL(absPath).toString();
});


