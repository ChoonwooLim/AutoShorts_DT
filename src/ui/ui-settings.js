import * as DOM from '../dom-elements.js';
import { aiModels, saveApiKey } from '../api.js';
import { googleConfig } from '../config.js';
import { state, workLogManager } from '../state.js';

function initializeModelSelects() {
    console.log('🔧 모델 선택 드롭다운 초기화 시작');
    
    // DOM 요소 존재 확인
    if (!DOM.mainModelSelect) {
        console.error('❌ mainModelSelect 요소를 찾을 수 없습니다.');
        return;
    }
    
    if (!DOM.subModelSelect) {
        console.error('❌ subModelSelect 요소를 찾을 수 없습니다.');
        return;
    }
    
    // aiModels 데이터 확인
    if (!aiModels || Object.keys(aiModels).length === 0) {
        console.error('❌ aiModels 데이터를 찾을 수 없습니다.');
        return;
    }
    
    console.log('📊 사용 가능한 AI 모델:', Object.keys(aiModels));
    
    // 기존 옵션 초기화
    DOM.mainModelSelect.innerHTML = '';
    
    // 모델 옵션 추가
    Object.keys(aiModels).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = aiModels[key].name;
        DOM.mainModelSelect.appendChild(option);
        console.log(`➕ 모델 추가: ${key} - ${aiModels[key].name}`);
    });
    
    // 기본값으로 Gemini 선택
    DOM.mainModelSelect.value = 'gemini';
    console.log('✅ 기본 모델로 Gemini 선택됨');
    
    // 서브 모델 업데이트
    updateSubModels();
    
    console.log('🎯 모델 선택 드롭다운 초기화 완료');
}

function updateSubModels() {
    console.log('🔄 서브 모델 업데이트 시작');
    
    const selectedModelKey = DOM.mainModelSelect ? DOM.mainModelSelect.value : '';
    
    if (!selectedModelKey) {
        console.warn('⚠️ 선택된 모델이 없습니다.');
        return;
    }
    
    if (!DOM.subModelSelect) {
        console.error('❌ subModelSelect 요소를 찾을 수 없습니다.');
        return;
    }
    
    console.log(`📝 선택된 모델: ${selectedModelKey}`);
    
    // 기존 옵션 초기화
    DOM.subModelSelect.innerHTML = '';
    
    if (aiModels[selectedModelKey] && aiModels[selectedModelKey].subModels) {
        DOM.subModelSelect.style.display = 'block';
        
        aiModels[selectedModelKey].subModels.forEach(modelName => {
            const option = document.createElement('option');
            option.value = modelName;
            
            // GPT 모델의 경우 이미지 지원 여부 표시
            if (selectedModelKey === 'gpt') {
                const visionModels = ["GPT-4o", "GPT-4o Mini", "GPT-4 Turbo"];
                if (visionModels.includes(modelName)) {
                    option.textContent = modelName + " (🖼️ 이미지 지원)";
                } else {
                    option.textContent = modelName + " (텍스트만)";
                }
            } else {
                option.textContent = modelName;
            }
            
            DOM.subModelSelect.appendChild(option);
            console.log(`➕ 서브 모델 추가: ${modelName}`);
        });
        
        // Gemini가 선택된 경우 Gemini 2.0 Flash를 기본값으로 설정
        if (selectedModelKey === 'gemini') {
            DOM.subModelSelect.value = 'Gemini 2.0 Flash';
            console.log('✅ Gemini 2.0 Flash를 기본값으로 설정');
        }
        
        console.log(`🎯 ${selectedModelKey} 서브 모델 ${aiModels[selectedModelKey].subModels.length}개 로드 완료`);
    } else {
        DOM.subModelSelect.style.display = 'none';
        console.log('⚠️ 서브 모델이 없는 모델입니다.');
    }
    
    console.log('✅ 서브 모델 업데이트 완료');
}

function updateFolderStatusUI(isSelected, folderName = '') {
    if (!DOM.outputFolder || !DOM.selectFolderBtn) return;
    if (isSelected && folderName) {
        DOM.outputFolder.className = 'setting-input folder-selected';
        DOM.selectFolderBtn.className = 'control-btn folder-selected';
        DOM.selectFolderBtn.innerHTML = '✅';
        DOM.selectFolderBtn.title = `현재 폴더: ${folderName}`;
        DOM.outputFolder.placeholder = `현재 선택: ${folderName}`;
    } else {
        DOM.outputFolder.className = 'setting-input folder-not-selected';
        DOM.selectFolderBtn.className = 'control-btn folder-not-selected';
        DOM.selectFolderBtn.innerHTML = '📁';
        DOM.selectFolderBtn.title = '저장 폴더를 선택하세요 (필수)';
        DOM.outputFolder.placeholder = '📁 저장 폴더를 먼저 선택해주세요';
    }
}

export function initializeSettingsUI() {
    console.log('🚀 설정 UI 초기화 시작');
    
    // 재시도 로직으로 모델 선택 초기화
    let retryCount = 0;
    const maxRetries = 3;
    
    const tryInitializeModels = () => {
        try {
            initializeModelSelects();
            console.log('✅ 모델 선택 초기화 성공');
        } catch (error) {
            console.error(`❌ 모델 선택 초기화 실패 (시도 ${retryCount + 1}/${maxRetries}):`, error);
            
            if (retryCount < maxRetries - 1) {
                retryCount++;
                console.log(`🔄 ${1000 * retryCount}ms 후 재시도...`);
                setTimeout(tryInitializeModels, 1000 * retryCount);
            } else {
                console.error('❌ 모델 선택 초기화 최종 실패');
                // 사용자에게 수동 재초기화 방법 안내
                console.log('🛠️ 수동 재초기화 방법: 개발자 도구에서 window.reinitializeModels() 호출');
            }
        }
    };
    
    tryInitializeModels();
    updateFolderStatusUI(false);
    
    console.log('🎯 설정 UI 초기화 완료');
}

let currentApiModelKey = '';

// Google 설정 모달 관련 함수들
function showGoogleConfigModal() {
    if (!DOM.googleConfigModal || !DOM.googleClientIdInput || !DOM.currentGoogleConfigInfo) {
        console.error('Google Config modal elements not found');
        return;
    }
    
    // 현재 설정 정보 표시
    const idInfo = googleConfig.getCurrentIdInfo();
    DOM.currentGoogleConfigInfo.textContent = `현재 사용 중: ${idInfo.source} (${idInfo.clientId.substring(0, 20)}...)`;
    
    // 사용자 정의 ID가 있으면 입력창에 표시
    if (idInfo.isCustom) {
        DOM.googleClientIdInput.value = idInfo.clientId;
    } else {
        DOM.googleClientIdInput.value = '';
        DOM.googleClientIdInput.placeholder = '사용자 정의 Client ID 입력 (선택사항)';
    }
    
    DOM.googleConfigModal.style.display = 'flex';
}

function hideGoogleConfigModal() {
    if (DOM.googleConfigModal) {
        DOM.googleConfigModal.style.display = 'none';
    }
}

function handleSaveGoogleConfig() {
    if (!DOM.googleClientIdInput) return;
    
    const clientId = DOM.googleClientIdInput.value.trim();
    
    if (clientId) {
        // 사용자 정의 Client ID 설정
        const success = googleConfig.setCustomClientId(clientId);
        if (!success) {
            alert('❌ 잘못된 Google Client ID 형식입니다.\n\n올바른 형식: 숫자-문자열.apps.googleusercontent.com');
            return;
        }
        alert('✅ Google Client ID가 저장되었습니다.\n페이지를 새로고침하면 새 설정이 적용됩니다.');
    } else {
        // 빈 값이면 기본값 사용
        googleConfig.setCustomClientId('');
        alert('✅ 기본 Google Client ID를 사용합니다.\n페이지를 새로고침하면 적용됩니다.');
    }
    
    hideGoogleConfigModal();
}

function handleResetGoogleConfig() {
    if (confirm('🔄 Google Client ID를 기본값으로 재설정하시겠습니까?\n\n현재 사용자 정의 설정이 삭제됩니다.')) {
        googleConfig.setCustomClientId('');
        DOM.googleClientIdInput.value = '';
        
        // 현재 정보 업데이트
        const idInfo = googleConfig.getCurrentIdInfo();
        DOM.currentGoogleConfigInfo.textContent = `현재 사용 중: ${idInfo.source} (${idInfo.clientId.substring(0, 20)}...)`;
        
        alert('✅ 기본 Google Client ID로 재설정되었습니다.\n페이지를 새로고침하면 적용됩니다.');
    }
}

async function showApiKeyModal(modelKey) {
    currentApiModelKey = modelKey;
    const modelData = aiModels[modelKey];
    
    if (!DOM.apiKeyModal || !DOM.apiKeyModalTitle || !DOM.apiKeyInput || !DOM.apiKeyLink) {
        console.error('API Key modal elements not found');
        return;
    }
    
    // API 키 로드 (통일된 비동기 방식)
    let savedApiKey = '';
    
    try {
        if (window.apiKeyManager) {
            console.log('🔑 apiKeyManager를 사용하여 비동기적으로 키 로드');
            savedApiKey = await window.apiKeyManager.loadApiKey(modelKey) || '';
            
            // 메모리에도 반영
            if (aiModels[modelKey]) {
                aiModels[modelKey].apiKey = savedApiKey;
            }
        } else {
            console.warn('⚠️ window.apiKeyManager를 찾을 수 없어 localStorage에서 직접 로드합니다.');
            savedApiKey = localStorage.getItem(`apiKey_${modelKey}`) || '';
             // 메모리에도 반영
            if (savedApiKey && aiModels[modelKey]) {
                aiModels[modelKey].apiKey = savedApiKey;
            }
        }
    } catch (error) {
        console.error('API 키 로드 중 오류 발생:', error);
        savedApiKey = ''; // 오류 발생 시 빈 문자열로 초기화
    }

    DOM.apiKeyModalTitle.textContent = `${modelData.name} API 키 설정`;
    DOM.apiKeyInput.value = savedApiKey;
    DOM.apiKeyLink.href = modelData.apiKeyUrl;
    DOM.apiKeyLink.textContent = `${modelData.name} API 키 발급받기`;
    
    DOM.apiKeyModal.style.display = 'flex';
    DOM.apiKeyInput.focus();
}

function hideApiKeyModal() {
    if (DOM.apiKeyModal) {
        DOM.apiKeyModal.style.display = 'none';
    }
    currentApiModelKey = '';
}

async function handleSaveApiKey() {
    const apiKey = DOM.apiKeyInput.value.trim();
    if (!currentApiModelKey) {
        alert('오류: 현재 API 모델이 선택되지 않았습니다.');
        return;
    }

    if (!apiKey) {
        alert('API 키를 입력해주세요.');
        return;
    }

    try {
        DOM.saveApiKeyBtn.disabled = true;
        DOM.saveApiKeyBtn.textContent = '저장 중...';

        console.log(`🔑 ${currentApiModelKey} API 키 저장 시도...`);
        const result = await saveApiKey(currentApiModelKey, apiKey);

        if (result.success) {
            // aiModels 객체에도 최신 키 반영
            if (aiModels[currentApiModelKey]) {
                aiModels[currentApiModelKey].apiKey = apiKey;
            }
            console.log(`✅ ${currentApiModelKey} API 키 저장 성공.`);
            alert(`${aiModels[currentApiModelKey].name} API 키가 안전하게 저장되었습니다.`);
            hideApiKeyModal();
        } else {
            throw new Error(result.error || '알 수 없는 오류로 키 저장에 실패했습니다.');
        }
    } catch (error) {
        console.error(`❌ ${currentApiModelKey} API 키 저장 실패:`, error);
        alert(`API 키 저장에 실패했습니다. 다음을 확인해주세요:\n\n- API 키가 정확한지 확인해주세요.\n- 콘솔(F12)에서 오류 메시지를 확인해주세요.\n\n오류: ${error.message}`);
    } finally {
        DOM.saveApiKeyBtn.disabled = false;
        DOM.saveApiKeyBtn.textContent = '저장';
    }
}

// 얼굴 분석 갤러리 초기화 함수
function initializeFaceAnalysisGallery() {
    // 얼굴 분석 체크박스가 기본적으로 체크되어 있으므로 갤러리도 표시
    if (DOM.faceAnalysisCheckbox && DOM.faceGalleryContainer) {
        const isChecked = DOM.faceAnalysisCheckbox.checked;
        DOM.faceGalleryContainer.style.display = isChecked ? 'block' : 'none';
        console.log(`🎭 얼굴 분석 갤러리 초기 상태: ${isChecked ? '표시' : '숨김'}`);
    }
}

export function setupSettingsEventListeners() {
    // 얼굴 분석 갤러리 초기화
    initializeFaceAnalysisGallery();
    
    // 모델 선택 이벤트 리스너
    if(DOM.mainModelSelect) DOM.mainModelSelect.addEventListener('change', updateSubModels);
    
    // 폴더 선택 이벤트 리스너
    if(DOM.selectFolderBtn) {
        DOM.selectFolderBtn.addEventListener('click', async () => {
            try {
                const handle = await window.showDirectoryPicker();
                updateFolderStatusUI(true, handle.name);
            } catch (err) {
                console.warn('Folder picker was cancelled or failed.', err.name);
                updateFolderStatusUI(false);
            }
        });
    }
    
    // API 설정 버튼 이벤트 리스너
    if (DOM.apiSettingsBtn) {
        DOM.apiSettingsBtn.addEventListener('click', () => {
            const selectedModelKey = DOM.mainModelSelect ? DOM.mainModelSelect.value : Object.keys(aiModels)[0];
            showApiKeyModal(selectedModelKey);
        });
    }
    
    // Google 설정 버튼 이벤트 리스너
    if (DOM.googleConfigBtn) {
        DOM.googleConfigBtn.addEventListener('click', showGoogleConfigModal);
    }
    
    // 작업 로그 버튼 이벤트 리스너
    const workLogBtn = document.getElementById('workLogBtn');
    if (workLogBtn) {
        workLogBtn.addEventListener('click', showWorkLogModal);
    }
    
    // 작업 로그 필터 이벤트 리스너
    const workLogDateFilter = document.getElementById('workLogDateFilter');
    const workLogTypeFilter = document.getElementById('workLogTypeFilter');
    
    if (workLogDateFilter) {
        workLogDateFilter.addEventListener('change', updateWorkLogDisplay);
    }
    
    if (workLogTypeFilter) {
        workLogTypeFilter.addEventListener('change', updateWorkLogDisplay);
    }
    
    // API 키 모달 이벤트 리스너들
    if (DOM.saveApiKeyBtn) {
        DOM.saveApiKeyBtn.addEventListener('click', handleSaveApiKey);
    }
    
    if (DOM.cancelApiKeyBtn) {
        DOM.cancelApiKeyBtn.addEventListener('click', hideApiKeyModal);
    }
    
    if (DOM.closeApiKeyModalBtn) {
        DOM.closeApiKeyModalBtn.addEventListener('click', hideApiKeyModal);
    }
    
    // 모달 배경 클릭시 닫기
    if (DOM.apiKeyModal) {
        DOM.apiKeyModal.addEventListener('click', (e) => {
            if (e.target === DOM.apiKeyModal) {
                hideApiKeyModal();
            }
        });
    }
    
    // Enter 키로 저장
    if (DOM.apiKeyInput) {
        DOM.apiKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSaveApiKey();
            }
        });
    }
    
    // Google 설정 모달 이벤트 리스너들
    if (DOM.saveGoogleConfigBtn) {
        DOM.saveGoogleConfigBtn.addEventListener('click', handleSaveGoogleConfig);
    }
    
    if (DOM.cancelGoogleConfigBtn) {
        DOM.cancelGoogleConfigBtn.addEventListener('click', hideGoogleConfigModal);
    }
    
    if (DOM.resetGoogleConfigBtn) {
        DOM.resetGoogleConfigBtn.addEventListener('click', handleResetGoogleConfig);
    }
    
    if (DOM.closeGoogleConfigModalBtn) {
        DOM.closeGoogleConfigModalBtn.addEventListener('click', hideGoogleConfigModal);
    }
    
    // Google 설정 모달 배경 클릭시 닫기
    if (DOM.googleConfigModal) {
        DOM.googleConfigModal.addEventListener('click', (e) => {
            if (e.target === DOM.googleConfigModal) {
                hideGoogleConfigModal();
            }
        });
    }
    
    // Google Client ID 입력창에서 Enter 키로 저장
    if (DOM.googleClientIdInput) {
        DOM.googleClientIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSaveGoogleConfig();
            }
        });
    }
    
    // 얼굴 분석 체크박스 이벤트 리스너 추가
    if (DOM.faceAnalysisCheckbox && DOM.faceGalleryContainer) {
        DOM.faceAnalysisCheckbox.addEventListener('change', (e) => {
            DOM.faceGalleryContainer.style.display = e.target.checked ? 'block' : 'none';
            console.log(`🎭 얼굴 분석 갤러리 ${e.target.checked ? '표시' : '숨김'}`);
        });
    }
    
    // 얼굴 분석 버튼 이벤트 리스너
    if (DOM.analyzeFacesBtn) {
        DOM.analyzeFacesBtn.addEventListener('click', async () => {
            // 현재 버튼 텍스트로 상태 판단
            const isAnalyzing = DOM.analyzeFacesBtn.textContent === '분석 중지';
            
            if (isAnalyzing) {
                // 분석 중지
                console.log('🛑 얼굴 분석 중지 요청');
                const faceAnalysisModule = await import('../modules/face-analysis.js');
                if (faceAnalysisModule.stopFaceAnalysis) {
                    faceAnalysisModule.stopFaceAnalysis();
                }
                return;
            }
            
            // 분석 시작
            // state 확인 - import한 state 직접 사용
            if (!state.uploadedFile) {
                alert('얼굴 분석을 시작하기 전에 먼저 영상을 업로드해주세요.');
                return;
            }
            
            // 🔄 얼굴 분석 직접 실행 (두 번 클릭 문제 해결)
            try {
                console.log('🎭 얼굴 분석 시작...');
                console.log('📹 업로드된 파일:', state.uploadedFile.name);
                
                // face-analysis 모듈 로드 및 분석 시작 (한 번에 처리)
                const faceAnalysisModule = await import('../modules/face-analysis.js');
                
                // face-detection 모듈이 필요하면 여기서 로드
                if (window.loadFaceAnalysisModules && !window.faceAnalysisModulesLoaded) {
                    console.log('📦 face-detection 모듈 로드 중...');
                    const loaded = await window.loadFaceAnalysisModules();
                    if (loaded) {
                        window.faceAnalysisModulesLoaded = true;
                        console.log('✅ face-detection 모듈 로드 완료');
                    }
                }
                
                if (faceAnalysisModule.startFaceAnalysis) {
                    await faceAnalysisModule.startFaceAnalysis();
                } else {
                    console.error('❌ startFaceAnalysis 함수를 찾을 수 없습니다.');
                    alert('얼굴 분석 기능이 아직 준비되지 않았습니다.');
                }
            } catch (error) {
                console.error('❌ 얼굴 분석 시작 실패:', error);
                alert('얼굴 분석 시작 중 오류가 발생했습니다.');
                
                // 오류 시 버튼 상태 복원
                DOM.analyzeFacesBtn.disabled = false;
                DOM.analyzeFacesBtn.textContent = '얼굴 분석 시작';
                DOM.analyzeFacesBtn.style.backgroundColor = '';
            }
        });
    }
    
    // 작업 로그 모달 닫기 버튼 이벤트 리스너
    const workLogModal = document.getElementById('workLogModal');
    if (workLogModal) {
        // X 버튼 클릭으로 닫기
        const workLogCloseBtn = workLogModal.querySelector('.modal-close');
        if (workLogCloseBtn) {
            workLogCloseBtn.addEventListener('click', hideWorkLogModal);
        }
        
        // 하단 닫기 버튼 클릭으로 닫기
        const workLogCloseFooterBtn = workLogModal.querySelector('.modal-btn.primary');
        if (workLogCloseFooterBtn) {
            workLogCloseFooterBtn.addEventListener('click', hideWorkLogModal);
        }
        
        // 모달 배경 클릭으로 닫기
        workLogModal.addEventListener('click', (e) => {
            if (e.target === workLogModal) {
                hideWorkLogModal();
            }
        });
        
        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && workLogModal.style.display === 'flex') {
                hideWorkLogModal();
            }
        });
    }
} 

// 작업 로그 관련 함수들
function showWorkLogModal() {
    const workLogModal = document.getElementById('workLogModal');
    if (!workLogModal) {
        console.error('작업 로그 모달을 찾을 수 없습니다.');
        return;
    }
    
    // 작업 로그 데이터 로드
    workLogManager.loadWorkLogs();
    
    // 통계 업데이트
    updateWorkLogStats();
    
    // 로그 목록 표시
    updateWorkLogDisplay();
    
    // 모달 표시
    workLogModal.style.display = 'flex';
    console.log('📝 작업 로그 모달 열림');
}

function hideWorkLogModal() {
    const workLogModal = document.getElementById('workLogModal');
    if (workLogModal) {
        workLogModal.style.display = 'none';
        console.log('📝 작업 로그 모달 닫힘');
    }
}

function updateWorkLogStats() {
    const stats = workLogManager.getWorkLogStats();
    
    const totalWorkCount = document.getElementById('totalWorkCount');
    const todayWorkCount = document.getElementById('todayWorkCount');
    const activeDaysCount = document.getElementById('activeDaysCount');
    
    if (totalWorkCount) totalWorkCount.textContent = stats.total;
    if (todayWorkCount) todayWorkCount.textContent = stats.today;
    if (activeDaysCount) activeDaysCount.textContent = stats.dates;
}

function updateWorkLogDisplay() {
    const workLogList = document.getElementById('workLogList');
    if (!workLogList) return;
    
    const dateFilter = document.getElementById('workLogDateFilter')?.value || 'all';
    const typeFilter = document.getElementById('workLogTypeFilter')?.value || 'all';
    
    let filteredLogs = [...state.workLogs];
    
    // 날짜 필터 적용
    if (dateFilter !== 'all') {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        switch (dateFilter) {
            case 'today':
                filteredLogs = filteredLogs.filter(log => log.date === todayStr);
                break;
            case 'yesterday':
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];
                filteredLogs = filteredLogs.filter(log => log.date === yesterdayStr);
                break;
            case 'this-week':
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - today.getDay());
                const weekStartStr = weekStart.toISOString().split('T')[0];
                filteredLogs = filteredLogs.filter(log => log.date >= weekStartStr);
                break;
            case 'this-month':
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                const monthStartStr = monthStart.toISOString().split('T')[0];
                filteredLogs = filteredLogs.filter(log => log.date >= monthStartStr);
                break;
        }
    }
    
    // 타입 필터 적용
    if (typeFilter !== 'all') {
        filteredLogs = filteredLogs.filter(log => log.type === typeFilter);
    }
    
    // 최신 순으로 정렬
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // 화면에 표시
    if (filteredLogs.length === 0) {
        workLogList.innerHTML = `
            <div class="work-log-empty">
                <div class="empty-icon">📋</div>
                <div class="empty-text">해당 조건의 작업 로그가 없습니다.</div>
                <div class="empty-desc">다른 필터를 선택해보세요.</div>
            </div>
        `;
    } else {
        workLogList.innerHTML = filteredLogs.map(log => `
            <div class="work-log-item">
                <div class="work-log-header">
                    <div class="work-log-type">${getWorkLogTypeIcon(log.type)} ${getWorkLogTypeName(log.type)}</div>
                    <div class="work-log-time">${log.date} ${log.time}</div>
                </div>
                <div class="work-log-description">${log.description}</div>
                ${log.details && Object.keys(log.details).length > 0 ? `
                    <div class="work-log-details">
                        ${Object.entries(log.details).map(([key, value]) => `
                            <span class="detail-item">${key}: ${value}</span>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');
    }
}

function getWorkLogTypeIcon(type) {
    const icons = {
        'upload': '📁',
        'transcription': '🎙️',
        'processing': '⚙️',
        'chat': '💬',
        'settings': '⚙️',
        'export': '📤',
        'import': '📥'
    };
    return icons[type] || '📝';
}

function getWorkLogTypeName(type) {
    const names = {
        'upload': '파일 업로드',
        'transcription': '자막 추출',
        'processing': '영상 처리',
        'chat': 'AI 대화',
        'settings': '설정 변경',
        'export': '내보내기',
        'import': '가져오기'
    };
    return names[type] || '기타';
}

// 전역 함수로 내보내기
window.exportWorkLogs = function() {
    const logs = state.workLogs;
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `AutoShorts_WorkLogs_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 로그 기록
    workLogManager.addWorkLog('export', `작업 로그 ${logs.length}개 내보내기 완료`, { 
        format: 'JSON',
        count: logs.length 
    });
    
    alert(`✅ 작업 로그 ${logs.length}개를 파일로 내보냈습니다.`);
};

window.clearWorkLogs = function() {
    if (confirm('🗑️ 모든 작업 로그를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
        const count = state.workLogs.length;
        state.workLogs = [];
        workLogManager.saveWorkLogs();
        
        updateWorkLogStats();
        updateWorkLogDisplay();
        
        alert(`✅ 작업 로그 ${count}개를 모두 삭제했습니다.`);
    }
};

// 🆘 문제 해결을 위한 전역 함수들
window.reinitializeModels = function() {
    console.log('🔄 모델 선택 드롭다운 수동 재초기화 시작');
    try {
        initializeModelSelects();
        console.log('✅ 모델 선택 드롭다운 수동 재초기화 성공');
        alert('✅ 모델 선택 드롭다운이 재초기화되었습니다.');
    } catch (error) {
        console.error('❌ 모델 선택 드롭다운 수동 재초기화 실패:', error);
        alert('❌ 모델 선택 드롭다운 재초기화에 실패했습니다.\n\n개발자 도구 콘솔에서 오류를 확인해주세요.');
    }
};

window.debugModelStatus = function() {
    console.log('🔍 모델 선택 드롭다운 상태 디버깅');
    console.log('DOM 요소 상태:', {
        mainModelSelect: !!DOM.mainModelSelect,
        subModelSelect: !!DOM.subModelSelect,
        mainModelOptions: DOM.mainModelSelect ? DOM.mainModelSelect.children.length : 0,
        subModelOptions: DOM.subModelSelect ? DOM.subModelSelect.children.length : 0
    });
    console.log('aiModels 데이터:', aiModels);
    console.log('현재 선택된 모델:', DOM.mainModelSelect ? DOM.mainModelSelect.value : 'N/A');
    console.log('현재 선택된 서브모델:', DOM.subModelSelect ? DOM.subModelSelect.value : 'N/A');
    
    // 콘솔에 상태 출력
    alert('🔍 모델 상태 디버깅 정보가 콘솔에 출력되었습니다.\n\n개발자 도구 콘솔을 확인해주세요.');
};

window.reinitializeAllSettings = function() {
    console.log('🔄 전체 설정 UI 재초기화 시작');
    try {
        initializeSettingsUI();
        setupSettingsEventListeners();
        console.log('✅ 전체 설정 UI 재초기화 성공');
        alert('✅ 모든 설정이 재초기화되었습니다.');
    } catch (error) {
        console.error('❌ 전체 설정 UI 재초기화 실패:', error);
        alert('❌ 설정 재초기화에 실패했습니다.\n\n개발자 도구 콘솔에서 오류를 확인해주세요.');
    }
};

// 도움말 함수
window.showModelHelp = function() {
    console.log(`
🆘 모델 선택 드롭다운 문제 해결 가이드

📋 문제 진단:
1. window.debugModelStatus() - 현재 상태 확인

🔧 해결 방법:
1. window.reinitializeModels() - 모델 드롭다운만 재초기화
2. window.reinitializeAllSettings() - 전체 설정 재초기화
3. 페이지 새로고침 - 전체 앱 재시작

🎯 사용법:
개발자 도구 콘솔에서 위 함수들을 호출하세요.
예: window.reinitializeModels()
    `);
    
    alert('🆘 모델 선택 문제 해결 가이드가 콘솔에 출력되었습니다.\n\n개발자 도구 콘솔을 확인해주세요.');
};
