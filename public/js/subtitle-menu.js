/**
 * 자막처리 메뉴 관리
 */

console.log('📝 subtitle-menu.js loading...');

// 전역 함수로 정의
window.openSubtitleMenu = function() {
    console.log('🚀 openSubtitleMenu called');
    
    // 기존 모달이 있으면 제거
    const existingModal = document.getElementById('subtitleMenuModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 모달 생성
    const modal = document.createElement('div');
    modal.id = 'subtitleMenuModal';
    modal.className = 'option-modal active';
    // 인라인 스타일로 모달 표시 보장
    modal.style.cssText = `
        display: block !important;
        opacity: 1 !important;
        z-index: 10000 !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background-color: rgba(0, 0, 0, 0.8) !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
    `;
    console.log('📦 Creating modal with ID:', modal.id);
    modal.innerHTML = `
        <div class="modal-content" style="
            background: var(--bg-primary, #1a1a1a);
            border-radius: 12px;
            padding: 0;
            max-width: 800px;
            width: 90%;
            max-height: 80vh;
            overflow: auto;
        ">
            <div class="modal-header">
                <h3>📝 자막처리</h3>
                <button class="modal-close" onclick="closeSubtitleMenu()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="subtitle-menu-grid">
                    <button class="subtitle-menu-item" onclick="openAdvancedTranscription()">
                        <div class="menu-icon">🚀</div>
                        <div class="menu-title">고급 자막 추출</div>
                        <div class="menu-desc">OpenAI Whisper, Google, AssemblyAI 등</div>
                    </button>
                    
                    <button class="subtitle-menu-item" onclick="openSubtitleEditor()">
                        <div class="menu-icon">✏️</div>
                        <div class="menu-title">자막 편집기 열기</div>
                        <div class="menu-desc">전문 자막 편집 도구</div>
                    </button>
                    
                    <button class="subtitle-menu-item" onclick="importSubtitles()">
                        <div class="menu-icon">📥</div>
                        <div class="menu-title">자막 파일 가져오기</div>
                        <div class="menu-desc">SRT, VTT, ASS 등 지원</div>
                    </button>
                    
                    <button class="subtitle-menu-item" onclick="exportSubtitles()">
                        <div class="menu-icon">📤</div>
                        <div class="menu-title">자막 파일 내보내기</div>
                        <div class="menu-desc">다양한 형식으로 저장</div>
                    </button>
                    
                    <button class="subtitle-menu-item" onclick="autoTranslate()">
                        <div class="menu-icon">🌐</div>
                        <div class="menu-title">자동 번역</div>
                        <div class="menu-desc">다국어 자막 생성</div>
                    </button>
                    
                    <button class="subtitle-menu-item" onclick="syncSubtitles()">
                        <div class="menu-icon">🔄</div>
                        <div class="menu-title">자막 동기화</div>
                        <div class="menu-desc">타이밍 자동 조정</div>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // 스타일 추가
    if (!document.getElementById('subtitleMenuStyles')) {
        const style = document.createElement('style');
        style.id = 'subtitleMenuStyles';
        style.innerHTML = `
            .subtitle-menu-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                padding: 20px;
            }
            
            .subtitle-menu-item {
                background: var(--bg-secondary, #2a2a2a);
                border: 1px solid var(--border-color, #3a3a3a);
                border-radius: 12px;
                padding: 20px;
                cursor: pointer;
                transition: all 0.3s ease;
                text-align: center;
            }
            
            .subtitle-menu-item:hover {
                background: var(--bg-tertiary, #3a3a3a);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            
            .subtitle-menu-item .menu-icon {
                font-size: 32px;
                margin-bottom: 10px;
            }
            
            .subtitle-menu-item .menu-title {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary, #fff);
                margin-bottom: 5px;
            }
            
            .subtitle-menu-item .menu-desc {
                font-size: 12px;
                color: var(--text-secondary, #999);
                line-height: 1.4;
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(modal);
    console.log('✅ Modal appended to body');
    console.log('📍 Modal exists in DOM:', document.getElementById('subtitleMenuModal') !== null);
    console.log('📏 Modal dimensions:', modal.offsetWidth, 'x', modal.offsetHeight);
};

// 메뉴 닫기
window.closeSubtitleMenu = function() {
    const modal = document.getElementById('subtitleMenuModal');
    if (modal) {
        modal.remove();
    }
};

// 고급 자막 추출 열기
window.openAdvancedTranscription = function() {
    closeSubtitleMenu();
    if (window.openTranscriptionModal) {
        window.openTranscriptionModal(window.state?.uploadedFile);
    } else {
        console.error('자막 추출 모달을 찾을 수 없습니다.');
    }
};

// 자막 편집기 열기
window.openSubtitleEditor = function() {
    closeSubtitleMenu();
    if (window.subtitleEditorPro && typeof window.subtitleEditorPro.open === 'function') {
        window.subtitleEditorPro.open();
    } else {
        console.error('자막 편집기를 찾을 수 없습니다.');
    }
};

// 자막 가져오기
window.importSubtitles = function() {
    closeSubtitleMenu();
    if (window.subtitleEditorPro && typeof window.subtitleEditorPro.import === 'function') {
        window.subtitleEditorPro.import();
    } else {
        alert('자막 편집기를 먼저 열어주세요.');
    }
};

// 자막 내보내기
window.exportSubtitles = function() {
    closeSubtitleMenu();
    if (window.subtitleEditorPro && typeof window.subtitleEditorPro.export === 'function') {
        window.subtitleEditorPro.export();
    } else {
        alert('자막 편집기를 먼저 열어주세요.');
    }
};

// 자동 번역
window.autoTranslate = function() {
    closeSubtitleMenu();
    if (window.subtitleEditorPro && typeof window.subtitleEditorPro.openTranslateDialog === 'function') {
        window.subtitleEditorPro.openTranslateDialog();
    } else {
        alert('자막 편집기를 먼저 열어주세요.');
    }
};

// 자막 동기화
window.syncSubtitles = function() {
    closeSubtitleMenu();
    if (window.subtitleEditorPro && typeof window.subtitleEditorPro.openSyncDialog === 'function') {
        window.subtitleEditorPro.openSyncDialog();
    } else {
        alert('자막 편집기를 먼저 열어주세요.');
    }
};

console.log('✅ 자막처리 메뉴 초기화 완료');
console.log('🔍 window.openSubtitleMenu is:', typeof window.openSubtitleMenu);