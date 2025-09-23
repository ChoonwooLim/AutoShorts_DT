import { app, BrowserWindow, shell, Menu } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import http from 'node:http';
import handler from 'serve-handler';
import { ipcMain } from 'electron';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { spawn } from 'node:child_process';
import { initializeCache, getCachedOutputPath, hasCache, writeCacheFromTemp } from './cache.js';
import { detectHardwareEncoders, pickBestH264Encoder, buildTranscodeArgs, parseFfmpegProgress } from './ffmpeg-utils.js';
import getPort from 'get-port';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== 'production';
const rendererUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL;

// FFmpeg 경로 설정
let ffmpegPath;
function setupFfmpegPath() {
  if (app.isPackaged) {
    // 패키징된 앱인 경우, unpacked 리소스에서 ffmpeg 찾기
    const unpackedPath = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      '@ffmpeg-installer',
      process.platform === 'win32' ? 'win32-x64' : process.platform,
      process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    );
    
    if (fs.existsSync(unpackedPath)) {
      ffmpegPath = unpackedPath;
    } else {
      // unpacked에 없으면 ffmpeg-installer의 경로 사용
      ffmpegPath = ffmpegInstaller.path;
    }
  } else {
    // 개발 환경에서는 ffmpeg-installer의 경로 사용
    ffmpegPath = ffmpegInstaller.path;
  }
  
  console.log(`🔧 FFmpeg 경로 설정: ${ffmpegPath}`);
  return ffmpegPath;
}

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

  // 메뉴 설정 (Windows용 수정)
  const isMac = process.platform === 'darwin';
  
  const template = [
    // macOS는 앱 이름이 첫 메뉴
    ...(isMac ? [{
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { 
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              if (browserWindow.webContents.isDevToolsOpened()) {
                browserWindow.webContents.closeDevTools();
              } else {
                browserWindow.webContents.openDevTools({ mode: 'right' });
              }
            }
          }
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Toggle Dark Mode',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('toggle-theme');
            }
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://electronjs.org');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, '..', 'image', 'AutoShortsIco.ico'),
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true,  // 개발자 도구 항상 활성화
      webSecurity: false  // 데스크톱 앱이므로 웹 보안 비활성화
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
            { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' }
            // CSP 헤더 제거 - 데스크톱 앱에서는 불필요
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
    // 개발자 도구를 앱 내부 우측에 표시 (별도 창이 아닌 도킹 모드)
    win.webContents.openDevTools({ mode: 'right' });
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

// 프록시 서버 설정 및 시작
async function startProxyServer() {
  const proxyApp = express();
  const proxyPort = await getPort({ port: [3001, 3002, 3003, 0] });
  
  // 업로드 디렉토리 설정
  const uploadsDir = path.join(app.getPath('temp'), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  const upload = multer({ 
    dest: uploadsDir,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB 제한
  });

  // CORS 설정
  proxyApp.use(cors({
    origin: true,
    credentials: true
  }));

  // JSON 및 URL 인코딩 파싱
  proxyApp.use(express.json({ limit: '50mb' }));
  proxyApp.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 상태 확인 엔드포인트
  proxyApp.get('/api/status', (req, res) => {
    res.json({ status: 'ok', message: 'Proxy server is running in Electron' });
  });

  // OpenAI Whisper API 프록시
  proxyApp.post('/api/openai/transcriptions', upload.single('file'), async (req, res) => {
    try {
      const apiKey = req.headers['authorization']?.replace('Bearer ', '');
      
      if (!apiKey) {
        return res.status(401).json({ error: 'API key is required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Audio file is required' });
      }

      const formData = new FormData();
      formData.append('file', fs.createReadStream(req.file.path), {
        filename: 'audio.webm',
        contentType: req.file.mimetype
      });
      formData.append('model', req.body.model || 'whisper-1');
      
      if (req.body.language) {
        formData.append('language', req.body.language);
      }
      
      if (req.body.response_format) {
        formData.append('response_format', req.body.response_format);
      }

      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            ...formData.getHeaders()
          },
          maxBodyLength: Infinity
        }
      );

      fs.unlinkSync(req.file.path);
      res.json(response.data);
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // AssemblyAI Upload 프록시
  proxyApp.post('/api/assemblyai/upload', upload.single('audio'), async (req, res) => {
    try {
      const apiKey = req.headers['authorization'];
      
      if (!apiKey) {
        return res.status(401).json({ error: 'API key is required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Audio file is required' });
      }

      const audioData = fs.readFileSync(req.file.path);

      const response = await axios.post(
        'https://api.assemblyai.com/v2/upload',
        audioData,
        {
          headers: {
            'authorization': apiKey,
            'content-type': 'application/octet-stream'
          }
        }
      );

      fs.unlinkSync(req.file.path);
      res.json(response.data);
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // AssemblyAI Transcript 프록시
  proxyApp.post('/api/assemblyai/transcript', async (req, res) => {
    try {
      const apiKey = req.headers['authorization'];
      
      if (!apiKey) {
        return res.status(401).json({ error: 'API key is required' });
      }

      const response = await axios.post(
        'https://api.assemblyai.com/v2/transcript',
        req.body,
        {
          headers: {
            'authorization': apiKey,
            'content-type': 'application/json'
          }
        }
      );

      res.json(response.data);
    } catch (error) {
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // AssemblyAI Transcript Status 프록시
  proxyApp.get('/api/assemblyai/transcript/:id', async (req, res) => {
    try {
      const apiKey = req.headers['authorization'];
      
      if (!apiKey) {
        return res.status(401).json({ error: 'API key is required' });
      }

      const response = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${req.params.id}`,
        {
          headers: {
            'authorization': apiKey
          }
        }
      );

      res.json(response.data);
    } catch (error) {
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // Google Speech-to-Text 프록시
  proxyApp.post('/api/google/speech', async (req, res) => {
    try {
      const apiKey = req.query.key;
      
      if (!apiKey) {
        return res.status(401).json({ error: 'API key is required' });
      }

      const response = await axios.post(
        `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
        req.body,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      res.json(response.data);
    } catch (error) {
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // 프록시 서버 시작
  await new Promise((resolve, reject) => {
    proxyApp.listen(proxyPort, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`🚀 Proxy Server running on port ${proxyPort}`);
        resolve();
      }
    });
  });

  return proxyPort;
}

// file 스킴에서 CORS/리소스 접근 이슈를 줄이기 위한 등록
app.whenReady().then(async () => {
  // FFmpeg 경로 초기화
  setupFfmpegPath();
  
  initializeCache(app.getPath('userData'));
  
  // 프록시 서버 시작
  let proxyPort = 3003;
  try {
    proxyPort = await startProxyServer();
    console.log(`✅ Proxy server started on port ${proxyPort}`);
    // 프록시 포트를 전역 변수로 저장
    global.proxyPort = proxyPort;
  } catch (error) {
    console.error('❌ Failed to start proxy server:', error);
  }
  
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

// --- App Info ---
ipcMain.handle('app:get-proxy-port', async () => {
  return global.proxyPort || 3003;
});

// --- Save Binary File ---
ipcMain.handle('file:save-binary', async (_event, { fileName, buffer }) => {
  try {
    const tempDir = app.getPath('temp');
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const tempPath = path.join(tempDir, `temp_${timestamp}_${safeName}`);
    
    // ArrayBuffer를 Buffer로 변환하여 저장
    const nodeBuffer = Buffer.from(buffer);
    fs.writeFileSync(tempPath, nodeBuffer);
    
    console.log(`📁 바이너리 파일 저장: ${tempPath} (${(nodeBuffer.length / 1024 / 1024).toFixed(2)}MB)`);
    return tempPath;
  } catch (error) {
    console.error('❌ 바이너리 파일 저장 실패:', error);
    return null;
  }
});

// --- File Management ---
ipcMain.handle('file:save-to-temp', async (_event, { fileName, data, isBase64, append, tempPath: existingPath }) => {
  try {
    let tempPath;
    
    if (append && existingPath) {
      // 기존 파일에 추가
      tempPath = existingPath;
    } else {
      // 새 파일 생성
      const tempDir = app.getPath('temp');
      const timestamp = Date.now();
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      tempPath = path.join(tempDir, `temp_${timestamp}_${safeName}`);
    }
    
    let buffer;
    if (isBase64) {
      // Base64 문자열로 전달된 경우
      buffer = Buffer.from(data, 'base64');
    } else {
      // Array로 전달된 경우
      buffer = Buffer.from(data);
    }
    
    if (append && existingPath) {
      // 파일에 추가
      fs.appendFileSync(tempPath, buffer);
      const stats = fs.statSync(tempPath);
      console.log(`📝 파일에 추가: ${(buffer.length / 1024 / 1024).toFixed(2)}MB (총: ${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
    } else {
      // 새 파일 작성
      fs.writeFileSync(tempPath, buffer);
      console.log(`📁 임시 파일 생성: ${tempPath} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
    }
    
    return tempPath;
  } catch (error) {
    console.error('❌ 임시 파일 저장 실패:', error);
    return null;
  }
});

// --- Audio Extraction from Path ---
ipcMain.handle('audio:extract-from-path', async (_event, { filePath, fileName, quality = 'high' }) => {
  try {
    console.log(`🎬 파일 경로에서 오디오 추출: ${filePath}`);
    const tempDir = app.getPath('temp');
    const timestamp = Date.now();
    const outputPath = path.join(tempDir, `output_${timestamp}.mp3`);
    
    // 품질 설정에 따른 FFmpeg 파라미터
    let args;
    if (quality === 'high') {
      args = [
        '-y',
        '-i', filePath,
        '-vn',  // 비디오 제거
        '-acodec', 'libmp3lame',
        '-ar', '24000',  // 24kHz
        '-ac', '1',  // 모노
        '-b:a', '96k',  // 96kbps
        '-q:a', '2',
        // 시간 제한 제거 - 전체 비디오 처리
        outputPath
      ];
      console.log('🏆 하이엔드 품질로 오디오 추출');
    } else if (quality === 'medium') {
      args = [
        '-y',
        '-i', filePath,
        '-vn',
        '-acodec', 'libmp3lame',
        '-ar', '16000',
        '-ac', '1',
        '-b:a', '64k',
        '-q:a', '4',
        // 시간 제한 제거
        outputPath
      ];
      console.log('⚖️ 표준 품질로 오디오 추출');
    } else {
      args = [
        '-y',
        '-i', filePath,
        '-vn',
        '-acodec', 'libmp3lame',
        '-ar', '16000',
        '-ac', '1',
        '-b:a', '32k',
        '-q:a', '7',
        // 시간 제한 제거
        outputPath
      ];
      console.log('⚡ 경량 품질로 오디오 추출');
    }
    
    return new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, args);
      let stderr = '';
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      proc.on('close', (code) => {
        // 임시 입력 파일 삭제
        try {
          if (filePath.includes('temp_')) {
            fs.unlinkSync(filePath);
          }
        } catch (e) {}
        
        if (code !== 0) {
          reject(new Error(`FFmpeg failed: ${stderr}`));
          return;
        }
        
        try {
          const audioBuffer = fs.readFileSync(outputPath);
          const audioBase64 = audioBuffer.toString('base64');
          
          // 출력 파일 크기 확인
          const sizeMB = audioBuffer.length / (1024 * 1024);
          console.log(`✅ 오디오 추출 완료: ${sizeMB.toFixed(2)}MB`);
          
          // 임시 출력 파일 삭제
          fs.unlinkSync(outputPath);
          
          resolve({
            success: true,
            audioData: audioBase64
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// --- Audio Extraction for Transcription ---
ipcMain.handle('audio:extract', async (_event, { videoData, fileName, quality = 'high' }) => {
  try {
    const tempDir = app.getPath('temp');
    const timestamp = Date.now();
    const inputPath = path.join(tempDir, `input_${timestamp}.mp4`);
    const outputPath = path.join(tempDir, `output_${timestamp}.mp3`);
    
    // Base64 데이터를 파일로 저장
    const buffer = Buffer.from(videoData, 'base64');
    fs.writeFileSync(inputPath, buffer);
    
    // 품질 설정에 따른 FFmpeg 파라미터
    let args;
    if (quality === 'high') {
      // 하이엔드 품질 (최고 정확도)
      args = [
        '-y',
        '-i', inputPath,
        '-vn',  // 비디오 제거
        '-acodec', 'libmp3lame',  // MP3 코덱
        '-ar', '24000',  // 24kHz (음성 명료도 최적)
        '-ac', '1',  // 모노
        '-b:a', '96k',  // 96kbps
        '-q:a', '2',  // 고품질
        // 시간 제한 제거
        outputPath
      ];
      console.log('🏆 하이엔드 품질로 오디오 추출 (96kbps, 24kHz)');
    } else if (quality === 'medium') {
      // 표준 품질 (균형)
      args = [
        '-y',
        '-i', inputPath,
        '-vn',
        '-acodec', 'libmp3lame',
        '-ar', '16000',  // 16kHz (Whisper 권장)
        '-ac', '1',
        '-b:a', '64k',  // 64kbps
        '-q:a', '4',  // 표준 품질
        // 시간 제한 제거
        outputPath
      ];
      console.log('⚖️ 표준 품질로 오디오 추출 (64kbps, 16kHz)');
    } else {
      // 경량 품질 (빠른 처리)
      args = [
        '-y',
        '-i', inputPath,
        '-vn',
        '-acodec', 'libmp3lame',
        '-ar', '16000',  // 16kHz
        '-ac', '1',
        '-b:a', '32k',  // 32kbps
        '-q:a', '7',  // 낮은 품질
        // 시간 제한 제거
        outputPath
      ];
      console.log('⚡ 경량 품질로 오디오 추출 (32kbps, 16kHz)');
    }
    
    return new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, args);
      let stderr = '';
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      proc.on('close', (code) => {
        // 임시 입력 파일 삭제
        try {
          fs.unlinkSync(inputPath);
        } catch (e) {}
        
        if (code !== 0) {
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
          return;
        }
        
        try {
          // 출력 파일 읽기
          const audioBuffer = fs.readFileSync(outputPath);
          const audioBase64 = audioBuffer.toString('base64');
          
          // 임시 출력 파일 삭제
          fs.unlinkSync(outputPath);
          
          resolve({
            success: true,
            audioData: audioBase64
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
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


