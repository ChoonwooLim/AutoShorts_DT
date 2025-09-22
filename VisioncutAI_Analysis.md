## Visioncut.AI 기술 분석 보고서

### 개요
- **앱 유형**: Electron + Vite 기반 데스크톱/웹 하이브리드 앱
- **브랜딩**: Visioncut.AI (UI 타이틀), 코드 제품명/패키징은 현재 AutoShorts 계열 식별자 사용
- **제품명/버전(코드 기준)**: AutoShorts Web 1.0.6 (`package.json`), Electron 패키징 시 `productName: AutoShorts`
- **주요 목적**: 동영상 업로드 → 얼굴 분석(face-api.js) → 오디오 추출/자막화 → 전문 자막 편집 → 숏츠 제작 파이프라인 지원. AI 모델(Claude, GPT, Gemini 등) 연동 및 CORS 회피를 위한 내장 프록시 제공.

### 기술 스택
- 런타임: Node.js + Electron ^31, Vite ^5
- 프론트: ES 모듈, vanilla JS, CSS, 일부 동적 import로 코드 스플리팅
- ML/미디어: face-api.js, @ffmpeg/ffmpeg(wasm), @ffmpeg-installer/ffmpeg(네이티브)
- 서버/프록시: express, multer, axios, cors, serve-handler
- 기타: tensorflow/tfjs, d3-scale, natural(NLP), jszip

### 빌드/실행 스크립트 (`package.json`)
- `dev`: vite 개발 서버 (기본 5173, SSL)
- `dev:electron`: Vite(5174, --strictPort) + Electron 개발 실행 (ELECTRON_RENDERER_URL로 로드)
- `build`: vite build → `dist/`
- `build:app`: `BUILD_TARGET=electron`로 vite 빌드 (상대 base)
- `electron:preview`: NODE_ENV=production 으로 Electron 로컬 로드
- `dist`: build 후 `electron-builder`로 Windows NSIS 인스톨러 생성 (`release/` 산출)

### Electron 구조 (`electron/main.js`, `electron/preload.cjs`)
- 보안: `nodeIntegration=false`, `contextIsolation=true`; 메뉴 정의 및 F12 DevTools 토글 제공
- 개발 모드: HTTPS(5173~5190) 후보 URL 순회 로드. 프로덕션: `serve-handler`로 정적 파일 로컬 HTTP 서빙(COOP/COEP 헤더 추가)
- SharedArrayBuffer 플래그, 디스크 캐시/`userData` 경로 명시, `keys.json`에 API 키 저장
- 프록시 서버 내장: `/api/openai/*`, `/api/assemblyai/*`, `/api/google/speech` 중계. 업로드는 temp 하위에 저장 후 즉시 삭제
- FFmpeg IPC: `ffmpeg:version`, `ffmpeg:extract-audio`(분할/압축), `ffmpeg:transcode`(하드웨어 엔코더 자동 선택, 진행률 이벤트)
- 파일 IPC: 안전 URL/바이트 읽기, 임시 파일 저장/추가/삭제, 바이너리 저장
- 키 저장 IPC: `keys:load/save`로 보안 저장소 핸들러 노출
- preload.cjs: `env`, `nativeFFmpeg`, `electronAPI`, `nativeIO`, `secureKeys`, `sttProxy`, `themeAPI` 브릿지 노출

### Vite 설정 (`vite.config.js`)
- HTTPS 개발 서버 + COOP/COEP 헤더, 에셋 분리(`vendor`, `ffmpeg`), worker 포맷/옵션 지정
- `BUILD_TARGET=electron`이면 `base='./'`, 일반 프로덕션은 현재 `/AutoShortsWeb/` (브랜딩 권장값: `/VisioncutAI/`)
- optimizeDeps에서 ffmpeg wasm 계열 제외

### 프론트엔드 엔트리/흐름 (`index.html`, `js/main.js`)
- `index.html`: 단일 페이지 레이아웃, 다수의 모듈 스크립트 로드. Google API/GIS 스크립트와 콜백 훅(`handleGapiLoaded`, `handleGisLoaded`) 연결
- 초기화(main):
  - API 키 관리자 초기화(`window.apiKeyManager`)
  - 테마/파일 업로드/설정/채팅 이벤트 바인딩
  - 얼굴 분석 시스템 모듈 동적 로드(`face-analysis.js`, `face-analyzer-new.js`)
  - 백그라운드 프리로딩 큐 시작(`lazy-loader`)
  - 자막 추출 완료 이벤트 → 전문 자막 편집기(`subtitle-editor-pro*`) 자동 오픈
  - 배우 얼굴 분석 버튼 → 분석 수행 및 UI 갱신

### 상태/유틸리티
- `js/state.js`: 업로드 파일, 자막, 얼굴 분석 V2 상태, 처리 파이프라인 진행상태, 작업 로그(로컬스토리지 백업) 등 단일 소스 상태
- `js/config.js`: Google Client ID 관리(사용자 지정/localStorage, 기본값 보유)
- `js/dom-elements.js`: 주요 DOM 요소 레퍼런스 집합
- `js/utils/lazy-loader.js`: 모듈 지연 로딩/프리로딩, FFmpeg/face-api 헬퍼 로더 포함
- `js/utils/performance-monitor.js`: PerformanceObserver 기반 로딩/네트워크/메모리/페인트 추적 및 리포트

### 얼굴 분석 (`js/face-analysis.js`)
- face-api.js를 동적 로딩, 환경별 모델/라이브러리 경로 자동 결정
- 1초 간격으로 전체 비디오를 탐색하며 얼굴 탐지/랜드마크/디스크립터/나이/성별 추정
- 동일 인물 매칭(face descriptors → `FaceMatcher`) 및 인물 카드 생성, 병합 기능 제공(재학습 포함)
- 분석 진행률/출현 타임라인/구간 요약 등 UI 구성

### 자막 편집기 (`js/subtitle-editor-pro.js` 및 관련)*
- 전문 편집기 모달 UI/스타일/테이블/파형/일괄 작업/번역/가져오기/내보내기 등 풍부한 기능 구성
- 메서드/이벤트 구현은 `subtitle-editor-pro-methods.js` 등 보조 파일에서 이어짐

### AI 연동 (`js/api.js`)
- 모델 카탈로그: claude, gpt, gemini, groq, openrouter, mistral, deepseek, assemblyai
- 키 저장/로드: Electron 보안 저장소 우선(`secureKeys` IPC), 폴백으로 localStorage. 세션 백업 및 마이그레이션 루틴 포함
- 각 모델별 호출 래퍼: OpenAI 호환 스키마 공통 함수 + 서비스별 맵핑, 이미지 입력 처리, TPM/429 가이드 메시지
- Google Auth: GAPI/GIS 초기화 및 토큰 발급 보조

### 오디오/비디오 처리
- 네이티브 FFmpeg: `@ffmpeg-installer/ffmpeg` 경로 사용, 추출/분할(>10MB 시 segment), 하드웨어 인코딩 지원 탐지(`nvenc/qsv/amf`)
- wasm FFmpeg: 프론트에서 필요 시 `lazyLoader.loadFFmpeg()`로 로딩 (관련 모듈에서 사용)

### 프록시/네트워킹
- Electron 내장 프록시: 앱 시작 시 가용 포트에 express 서버 기동, Whisper/AssemblyAI/Google STT 중계. 업로드는 temp 디렉토리 사용 후 삭제
- 독립 실행 프록시(`proxy-server.js`): 개발 환경에서 포트 3001로 유사 엔드포인트 제공

### 환경 변수/설정
- `env.development` 예시:
```
NODE_ENV=development
VITE_APP_ENV=development
VITE_API_BASE_URL=http://localhost:3000
VITE_AUTOSHORTS_BASE_URL=http://localhost:5173
VITE_ENABLE_HTTPS=false
VITE_GAPI_ENABLED=true
VITE_GIS_ENABLED=true
```
- Vite 서버는 HTTPS 플래그/포트, Electron 개발 모드는 `ELECTRON_RENDERER_URL`로 렌더러 연결

### 빌드/배포 산출물
- `vite build` → `dist/`
- `electron-builder` → `release/`
  - (현 설정) NSIS 인스톨러: `AutoShorts-<version>-Setup.exe` 및 blockmap, `latest.yml`
  - (브랜딩 권장) `productName: VisioncutAI`, 산출물 예: `VisioncutAI-<version>-Setup.exe`
  - `win-unpacked/`에 실행 파일과 런타임, `resources/app.asar` 포함

### 실행 방법 (로컬 개발)
1) 프록시와 Vite를 동시 실행:
```
npm run dev:with-proxy
```
2) Electron 개발 실행(렌더러 URL 지정 방식):
```
npm run dev:electron
```
또는 단순 Electron 개발:
```
npm run electron:dev
```

### 보안/권한 고려사항
- Electron에서 `webSecurity: false`, COOP/COEP 헤더 세트. 파일 시스템 접근은 IPC로 한정, 키는 `userData/keys.json`에 저장(민감정보 취급 유의)
- 업로드/임시 파일은 처리 후 즉시 삭제 시도. 예외 시 잔존 가능성 고려

### 알려진 제약/주의
- Whisper/일부 API는 TPM/요금제 제한에 걸릴 수 있음 → 에러 메시지에 가이드 포함, Gemini 권장
- face-api.js 모델 경로는 배포 경로에 따라 상이 → `public/models` 또는 `dist` 하위 반영 필수
- Vite base 경로(`/AutoShortsWeb/`)로 GitHub Pages 등 정적 호스팅을 염두에 둔 구성

### 폴더 구조 하이라이트
- `electron/`: 메인/프리로드/FFmpeg 유틸/캐시
- `js/`: 앱 로직(엔트리, UI, 상태, AI, 얼굴 분석, 자막 편집 등)
- `public/models/`: face-api.js 모델 가중치(manifest 포함)
- `image/`, `css/`, `index.html`: 정적 자원 및 뷰
- `release/`: 빌드 산출물

### 브랜딩 적용 체크리스트 (Visioncut.AI)
- 제품명/아이디: `package.json > build.productName`, `build.appId`를 Visioncut.AI 네이밍으로 교체
- 설치 아이콘/이미지: `image/AutoShortsIco.ico` 등 아이콘을 Visioncut.AI 자산으로 교체
- 앱 타이틀: `index.html`의 `<title>`은 이미 `VisionCut.AI`로 설정됨(확인 완료)
- Vite base 경로: `vite.config.js`의 프로덕션 `base`를 `/VisioncutAI/`로 변경(정적 호스팅 시)
- 배포 산출물명: electron-builder 산출물 접두사를 `VisioncutAI-`로 통일
- UI 텍스트: 문서/레이블에서 AutoShorts 용어가 남아있는지 최종 점검

### 개선 제안(요약)
- 키 스토리지 암호화 강화(플랫폼 시크릿/OS 키체인 연동) 및 마스킹 로깅
- 프록시 업로드 파일 오류 시 안전 삭제 보장(try/finally 강화)
- 얼굴 분석 시 샘플링율/해상도 동적 조절 옵션 제공으로 처리 시간 제어
- 자막 편집기 기능 분리 및 Web Worker 도입으로 메인 스레드 부하 경감

---
본 문서는 `C:\WORK\AutoShorts_DT` 워크스페이스를 기준으로 작성되었습니다.


