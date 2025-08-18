import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import http from 'node:http';
import handler from 'serve-handler';
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
    const url = rendererUrl || 'https://localhost:5173/index.html';
    await win.loadURL(url);
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

// file 스킴에서 CORS/리소스 접근 이슈를 줄이기 위한 등록
app.whenReady().then(async () => {
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


