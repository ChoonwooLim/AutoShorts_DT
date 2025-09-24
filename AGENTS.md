# Repository Guidelines
## 에이전트 실행 정책
- 명령 실행 여부를 사용자에게 재확인하지 않고 필요한 경우 자동으로 수행한다.
- 단, 시스템/보안 정책으로 승인이 요구되면 해당 절차를 우선 준수하고 가능한 대안을 검토한다.

## 프로젝트 구조 및 모듈 구성
주요 프런트엔드 스크립트는 기능별로 `js/`에 정리돼 있으며(`ui-*.js`, `subtitle-*.js`, `utils/`), 스타일은 `css/`, 정적 진입점은 `public/index.html`에 있습니다. Electron 메인·프리로드 로직은 `electron/`에, 빌드 결과물은 `dist/`(웹)와 `release/`(설치 파일)에 생성됩니다. IPC 흐름과 리브랜딩 체크리스트는 `VisioncutAI_Analysis.md`에서 확인하세요. 자산·임시 파일·개발 인증서는 각각 `image/`, `uploads/`, `certs/`에 둡니다.

## 빌드 · 테스트 · 개발 실행 명령어
- `npm install` - 런타임과 Electron 의존성을 설치합니다.
- `npm run dev` - `certs/` 인증서를 사용해 https://localhost:5173 에서 Vite 개발 서버를 기동합니다.
- `npm run dev:with-proxy` - Vite와 `proxy-server.js`를 동시에 실행해 로컬 API 프록시를 활성화합니다.
- `npm run dev:electron` - 개발 서버에 연결된 Electron 렌더러를 띄워 디버깅합니다.
- `npm run build` / `npm run build:app` - 웹 또는 Electron 번들을 `dist/`에 생성합니다.
- `npm run electron:preview` - 빌드된 산출물로 프리뷰를 검증합니다.
- `npm run dist` - Windows 설치 프로그램을 `release/`에 패키징합니다.

## 코드 스타일 및 네이밍
들여쓰기는 4칸 공백, ES 모듈, 세미콜론 필수입니다(`js/main.js` 참고). 파일명은 케밥 케이스, 함수·상수는 camelCase, 생성자는 PascalCase를 사용합니다. 기능 모듈 인근에 관련 유틸을 배치하고, 의도가 불분명한 경우에만 짧은 상단 주석을 추가합니다.

## 테스트 지침
자동화 커버리지가 낮으므로 수정 후 수동 검증을 병행합니다. 패키징·의존성 변경 뒤에는 `node electron/test.cjs`로 Electron 로딩을 확인하세요. 미디어·자막 흐름 변경 시 `npm run dev` 상태에서 `test-transcription.html`, `test-subtitle-editor.html`을 열어 동작을 점검합니다.

## 백엔드 및 외부 연동
로컬 MCP 서버와 Render 기반 TwinVerse 백엔드 구성은 `twinverse-backend-setup.md`에서 단계별로 설명합니다. 새 API 엔드포인트를 추가할 때는 해당 문서의 CORS, 업로드 규칙, 환경 변수 표를 따라 Electron 프록시(`proxy-server.js`)와 일관되게 설정하세요.

## AI 협업 및 코드 리뷰
Claude와의 협업 원칙, 비용 공개, 금지 작업, 리뷰 체크리스트는 `CLAUDE.md`에 정리돼 있습니다. 이 문서에서 요약한 기본 지침(기존 기능 보존, UX 영향 진단, 위험 식별)을 준수하고 추가 세부 사항이 필요하면 `CLAUDE.md`를 확인하세요.

## 문서 및 로그 운영
개발 노트 자동화 규칙은 `��������_2025_01_21.md`에 기록돼 있습니다. 새 개발 일지를 추가하거나 `CLAUDE.md` 구조를 변경할 때는 해당 문서가 안내하는 `claudeMdManager.js` 유지보수 지침과 파일 용량 경고 로직을 준수해 자동화를 유지합니다.

## 커밋 · PR 규칙
Git 로그처럼 간결한 명령형 한국어 제목을 사용하고(예: `오디오 추출 기능 리팩토링: 공통 함수 추가`), 본문에는 영향 범위와 환경 변경 사항을 정리합니다. PR에는 작업 요약, 실행한 명령·테스트, 관련 이슈, 검토자 준비 작업, 가능하면 스크린샷이나 영상을 포함하세요.

## 보안 · 설정 팁
민감 정보는 저장소 외부에서 관리하고 `env.development`는 로컬 오버라이드 전용으로 사용합니다. 인증서나 대용량 미디어는 커밋하지 말고 `uploads/` 등 임시 경로와 `.gitignore`를 활용하세요. FFmpeg 경로를 수정할 때는 `electron/ffmpeg-utils.js`와 `VisioncutAI_Analysis.md`의 FFmpeg 챕터를 참고해 동적 탐색 로직과 배포 환경을 유지합니다.

