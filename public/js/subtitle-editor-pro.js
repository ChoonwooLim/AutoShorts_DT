// 전문 자막 편집기 모달
class SubtitleEditorPro {
    constructor() {
        this.subtitles = [];
        this.originalSubtitles = [];
        this.currentLanguage = 'ko';
        this.targetLanguage = 'en';
        this.selectedSubtitles = new Set();
        this.videoElement = null;
        this.isPlaying = false;
        this.currentSubtitleIndex = 0;
        this.speakerColors = {};
        this.speakerNames = {};
        
        this.init();
    }

    init() {
        this.createModal();
        // attachEventListeners는 subtitle-editor-pro-methods.js에서 정의됨
        if (this.attachEventListeners) {
            this.attachEventListeners();
        }
        this.loadSettings();
    }

    createModal() {
        // 모달 컨테이너 생성
        const modal = document.createElement('div');
        modal.id = 'subtitleEditorProModal';
        modal.className = 'subtitle-editor-pro-modal';
        modal.innerHTML = `
            <div class="subtitle-editor-content">
                <div class="subtitle-editor-header">
                    <h2>🎬 전문 자막 편집기</h2>
                    <div class="header-actions">
                        <button class="minimize-btn" title="최소화">_</button>
                        <button class="maximize-btn" title="최대화">□</button>
                        <button class="close-btn" title="닫기">✕</button>
                    </div>
                </div>
                
                <!-- 툴바 섹션 -->
                <div class="subtitle-toolbar">
                    <div class="toolbar-group">
                        <button class="toolbar-btn" id="undoBtn" title="실행 취소">
                            <i class="fas fa-undo"></i>
                        </button>
                        <button class="toolbar-btn" id="redoBtn" title="다시 실행">
                            <i class="fas fa-redo"></i>
                        </button>
                        <div class="toolbar-separator"></div>
                        <button class="toolbar-btn" id="cutBtn" title="잘라내기">
                            <i class="fas fa-cut"></i>
                        </button>
                        <button class="toolbar-btn" id="copyBtn" title="복사">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="toolbar-btn" id="pasteBtn" title="붙여넣기">
                            <i class="fas fa-paste"></i>
                        </button>
                        <button class="toolbar-btn" id="deleteBtn" title="삭제">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    
                    <div class="toolbar-group">
                        <button class="toolbar-btn" id="mergeBtn" title="자막 병합">
                            <i class="fas fa-compress"></i> 병합
                        </button>
                        <button class="toolbar-btn" id="splitBtn" title="자막 분할">
                            <i class="fas fa-expand"></i> 분할
                        </button>
                        <button class="toolbar-btn" id="syncBtn" title="싱크 조정">
                            <i class="fas fa-sync"></i> 싱크
                        </button>
                        <button class="toolbar-btn" id="speakerBtn" title="화자 설정">
                            <i class="fas fa-user"></i> 화자
                        </button>
                    </div>

                    <div class="toolbar-group">
                        <button class="toolbar-btn primary" id="translateBtn" title="자막 번역">
                            <i class="fas fa-language"></i> 번역
                        </button>
                        <button class="toolbar-btn" id="spellCheckBtn" title="맞춤법 검사">
                            <i class="fas fa-spell-check"></i> 검사
                        </button>
                        <button class="toolbar-btn" id="findReplaceBtn" title="찾기/바꾸기">
                            <i class="fas fa-search"></i> 찾기
                        </button>
                    </div>

                    <div class="toolbar-group">
                        <select id="exportFormat" class="toolbar-select">
                            <option value="srt">SRT</option>
                            <option value="vtt">WebVTT</option>
                            <option value="ass">ASS/SSA</option>
                            <option value="txt">텍스트</option>
                            <option value="json">JSON</option>
                            <option value="csv">CSV</option>
                        </select>
                        <button class="toolbar-btn success" id="exportBtn" title="내보내기">
                            <i class="fas fa-download"></i> 내보내기
                        </button>
                        <button class="toolbar-btn" id="importBtn" title="가져오기">
                            <i class="fas fa-upload"></i> 가져오기
                        </button>
                    </div>
                </div>

                <!-- 메인 편집 영역 -->
                <div class="subtitle-editor-body">
                    <!-- 비디오 미리보기 -->
                    <div class="video-preview-panel">
                        <div class="video-container">
                            <video id="previewVideo" controls></video>
                            <div class="subtitle-overlay" id="subtitleOverlay"></div>
                        </div>
                        <div class="video-controls">
                            <button id="playPauseBtn" class="video-control-btn">
                                <i class="fas fa-play"></i>
                            </button>
                            <button id="skipBackBtn" class="video-control-btn" title="5초 뒤로">
                                <i class="fas fa-backward"></i>
                            </button>
                            <button id="skipForwardBtn" class="video-control-btn" title="5초 앞으로">
                                <i class="fas fa-forward"></i>
                            </button>
                            <input type="range" id="videoSeeker" class="video-seeker" min="0" max="100" value="0">
                            <span class="time-display">
                                <span id="currentTime">00:00</span> / <span id="totalTime">00:00</span>
                            </span>
                        </div>
                        
                        <!-- 파형 표시 -->
                        <div class="waveform-container" id="waveformContainer">
                            <canvas id="waveformCanvas"></canvas>
                            <div class="waveform-cursor"></div>
                        </div>
                    </div>

                    <!-- 자막 편집 테이블 -->
                    <div class="subtitle-editor-panel">
                        <div class="editor-controls">
                            <div class="search-bar">
                                <input type="text" id="searchInput" placeholder="자막 검색..." />
                                <button id="searchBtn"><i class="fas fa-search"></i></button>
                            </div>
                            <div class="filter-controls">
                                <select id="speakerFilter">
                                    <option value="">모든 화자</option>
                                </select>
                                <button id="selectAllBtn" class="filter-btn">전체 선택</button>
                                <button id="deselectAllBtn" class="filter-btn">선택 해제</button>
                            </div>
                        </div>

                        <div class="subtitle-table-container">
                            <table class="subtitle-table">
                                <thead>
                                    <tr>
                                        <th width="30"><input type="checkbox" id="selectAllCheckbox"></th>
                                        <th width="50">#</th>
                                        <th width="100">시작</th>
                                        <th width="100">종료</th>
                                        <th width="80">화자</th>
                                        <th>원본 자막</th>
                                        <th>번역 자막</th>
                                        <th width="100">작업</th>
                                    </tr>
                                </thead>
                                <tbody id="subtitleTableBody">
                                    <!-- 자막 행들이 여기에 동적으로 추가됨 -->
                                </tbody>
                            </table>
                        </div>

                        <!-- 일괄 작업 패널 -->
                        <div class="batch-actions-panel">
                            <h4>일괄 작업</h4>
                            <div class="batch-controls">
                                <div class="batch-group">
                                    <label>시간 조정 (초):</label>
                                    <input type="number" id="timeAdjustInput" step="0.1" value="0">
                                    <button id="applyTimeAdjustBtn">적용</button>
                                </div>
                                <div class="batch-group">
                                    <label>화자 일괄 변경:</label>
                                    <input type="text" id="batchSpeakerInput" placeholder="화자 이름">
                                    <button id="applyBatchSpeakerBtn">적용</button>
                                </div>
                                <div class="batch-group">
                                    <button id="autoSyncBtn" class="batch-btn">
                                        <i class="fas fa-magic"></i> 자동 싱크 맞추기
                                    </button>
                                    <button id="removeSilenceBtn" class="batch-btn">
                                        <i class="fas fa-volume-mute"></i> 무음 구간 제거
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 상태바 -->
                <div class="subtitle-editor-footer">
                    <div class="status-info">
                        <span>총 자막: <strong id="totalSubtitles">0</strong>개</span>
                        <span>선택됨: <strong id="selectedCount">0</strong>개</span>
                        <span>총 시간: <strong id="totalDuration">00:00:00</strong></span>
                    </div>
                    <div class="progress-info">
                        <span id="statusMessage">준비됨</span>
                    </div>
                    <div class="action-buttons">
                        <button id="saveProjectBtn" class="footer-btn">
                            <i class="fas fa-save"></i> 프로젝트 저장
                        </button>
                        <button id="applyChangesBtn" class="footer-btn primary">
                            <i class="fas fa-check"></i> 변경사항 적용
                        </button>
                    </div>
                </div>
            </div>

            <!-- 번역 설정 모달 -->
            <div id="translateSettingsModal" class="sub-modal" style="display: none;">
                <div class="sub-modal-content">
                    <h3>번역 설정</h3>
                    <div class="form-group">
                        <label>원본 언어:</label>
                        <select id="sourceLangSelect">
                            <option value="ko">한국어</option>
                            <option value="en">영어</option>
                            <option value="ja">일본어</option>
                            <option value="zh">중국어</option>
                            <option value="es">스페인어</option>
                            <option value="fr">프랑스어</option>
                            <option value="de">독일어</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>대상 언어:</label>
                        <select id="targetLangSelect">
                            <option value="en">영어</option>
                            <option value="ko">한국어</option>
                            <option value="ja">일본어</option>
                            <option value="zh">중국어</option>
                            <option value="es">스페인어</option>
                            <option value="fr">프랑스어</option>
                            <option value="de">독일어</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>번역 서비스:</label>
                        <select id="translationService">
                            <option value="google">Google Translate</option>
                            <option value="deepl">DeepL</option>
                            <option value="papago">Papago</option>
                            <option value="openai">OpenAI GPT</option>
                        </select>
                    </div>
                    <div class="modal-actions">
                        <button id="cancelTranslateBtn">취소</button>
                        <button id="startTranslateBtn" class="primary">번역 시작</button>
                    </div>
                </div>
            </div>

            <!-- 찾기/바꾸기 모달 -->
            <div id="findReplaceModal" class="sub-modal" style="display: none;">
                <div class="sub-modal-content">
                    <h3>찾기 및 바꾸기</h3>
                    <div class="form-group">
                        <label>찾을 내용:</label>
                        <input type="text" id="findText" placeholder="검색어 입력">
                    </div>
                    <div class="form-group">
                        <label>바꿀 내용:</label>
                        <input type="text" id="replaceText" placeholder="대체 텍스트">
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="caseSensitive"> 대소문자 구분
                        </label>
                        <label>
                            <input type="checkbox" id="wholeWord"> 단어 단위로
                        </label>
                        <label>
                            <input type="checkbox" id="useRegex"> 정규식 사용
                        </label>
                    </div>
                    <div class="modal-actions">
                        <button id="findNextBtn">다음 찾기</button>
                        <button id="replaceOneBtn">바꾸기</button>
                        <button id="replaceAllBtn">모두 바꾸기</button>
                        <button id="closeFindReplaceBtn">닫기</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 스타일 추가
        this.addStyles();
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .subtitle-editor-pro-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 10000;
                animation: fadeIn 0.3s ease;
            }

            .subtitle-editor-pro-modal.active {
                display: block;
            }
            
            /* 최대화 상태 스타일 */
            .subtitle-editor-pro-modal.maximized .subtitle-editor-content {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                max-width: none !important;
                max-height: none !important;
                border-radius: 0 !important;
                transform: none !important;
            }

            .subtitle-editor-content {
                position: absolute;
                top: 50px;
                left: 50px;
                width: calc(100vw - 100px);
                height: calc(100vh - 100px);
                min-width: 800px;
                min-height: 600px;
                max-width: calc(100vw - 20px);
                max-height: calc(100vh - 20px);
                background: var(--bg-primary, #1a1a1a);
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                animation: slideUp 0.3s ease;
                overflow: hidden;
            }
            
            /* 최소화 상태 스타일 */
            .subtitle-editor-pro-modal.minimized {
                background: transparent;
            }
            
            .subtitle-editor-pro-modal.minimized .subtitle-editor-content {
                display: none;
            }
            
            /* 화면 중앙 정렬을 위한 조정 */
            @media (max-width: 1000px) {
                .subtitle-editor-content {
                    width: calc(100vw - 40px);
                    height: calc(100vh - 40px);
                    left: 20px;
                    top: 20px;
                    min-width: 600px;
                    min-height: 400px;
                }
            }

            .subtitle-editor-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 12px 12px 0 0;
                color: white;
                cursor: move;
                user-select: none;
                position: relative;
                z-index: 1002;
            }

            .subtitle-editor-header h2 {
                margin: 0;
                font-size: 24px;
                font-weight: 600;
            }

            .header-actions {
                display: flex;
                gap: 10px;
            }

            .header-actions button {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                width: 32px;
                height: 32px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.3s;
            }

            .header-actions button:hover {
                background: rgba(255, 255, 255, 0.3);
            }

            .subtitle-toolbar {
                display: flex;
                gap: 20px;
                padding: 15px 20px;
                background: var(--bg-secondary, #2a2a2a);
                border-bottom: 1px solid var(--border-color, #3a3a3a);
                flex-wrap: wrap;
            }

            .toolbar-group {
                display: flex;
                gap: 5px;
                align-items: center;
            }

            .toolbar-btn {
                background: var(--bg-tertiary, #3a3a3a);
                border: 1px solid var(--border-color, #4a4a4a);
                color: var(--text-primary, #e0e0e0);
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.3s;
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 14px;
            }

            .toolbar-btn:hover {
                background: var(--bg-hover, #4a4a4a);
                transform: translateY(-1px);
            }

            .toolbar-btn.primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                color: white;
            }

            .toolbar-btn.success {
                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                border: none;
                color: white;
            }

            .toolbar-separator {
                width: 1px;
                height: 30px;
                background: var(--border-color, #4a4a4a);
                margin: 0 10px;
            }

            .toolbar-select {
                background: var(--bg-tertiary, #3a3a3a);
                border: 1px solid var(--border-color, #4a4a4a);
                color: var(--text-primary, #e0e0e0);
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
            }

            .subtitle-editor-body {
                flex: 1;
                display: flex;
                gap: 20px;
                padding: 20px;
                overflow: hidden;
            }

            .video-preview-panel {
                width: 40%;
                display: flex;
                flex-direction: column;
                gap: 15px;
            }

            .video-container {
                position: relative;
                background: black;
                border-radius: 8px;
                overflow: hidden;
                aspect-ratio: 16/9;
            }

            #previewVideo {
                width: 100%;
                height: 100%;
                object-fit: contain;
            }

            .subtitle-overlay {
                position: absolute;
                bottom: 10%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 18px;
                text-align: center;
                max-width: 80%;
                pointer-events: none;
                text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
            }

            .video-controls {
                display: flex;
                align-items: center;
                gap: 10px;
                background: var(--bg-secondary, #2a2a2a);
                padding: 10px;
                border-radius: 8px;
            }

            .video-control-btn {
                background: var(--bg-tertiary, #3a3a3a);
                border: none;
                color: var(--text-primary, #e0e0e0);
                width: 36px;
                height: 36px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s;
            }

            .video-control-btn:hover {
                background: var(--bg-hover, #4a4a4a);
                transform: scale(1.1);
            }

            .video-seeker {
                flex: 1;
                height: 6px;
                border-radius: 3px;
                background: var(--bg-tertiary, #3a3a3a);
                outline: none;
                cursor: pointer;
            }

            .time-display {
                color: var(--text-secondary, #999);
                font-size: 14px;
                white-space: nowrap;
            }

            .waveform-container {
                height: 100px;
                background: var(--bg-secondary, #2a2a2a);
                border-radius: 8px;
                position: relative;
                overflow: hidden;
            }

            #waveformCanvas {
                width: 100%;
                height: 100%;
            }

            .waveform-cursor {
                position: absolute;
                top: 0;
                width: 2px;
                height: 100%;
                background: #ff4444;
                pointer-events: none;
            }

            .subtitle-editor-panel {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 15px;
            }

            .editor-controls {
                display: flex;
                justify-content: space-between;
                gap: 15px;
                flex-wrap: wrap;
            }

            .search-bar {
                display: flex;
                gap: 10px;
                flex: 1;
                min-width: 250px;
            }

            .search-bar input {
                flex: 1;
                padding: 10px;
                background: var(--bg-tertiary, #3a3a3a);
                border: 1px solid var(--border-color, #4a4a4a);
                color: var(--text-primary, #e0e0e0);
                border-radius: 6px;
            }

            .search-bar button {
                padding: 10px 15px;
                background: var(--bg-tertiary, #3a3a3a);
                border: 1px solid var(--border-color, #4a4a4a);
                color: var(--text-primary, #e0e0e0);
                border-radius: 6px;
                cursor: pointer;
            }

            .filter-controls {
                display: flex;
                gap: 10px;
                align-items: center;
            }

            .filter-controls select {
                padding: 10px;
                background: var(--bg-tertiary, #3a3a3a);
                border: 1px solid var(--border-color, #4a4a4a);
                color: var(--text-primary, #e0e0e0);
                border-radius: 6px;
            }

            .filter-btn {
                padding: 10px 15px;
                background: var(--bg-tertiary, #3a3a3a);
                border: 1px solid var(--border-color, #4a4a4a);
                color: var(--text-primary, #e0e0e0);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.3s;
            }

            .filter-btn:hover {
                background: var(--bg-hover, #4a4a4a);
            }

            .subtitle-table-container {
                flex: 1;
                overflow: auto;
                background: var(--bg-secondary, #2a2a2a);
                border-radius: 8px;
                padding: 10px;
            }

            .subtitle-table {
                width: 100%;
                border-collapse: collapse;
            }

            .subtitle-table thead {
                position: sticky;
                top: 0;
                background: var(--bg-tertiary, #3a3a3a);
                z-index: 10;
            }

            .subtitle-table th {
                padding: 12px;
                text-align: left;
                color: var(--text-secondary, #999);
                font-weight: 600;
                font-size: 14px;
                border-bottom: 2px solid var(--border-color, #4a4a4a);
            }
            
            /* 컬럼 너비 조정 */
            .subtitle-table th:nth-child(1),
            .subtitle-table td:nth-child(1) {
                width: 40px; /* 체크박스 */
            }
            
            .subtitle-table th:nth-child(2),
            .subtitle-table td:nth-child(2) {
                width: 50px; /* 번호 */
            }
            
            .subtitle-table th:nth-child(3),
            .subtitle-table td:nth-child(3) {
                width: 100px; /* 시작 시간 */
            }
            
            .subtitle-table th:nth-child(4),
            .subtitle-table td:nth-child(4) {
                width: 100px; /* 종료 시간 */
            }
            
            .subtitle-table th:nth-child(5),
            .subtitle-table td:nth-child(5) {
                width: 100px; /* 화자 */
            }
            
            .subtitle-table th:nth-child(6),
            .subtitle-table td:nth-child(6) {
                width: 40%; /* 원본 자막 - 더 넓게 */
                min-width: 300px;
            }
            
            .subtitle-table th:nth-child(7),
            .subtitle-table td:nth-child(7) {
                width: 40%; /* 번역 자막 - 더 넓게 */
                min-width: 300px;
            }
            
            .subtitle-table th:nth-child(8),
            .subtitle-table td:nth-child(8) {
                width: 120px; /* 작업 */
            }

            .subtitle-table td {
                padding: 10px;
                border-bottom: 1px solid var(--border-color, #4a4a4a);
                color: var(--text-primary, #e0e0e0);
            }

            .subtitle-table tr:hover {
                background: var(--bg-hover, #333);
            }

            .subtitle-table tr.selected {
                background: rgba(102, 126, 234, 0.2);
            }

            .subtitle-table tr.active {
                background: rgba(102, 126, 234, 0.4);
                animation: pulse 1s infinite;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }

            .subtitle-text-input {
                width: 100%;
                padding: 6px;
                background: var(--bg-tertiary, #3a3a3a);
                border: 1px solid var(--border-color, #4a4a4a);
                color: var(--text-primary, #e0e0e0);
                border-radius: 4px;
                font-size: 14px;
                resize: vertical;
                min-height: 50px;
            }

            .time-input {
                width: 80px;
                padding: 6px;
                background: var(--bg-tertiary, #3a3a3a);
                border: 1px solid var(--border-color, #4a4a4a);
                color: var(--text-primary, #e0e0e0);
                border-radius: 4px;
                font-size: 14px;
                text-align: center;
            }

            .speaker-input {
                width: 100%;
                padding: 6px;
                background: var(--bg-tertiary, #3a3a3a);
                border: 1px solid var(--border-color, #4a4a4a);
                color: var(--text-primary, #e0e0e0);
                border-radius: 4px;
                font-size: 14px;
            }

            .action-buttons-cell {
                display: flex;
                gap: 5px;
            }

            .action-btn {
                padding: 5px;
                background: var(--bg-tertiary, #3a3a3a);
                border: none;
                color: var(--text-primary, #e0e0e0);
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.3s;
            }

            .action-btn:hover {
                background: var(--bg-hover, #4a4a4a);
            }

            .batch-actions-panel {
                background: var(--bg-secondary, #2a2a2a);
                border-radius: 8px;
                padding: 15px;
            }

            .batch-actions-panel h4 {
                margin: 0 0 15px 0;
                color: var(--text-primary, #e0e0e0);
            }

            .batch-controls {
                display: flex;
                gap: 20px;
                flex-wrap: wrap;
            }

            .batch-group {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .batch-group label {
                color: var(--text-secondary, #999);
                font-size: 14px;
            }

            .batch-group input {
                padding: 8px;
                background: var(--bg-tertiary, #3a3a3a);
                border: 1px solid var(--border-color, #4a4a4a);
                color: var(--text-primary, #e0e0e0);
                border-radius: 4px;
                width: 120px;
            }

            .batch-group button,
            .batch-btn {
                padding: 8px 15px;
                background: var(--bg-tertiary, #3a3a3a);
                border: 1px solid var(--border-color, #4a4a4a);
                color: var(--text-primary, #e0e0e0);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.3s;
            }

            .batch-btn:hover {
                background: var(--bg-hover, #4a4a4a);
            }

            .subtitle-editor-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                background: var(--bg-secondary, #2a2a2a);
                border-top: 1px solid var(--border-color, #3a3a3a);
                border-radius: 0 0 12px 12px;
            }

            .status-info {
                display: flex;
                gap: 20px;
                color: var(--text-secondary, #999);
                font-size: 14px;
            }

            .status-info strong {
                color: var(--text-primary, #e0e0e0);
            }

            .progress-info {
                color: var(--text-secondary, #999);
                font-size: 14px;
            }

            .action-buttons {
                display: flex;
                gap: 10px;
            }

            .footer-btn {
                padding: 10px 20px;
                background: var(--bg-tertiary, #3a3a3a);
                border: 1px solid var(--border-color, #4a4a4a);
                color: var(--text-primary, #e0e0e0);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.3s;
                display: flex;
                align-items: center;
                gap: 5px;
            }

            .footer-btn:hover {
                background: var(--bg-hover, #4a4a4a);
            }

            .footer-btn.primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                color: white;
            }

            .sub-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10001;
                background: rgba(0, 0, 0, 0.8);
                border-radius: 12px;
                padding: 2px;
            }

            .sub-modal-content {
                background: var(--bg-primary, #1a1a1a);
                border-radius: 10px;
                padding: 25px;
                min-width: 400px;
            }

            .sub-modal h3 {
                margin: 0 0 20px 0;
                color: var(--text-primary, #e0e0e0);
            }

            .form-group {
                margin-bottom: 15px;
            }

            .form-group label {
                display: block;
                margin-bottom: 5px;
                color: var(--text-secondary, #999);
                font-size: 14px;
            }

            .form-group input,
            .form-group select {
                width: 100%;
                padding: 10px;
                background: var(--bg-tertiary, #3a3a3a);
                border: 1px solid var(--border-color, #4a4a4a);
                color: var(--text-primary, #e0e0e0);
                border-radius: 6px;
            }

            .modal-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 20px;
            }

            .modal-actions button {
                padding: 10px 20px;
                background: var(--bg-tertiary, #3a3a3a);
                border: 1px solid var(--border-color, #4a4a4a);
                color: var(--text-primary, #e0e0e0);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.3s;
            }

            .modal-actions button.primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                color: white;
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes slideUp {
                from { 
                    opacity: 0;
                    transform: translateY(20px);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            /* 다크 테마 지원 */
            @media (prefers-color-scheme: light) {
                .subtitle-editor-pro-modal {
                    --bg-primary: #ffffff;
                    --bg-secondary: #f5f5f5;
                    --bg-tertiary: #e0e0e0;
                    --bg-hover: #d0d0d0;
                    --text-primary: #333333;
                    --text-secondary: #666666;
                    --border-color: #cccccc;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    // 나머지 메서드는 다음 파일에서 계속...
}

// 전역 인스턴스는 subtitle-editor-pro-methods.js가 로드된 후 생성되도록 함
// SubtitleEditorPro 클래스만 먼저 전역에 노출
window.SubtitleEditorPro = SubtitleEditorPro;