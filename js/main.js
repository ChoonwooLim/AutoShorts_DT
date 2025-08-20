// --- Main Application Entry Point for Web ---

// Core modules
import { initializeApiManagement } from './api.js';
import { state } from './state.js';
import { googleConfig } from './config.js';
import lazyLoader from './utils/lazy-loader.js';
import * as DOM from './dom-elements.js';

// Feature modules
import { setupFileEventListeners } from './ui-file.js';
import { applyInitialTheme, setupThemeEventListeners } from './ui-theme.js';
import { initializeSettingsUI, setupSettingsEventListeners } from './ui-settings.js';
import { setupChatEventListeners } from './ui-chat.js';
// import { initializeChatSystem } from './ui/chat/main.js';

// Expose state globally for easier debugging
window.state = state;

// Global function for lazy loading file-related modules
window.loadFileModules = async function() {
    if (window.loadFileModules.loaded) return true;
    try {
        const { setupProcessingEventListeners, updateProcessButtonState } = await lazyLoader.loadModule('ui-processing', () => import('./ui-processing.js'));
        await setupProcessingEventListeners();
        updateProcessButtonState();
        window.loadFileModules.loaded = true;
        console.log('📦 File processing modules loaded.');
        return true;
    } catch (error) {
        console.error('❌ Failed to load file processing modules:', error);
        return false;
    }
};

// Global function for loading and starting transcription modules (disabled)
window.loadTranscriptionModules = async function() {
    console.warn('🔇 Transcription feature is disabled.');
    alert('자막 추출 기능이 비활성화되었습니다.');
    return false;
};

/**
 * Initializes the web application.
 */
async function main() {
    try {
        console.log('🚀 AutoShorts Web Initializing...');
        console.log(`🌍 현재 환경: ${window.location.hostname}:${window.location.port}`);
        
        // API 키 관리자 초기화
        if (window.apiKeyManager) {
            await window.apiKeyManager.initialize();
            console.log('🔑 API keys loaded.');
        } else {
            console.warn('⚠️ window.apiKeyManager를 찾을 수 없습니다.');
        }
        
        // Theme system
        applyInitialTheme();
        setupThemeEventListeners();
        console.log('🎨 Theme system initialized.');
        
        // File upload system
        setupFileEventListeners();
        console.log('📁 File upload system initialized.');
        
        // Settings UI
        initializeSettingsUI();
        setupSettingsEventListeners(); // 이벤트 리스너 설정 추가
        console.log('⚙️ Settings UI initialized.');
        
        // Chat system
        setupChatEventListeners(); // 이벤트 리스너 설정 추가
        console.log('💬 Chat system initialized.');
        
        // Transcription system disabled
        
        // Face analysis system
        const faceAnalysisModule = await lazyLoader.loadModule('face-analysis', () => import('./face-analysis.js'));
        if (faceAnalysisModule && faceAnalysisModule.initializeFaceAnalysis) {
            await faceAnalysisModule.initializeFaceAnalysis();
            console.log('🎭 Face analysis system initialized.');
        }
        
        // Face analyzer V2 system
        const faceAnalyzerV2Module = await lazyLoader.loadModule('face-analyzer-new', () => import('./face-analyzer-new.js'));
        if (faceAnalyzerV2Module && faceAnalyzerV2Module.initializeFaceAnalyzer) {
            faceAnalyzerV2Module.initializeFaceAnalyzer();
            console.log('✅ Face analyzer V2 module load requested.');
        }
        
        // Background preloading
        lazyLoader.startPreloading();
        
        // 고급 자막 추출 버튼 이벤트 리스너 설정
        const advancedTranscriptionBtn = document.getElementById('openAdvancedTranscription');
        if (advancedTranscriptionBtn) {
            advancedTranscriptionBtn.addEventListener('click', () => {
                console.log('🚀 고급 자막 추출 버튼 클릭됨');
                if (window.openTranscriptionModal) {
                    window.openTranscriptionModal(state.uploadedFile);
                } else {
                    console.error('❌ openTranscriptionModal 함수를 찾을 수 없습니다.');
                }
            });
            console.log('🎙️ Advanced transcription button initialized.');
        }
        
        // 자막 추출 완료 이벤트 리스너 추가
        window.addEventListener('subtitleExtracted', (event) => {
            console.log('📝 자막 추출 완료 이벤트 수신');
            
            if (event.detail) {
                const { text, method } = event.detail;
                
                // 기존 자막 표시창 제거됨 - 전문 편집기로 대체
                console.log(`✅ ${method} 자막 추출 완료: ${text ? text.substring(0, 100) + '...' : ''}`);
                

                // ✅ 자동으로 자막 편집 모달 열기
                try {
                    const fullResult = event.detail.fullResult;
                    let segments = [];
                    if (fullResult && Array.isArray(fullResult.segments) && fullResult.segments.length > 0) {
                        segments = fullResult.segments.map(s => ({
                            start: Math.max(0, Math.round(Number(s.start)||0)),
                            end: Math.max(0, Math.round(Number(s.end)||0)),
                            text: String(s.text||'').trim()
                        }));
                    }

                    if (segments.length > 0) {
                        // 전역 상태에도 반영
                        state.subtitles = segments;
                    }

                    // 새로운 전문 자막 편집기 열기
                    if (window.subtitleEditorPro && typeof window.subtitleEditorPro.open === 'function') {
                        window.subtitleEditorPro.open(segments.length ? segments : undefined);
                    } else if (window.subtitleEditorModal && typeof window.subtitleEditorModal.open === 'function') {
                        window.subtitleEditorModal.open(segments.length ? segments : undefined);
                    } else {
                        // 늦게 로드되는 경우를 대비한 폴백 이벤트
                        document.dispatchEvent(new CustomEvent('openSubtitleEditorRequested'));
                    }
                } catch (e) {
                    console.warn('자막 편집 모달 자동 오픈 실패:', e);
                }
            }
        });
        
        // 배우 얼굴 분석 버튼 이벤트 리스너 설정
        const faceAnalysisBtn = document.getElementById('faceAnalysisBtn');
        if (faceAnalysisBtn) {
            faceAnalysisBtn.addEventListener('click', async () => {
                console.log('🎭 배우 얼굴 분석 버튼 클릭됨');
                
                // 비디오가 업로드되었는지 확인
                if (!DOM.videoPreview || !DOM.videoPreview.src) {
                    alert('먼저 동영상을 업로드해주세요.');
                    return;
                }
                
                try {
                    // face-analysis 모듈 로드 및 분석 시작
                    const faceAnalysisModule = await lazyLoader.loadModule('face-analysis', () => import('./face-analysis.js'));
                    if (faceAnalysisModule && faceAnalysisModule.analyzeFaces) {
                        const faceCountElement = document.getElementById('faceCount');
                        if (faceCountElement) {
                            faceCountElement.textContent = '분석 중...';
                        }
                        
                        const results = await faceAnalysisModule.analyzeFaces(DOM.videoPreview);
                        faceAnalysisModule.displayFaceAnalysisResults(results);
                        
                        if (faceCountElement) {
                            faceCountElement.textContent = `${results.length}명 발견`;
                        }
                        
                        console.log(`✅ 얼굴 분석 완료: ${results.length}명 발견`);
                    }
                } catch (error) {
                    console.error('❌ 얼굴 분석 중 오류:', error);
                    alert('얼굴 분석 중 오류가 발생했습니다. 콘솔을 확인해주세요.');
                    
                    const faceCountElement = document.getElementById('faceCount');
                    if (faceCountElement) {
                        faceCountElement.textContent = '분석 실패';
                    }
                }
            });
            console.log('✅ 배우 얼굴 분석 버튼 이벤트 리스너 설정 완료');
        } else {
            console.error('❌ faceAnalysisBtn 버튼을 찾을 수 없습니다.');
        }
        
        console.log('✅ AutoShorts Web successfully initialized.');
        
        // 기능 테스트를 위한 전역 함수들 노출
        window.testFeatures = {
            testFileUpload: () => {
                console.log('🧪 파일 업로드 테스트');
                console.log('📁 DOM 요소들:', {
                    fileInput: !!DOM.fileInput,
                    uploadContainer: !!DOM.uploadContainer,
                    videoPreview: !!DOM.videoPreview
                });
                console.log('📊 State:', {
                    uploadedFile: !!state.uploadedFile,
                    uploadedFileData: !!state.uploadedFileData
                });
            },
            testChat: () => {
                console.log('🧪 채팅 테스트');
                console.log('💬 DOM 요소들:', {
                    chatInput: !!DOM.chatInput,
                    sendChatBtn: !!DOM.sendChatBtn,
                    chatHistory: !!DOM.chatHistory
                });
                console.log('📊 State:', {
                    chats: state.chats.length,
                    currentChatId: state.currentChatId
                });
            },
            testAI: () => {
                console.log('🧪 AI 테스트');
                console.log('🤖 AI 모델들:', Object.keys(aiModels));
                console.log('🔑 API 키들:', Object.keys(apiKeyManager.keys));
            },
            testAIButtons: () => {
                console.log('🧪 AI 관련 버튼 테스트');
                const buttons = {
                    faceAnalysisBtn: !!document.getElementById('faceAnalysisBtn'),
                    newChatBtn: !!DOM.newChatBtn,
                    sendChatBtn: !!DOM.sendChatBtn,
                    testAIBtn: !!DOM.testAIBtn
                };
                console.log('🔘 버튼 상태:', buttons);
                
                // 얼굴 분석 버튼 강제 클릭 테스트
                const faceBtn = document.getElementById('faceAnalysisBtn');
                if (faceBtn) {
                    console.log('🎭 얼굴 분석 버튼 강제 클릭 테스트');
                    faceBtn.click();
                }
            }
        };
        
        console.log('🔧 테스트 함수들이 window.testFeatures에 추가되었습니다.');
        console.log('💡 브라우저 콘솔에서 testFeatures.testFileUpload(), testFeatures.testChat(), testFeatures.testAI()를 실행하여 각 기능을 테스트할 수 있습니다.');
        
        // 프로덕션 환경에서 추가 디버깅
        if (window.location.hostname === 'twinverse.org' || window.location.hostname === 'www.twinverse.org') {
            console.log('🌐 프로덕션 환경에서 초기화 완료');
            console.log('🔍 사용 가능한 모듈들:', {
                apiKeyManager: !!window.apiKeyManager,
                faceApi: !!window.faceapi,
                ffmpeg: typeof FFmpeg !== 'undefined'
            });
        }
        
    } catch (error) {
        console.error('❌ AutoShorts Web 초기화 실패:', error);
        console.error('❌ 오류 상세:', {
            message: error.message,
            stack: error.stack,
            hostname: window.location.hostname,
            port: window.location.port
        });
        
        // 사용자에게 오류 알림
        setTimeout(() => {
            alert('애플리케이션 초기화 중 오류가 발생했습니다. 페이지를 새로고침해주세요.');
        }, 1000);
    }
}

/**
 * Initialize transcription system
 */
async function initializeTranscriptionSystem() {
    try {
        // Load transcription module and initialize
        const transcriptionModule = await lazyLoader.loadModule('simple-transcription', () => import('./simple-transcription.js'));
        
        // Initialize transcription if available
        if (transcriptionModule && transcriptionModule.initializeTranscription) {
            await transcriptionModule.initializeTranscription();
            console.log('✅ Transcription module loaded and initialized');
        } else {
            console.warn('⚠️ Transcription module initialization function not found');
        }
        
        // Load audio extraction module
        const audioModule = await lazyLoader.loadModule('audio-extraction', () => import('./audio-extraction.js'));
        if (audioModule && audioModule.initializeAudioExtraction) {
            await audioModule.initializeAudioExtraction();
            console.log('✅ Audio extraction module loaded and initialized');
        }
        
    } catch (error) {
        console.error('❌ Failed to initialize transcription system:', error);
    }
}

/**
 * Initialize face analysis system
 */
async function initializeFaceAnalysisSystem() {
    try {
        // Load face analysis module and initialize
        const faceAnalysisModule = await lazyLoader.loadModule('face-analysis', () => import('./face-analysis.js'));
        
        // Initialize face analysis if available
        if (faceAnalysisModule && faceAnalysisModule.initializeFaceAnalysis) {
            await faceAnalysisModule.initializeFaceAnalysis();
            console.log('✅ Face analysis module loaded and initialized');
        } else {
            console.warn('⚠️ Face analysis module initialization function not found');
        }
        
        // Load face analyzer new module
        const faceAnalyzerModule = await lazyLoader.loadModule('face-analyzer-new', () => import('./face-analyzer-new.js'));
        if (faceAnalyzerModule && faceAnalyzerModule.initializeFaceAnalyzer) {
            // This function uses requestAnimationFrame internally, so it's not awaited.
            // A try-catch block handles potential synchronous errors during the call.
            try {
                faceAnalyzerModule.initializeFaceAnalyzer();
                console.log('✅ Face analyzer V2 module load requested.');
            } catch (error) {
                console.error('❌ Failed to synchronously initialize Face Analyzer V2:', error);
            }
        }
        
        // AI 숏츠 생성기 모듈 로드
        try {
            await import('./ai-shorts-generator.js');
            console.log('✅ AI Shorts Generator module loaded.');
        } catch (error) {
            console.error('❌ Failed to load AI Shorts Generator module:', error);
        }
        
    } catch (error) {
        console.error('❌ Failed to initialize face analysis system:', error);
    }
}

/**
 * Preloads non-critical modules in the background to improve performance.
 */
function setupBackgroundPreloading() {
    lazyLoader.addToPreloadQueue('ui-processing', () => import('./ui-processing.js'));
    lazyLoader.addToPreloadQueue('shorts-processing', () => import('./shorts-processing-real.js'));
    // Removed preloading for 'face-analyzer-new.js' to avoid potential race conditions.
    // lazyLoader.addToPreloadQueue('face-analyzer-new', () => import('./face-analyzer-new.js'));

    setTimeout(() => {
        lazyLoader.startPreloading();
    }, 1500); // Start preloading after a short delay
}

// --- Google Auth Initialization ---
window.handleGapiLoaded = async () => {
  try {
    const api = await lazyLoader.loadModule('api', () => import('./api.js'));
    gapi.load('client', api.initializeGapiClient);
  } catch (error) {
    console.error('Google API initialization failed:', error);
  }
};

window.handleGisLoaded = async () => {
  try {
    const clientId = googleConfig.getClientId();
    console.log(`🔐 Initializing Google Auth with client ID from: ${googleConfig.getCurrentIdInfo().source}`);
    const api = await lazyLoader.loadModule('api', () => import('./api.js'));
    api.initializeGis(clientId);
  } catch (error) {
    console.error('Google Identity Services initialization failed:', error);
  }
};


// Run the main initialization function when the DOM is ready.
document.addEventListener('DOMContentLoaded', main);
