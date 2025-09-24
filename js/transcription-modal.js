/**
 * 자막 추출 모달 컴포넌트
 * 3가지 고성능 음성 인식 API 통합
 * - OpenAI Whisper
 * - AssemblyAI
 * - Google Cloud Speech-to-Text
 */

class TranscriptionModal {
    constructor() {
        this.modal = null;
        this.currentFile = null;
        this.selectedMethod = 'whisper';
        this.isProcessing = false;
        this.audioContext = null;
        // API 키는 기존 apiKeyManager를 통해 관리 - 초기화 대기
        this.apiKeyManager = null;
        // 자동 닫기 옵션 (기본값: true)
        this.autoCloseOnComplete = true;
    }

    init() {
        this.createModal();
        this.attachEventListeners();
        this.loadSavedSettings();
        
        // apiKeyManager 초기화 확인
        this.initializeApiKeyManager();
    }
    
    initializeApiKeyManager() {
        // apiKeyManager가 준비될 때까지 대기
        if (window.apiKeyManager) {
            this.apiKeyManager = window.apiKeyManager;
            console.log('✅ TranscriptionModal: apiKeyManager 연결됨');
        } else {
            // 1초 후 재시도
            setTimeout(() => this.initializeApiKeyManager(), 1000);
            console.log('⏳ TranscriptionModal: apiKeyManager 대기 중...');
        }
    }

    createModal() {
        const modalHTML = `
            <div id="transcriptionModal" class="modal-overlay" style="display: none;">
                <div class="modal-container">
                    <div class="modal-header">
                        <h2>🎙️ 고급 자막 추출</h2>
                        <button class="modal-close-btn" id="closeTranscriptionModal">&times;</button>
                    </div>
                    
                    <div class="modal-body">
                        <!-- 방식 선택 탭 -->
                        <div class="method-tabs">
                            <button class="method-tab active" data-method="whisper">
                                <div class="method-icon">🤖</div>
                                <div class="method-name">OpenAI Whisper</div>
                                <div class="method-desc">최고 정확도, 다국어 지원</div>
                            </button>
                            <button class="method-tab" data-method="assemblyai">
                                <div class="method-icon">🎯</div>
                                <div class="method-name">AssemblyAI</div>
                                <div class="method-desc">실시간 처리, 화자 분리</div>
                            </button>
                            <button class="method-tab" data-method="google">
                                <div class="method-icon">🌐</div>
                                <div class="method-name">Google STT</div>
                                <div class="method-desc">빠른 속도, 실시간 스트리밍</div>
                            </button>
                        </div>

                        <!-- API 키 안내 -->  
                        <div class="api-key-notice">
                            <span>💡 API 키는 메인 설정에서 관리됩니다</span>
                            <button class="config-key-btn" onclick="document.getElementById('apiSettingsBtn').click()">⚙️ API 키 설정</button>
                        </div>
                        
                        <!-- 옵션 설정 섹션 -->
                        <div class="api-key-section">
                            <div id="whisperSettings" class="method-settings active">
                                <h3>OpenAI Whisper 설정</h3>
                                <div class="setting-group">
                                    <label>모델 선택</label>
                                    <select id="whisperModel" class="setting-select">
                                        <option value="whisper-1">Whisper v1 (기본)</option>
                                    </select>
                                </div>
                                <div class="setting-group">
                                    <label>🎧 오디오 품질 프리셋</label>
                                    <select id="audioQuality" class="setting-select">
                                        <option value="high" selected>🏆 하이엔드 (96kbps, 24kHz) - 최고 정확도</option>
                                        <option value="medium">⚖️ 표준 (64kbps, 16kHz) - 균형</option>
                                        <option value="low">⚡ 경량 (32kbps, 16kHz) - 빠른 처리</option>
                                    </select>
                                    <small style="color: var(--text-secondary, #999); display: block; margin-top: 5px;">
                                        💡 하이엔드: 20분 기준 약 14MB / 표준: 약 9.6MB / 경량: 약 4.8MB
                                    </small>
                                </div>
                                <div class="setting-group">
                                    <label>언어</label>
                                    <select id="whisperLanguage" class="setting-select">
                                        <option value="auto">자동 감지</option>
                                        <option value="en" selected>영어</option>
                                        <option value="ko">한국어</option>
                                        <option value="ja">일본어</option>
                                        <option value="zh">중국어</option>
                                    </select>
                                </div>
                                <div class="feature-options">
                                    <label><input type="checkbox" id="whisperTimestamps" checked> 타임스탬프 포함</label>
                                    <label><input type="checkbox" id="whisperTranslate"> 영어로 번역</label>
                                </div>
                            </div>

                            <div id="assemblyaiSettings" class="method-settings">
                                <h3>AssemblyAI 설정</h3>
                                <div class="setting-group">
                                    <label>언어</label>
                                    <select id="assemblyaiLanguage" class="setting-select">
                                        <option value="en" selected>영어</option>
                                        <option value="ko">한국어</option>
                                        <option value="es">스페인어</option>
                                        <option value="fr">프랑스어</option>
                                        <option value="de">독일어</option>
                                        <option value="ja">일본어</option>
                                        <option value="zh">중국어</option>
                                    </select>
                                </div>
                                <div class="feature-options">
                                    <label><input type="checkbox" id="assemblyaiSpeakers" checked> 화자 분리</label>
                                    <label><input type="checkbox" id="assemblyaiPunctuation" checked> 구두점 자동 추가</label>
                                    <label><input type="checkbox" id="assemblyaiSentiment"> 감정 분석</label>
                                    <label><input type="checkbox" id="assemblyaiChapters"> 자동 챕터 생성</label>
                                </div>
                            </div>

                            <div id="googleSettings" class="method-settings">
                                <h3>Google Speech-to-Text 설정</h3>
                                <div class="api-info-box">
                                    <span>ℹ️ Google STT는 Gemini API 키를 사용합니다</span>
                                </div>
                                <div class="setting-group">
                                    <label>인식 모델</label>
                                    <select id="googleModel" class="setting-select">
                                        <option value="latest_long">최신 장시간 모델</option>
                                        <option value="latest_short">최신 단시간 모델</option>
                                        <option value="video">비디오 전용</option>
                                        <option value="phone_call">전화 통화</option>
                                    </select>
                                </div>
                                <div class="setting-group">
                                    <label>언어</label>
                                    <select id="googleLanguage" class="setting-select">
                                        <option value="en-US" selected>영어 (미국)</option>
                                        <option value="ko-KR">한국어</option>
                                        <option value="en-GB">영어 (영국)</option>
                                        <option value="ja-JP">일본어</option>
                                        <option value="zh-CN">중국어 (간체)</option>
                                    </select>
                                </div>
                                <div class="feature-options">
                                    <label><input type="checkbox" id="googleDiarization"> 화자 분리</label>
                                    <label><input type="checkbox" id="googleProfanity"> 욕설 필터링</label>
                                    <label><input type="checkbox" id="googleWordTime" checked> 단어별 타임스탬프</label>
                                    <label><input type="checkbox" id="googleAutoDetect"> 언어 자동 감지</label>
                                </div>
                            </div>
                        </div>

                        <!-- 진행 상태 표시 -->
                        <div id="transcriptionStatus" class="status-section" style="display: none;">
                            <div class="progress-container">
                                <div class="progress-bar">
                                    <div id="transcriptionProgressBar" class="progress-fill"></div>
                                </div>
                                <div id="progressText" class="progress-text">준비 중...</div>
                            </div>
                            <div id="statusDetails" class="status-details"></div>
                        </div>

                        <!-- 결과 표시 영역 -->
                        <div id="transcriptionResults" class="results-section" style="display: none;">
                            <div class="results-header">
                                <h3>📝 추출된 자막</h3>
                                <div class="results-actions">
                                    <button id="editTranscript" class="action-btn">✏️ 편집</button>
                                    <button id="copyTranscript" class="action-btn">📋 복사</button>
                                    <button id="downloadSRT" class="action-btn">💾 SRT</button>
                                    <button id="downloadVTT" class="action-btn">💾 VTT</button>
                                    <button id="downloadTXT" class="action-btn">💾 TXT</button>
                                </div>
                            </div>
                            <div id="transcriptContent" class="transcript-content" contenteditable="false"></div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button id="startTranscription" class="primary-btn">
                            <span class="btn-icon">🎙️</span>
                            <span class="btn-text">자막 추출 시작</span>
                        </button>
                        <button id="cancelTranscription" class="secondary-btn" style="display: none;">취소</button>
                    </div>
                </div>
            </div>
        `;

        // 스타일 추가
        const styleHTML = `
            <style>
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    animation: fadeIn 0.3s ease;
                }

                .modal-container {
                    background: var(--bg-primary, #1a1a1a);
                    border-radius: 12px;
                    width: 90%;
                    max-width: 800px;
                    max-height: 90vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                    animation: slideUp 0.3s ease;
                }

                .modal-header {
                    padding: 20px;
                    border-bottom: 1px solid var(--border-color, #333);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .modal-header h2 {
                    margin: 0;
                    color: var(--text-primary, #fff);
                    font-size: 1.5rem;
                }

                .modal-close-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary, #999);
                    font-size: 1.5rem;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: all 0.3s;
                }

                .modal-close-btn:hover {
                    background: var(--hover-bg, #333);
                    color: var(--text-primary, #fff);
                }

                .modal-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                }

                .method-tabs {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    margin-bottom: 20px;
                }

                .method-tab {
                    background: var(--card-bg, #2a2a2a);
                    border: 2px solid transparent;
                    border-radius: 8px;
                    padding: 15px;
                    cursor: pointer;
                    transition: all 0.3s;
                    text-align: center;
                }

                .method-tab:hover {
                    background: var(--hover-bg, #333);
                    transform: translateY(-2px);
                }

                .method-tab.active {
                    border-color: var(--primary-color, #4CAF50);
                    background: var(--active-bg, #2d4a2d);
                }

                .method-icon {
                    font-size: 2rem;
                    margin-bottom: 8px;
                }

                .method-name {
                    font-weight: bold;
                    color: var(--text-primary, #fff);
                    margin-bottom: 4px;
                }

                .method-desc {
                    font-size: 0.85rem;
                    color: var(--text-secondary, #999);
                }

                .method-settings {
                    display: none;
                    animation: fadeIn 0.3s;
                }

                .method-settings.active {
                    display: block;
                }

                .setting-group {
                    margin-bottom: 15px;
                }

                .setting-group label {
                    display: block;
                    color: var(--text-primary, #fff);
                    margin-bottom: 5px;
                    font-weight: 500;
                }

                .api-key-notice {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px;
                    background: var(--info-bg, rgba(33, 150, 243, 0.1));
                    border: 1px solid var(--info-border, rgba(33, 150, 243, 0.3));
                    border-radius: 8px;
                    margin-bottom: 20px;
                }

                .api-key-notice span {
                    color: var(--text-primary, #fff);
                    font-size: 0.9rem;
                }

                .api-info-box {
                    padding: 10px;
                    background: var(--info-bg, rgba(33, 150, 243, 0.1));
                    border-left: 3px solid var(--info-color, #2196F3);
                    border-radius: 4px;
                    margin-bottom: 15px;
                    font-size: 0.9rem;
                    color: var(--text-primary, #fff);
                }

                .input-with-button {
                    display: flex;
                    gap: 10px;
                }

                .config-key-btn {
                    padding: 8px 12px;
                    background: var(--primary-color, #4CAF50);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.3s;
                    font-size: 0.9rem;
                }

                .config-key-btn:hover {
                    background: var(--primary-hover, #45a049);
                    transform: translateY(-1px);
                }

                .setting-select {
                    width: 100%;
                    padding: 10px;
                    background: var(--input-bg, #2a2a2a);
                    border: 1px solid var(--border-color, #444);
                    border-radius: 6px;
                    color: var(--text-primary, #fff);
                }

                .feature-options {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    margin-top: 15px;
                }

                .feature-options label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--text-primary, #fff);
                    cursor: pointer;
                }

                .feature-options input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                }

                .status-section {
                    background: var(--card-bg, #2a2a2a);
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                }

                .progress-container {
                    margin-bottom: 15px;
                }

                .progress-bar {
                    height: 20px;
                    background: var(--progress-bg, #333);
                    border-radius: 10px;
                    overflow: hidden;
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #4CAF50, #45a049);
                    width: 0%;
                    transition: width 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .progress-text {
                    text-align: center;
                    color: var(--text-primary, #fff);
                    margin-top: 10px;
                    font-weight: 500;
                }

                .status-details {
                    color: var(--text-secondary, #999);
                    font-size: 0.9rem;
                    margin-top: 10px;
                }

                .results-section {
                    background: var(--card-bg, #2a2a2a);
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                }

                .results-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }

                .results-header h3 {
                    margin: 0;
                    color: var(--text-primary, #fff);
                }

                .results-actions {
                    display: flex;
                    gap: 8px;
                }

                .action-btn {
                    padding: 6px 12px;
                    background: var(--button-bg, #444);
                    color: var(--text-primary, #fff);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    transition: all 0.3s;
                }

                .action-btn:hover {
                    background: var(--button-hover, #555);
                    transform: translateY(-1px);
                }

                .transcript-content {
                    background: var(--input-bg, #1a1a1a);
                    border: 1px solid var(--border-color, #444);
                    border-radius: 6px;
                    padding: 15px;
                    min-height: 200px;
                    max-height: 300px;
                    overflow-y: auto;
                    color: var(--text-primary, #fff);
                    line-height: 1.6;
                    white-space: pre-wrap;
                }

                .transcript-content[contenteditable="true"] {
                    background: var(--editable-bg, #222);
                    outline: 2px solid var(--primary-color, #4CAF50);
                }

                .modal-footer {
                    padding: 20px;
                    border-top: 1px solid var(--border-color, #333);
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                }

                .primary-btn, .secondary-btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 6px;
                    font-size: 1rem;
                    font-weight: 500;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.3s;
                }

                .primary-btn {
                    background: var(--primary-color, #4CAF50);
                    color: white;
                }

                .primary-btn:hover {
                    background: var(--primary-hover, #45a049);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
                }

                .primary-btn:disabled {
                    background: var(--disabled-bg, #666);
                    cursor: not-allowed;
                    transform: none;
                }

                .secondary-btn {
                    background: var(--secondary-color, #666);
                    color: white;
                }

                .secondary-btn:hover {
                    background: var(--secondary-hover, #777);
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                .timestamp-line {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 10px;
                    padding: 8px;
                    background: var(--timestamp-bg, #333);
                    border-radius: 4px;
                }

                .timestamp {
                    color: var(--timestamp-color, #4CAF50);
                    font-weight: bold;
                    min-width: 80px;
                }

                .speaker-label {
                    color: var(--speaker-color, #ffa500);
                    font-weight: bold;
                    margin-right: 5px;
                }
            </style>
        `;

        // DOM에 추가
        const styleElement = document.createElement('style');
        styleElement.innerHTML = styleHTML.replace(/<style>|<\/style>/g, '');
        document.head.appendChild(styleElement);

        const modalElement = document.createElement('div');
        modalElement.innerHTML = modalHTML;
        document.body.appendChild(modalElement.firstElementChild);

        this.modal = document.getElementById('transcriptionModal');
    }

    attachEventListeners() {
        // 모달 닫기
        document.getElementById('closeTranscriptionModal').addEventListener('click', () => this.close());
        
        // 방식 탭 전환
        document.querySelectorAll('.method-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const method = e.currentTarget.dataset.method;
                this.switchMethod(method);
            });
        });

        // API 키 상태 업데이트 제거 - 불필요

        // 시작 버튼
        document.getElementById('startTranscription').addEventListener('click', () => this.startTranscription());

        // 취소 버튼
        document.getElementById('cancelTranscription').addEventListener('click', () => this.cancelTranscription());

        // 결과 액션 버튼들
        document.getElementById('editTranscript').addEventListener('click', () => this.toggleEdit());
        document.getElementById('copyTranscript').addEventListener('click', () => this.copyTranscript());
        document.getElementById('downloadSRT').addEventListener('click', () => this.downloadSubtitle('srt'));
        document.getElementById('downloadVTT').addEventListener('click', () => this.downloadSubtitle('vtt'));
        document.getElementById('downloadTXT').addEventListener('click', () => this.downloadSubtitle('txt'));
    }

    switchMethod(method) {
        // 탭 활성화
        document.querySelectorAll('.method-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.method === method);
        });

        // 설정 패널 전환
        document.querySelectorAll('.method-settings').forEach(settings => {
            settings.classList.toggle('active', settings.id === `${method}Settings`);
        });

        this.selectedMethod = method;
    }

    async getApiKey(provider) {
        // apiKeyManager 재확인
        if (!this.apiKeyManager && window.apiKeyManager) {
            this.apiKeyManager = window.apiKeyManager;
            console.log('✅ getApiKey: apiKeyManager 재연결');
        }
        
        if (!this.apiKeyManager) {
            console.error('❌ apiKeyManager가 없습니다');
            return null;
        }
        
        let apiKey = null;
        
        // 각 프로바이더별로 가능한 키 이름들 확인
        if (provider === 'whisper' || provider === 'openai') {
            // OpenAI Whisper는 'gpt' 또는 'openai' 키 사용
            apiKey = this.apiKeyManager.loadApiKey('gpt') || 
                     this.apiKeyManager.loadApiKey('openai');
            console.log(`🔑 OpenAI/Whisper 키 확인: ${apiKey ? '있음' : '없음'}`);
        } else if (provider === 'assemblyai') {
            // AssemblyAI는 독립적인 키
            apiKey = this.apiKeyManager.loadApiKey('assemblyai');
            console.log(`🔑 AssemblyAI 키 확인: ${apiKey ? '있음' : '없음'}`);
        } else if (provider === 'google') {
            // Google STT는 Gemini 키 사용
            apiKey = this.apiKeyManager.loadApiKey('gemini') || 
                     this.apiKeyManager.loadApiKey('google');
            console.log(`🔑 Google/Gemini 키 확인: ${apiKey ? '있음' : '없음'}`);
        }
        
        return apiKey;
    }

    // API 키 상태 확인 제거 - 메인 시스템에서 관리

    loadSavedSettings() {
        // 설정 로드 - API 키는 메인 시스템에서 관리
    }

    open(file) {
        this.currentFile = file;
        this.modal.style.display = 'flex';
        this.resetUI();
        
        // 모달을 열 때마다 apiKeyManager 확인
        if (!this.apiKeyManager && window.apiKeyManager) {
            this.apiKeyManager = window.apiKeyManager;
            console.log('✅ TranscriptionModal: apiKeyManager 재연결됨');
        }
    }

    close() {
        this.modal.style.display = 'none';
        this.cancelTranscription();
        this.resetUI();
    }

    resetUI() {
        document.getElementById('transcriptionStatus').style.display = 'none';
        document.getElementById('transcriptionResults').style.display = 'none';
        document.getElementById('startTranscription').style.display = 'block';
        document.getElementById('cancelTranscription').style.display = 'none';
        document.getElementById('transcriptionProgressBar').style.width = '0%';
        document.getElementById('progressText').textContent = '준비 중...';
        document.getElementById('statusDetails').textContent = '';
        document.getElementById('transcriptContent').innerHTML = '';
    }

    updateProgress(percent, message, details = '') {
        document.getElementById('transcriptionStatus').style.display = 'block';
        document.getElementById('transcriptionProgressBar').style.width = `${percent}%`;
        document.getElementById('progressText').textContent = message;
        document.getElementById('statusDetails').textContent = details;
    }

    async startTranscription() {
        if (!this.currentFile) {
            alert('영상 파일을 먼저 업로드해주세요.');
            return;
        }

        // FFmpeg 로드 확인 및 초기화
        if (!window.ffmpeg || !window.ffmpeg.isLoaded) {
            console.log('📦 FFmpeg.wasm 로딩 중...');
            this.updateProgress(5, 'FFmpeg 초기화 중...', '오디오 추출 준비 중입니다.');
            
            // FFmpeg 로드 시도
            if (window.loadFFmpeg) {
                try {
                    await window.loadFFmpeg();
                    console.log('✅ FFmpeg.wasm 로드 완료');
                } catch (error) {
                    console.warn('⚠️ FFmpeg.wasm 로드 실패, 대체 방법 사용:', error);
                }
            }
        }

        // API 키 확인
        let apiKey;
        let providerName;
        
        switch(this.selectedMethod) {
            case 'whisper':
                apiKey = await this.getApiKey('whisper');
                providerName = 'OpenAI';
                break;
            case 'assemblyai':
                apiKey = await this.getApiKey('assemblyai');
                providerName = 'AssemblyAI';
                break;
            case 'google':
                apiKey = await this.getApiKey('google');
                providerName = 'Google';
                break;
        }
        
        if (!apiKey) {
            let message = `${providerName} API 키가 설정되지 않았습니다.\n\n⚙️ API 키 설정 버튼을 클릭하여 키를 입력해주세요.`;
            
            // 각 서비스별 추가 안내
            if (this.selectedMethod === 'google') {
                message += '\n\n💡 팁: Google STT는 Gemini API 키를 사용합니다.';
            } else if (this.selectedMethod === 'whisper') {
                message += '\n\n💡 팁: OpenAI Whisper는 GPT API 키를 사용합니다.';
            }
            
            alert(message);
            // API 설정 모달 열기
            document.getElementById('apiSettingsBtn')?.click();
            return;
        }

        this.isProcessing = true;
        document.getElementById('startTranscription').disabled = true;
        document.getElementById('startTranscription').querySelector('.btn-text').textContent = '처리 중...';
        document.getElementById('cancelTranscription').style.display = 'block';

        try {
            // 오디오 추출
            this.updateProgress(10, '오디오 추출 중...', '영상에서 음성 데이터를 추출하고 있습니다.');
            const audioData = await this.extractAudio(this.currentFile);

            // 선택된 방식에 따라 처리
            let result;
            switch (this.selectedMethod) {
                case 'whisper':
                    result = await this.transcribeWithWhisper(audioData);
                    break;
                case 'assemblyai':
                    result = await this.transcribeWithAssemblyAI(audioData);
                    break;
                case 'google':
                    result = await this.transcribeWithGoogle(audioData);
                    break;
            }

            // 결과 표시
            this.displayResults(result);

        } catch (error) {
            console.error('🔴 자막 추출 실패:', error);
            
            // 오류 상세 정보 표시
            let errorMessage = '자막 추출 중 오류가 발생했습니다.\n\n';
            
            // 오류 유형별 안내
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMessage += '❌ 네트워크 오류\n';
                errorMessage += '인터넷 연결을 확인하거나 API 서비스 상태를 확인해주세요.\n';
                errorMessage += '브라우저 CORS 정책으로 인해 일부 API가 차단될 수 있습니다.\n\n';
            } else if (error.message.includes('CORS') || error.message.includes('Cross-Origin')) {
                errorMessage += '🔒 CORS 오류\n';
                errorMessage += '브라우저 보안 정책으로 인해 직접 API 호출이 차단되었습니다.\n';
                errorMessage += '프록시 서버를 사용하거나 백엔드 서버를 통해 호출해야 합니다.\n\n';
            } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                errorMessage += '🔐 인증 오류\n';
                errorMessage += 'API 키가 올바르지 않거나 만료되었습니다.\n';
                errorMessage += 'API 키 설정을 다시 확인해주세요.\n\n';
            } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
                errorMessage += '🚫 권한 오류\n';
                errorMessage += 'API 사용 권한이 없거나 할당량을 초과했습니다.\n\n';
            } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
                errorMessage += '⏱️ 요청 제한 초과\n';
                errorMessage += '잠시 후 다시 시도해주세요.\n\n';
            } else if (error.message.includes('413') || error.message.includes('too large')) {
                errorMessage += '📦 파일 크기 초과\n';
                errorMessage += '파일이 너무 큽니다. 더 작은 파일로 시도해주세요.\n\n';
            }
            
            errorMessage += `상세 오류: ${error.message}`;
            
            // 진행 상태에 오류 표시
            this.updateProgress(0, '❌ 자막 추출 실패', error.message);
            
            // 알림 표시
            alert(errorMessage);
            
            // 상태 섹션에 오류 정보 유지
            document.getElementById('statusDetails').innerHTML = `
                <div style="color: var(--error-color, #f44336); margin-top: 10px;">
                    <strong>오류 발생:</strong><br>
                    ${error.message}<br><br>
                    <small>콘솔에서 자세한 정보를 확인하세요.</small>
                </div>
            `;
        } finally {
            this.isProcessing = false;
            document.getElementById('startTranscription').disabled = false;
            document.getElementById('startTranscription').querySelector('.btn-text').textContent = '자막 추출 시작';
            document.getElementById('cancelTranscription').style.display = 'none';
        }
    }

    async transcribeWithWhisperSegments(audioData) {
        // 대용량 오디오 파일을 여러 세그먼트로 분할하여 처리
        const maxSize = 24 * 1024 * 1024; // 24MB
        const totalSize = audioData.size;
        const segmentCount = Math.ceil(totalSize / maxSize);
        const allSegments = [];
        let lastEndTime = 0;
        
        console.log(`📊 총 ${segmentCount}개 세그먼트로 분할 처리`);
        
        for (let i = 0; i < segmentCount; i++) {
            const start = i * maxSize;
            const end = Math.min(start + maxSize, totalSize);
            const segmentBlob = audioData.slice(start, end);
            const segmentNum = i + 1;
            
            this.updateProgress(
                30 + (40 * i / segmentCount), 
                `세그먼트 ${segmentNum}/${segmentCount} 처리 중...`,
                `각 세그먼트를 순차적으로 처리합니다.`
            );
            
            console.log(`🎙️ 세그먼트 ${segmentNum}/${segmentCount} 처리 중...`);
            
            const formData = new FormData();
            formData.append('file', segmentBlob, `audio_segment_${i}.mp3`);
            formData.append('model', 'whisper-1');
            
            const language = document.getElementById('whisperLanguage').value;
            if (language !== 'auto') {
                formData.append('language', language);
            }
            
            // 타임스탬프 요청
            if (document.getElementById('whisperTimestamps').checked) {
                formData.append('response_format', 'verbose_json');
                formData.append('timestamp_granularities', 'segment');
            }
            
            // 프롬프트에 이전 컨텍스트 포함
            const lastText = allSegments.length > 0 ? 
                allSegments[allSegments.length - 1].text?.slice(-200) : '';
            formData.append('prompt', `이전 내용: ${lastText}\n이 오디오를 정확하게 전사해주세요.`);
            
            try {
                // 프록시 URL 설정
                let proxyUrl;
                if (window.env && window.env.isElectron) {
                    const proxyPort = window.electronAPI && window.electronAPI.getProxyPort 
                        ? await window.electronAPI.getProxyPort() 
                        : 3003;
                    proxyUrl = `http://localhost:${proxyPort}`;
                } else if (window.location.hostname === 'localhost') {
                    proxyUrl = 'http://localhost:3001';
                } else {
                    proxyUrl = '';
                }
                
                // apiKey를 FormData에 추가 (Electron 프록시 요구사항)
                const apiKey = await this.getApiKey('openai');

            const cloneFormData = (source) => {
                const copy = new FormData();
                source.forEach((value, key) => {
                    copy.append(key, value);
                });
                return copy;
            };

            const buildRequestOptions = (includeApiKey) => {
                const payload = cloneFormData(formData);
                if (includeApiKey) {
                    payload.append('apiKey', apiKey);
                }
                return {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: payload
                };
            };

            let response = await fetch(`${proxyUrl}/proxy/openai/whisper`, buildRequestOptions(true));

            if (response.status === 404) {
                console.warn('⚠️ Whisper proxy route missing. Falling back to /api/openai/transcriptions');
                response = await fetch(`${proxyUrl}/api/openai/transcriptions`, buildRequestOptions(false));
            }
<<<<<<< HEAD
=======
        }
        
        // 모든 세그먼트 병합
        const mergedResult = {
            text: allSegments.map(s => s.text).join(' '),
            segments: allSegments
        };
        
        console.log(`✅ 총 ${allSegments.length}개 세그먼트 처리 완료`);
        return mergedResult;
    }

    async extractAudio(file) {
        console.log('🎵 오디오 추출 시작...');
        
        // 품질 설정 가져오기
        const qualitySelect = document.getElementById('audioQuality');
        const quality = qualitySelect ? qualitySelect.value : 'high'; // 기본값: 하이엔드
        
        // Electron 환경에서는 IPC를 통해 네이티브 FFmpeg 사용
        if (window.electronAPI && window.electronAPI.extractAudio) {
            try {
                console.log('📦 네이티브 FFmpeg를 사용하여 오디오 추출 중...');
                this.updateProgress(15, '네이티브 FFmpeg로 오디오 추출 중...', '대용량 파일 처리 중입니다.');
                
                console.log('📦 파일 크기:', (file.size / 1024 / 1024).toFixed(2), 'MB');
                
                // 파일 크기에 따라 다른 처리 방식 사용
                
                if (file.size > 10 * 1024 * 1024) {
                    // 10MB 이상: File 객체의 path 속성 직접 사용 (Electron 환경)
                    console.log('🔧 대용량 파일 - 파일 경로 직접 사용');
                    
                    // Electron 환경에서 File 객체는 path 속성을 가질 수 있음
                    let filePath = null;
                    
                    // 방법 1: File 객체의 path 속성 확인
                    if (file.path) {
                        filePath = file.path;
                        console.log('📍 File.path 사용:', filePath);
                    } 
                    // 방법 2: webkitRelativePath 확인
                    else if (file.webkitRelativePath) {
                        filePath = file.webkitRelativePath;
                        console.log('📍 webkitRelativePath 사용:', filePath);
                    }
                    // 방법 3: Blob URL 생성 후 처리
                    else {
                        console.log('📁 Blob으로 임시 파일 생성 중...');
                        
                        // Blob URL 생성
                        const blobUrl = URL.createObjectURL(file);
                        
                        // Electron의 nativeIO를 통해 파일 저장
                        if (window.nativeIO && window.nativeIO.saveBlobToFile) {
                            filePath = await window.nativeIO.saveBlobToFile({
                                blobUrl: blobUrl,
                                fileName: file.name
                            });
                            URL.revokeObjectURL(blobUrl);
                        } else {
                            // 폴백: FileReader 사용
                            console.log('📝 FileReader로 파일 읽기...');
                            const buffer = await file.arrayBuffer();
                            const uint8Array = new Uint8Array(buffer);
                            
                            // 바이너리 데이터를 직접 전송
                            const tempPath = await window.electronAPI.saveBinaryFile({
                                fileName: file.name,
                                buffer: buffer
                            });
                            filePath = tempPath;
                        }
                    }
                    
                    if (filePath) {
                        console.log('📍 파일 경로:', filePath);
                        
                        // 파일 경로로 직접 오디오 추출
                        const result = await window.electronAPI.extractAudioFromPath({
                            filePath: filePath,
                            fileName: file.name,
                            quality: quality
                        });
                        
                        if (result && result.success) {
                            // result.data 또는 result.audioData 체크
                            const base64Data = result.data || result.audioData;
                            if (!base64Data) {
                                console.error('❌ 오디오 데이터가 없습니다:', result);
                                throw new Error('오디오 데이터가 반환되지 않았습니다');
                            }
                            const binaryString = atob(base64Data);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            const audioBlob = new Blob([bytes], { type: 'audio/ogg' });
                            console.log('✅ 대용량 파일 오디오 추출 완료:', (audioBlob.size / 1024 / 1024).toFixed(2), 'MB');
                            return audioBlob;
                        } else if (result && result.error) {
                            console.error('❌ FFmpeg 오류:', result.error);
                            throw new Error(result.error);
                        }
                    }
                } else {
                    // 10MB 미만: Base64로 변환하여 전송
                    console.log('📤 일반 파일 - Base64 변환 후 전송');
                    
                    const arrayBuffer = await file.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    
                    // 청크 단위로 Base64 변환 (메모리 오버플로우 방지)
                    const chunkSize = 65536; // 64KB 청크로 증가
                    for (let i = 0; i < uint8Array.length; i += chunkSize) {
                        const chunk = uint8Array.slice(i, i + chunkSize);
                        base64 += btoa(String.fromCharCode.apply(null, chunk));
                        
                        // 진행률 업데이트
                        if (i % (1024 * 1024) === 0) {
                            const progress = Math.min(15 + (i / uint8Array.length) * 10, 25);
                            this.updateProgress(progress, '파일 변환 중...', `${((i / uint8Array.length) * 100).toFixed(0)}% 완료`);
                        }
                    }
                    
                    // IPC를 통해 오디오 추출 요청
                    const result = await window.electronAPI.extractAudio({
                        videoData: base64,
                        fileName: file.name,
                        quality: quality
                    });
                    
                    if (result && result.success) {
                        const binaryString = atob(result.audioData);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        const audioBlob = new Blob([bytes], { type: 'audio/ogg' });
                        console.log('✅ 네이티브 FFmpeg로 오디오 추출 완료:', (audioBlob.size / 1024 / 1024).toFixed(2), 'MB');
                        return audioBlob;
                    }
                }
            } catch (error) {
                console.error('❌ 네이티브 FFmpeg 오디오 추출 실패:', error);
            }
        }
        
        // FFmpeg.wasm을 사용한 오디오 추출 (브라우저 환경)
        if (window.ffmpeg && window.ffmpeg.isLoaded) {
            try {
                console.log('📦 FFmpeg.wasm을 사용하여 오디오 추출 중...');
                this.updateProgress(15, 'FFmpeg.wasm으로 오디오 추출 중...', '처리 중입니다.');
                
                // 파일을 ArrayBuffer로 읽기
                const arrayBuffer = await file.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                // FFmpeg 파일 시스템에 비디오 파일 쓰기
                await window.ffmpeg.FS('writeFile', 'input.mp4', uint8Array);
                
                // FFmpeg로 오디오 추출 (하이엔드 품질 최적화)
                await window.ffmpeg.run(
                    '-i', 'input.mp4',
                    '-vn',  // 비디오 제거
                    '-acodec', 'libmp3lame',  // MP3 코덱 사용
                    '-ar', '24000',  // 24kHz 샘플레이트 (음성 명료도 향상)
                    '-ac', '1',  // 모노 채널 (대화 중심 콘텐츠)
                    '-b:a', '96k',  // 96kbps (고품질 음성 인식)
                    '-q:a', '2',  // MP3 품질 설정 (0-9, 낮을수록 고품질)
                    '-t', '1200',  // 최대 20분
                    'output.mp3'
                );
                
                // 결과 파일 읽기
                const audioData = window.ffmpeg.FS('readFile', 'output.mp3');
                
                // 정리
                window.ffmpeg.FS('unlink', 'input.mp4');
                window.ffmpeg.FS('unlink', 'output.mp3');
                
                // Blob으로 변환
                const audioBlob = new Blob([audioData.buffer], { type: 'audio/mp3' });
                console.log('✅ FFmpeg.wasm으로 오디오 추출 완료:', (audioBlob.size / 1024 / 1024).toFixed(2), 'MB');
                
                return audioBlob;
                
            } catch (ffmpegError) {
                console.error('❌ FFmpeg.wasm 오디오 추출 실패:', ffmpegError);
                console.log('📡 대체 방법으로 시도 중...');
            }
        }
        
        // 최후의 방법: 파일 직접 전송 (오디오 추출 없이)
        console.log('🎬 비디오 파일을 직접 전송합니다...');
        this.updateProgress(15, '파일 준비 중...', '비디오 파일을 처리 중입니다.');
        
        // 파일 크기 정보 표시
        const fileSizeMB = file.size / (1024 * 1024);
        console.log(`📁 원본 파일 크기: ${fileSizeMB.toFixed(2)}MB`);
        
        // MP3 압축 정보 표시  
        const estimatedMP3Size = (file.size * 0.01); // 대략 1% 크기로 압축 예상
        console.log(`💡 MP3 압축 후 예상 크기: ${(estimatedMP3Size / 1024 / 1024).toFixed(2)}MB`);
        console.log(`📊 압축 설정: 16kHz, 모노, 32kbps - 음성 인식에 최적화`);
        
        // 파일 그대로 반환 (오디오 추출은 FFmpeg가 처리)
        return file;
    }

    async transcribeWithWhisper(audioData) {
        this.updateProgress(30, 'OpenAI Whisper로 음성 인식 중...', '고정밀 AI 모델로 처리 중입니다.');

        // 파일 크기 확인 및 분할 처리
        const maxSize = 24 * 1024 * 1024; // 24MB (API 제한보다 약간 작게)
        const audioSize = audioData.size;
        
        if (audioSize > maxSize) {
            console.log(`🔄 큰 파일 감지 (${(audioSize / 1024 / 1024).toFixed(2)}MB) - 분할 처리 중...`);
            return await this.transcribeWithWhisperSegments(audioData);
        }

        const formData = new FormData();
        formData.append('file', audioData, 'audio.webm');
        formData.append('model', 'whisper-1');
        
        const language = document.getElementById('whisperLanguage').value;
        if (language !== 'auto') {
            formData.append('language', language);
        }

        // 타임스탬프와 함께 상세 정보 요청
        if (document.getElementById('whisperTimestamps').checked) {
            formData.append('response_format', 'verbose_json');
            formData.append('timestamp_granularities', 'segment');
        }
        
        // 프롬프트 추가 - 음악 구간도 포함하여 전사
        formData.append('prompt', '이 오디오에는 대화, 나레이션, 또는 음악이 포함되어 있을 수 있습니다. 모든 음성 내용을 정확하게 전사해주세요.');

        // 프록시 서버 URL 설정 (로컬 개발 환경)
        // Electron 환경에서는 내장 프록시 서버 사용
        let proxyUrl;
        if (window.env && window.env.isElectron) {
            // Electron 환경에서는 동적으로 프록시 포트 가져오기
            const proxyPort = window.electronAPI && window.electronAPI.getProxyPort 
                ? await window.electronAPI.getProxyPort() 
                : 3003;
            proxyUrl = `http://localhost:${proxyPort}/api`;
            console.log(`🔗 Using Electron proxy on port ${proxyPort}`);
        } else if (window.location.hostname === 'localhost') {
            proxyUrl = 'http://localhost:3001/api';  // 개발 환경
        } else {
            proxyUrl = '/api'; // 프로덕션에서는 같은 도메인 사용
        }

        if (document.getElementById('whisperTranslate').checked) {
            // 번역 엔드포인트 사용 (프록시 경유)
            const response = await fetch(`${proxyUrl}/openai/translations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${await this.getApiKey('openai')}`
                },
                body: formData
            });
>>>>>>> 5b647801bc68d78a7edd6d139cc2ff83afb6b9b6

            if (!response.ok) {
                const errorData = await response.text();
                console.error('🔴 OpenAI API 응답 오류:', errorData);
                throw new Error(`OpenAI API 오류 (${response.status}): ${response.statusText}`);
            }

            return await response.json();
        } else {
            // 전사 엔드포인트 사용 (프록시 경유)
            // apiKey를 FormData에 추가 (Electron 프록시 요구사항)
            const apiKey = await this.getApiKey('openai');
            formData.append('apiKey', apiKey);
            
            const response = await fetch(`${proxyUrl}/proxy/openai/whisper`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('🔴 OpenAI API 응답 오류:', errorData);
                throw new Error(`OpenAI API 오류 (${response.status}): ${response.statusText}`);
            }

            return await response.json();
        }
    }

    async transcribeWithAssemblyAI(audioData) {
        this.updateProgress(30, 'AssemblyAI로 업로드 중...', '오디오 파일을 업로드하고 있습니다.');

        // 1. 오디오 업로드
        const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
            method: 'POST',
            headers: {
                'authorization': await this.getApiKey('assemblyai'),
                'content-type': 'application/octet-stream'
            },
            body: audioData
        });

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.text();
            console.error('🔴 AssemblyAI 업로드 오류:', errorData);
            throw new Error(`AssemblyAI 업로드 실패 (${uploadResponse.status}): ${uploadResponse.statusText}`);
        }

        const { upload_url } = await uploadResponse.json();

        // 2. 전사 요청
        this.updateProgress(50, 'AssemblyAI로 전사 요청 중...', '음성 인식을 시작합니다.');

        const params = {
            audio_url: upload_url,
            language_code: document.getElementById('assemblyaiLanguage').value
        };

        if (document.getElementById('assemblyaiSpeakers').checked) {
            params.speaker_labels = true;
        }

        if (document.getElementById('assemblyaiPunctuation').checked) {
            params.punctuate = true;
        }

        if (document.getElementById('assemblyaiSentiment').checked) {
            params.sentiment_analysis = true;
        }

        // auto_chapters는 영어(en)에서만 지원됨
        const language = document.getElementById('assemblyaiLanguage').value;
        if (document.getElementById('assemblyaiChapters').checked && language === 'en') {
            params.auto_chapters = true;
        }

        const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
            method: 'POST',
            headers: {
                'authorization': await this.getApiKey('assemblyai'),
                'content-type': 'application/json'
            },
            body: JSON.stringify(params)
        });

        if (!transcriptResponse.ok) {
            const errorData = await transcriptResponse.text();
            console.error('🔴 AssemblyAI 전사 요청 오류:', errorData);
            throw new Error(`AssemblyAI 전사 요청 실패 (${transcriptResponse.status}): ${transcriptResponse.statusText}`);
        }

        const transcript = await transcriptResponse.json();

        // 3. 결과 대기
        this.updateProgress(70, 'AssemblyAI 처리 중...', '음성 인식이 진행 중입니다.');

        return await this.pollAssemblyAIResult(transcript.id);
    }

    async pollAssemblyAIResult(transcriptId) {
        const maxAttempts = 60;
        let attempts = 0;

        while (attempts < maxAttempts) {
            const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
                headers: {
                    'authorization': await this.getApiKey('assemblyai')
                }
            });

            const result = await response.json();

            if (result.status === 'completed') {
                this.updateProgress(100, '완료!', '음성 인식이 완료되었습니다.');
                return result;
            } else if (result.status === 'error') {
                throw new Error(`AssemblyAI 처리 실패: ${result.error}`);
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;
            
            const progress = 70 + (attempts / maxAttempts * 25);
            this.updateProgress(progress, 'AssemblyAI 처리 중...', `${attempts * 2}초 경과`);
        }

        throw new Error('AssemblyAI 처리 시간 초과');
    }

    async transcribeWithGoogle(audioData) {
        this.updateProgress(30, 'Google STT 처리 중...', '음성을 분석하고 있습니다.');

        try {
            const googleKey = await this.getApiKey('google');

            if (!googleKey) {
                throw new Error('Google API 키가 설정되지 않았습니다.');
            }

            const qualitySelect = document.getElementById('audioQuality');
            const quality = qualitySelect ? qualitySelect.value : 'medium';
            const sampleRateMap = {
                low: 8000,
                medium: 16000,
                high: 16000
            };
            const sampleRate = sampleRateMap[quality] || 16000;

            const language = document.getElementById('googleLanguage').value || 'en-US';

            const arrayBuffer = await audioData.arrayBuffer();
            const base64Audio = this.arrayBufferToBase64(arrayBuffer);
            const audioSizeMB = (base64Audio.length * 0.75) / (1024 * 1024);

            console.log(`🎧 Google STT 요청 준비: ${audioSizeMB.toFixed(2)}MB, 샘플레이트 ${sampleRate}Hz`);

            const model = audioSizeMB > 1.5 ? 'latest_long' : 'latest_short';

            const requestBody = {
                config: {
                    encoding: 'OGG_OPUS',
                    sampleRateHertz: sampleRate,
                    languageCode: language,
                    enableAutomaticPunctuation: true,
                    model: model,
                    audioChannelCount: 1,
                    enableSeparateRecognitionPerChannel: false,
                    maxAlternatives: 1,
                    enableWordTimeOffsets: true
                },
                audio: { content: base64Audio }
            };

            let proxyUrl = '';
            if (window.env && window.env.isElectron) {
                const proxyPort = window.electronAPI && window.electronAPI.getProxyPort
                    ? await window.electronAPI.getProxyPort()
                    : 3003;
                proxyUrl = `http://localhost:${proxyPort}`;
                console.log(`🔗 Using Electron proxy on port ${proxyPort}`);
            } else if (window.location.hostname === 'localhost') {
                proxyUrl = 'http://localhost:3001';
            }

            const endpoint = `${proxyUrl}/api/google/speech?key=${googleKey}`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('🔴 Google STT 응답 오류:', errorText);

                if (response.status === 400 && errorText.includes('payload size exceeds')) {
                    throw new Error(`Google STT 요청이 너무 큽니다. (전송 크기: ${audioSizeMB.toFixed(2)}MB)

대안:
1. OpenAI Whisper 사용 (권장)
2. 더 짧은 구간만 선택
3. 영상 해상도나 길이를 줄여 업로드`);
                }

                if (response.status === 401) {
                    throw new Error('Google API 키가 유효하지 않습니다. API 설정을 확인해주세요.');
                }

                throw new Error(`Google STT API 오류 (${response.status}): ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.results || !data.results.length) {
                console.warn('⚠️ Google STT 응답에 결과가 없습니다.', data);
            }

            this.updateProgress(100, '완료!', 'Google STT 처리 완료');
            return data;

        } catch (error) {
            console.error('🔴 Google STT 처리 실패:', error);

            const fallbackMessage = `
Google Speech-to-Text API 사용 중 문제가 발생했습니다.

확인 사항:
1. Google Cloud Console에서 Speech-to-Text API가 활성화되었는지 확인
2. API 키에 올바른 권한이 있는지 확인
3. 긴 영상이라면 OpenAI Whisper 또는 AssemblyAI 사용 고려`;
            console.log(fallbackMessage);
            throw error;
        }
    }
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        const chunkSize = 0x2000;
        const chunks = [];
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            chunks.push(String.fromCharCode.apply(null, chunk));
        }
        return btoa(chunks.join(''));
    }

    displayResults(result) {
        document.getElementById('transcriptionResults').style.display = 'block';
        const contentDiv = document.getElementById('transcriptContent');
        
        console.log('📝 전사 결과:', result);
        
        // 진행 상태 업데이트
        this.updateProgress(100, '✅ 자막 추출 완료!', '결과를 확인하세요.');
        
        let html = '';

        if (this.selectedMethod === 'whisper') {
            if (result.segments && result.segments.length > 0) {
                // 타임스탬프가 있는 경우
                let hasValidContent = false;
                
                result.segments.forEach(segment => {
                    const startTime = this.formatTime(segment.start);
                    const endTime = this.formatTime(segment.end);
                    const text = String(segment.text || '');
                    
                    // 음표가 아닌 실제 내용이 있는지 확인
                    if (text && text.trim() && !text.match(/^[♪♫♬]+$/)) {
                        hasValidContent = true;
                    }
                    
                    html += `<div class="timestamp-line">
                        <span class="timestamp">[${startTime} - ${endTime}]</span>
                        <span>${text}</span>
                    </div>`;
                });
                
                // 음표만 있는 경우 안내 메시지
                if (!hasValidContent) {
                    html = `<div style="background: #ff9800; color: white; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                        ⚠️ 음성이 감지되지 않았거나 음악만 있는 구간입니다.<br>
                        • 비디오의 다른 구간을 선택해보세요<br>
                        • 언어 설정을 확인해주세요<br>
                        • 오디오 품질을 '하이엔드'로 설정해보세요
                    </div>` + html;
                }
            } else {
                // result.text가 undefined이거나 null인 경우도 안전하게 처리
                const rawText = result.text || result || '';
                const text = typeof rawText === 'string' ? rawText : String(rawText);
                // 단순 텍스트 - 음표만 있는지 확인
                if (text && text.match && text.match(/^[♪♫♬\s]*$/)) {
                    html = `<div style="background: #ff9800; color: white; padding: 10px; border-radius: 4px;">
                        ⚠️ 음성이 감지되지 않았습니다. 비디오에 대화/나레이션이 있는지 확인해주세요.
                    </div>`;
                } else {
                    html = text;
                }
            }
        } else if (this.selectedMethod === 'assemblyai') {
            if (result.utterances && result.utterances.length > 0) {
                // 화자 분리가 있는 경우
                result.utterances.forEach(utterance => {
                    const startTime = this.formatTime(utterance.start / 1000);
                    const endTime = this.formatTime(utterance.end / 1000);
                    html += `<div class="timestamp-line">
                        <span class="timestamp">[${startTime} - ${endTime}]</span>
                        <span class="speaker-label">화자 ${utterance.speaker}:</span>
                        <span>${utterance.text}</span>
                    </div>`;
                });
            } else if (result.words && result.words.length > 0) {
                // 단어별 타임스탬프를 세그먼트로 그룹화
                let segments = [];
                let currentSegment = null;
                let wordCount = 0;
                
                result.words.forEach((word, index) => {
                    // 첫 단어이거나 이전 단어와 1.5초 이상 차이나면 새 세그먼트
                    if (!currentSegment || (word.start - currentSegment.end) > 1500) {
                        if (currentSegment && currentSegment.text.trim()) {
                            segments.push(currentSegment);
                        }
                        currentSegment = {
                            start: word.start,
                            end: word.end,
                            text: word.text
                        };
                        wordCount = 1;
                    } else {
                        // 현재 세그먼트에 단어 추가
                        currentSegment.text += ' ' + word.text;
                        currentSegment.end = word.end;
                        wordCount++;
                        
                        // 세그먼트 분리 조건 - 30자 제한 및 단어 수 제한
                        const wordText = String(word.text || '');
                        const shouldSplit = 
                            // 25자 이상이면 무조건 분리
                            currentSegment.text.length >= 25 ||
                            // 5단어 이상이면 분리
                            wordCount >= 5 ||
                            // 문장 끝 (마침표, 느낌표, 물음표)
                            (wordText.match(/[.!?]$/) && currentSegment.text.length > 10) ||
                            // 쉼표 뒤이고 15자 이상
                            (wordText.match(/,$/) && currentSegment.text.length > 15) ||
                            // 시간이 2.5초 이상
                            (currentSegment.end - currentSegment.start) > 2500;
                            
                        if (shouldSplit) {
                            segments.push(currentSegment);
                            currentSegment = null;
                            wordCount = 0;
                        }
                    }
                });
                
                // 마지막 세그먼트 추가
                if (currentSegment && currentSegment.text.trim()) {
                    segments.push(currentSegment);
                }
                
                // 세그먼트를 HTML로 변환
                segments.forEach(segment => {
                    const startTime = this.formatTime(segment.start / 1000);
                    const endTime = this.formatTime(segment.end / 1000);
                    html += `<div class="timestamp-line">
                        <span class="timestamp">[${startTime} - ${endTime}]</span>
                        <span>${segment.text.trim()}</span>
                    </div>`;
                });
            } else if (result.text) {
                // 텍스트만 있는 경우 - 문장 단위로 분리
                const sentences = result.text.match(/[^.!?]+[.!?]+/g) || [result.text];
                sentences.forEach((sentence, index) => {
                    html += `<div class="timestamp-line">
                        <span class="timestamp">[${index + 1}]</span>
                        <span>${sentence.trim()}</span>
                    </div>`;
                });
            } else {
                html = '<div>결과가 없습니다.</div>';
            }
        } else if (this.selectedMethod === 'google') {
            if (result.results) {
                result.results.forEach(r => {
                    const alternative = r.alternatives[0];
                    if (r.alternatives[0].words) {
                        // 단어별 타임스탬프가 있는 경우
                        let currentSentence = '';
                        let sentenceStart = 0;
                        
                        r.alternatives[0].words.forEach((word, index) => {
                            if (index === 0) {
                                sentenceStart = parseFloat(word.startTime.replace('s', ''));
                            }
                            currentSentence += word.word + ' ';
                            
                            // 문장 끝 감지
                            if (word.word.match(/[.!?]$/) || index === r.alternatives[0].words.length - 1) {
                                html += `<div class="timestamp-line">
                                    <span class="timestamp">[${this.formatTime(sentenceStart)}]</span>
                                    <span>${currentSentence.trim()}</span>
                                </div>`;
                                currentSentence = '';
                            }
                        });
                    } else if (alternative.transcript) {
                        const sentences = alternative.transcript.match(/[^.!?]+[.!?]+/g) || [alternative.transcript];
                        sentences.forEach((sentence, index) => {
                            html += `<div class="timestamp-line">
                                <span class="timestamp">[${(index + 1).toString().padStart(2, '0')}]</span>
                                <span>${sentence.trim()}</span>
                            </div>`;
                        });
                    }
                });
            }
        }

        contentDiv.innerHTML = html;
        this.transcriptionResult = result;
        
        // 메인 시스템에 결과 전달
        this.sendResultsToMain(result);
        
        // 처리 완료 상태 업데이트
        this.isProcessing = false;
        document.getElementById('startTranscription').disabled = false;
        document.getElementById('startTranscription').querySelector('.btn-text').textContent = '자막 추출 시작';
        document.getElementById('cancelTranscription').style.display = 'none';
        
        // 자동 닫기 옵션 (2초 후)
        if (this.autoCloseOnComplete) {
            setTimeout(() => {
                console.log('✅ 자막 추출 완료 - 모달 자동 닫기');
                this.close();
            }, 2000);
        }
    }
    
    sendResultsToMain(result) {
        try {
            // 결과를 세그먼트 형식으로 정규화
            let normalizedResult = {
                text: '',
                segments: [],
                method: this.selectedMethod
            };
            
            if (this.selectedMethod === 'whisper') {
                if (result.segments) {
                    normalizedResult.segments = result.segments;
                    result.segments.forEach(segment => {
                        normalizedResult.text += segment.text + '\n';
                    });
                } else if (result.text) {
                    normalizedResult.text = result.text;
                }
            } else if (this.selectedMethod === 'assemblyai') {
                if (result.utterances && result.utterances.length > 0) {
                    // 화자별 발화를 세그먼트로 변환
                    normalizedResult.segments = result.utterances.map(utt => ({
                        start: utt.start / 1000,
                        end: utt.end / 1000,
                        text: utt.text,
                        speaker: `화자 ${utt.speaker}`
                    }));
                    normalizedResult.text = result.text;
                } else if (result.words && result.words.length > 0) {
                    // 단어들을 세그먼트로 그룹화
                    let segments = [];
                    let currentSegment = null;
                    let wordCount = 0;
                    
                    result.words.forEach((word) => {
                        // 첫 단어이거나 이전 단어와 1.5초 이상 차이나면 새 세그먼트
                        if (!currentSegment || (word.start - currentSegment.end) > 1500) {
                            if (currentSegment && currentSegment.text.trim()) {
                                segments.push({
                                    start: currentSegment.start / 1000,
                                    end: currentSegment.end / 1000,
                                    text: currentSegment.text.trim()
                                });
                            }
                            currentSegment = {
                                start: word.start,
                                end: word.end,
                                text: word.text
                            };
                            wordCount = 1;
                        } else {
                            currentSegment.text += ' ' + word.text;
                            currentSegment.end = word.end;
                            wordCount++;
                            
                            // 세그먼트 분리 조건 - 30자 제한 및 단어 수 제한
                            const shouldSplit = 
                                // 25자 이상이면 무조건 분리
                                currentSegment.text.length >= 25 ||
                                // 5단어 이상이면 분리
                                wordCount >= 5 ||
                                // 문장 끝
                                (word.text.match(/[.!?]$/) && currentSegment.text.length > 10) ||
                                // 쉼표 뒤이고 15자 이상
                                (word.text.match(/,$/) && currentSegment.text.length > 15) ||
                                // 시간이 2.5초 이상
                                (currentSegment.end - currentSegment.start) > 2500;
                                
                            if (shouldSplit) {
                                segments.push({
                                    start: currentSegment.start / 1000,
                                    end: currentSegment.end / 1000,
                                    text: currentSegment.text.trim()
                                });
                                currentSegment = null;
                                wordCount = 0;
                            }
                        }
                    });
                    
                    if (currentSegment && currentSegment.text.trim()) {
                        segments.push({
                            start: currentSegment.start / 1000,
                            end: currentSegment.end / 1000,
                            text: currentSegment.text.trim()
                        });
                    }
                    
                    normalizedResult.segments = segments;
                    normalizedResult.text = result.text;
                } else if (result.text) {
                    normalizedResult.text = result.text;
                    // 텍스트를 문장 단위로 가상 세그먼트 생성
                    const sentences = result.text.match(/[^.!?]+[.!?]+/g) || [result.text];
                    let time = 0;
                    normalizedResult.segments = sentences.map(sentence => {
                        const segment = {
                            start: time,
                            end: time + 3,
                            text: sentence.trim()
                        };
                        time += 3;
                        return segment;
                    });
                }
            } else if (this.selectedMethod === 'google' && result.results) {
                // Google 결과 처리
                normalizedResult.segments = [];
                result.results.forEach(r => {
                    if (r.alternatives[0].words) {
                        let segment = {
                            start: 0,
                            end: 0,
                            text: ''
                        };
                        r.alternatives[0].words.forEach((word, index) => {
                            if (index === 0) {
                                segment.start = parseFloat(word.startTime.replace('s', ''));
                            }
                            segment.text += word.word + ' ';
                            segment.end = parseFloat(word.endTime.replace('s', ''));
                            
                            if (word.word.match(/[.!?]$/) || index === r.alternatives[0].words.length - 1) {
                                normalizedResult.segments.push({...segment, text: segment.text.trim()});
                                segment = { start: 0, end: 0, text: '' };
                            }
                        });
                    }
                    normalizedResult.text += r.alternatives[0].transcript + ' ';
                });

                normalizedResult.text = normalizedResult.text.trim();

                if (!normalizedResult.segments.length && normalizedResult.text) {
                    const sentences = normalizedResult.text.match(/[^.!?]+[.!?]+/g) || [normalizedResult.text];
                    let approximateTime = 0;
                    sentences.forEach((sentence) => {
                        const cleanSentence = sentence.trim();
                        if (!cleanSentence) {
                            return;
                        }
                        normalizedResult.segments.push({
                            start: approximateTime,
                            end: approximateTime + 3,
                            text: cleanSentence
                        });
                        approximateTime += 3;
                    });
                }
            }
            
            // 메인 페이지에 이벤트 발송
            const event = new CustomEvent('subtitleExtracted', {
                detail: {
                    text: normalizedResult.text,
                    segments: normalizedResult.segments,
                    fullResult: result,
                    method: this.selectedMethod
                }
            });
            window.parent.dispatchEvent(event);
            console.log('📤 자막 추출 완료 - 전문 편집기에서 표시됩니다', normalizedResult);
            
            // AI 어시스턴트로 자막 내용 전송
            if (window.sendSubtitlesToAI) {
                console.log('🤖 AI 어시스턴트로 자막 전송 중...');
                window.sendSubtitlesToAI(normalizedResult).then(response => {
                    console.log('✅ AI가 자막을 파악했습니다');
                }).catch(error => {
                    console.error('❌ AI 자막 전송 실패:', error);
                });
            }
        } catch (error) {
            console.error('❌ 이벤트 발송 실패:', error);
        }
    }

    formatTime(seconds) {
        const date = new Date(seconds * 1000);
        const mm = date.getUTCMinutes().toString().padStart(2, '0');
        const ss = date.getUTCSeconds().toString().padStart(2, '0');
        const ms = Math.floor(date.getUTCMilliseconds() / 10).toString().padStart(2, '0');
        return `${mm}:${ss}.${ms}`;
    }

    toggleEdit() {
        const contentDiv = document.getElementById('transcriptContent');
        const isEditing = contentDiv.contentEditable === 'true';
        
        contentDiv.contentEditable = !isEditing;
        document.getElementById('editTranscript').textContent = isEditing ? '✏️ 편집' : '💾 저장';
    }

    copyTranscript() {
        const contentDiv = document.getElementById('transcriptContent');
        const text = contentDiv.innerText;
        
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('copyTranscript');
            const originalText = btn.textContent;
            btn.textContent = '✅ 복사됨!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        });
    }

    downloadSubtitle(format) {
        const content = this.generateSubtitleContent(format);
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `subtitle.${format}`;
        a.click();
        URL.revokeObjectURL(url);
    }

    generateSubtitleContent(format) {
        const contentDiv = document.getElementById('transcriptContent');
        
        if (format === 'txt') {
            return contentDiv.innerText;
        }

        let content = '';
        const lines = contentDiv.querySelectorAll('.timestamp-line');
        
        if (format === 'srt') {
            lines.forEach((line, index) => {
                const timestamp = line.querySelector('.timestamp')?.textContent || '';
                const text = line.textContent.replace(timestamp, '').trim();
                
                if (timestamp) {
                    const times = timestamp.replace(/[\[\]]/g, '').split(' - ');
                    const startTime = times[0] || '00:00.00';
                    const endTime = times[1] || this.addSeconds(startTime, 3);
                    
                    content += `${index + 1}\n`;
                    content += `${this.toSRTTime(startTime)} --> ${this.toSRTTime(endTime)}\n`;
                    content += `${text}\n\n`;
                }
            });
        } else if (format === 'vtt') {
            content = 'WEBVTT\n\n';
            
            lines.forEach((line) => {
                const timestamp = line.querySelector('.timestamp')?.textContent || '';
                const text = line.textContent.replace(timestamp, '').trim();
                
                if (timestamp) {
                    const times = timestamp.replace(/[\[\]]/g, '').split(' - ');
                    const startTime = times[0] || '00:00.00';
                    const endTime = times[1] || this.addSeconds(startTime, 3);
                    
                    content += `${startTime} --> ${endTime}\n`;
                    content += `${text}\n\n`;
                }
            });
        }

        return content;
    }

    toSRTTime(time) {
        // MM:SS.MS 형식을 HH:MM:SS,MS 형식으로 변환
        const parts = time.split(':');
        const minutes = parts[0] || '00';
        const secondsAndMs = parts[1] || '00.00';
        const [seconds, ms] = secondsAndMs.split('.');
        
        return `00:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')},${(ms || '00').padEnd(3, '0')}`;
    }

    addSeconds(time, seconds) {
        // 간단한 시간 더하기 함수
        const parts = time.split(':');
        const totalSeconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]) + seconds;
        const newMinutes = Math.floor(totalSeconds / 60);
        const newSeconds = (totalSeconds % 60).toFixed(2);
        return `${newMinutes.toString().padStart(2, '0')}:${newSeconds.padStart(5, '0')}`;
    }

    cancelTranscription() {
        this.isProcessing = false;
        // 진행 중인 작업 취소 로직 추가
    }
}

// 전역 인스턴스 생성 및 초기화
const transcriptionModal = new TranscriptionModal();

// DOM이 로드된 후 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        transcriptionModal.init();
        console.log('✅ TranscriptionModal 초기화 완료');
    });
} else {
    transcriptionModal.init();
    console.log('✅ TranscriptionModal 초기화 완료');
}

// 전역 함수로 노출
window.openTranscriptionModal = (file) => {
    transcriptionModal.open(file);
};