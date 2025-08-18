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
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
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
const keysStorePath = path.join(userDataDir, 'keys.json');

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
  const preload = path.join(__dirname, 'preload.cjs');

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
  const tempDir = app.getPath('temp');
  const timestamp = Date.now();
  
  // 먼저 전체 오디오를 MP3로 변환 (더 강력한 압축)
  const fullMp3Path = path.join(tempDir, `as_audio_${timestamp}_full.mp3`);
  const firstArgs = [
    '-y', '-i', filePathArg,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-acodec', 'libmp3lame',
    '-b:a', '32k',  // 32kbps로 더 압축
    '-compression_level', '9',  // 최대 압축
    fullMp3Path
  ];
  
  return new Promise((resolve, reject) => {
    const proc1 = spawn(ffmpegPath, firstArgs);
    let logs = '';
    proc1.stderr.on('data', (d) => (logs += d.toString()));
    proc1.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed: ${logs}`));
        return;
      }
      
      // 파일 크기 확인
      const stats = fs.statSync(fullMp3Path);
      const fileSizeMB = stats.size / (1024 * 1024);
      console.log(`MP3 파일 크기: ${fileSizeMB.toFixed(2)}MB`);
      
      // 10MB 이하면 분할 불필요
      if (fileSizeMB <= 10) {
        resolve({ outPath: fullMp3Path, logs, segmented: false });
        return;
      }
      
      // 10MB 초과 시 분할 (8MB 조각으로 안전하게)
      const segmentCount = Math.ceil(fileSizeMB / 8);
      const duration = await getAudioDuration(fullMp3Path);
      const segmentTime = Math.floor(duration / segmentCount);
      const outputPattern = path.join(tempDir, `as_audio_${timestamp}_%03d.mp3`);
      const listPath = path.join(tempDir, `as_audio_${timestamp}.m3u8`);
      const segmentArgs = [
        '-y', '-i', fullMp3Path,
        '-f', 'segment',
        '-segment_time', String(segmentTime),
        '-segment_list', listPath,
        '-segment_list_type', 'm3u8',
        '-c', 'copy',  // 재인코딩 없이 복사
        '-reset_timestamps', '1',
        outputPattern
      ];
      
      const proc2 = spawn(ffmpegPath, segmentArgs);
      let segLogs = '';
      proc2.stderr.on('data', (d) => (segLogs += d.toString()));
      proc2.on('close', async (code2) => {
        if (code2 === 0) {
          const entries = await fs.promises.readdir(tempDir);
          const files = entries
            .filter(f => f.startsWith(`as_audio_${timestamp}_`) && f.endsWith('.mp3') && !f.includes('_full'))
            .sort()
            .map(f => path.join(tempDir, f));
          // m3u8 파싱으로 정확한 타임스탬프 생성
          let segments = [];
          try {
            const m3u = await fs.promises.readFile(listPath, 'utf-8');
            const lines = m3u.split(/\r?\n/);
            let t = 0;
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (line.startsWith('#EXTINF:')) {
                const dur = parseFloat(line.substring('#EXTINF:'.length));
                const name = lines[i+1];
                segments.push({ start: t, end: t + dur, name });
                t += dur;
              }
            }
          } catch {}
          try { await fs.promises.unlink(listPath); } catch {}
          // 원본 전체 파일 삭제
          try { await fs.promises.unlink(fullMp3Path); } catch {}
          
          console.log(`분할 완료: ${files.length}개 파일 (각 약 ${segmentTime}초)`);
          resolve({ outPaths: files, logs: logs + segLogs, segmented: true, segmentDuration: segmentTime, segmentList: segments });
        } else {
          reject(new Error(`ffmpeg segment failed: ${segLogs}`));
        }
      });
    });
  });
  
  // 오디오 길이 구하기
  async function getAudioDuration(filePath) {
    return new Promise((resolve) => {
      const proc = spawn(ffmpegPath, ['-i', filePath]);
      let output = '';
      proc.stderr.on('data', (d) => (output += d.toString()));
      proc.on('close', () => {
        const match = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
        if (match) {
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const seconds = parseInt(match[3], 10);
          resolve(hours * 3600 + minutes * 60 + seconds);
        } else {
          resolve(120); // 기본값
        }
      });
    });
  }
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

ipcMain.handle('io:read-file-bytes', async (_event, absPath) => {
  try {
    const data = await fs.promises.readFile(absPath);
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  } catch (e) {
    return { __error: e.message };
  }
});

ipcMain.handle('io:delete-files', async (_event, paths) => {
  try {
    if (Array.isArray(paths)) {
      await Promise.all(paths.map(p => fs.promises.unlink(p).catch(() => {})));
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// --- OpenAI Whisper proxy (CORS-free) ---
ipcMain.handle('stt:openai', async (_event, { bytes, language, apiKey }) => {
  try {
    let key = apiKey || '';
    try {
      if (!key && fs.existsSync(keysStorePath)) {
        const raw = await fs.promises.readFile(keysStorePath, 'utf-8');
        const obj = JSON.parse(raw);
        key = obj?.gpt || '';
      }
    } catch {}
    if (!key) throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/mp3' });
    const form = new FormData();
    form.append('file', blob, 'audio.mp3');
    form.append('model', 'whisper-1');
    form.append('language', (language || 'ko').split('-')[0]);
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}` },
      body: form
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`[${res.status}] ${txt}`);
    }
    const data = await res.json();
    return { text: data.text || '' };
  } catch (e) {
    return { __error: e.message };
  }
});

// ---- Secure API key storage (cross-port persistent) ----
ipcMain.handle('keys:load', async () => {
  try {
    if (fs.existsSync(keysStorePath)) {
      const raw = await fs.promises.readFile(keysStorePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}
  return {};
});

ipcMain.handle('keys:save', async (_event, data) => {
  try {
    await fs.promises.mkdir(path.dirname(keysStorePath), { recursive: true });
    await fs.promises.writeFile(keysStorePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});


