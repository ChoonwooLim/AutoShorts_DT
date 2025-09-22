const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const http = require('node:http');
const { spawn } = require('node:child_process');
const crypto = require('crypto');

// FFmpeg 관련
const { path: ffmpegPath } = require('@ffmpeg-installer/ffmpeg');

// Express 관련
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');

const isDev = process.env.NODE_ENV !== 'production';
const rendererUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL;

// 개발 모드에서 Vite https 인증서 무시
if (isDev) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

// app이 사용 가능한지 확인
if (app) {
  if (isDev) {
    app.commandLine.appendSwitch('ignore-certificate-errors');
  }
  
  // SharedArrayBuffer 활성화를 위한 플래그 추가
  app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');
}

// 디스크 캐시 경로와 유저 데이터는 app.whenReady() 이후에 설정
let diskCacheDir;
let userDataDir;
let keysStorePath;

function resolveRootPath(...segments) {
  return path.join(__dirname, '..', ...segments);
}

function resolveDistAppPath(...segments) {
  return path.join(__dirname, '..', 'dist', ...segments);
}

// 파일 URL 생성
function toFileUrl(filePath) {
  return pathToFileURL(filePath).toString();
}

// 간단한 캐시 구현
let cacheBaseDir = null;

function initializeCache(baseDir) {
  cacheBaseDir = path.join(baseDir, 'cache');
  fs.mkdirSync(cacheBaseDir, { recursive: true });
}

function getCachedOutputPath(inputHash) {
  if (!cacheBaseDir) return null;
  return path.join(cacheBaseDir, `${inputHash}.mp3`);
}

function hasCache(inputPath) {
  const hash = crypto.createHash('md5').update(inputPath).digest('hex');
  const cachePath = getCachedOutputPath(hash);
  return cachePath && fs.existsSync(cachePath) ? cachePath : null;
}

function writeCacheFromTemp(inputHash, tempPath) {
  if (!cacheBaseDir) return;
  const cachePath = getCachedOutputPath(inputHash);
  if (cachePath && fs.existsSync(tempPath)) {
    fs.copyFileSync(tempPath, cachePath);
  }
}

// FFmpeg 유틸리티
async function detectHardwareEncoders(ffmpegPath) {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-encoders']);
    let output = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.on('close', () => {
      const hw = {
        h264_nvenc: /\bh264_nvenc\b/.test(output),
        hevc_nvenc: /\bhevc_nvenc\b/.test(output),
        h264_amf: /\bh264_amf\b/.test(output),
        hevc_amf: /\bhevc_amf\b/.test(output),
        h264_qsv: /\bh264_qsv\b/.test(output),
        hevc_qsv: /\bhevc_qsv\b/.test(output),
        h264_videotoolbox: /\bh264_videotoolbox\b/.test(output),
        hevc_videotoolbox: /\bhevc_videotoolbox\b/.test(output)
      };
      resolve(hw);
    });
  });
}

function pickBestH264Encoder(hw) {
  if (process.platform === 'win32') {
    if (hw.h264_nvenc) return 'h264_nvenc';
    if (hw.h264_amf) return 'h264_amf';
    if (hw.h264_qsv) return 'h264_qsv';
  } else if (process.platform === 'darwin') {
    if (hw.h264_videotoolbox) return 'h264_videotoolbox';
  } else {
    if (hw.h264_nvenc) return 'h264_nvenc';
    if (hw.h264_vaapi) return 'h264_vaapi';
  }
  return 'libx264';
}

function buildTranscodeArgs(inputPath, outputPath, videoCodec = 'libx264') {
  return [
    '-i', inputPath,
    '-c:v', videoCodec,
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outputPath
  ];
}

function parseFfmpegProgress(data) {
  const timeMatch = data.match(/time=(\d{2}):(\d{2}):(\d{2})/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = parseInt(timeMatch[3], 10);
    return hours * 3600 + minutes * 60 + seconds;
  }
  return null;
}

// 간단한 포트 찾기 함수
async function findAvailablePort(preferredPorts = [5123, 5124, 5125]) {
  for (const port of preferredPorts) {
    try {
      await new Promise((resolve, reject) => {
        const server = http.createServer();
        server.once('error', reject);
        server.once('listening', () => {
          server.close();
          resolve();
        });
        server.listen(port);
      });
      return port;
    } catch (e) {
      continue;
    }
  }
  
  // 랜덤 포트 사용
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once('error', reject);
    server.once('listening', () => {
      const port = server.address().port;
      server.close();
      resolve(port);
    });
    server.listen(0);
  });
}

let mainWindow = null;
let proxyServer = null;
let proxyPort = null;

async function createWindow() {
  const preload = path.join(__dirname, 'preload.cjs');

  // 메뉴 설정
  const isMac = process.platform === 'darwin';
  
  const template = [
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

  // 브라우저 창 생성
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      webviewTag: false,
      sandbox: false
    }
  });

  // 프록시 서버 시작
  await startProxyServer();

  // 콘텐츠 로드
  const serveRoot = resolveDistAppPath();
  
  if (rendererUrl) {
    // 개발 모드: Vite 서버에서 로드
    await mainWindow.loadURL(rendererUrl);
  } else {
    // 프로덕션 모드: 로컬 파일 시스템에서 로드
    const handler = require('serve-handler');
    const port = await findAvailablePort();
    
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
          ]}
        ]
      });
    });

    await new Promise((resolve) => {
      server.listen(port, 'localhost', () => {
        console.log(`Local server running at http://localhost:${port}`);
        resolve();
      });
    });

    await mainWindow.loadURL(`http://localhost:${port}`);
  }

  // 개발 모드에서 자동으로 개발자 도구 열기
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // 외부 링크 처리
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// 프록시 서버 시작
async function startProxyServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  const upload = multer({ storage: multer.memoryStorage() });

  // OpenAI Whisper 프록시
  app.post('/proxy/openai/whisper', upload.single('file'), async (req, res) => {
    try {
      const formData = new FormData();
      formData.append('file', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
      formData.append('model', req.body.model || 'whisper-1');
      if (req.body.language) formData.append('language', req.body.language);
      formData.append('response_format', 'verbose_json');

      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${req.body.apiKey}`
          },
          maxBodyLength: Infinity
        }
      );

      res.json(response.data);
    } catch (error) {
      console.error('OpenAI proxy error:', error.message);
      res.status(error.response?.status || 500).json({
        error: error.message
      });
    }
  });

  proxyPort = await findAvailablePort([5001, 5002, 5003]);
  proxyServer = app.listen(proxyPort, () => {
    console.log(`Proxy server running on port ${proxyPort}`);
  });
}

// IPC 핸들러 설정 함수
function setupIPCHandlers() {
  ipcMain.handle('app:get-proxy-port', () => proxyPort);

ipcMain.handle('keys:load', () => {
  try {
    if (fs.existsSync(keysStorePath)) {
      const data = fs.readFileSync(keysStorePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load keys:', error);
  }
  return {};
});

ipcMain.handle('keys:save', (event, data) => {
  try {
    fs.mkdirSync(path.dirname(keysStorePath), { recursive: true });
    fs.writeFileSync(keysStorePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save keys:', error);
    return false;
  }
});

ipcMain.handle('ffmpeg:extract-audio', async (event, filePath) => {
  const inputPath = filePath;
  const tempOutput = path.join(app.getPath('temp'), `audio_${Date.now()}.mp3`);

  const cached = hasCache(inputPath);
  if (cached) {
    return fs.readFileSync(cached);
  }

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      '-i', inputPath,
      '-vn',
      '-acodec', 'libmp3lame',
      '-b:a', '128k',
      tempOutput
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        const buffer = fs.readFileSync(tempOutput);
        fs.unlinkSync(tempOutput);
        
        const hash = crypto.createHash('md5').update(inputPath).digest('hex');
        writeCacheFromTemp(hash, tempOutput);
        
        resolve(buffer);
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', reject);
  });
});

ipcMain.handle('ffmpeg:version', async () => {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath, ['-version']);
    let output = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.on('close', () => {
      resolve(output);
    });
  });
});

ipcMain.handle('ffmpeg:transcode', async (event, params) => {
  const { inputPath, outputPath } = params;
  
  const hw = await detectHardwareEncoders(ffmpegPath);
  const videoCodec = pickBestH264Encoder(hw);
  const args = buildTranscodeArgs(inputPath, outputPath, videoCodec);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, args);
    
    ffmpeg.stderr.on('data', (data) => {
      const progress = parseFfmpegProgress(data.toString());
      if (progress !== null) {
        event.sender.send('ffmpeg:progress', { progress });
      }
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', reject);
  });
});

// Common audio extraction function
async function extractAudio(videoPath, quality = 'medium') {
  const tempOutput = path.join(app.getPath('temp'), `audio_${Date.now()}.mp3`);

  const qualitySettings = {
    low: { bitrate: '64k', sampleRate: 22050 },
    medium: { bitrate: '128k', sampleRate: 44100 },
    high: { bitrate: '192k', sampleRate: 48000 }
  };

  const settings = qualitySettings[quality] || qualitySettings.medium;

  return new Promise((resolve, reject) => {
    const args = [
      '-i', videoPath,
      '-vn',
      '-acodec', 'libmp3lame',
      '-b:a', settings.bitrate,
      '-ar', settings.sampleRate,
      '-ac', '2',
      tempOutput
    ];

    const ffmpeg = spawn(ffmpegPath, args);
    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0 && fs.existsSync(tempOutput)) {
        const buffer = fs.readFileSync(tempOutput);
        fs.unlinkSync(tempOutput);
        resolve({ 
          success: true, 
          data: buffer.toString('base64'),
          size: buffer.length
        });
      } else {
        reject(new Error(`FFmpeg failed: ${errorOutput}`));
      }
    });

    ffmpeg.on('error', reject);
  });
}

ipcMain.handle('audio:extract', async (event, params) => {
  const { videoPath, quality = 'medium' } = params;
  return extractAudio(videoPath, quality);
});

ipcMain.handle('audio:extract-from-path', async (event, params) => {
  const { filePath, quality = 'medium' } = params;
  return extractAudio(filePath, quality);
});

ipcMain.handle('file:save-to-temp', async (event, params) => {
  const { fileName, base64Data, append = false } = params;
  const tempPath = path.join(app.getPath('temp'), fileName);
  
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    
    if (append && fs.existsSync(tempPath)) {
      fs.appendFileSync(tempPath, buffer);
    } else {
      fs.writeFileSync(tempPath, buffer);
    }
    
    return { success: true, path: tempPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:save-binary', async (event, params) => {
  const { fileName, data } = params;
  const tempPath = path.join(app.getPath('temp'), fileName);
  
  try {
    const buffer = Buffer.from(data);
    fs.writeFileSync(tempPath, buffer);
    return { success: true, path: tempPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('io:read-file-url', async (event, absolutePath) => {
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }
  
  const buffer = fs.readFileSync(absolutePath);
  const mimeType = absolutePath.endsWith('.mp4') ? 'video/mp4' :
                   absolutePath.endsWith('.mp3') ? 'audio/mpeg' :
                   absolutePath.endsWith('.wav') ? 'audio/wav' :
                   'application/octet-stream';
  
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
});

ipcMain.handle('io:read-file-bytes', async (event, absolutePath) => {
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }
  
  const buffer = fs.readFileSync(absolutePath);
  return Array.from(buffer);
});

ipcMain.handle('stt:openai', async (event, { bytes, language, apiKey }) => {
  try {
    const formData = new FormData();
    const buffer = Buffer.from(bytes);
    
    formData.append('file', buffer, {
      filename: 'audio.mp3',
      contentType: 'audio/mpeg'
    });
    formData.append('model', 'whisper-1');
    if (language) formData.append('language', language);
    formData.append('response_format', 'verbose_json');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${apiKey}`
        },
        maxBodyLength: Infinity
      }
    );

    return response.data;
  } catch (error) {
    console.error('STT error:', error.message);
    throw error;
  }
});

}

// 앱 초기화
if (app) {
  app.whenReady().then(async () => {
  // 캐시/유저 데이터 경로 설정
  diskCacheDir = path.join(app.getPath('temp'), 'AutoShortsCache');
  app.commandLine.appendSwitch('disk-cache-dir', diskCacheDir);
  
  userDataDir = path.join(app.getPath('appData'), 'AutoShorts');
  app.setPath('userData', userDataDir);
  keysStorePath = path.join(userDataDir, 'keys.json');
  
  initializeCache(app.getPath('userData'));
  
  // IPC 핸들러 설정
  setupIPCHandlers();
  
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (proxyServer) {
    proxyServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

  app.on('will-quit', () => {
    if (proxyServer) {
      proxyServer.close();
    }
  });
}