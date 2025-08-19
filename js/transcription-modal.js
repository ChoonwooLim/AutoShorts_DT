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
                                    <label>언어</label>
                                    <select id="whisperLanguage" class="setting-select">
                                        <option value="auto">자동 감지</option>
                                        <option value="ko">한국어</option>
                                        <option value="en">영어</option>
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
                                        <option value="ko">한국어</option>
                                        <option value="en">영어</option>
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
                                        <option value="ko-KR">한국어</option>
                                        <option value="en-US">영어 (미국)</option>
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

    async extractAudio(file) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            
            video.addEventListener('loadedmetadata', async () => {
                try {
                    const stream = video.captureStream();
                    const audioTracks = stream.getAudioTracks();
                    
                    if (audioTracks.length === 0) {
                        throw new Error('비디오에 오디오 트랙이 없습니다.');
                    }

                    const mediaRecorder = new MediaRecorder(stream, {
                        mimeType: 'audio/webm;codecs=opus'
                    });

                    const chunks = [];
                    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
                    
                    mediaRecorder.onstop = () => {
                        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
                        resolve(audioBlob);
                    };

                    mediaRecorder.start();
                    video.play();
                    
                    video.addEventListener('ended', () => {
                        mediaRecorder.stop();
                        stream.getTracks().forEach(track => track.stop());
                    });

                } catch (error) {
                    reject(error);
                }
            });

            video.addEventListener('error', () => {
                reject(new Error('비디오 파일을 읽을 수 없습니다.'));
            });
        });
    }

    async transcribeWithWhisper(audioData) {
        this.updateProgress(30, 'OpenAI Whisper로 음성 인식 중...', '고정밀 AI 모델로 처리 중입니다.');

        const formData = new FormData();
        formData.append('file', audioData, 'audio.webm');
        formData.append('model', 'whisper-1');
        
        const language = document.getElementById('whisperLanguage').value;
        if (language !== 'auto') {
            formData.append('language', language);
        }

        if (document.getElementById('whisperTimestamps').checked) {
            formData.append('response_format', 'verbose_json');
        }

        if (document.getElementById('whisperTranslate').checked) {
            // 번역 엔드포인트 사용
            const response = await fetch('https://api.openai.com/v1/audio/translations', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${await this.getApiKey('openai')}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('🔴 OpenAI API 응답 오류:', errorData);
                throw new Error(`OpenAI API 오류 (${response.status}): ${response.statusText}`);
            }

            return await response.json();
        } else {
            // 전사 엔드포인트 사용
            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${await this.getApiKey('openai')}`
                },
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

        if (document.getElementById('assemblyaiChapters').checked) {
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
        this.updateProgress(30, 'Google Speech-to-Text로 처리 중...', '음성 데이터를 분석하고 있습니다.');

        // 오디오를 base64로 인코딩
        const reader = new FileReader();
        const audioBase64 = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(audioData);
        });

        const config = {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000,
            languageCode: document.getElementById('googleLanguage').value,
            model: document.getElementById('googleModel').value,
            enableWordTimeOffsets: document.getElementById('googleWordTime').checked,
            enableAutomaticPunctuation: true,
            enableSpeakerDiarization: document.getElementById('googleDiarization').checked,
            diarizationSpeakerCount: 2,
            profanityFilter: document.getElementById('googleProfanity').checked
        };

        if (document.getElementById('googleAutoDetect').checked) {
            config.alternativeLanguageCodes = ['en-US', 'ko-KR', 'ja-JP', 'zh-CN'];
        }

        const request = {
            config: config,
            audio: {
                content: audioBase64
            }
        };

        const googleKey = await this.getApiKey('google');
        const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${googleKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('🔴 Google API 오류:', errorData);
            throw new Error(`Google API 오류 (${response.status}): ${response.statusText}`);
        }

        const result = await response.json();
        this.updateProgress(100, '완료!', 'Google Speech-to-Text 처리 완료');
        
        return result;
    }

    displayResults(result) {
        document.getElementById('transcriptionResults').style.display = 'block';
        const contentDiv = document.getElementById('transcriptContent');
        
        let html = '';

        if (this.selectedMethod === 'whisper') {
            if (result.segments) {
                // 타임스탬프가 있는 경우
                result.segments.forEach(segment => {
                    const startTime = this.formatTime(segment.start);
                    const endTime = this.formatTime(segment.end);
                    html += `<div class="timestamp-line">
                        <span class="timestamp">[${startTime} - ${endTime}]</span>
                        <span>${segment.text}</span>
                    </div>`;
                });
            } else {
                html = result.text || result;
            }
        } else if (this.selectedMethod === 'assemblyai') {
            if (result.utterances) {
                // 화자 분리가 있는 경우
                result.utterances.forEach(utterance => {
                    const startTime = this.formatTime(utterance.start / 1000);
                    html += `<div class="timestamp-line">
                        <span class="timestamp">[${startTime}]</span>
                        <span class="speaker-label">화자 ${utterance.speaker}:</span>
                        <span>${utterance.text}</span>
                    </div>`;
                });
            } else if (result.words) {
                // 단어별 타임스탬프
                let currentLine = '';
                let lineStart = 0;
                
                result.words.forEach((word, index) => {
                    if (index === 0 || word.start - lineStart > 5000) {
                        if (currentLine) {
                            html += `<div class="timestamp-line">
                                <span class="timestamp">[${this.formatTime(lineStart / 1000)}]</span>
                                <span>${currentLine}</span>
                            </div>`;
                        }
                        currentLine = word.text;
                        lineStart = word.start;
                    } else {
                        currentLine += ' ' + word.text;
                    }
                });
                
                if (currentLine) {
                    html += `<div class="timestamp-line">
                        <span class="timestamp">[${this.formatTime(lineStart / 1000)}]</span>
                        <span>${currentLine}</span>
                    </div>`;
                }
            } else {
                html = result.text;
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
                    } else {
                        html += `<div>${alternative.transcript}</div>`;
                    }
                });
            }
        }

        contentDiv.innerHTML = html;
        this.transcriptionResult = result;
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
transcriptionModal.init();

// 전역 함수로 노출
window.openTranscriptionModal = (file) => {
    transcriptionModal.open(file);
};

export default transcriptionModal;