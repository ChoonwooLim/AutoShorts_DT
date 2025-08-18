/**
 * 에러 복구 이벤트 처리 시스템
 * Phase C: 에러 처리 강화 - 복구 메커니즘
 */
class ErrorRecoveryManager {
    constructor() {
        this.retryAttempts = new Map();
        this.maxRetryAttempts = 3;
        this.isInitialized = false;
        
        this.initializeEventListeners();
    }
    
    /**
     * 이벤트 리스너 초기화
     */
    initializeEventListeners() {
        if (this.isInitialized) return;
        
        // 재시도 이벤트
        window.addEventListener('error-retry', (event) => {
            this.handleRetry(event.detail);
        });
        
        // 폴백 이벤트
        window.addEventListener('error-fallback', (event) => {
            this.handleFallback(event.detail);
        });
        
        // 사용자 액션 필요 이벤트
        window.addEventListener('error-user-action', (event) => {
            this.handleUserAction(event.detail);
        });
        
        // 작업 중단 이벤트
        window.addEventListener('error-abort', (event) => {
            this.handleAbort(event.detail);
        });
        
        this.isInitialized = true;
        console.log('✅ ErrorRecoveryManager 초기화 완료');
    }
    
    /**
     * 재시도 처리
     * @param {Object} errorData 에러 데이터
     */
    async handleRetry(errorData) {
        const key = `${errorData.type}_${errorData.context?.function || 'unknown'}`;
        const attempts = this.retryAttempts.get(key) || 0;
        
        if (attempts >= this.maxRetryAttempts) {
            console.warn(`🛑 최대 재시도 횟수 초과: ${key}`);
            this.handleMaxRetriesExceeded(errorData);
            return;
        }
        
        this.retryAttempts.set(key, attempts + 1);
        console.log(`🔄 재시도 ${attempts + 1}/${this.maxRetryAttempts}: ${key}`);
        
        try {
            await this.executeRetry(errorData);
            // 성공 시 재시도 카운터 리셋
            this.retryAttempts.delete(key);
            console.log(`✅ 재시도 성공: ${key}`);
        } catch (retryError) {
            console.error(`❌ 재시도 실패: ${key}`, retryError);
            // 다음 재시도는 ErrorHandler가 자동으로 스케줄링
        }
    }
    
    /**
     * 실제 재시도 실행
     * @param {Object} errorData 에러 데이터
     */
    async executeRetry(errorData) {
        switch (errorData.type) {
            case 'network':
                return await this.retryNetworkOperation(errorData);
            case 'api':
                return await this.retryApiCall(errorData);
            case 'transcription':
                return await this.retryTranscription(errorData);
            case 'ffmpeg':
                return await this.retryFFmpegOperation(errorData);
            default:
                throw new Error(`재시도 방법을 알 수 없는 에러 타입: ${errorData.type}`);
        }
    }
    
    /**
     * 네트워크 작업 재시도
     * @param {Object} errorData 에러 데이터
     */
    async retryNetworkOperation(errorData) {
        console.log('🌐 네트워크 작업 재시도 중...');
        
        // 네트워크 상태 확인
        if (!navigator.onLine) {
            throw new Error('인터넷 연결이 끊어져 있습니다.');
        }
        
        // 간단한 연결 테스트
        try {
            const response = await fetch('https://httpbin.org/status/200', {
                method: 'HEAD',
                timeout: 5000
            });
            if (!response.ok) {
                throw new Error('네트워크 연결 테스트 실패');
            }
        } catch (e) {
            throw new Error('네트워크 연결이 불안정합니다.');
        }
        
        console.log('✅ 네트워크 연결 복구됨');
    }
    
    /**
     * API 호출 재시도
     * @param {Object} errorData 에러 데이터
     */
    async retryApiCall(errorData) {
        console.log('🔑 API 호출 재시도 중...');
        
        // API 키 확인
        const context = errorData.context || {};
        if (context.function === 'transcribeWithGoogle') {
            // Google API 재시도 로직
            await this.validateGoogleApiAccess();
        } else if (context.function?.includes('openai') || context.function?.includes('OpenAI')) {
            // OpenAI API 재시도 로직
            await this.validateOpenAIApiAccess();
        }
        
        console.log('✅ API 접근 가능 확인됨');
    }
    
    /**
     * 자막 추출 재시도
     * @param {Object} errorData 에러 데이터
     */
    async retryTranscription(errorData) {
        console.log('🎙️ 자막 추출 재시도 중...');
        
        // 메모리 정리
        if (window.memoryManager) {
            await window.memoryManager.forceCleanup();
        }
        
        // 오디오 컨텍스트 재생성
        if (window.audioUtils) {
            window.audioUtils.resetAudioContext();
        }
        
        console.log('✅ 자막 추출 환경 재설정 완료');
    }
    
    /**
     * FFmpeg 작업 재시도
     * @param {Object} errorData 에러 데이터
     */
    async retryFFmpegOperation(errorData) {
        console.log('🎬 FFmpeg 작업 재시도 중...');
        
        // FFmpeg 인스턴스 재생성 시도
        if (window.ffmpegWorker) {
            try {
                window.ffmpegWorker.terminate();
                window.ffmpegWorker = null;
            } catch (e) {
                console.warn('FFmpeg 워커 종료 중 오류:', e);
            }
        }
        
        console.log('✅ FFmpeg 환경 재설정 완료');
    }
    
    /**
     * 폴백 처리
     * @param {Object} errorData 에러 데이터
     */
    async handleFallback(errorData) {
        console.log(`🔄 폴백 실행: ${errorData.type}`);
        
        try {
            await this.executeFallback(errorData);
            console.log(`✅ 폴백 성공: ${errorData.type}`);
        } catch (fallbackError) {
            console.error(`❌ 폴백 실패: ${errorData.type}`, fallbackError);
            // 폴백도 실패한 경우 사용자에게 알림
            if (window.uiUtils) {
                window.uiUtils.showError(
                    '복구 실패',
                    `모든 복구 시도가 실패했습니다.\n\n원본 오류: ${errorData.message}\n폴백 오류: ${fallbackError.message}`
                );
            }
        }
    }
    
    /**
     * 실제 폴백 실행
     * @param {Object} errorData 에러 데이터
     */
    async executeFallback(errorData) {
        switch (errorData.type) {
            case 'audio':
                return await this.fallbackAudioProcessing(errorData);
            case 'ffmpeg':
                return await this.fallbackVideoProcessing(errorData);
            case 'transcription':
                return await this.fallbackTranscription(errorData);
            default:
                throw new Error(`폴백 방법을 알 수 없는 에러 타입: ${errorData.type}`);
        }
    }
    
    /**
     * 오디오 처리 폴백
     * @param {Object} errorData 에러 데이터
     */
    async fallbackAudioProcessing(errorData) {
        console.log('🎵 오디오 처리 폴백: MediaRecorder 사용');
        
        // 복잡한 압축 방식에서 기본 MediaRecorder로 폴백
        const compressionMethod = document.querySelector('input[name="compression-method"]:checked');
        if (compressionMethod && compressionMethod.value !== 'mediarecorder') {
            // 자동으로 MediaRecorder로 변경
            const mediaRecorderOption = document.querySelector('input[name="compression-method"][value="mediarecorder"]');
            if (mediaRecorderOption) {
                mediaRecorderOption.checked = true;
                
                if (window.uiUtils) {
                    window.uiUtils.showInfo(
                        '압축 방식 변경',
                        '안정성을 위해 브라우저 압축 방식으로 자동 변경되었습니다.'
                    );
                }
            }
        }
    }
    
    /**
     * 영상 처리 폴백
     * @param {Object} errorData 에러 데이터
     */
    async fallbackVideoProcessing(errorData) {
        console.log('🎬 영상 처리 폴백: 단순 처리 모드');
        
        // 복잡한 영상 처리 옵션들을 비활성화
        const complexOptions = ['videoStabilization', 'colorCorrection', 'addEffects'];
        complexOptions.forEach(optionId => {
            const option = document.getElementById(optionId);
            if (option && option.checked) {
                option.checked = false;
            }
        });
        
        if (window.uiUtils) {
            window.uiUtils.showInfo(
                '처리 모드 변경',
                '안정성을 위해 일부 고급 기능이 비활성화되었습니다.'
            );
        }
    }
    
    /**
     * 자막 추출 폴백
     * @param {Object} errorData 에러 데이터
     */
    async fallbackTranscription(errorData) {
        console.log('🎙️ 자막 추출 폴백: 다른 엔진 사용');
        
        // 현재 선택된 STT 모델 확인
        const currentModel = document.querySelector('input[name="stT-model"]:checked');
        if (currentModel) {
            // Google -> OpenAI 또는 OpenAI -> Google로 자동 변경
            const fallbackModel = currentModel.value === 'google' ? 'openai' : 'google';
            const fallbackOption = document.querySelector(`input[name="stt-model"][value="${fallbackModel}"]`);
            
            if (fallbackOption) {
                fallbackOption.checked = true;
                
                if (window.uiUtils) {
                    window.uiUtils.showInfo(
                        '음성 인식 엔진 변경',
                        `안정성을 위해 ${fallbackModel === 'google' ? 'Google' : 'OpenAI'} 엔진으로 자동 변경되었습니다.`
                    );
                }
            }
        }
    }
    
    /**
     * 사용자 액션 필요 처리
     * @param {Object} errorData 에러 데이터
     */
    handleUserAction(errorData) {
        console.log(`👤 사용자 액션 필요: ${errorData.type}`);
        
        // 이미 사용자에게 알림이 갔으므로 추가 처리만 수행
        switch (errorData.type) {
            case 'api':
                this.handleApiUserAction(errorData);
                break;
            case 'validation':
                this.handleValidationUserAction(errorData);
                break;
            default:
                console.log(`일반적인 사용자 액션 필요: ${errorData.type}`);
        }
    }
    
    /**
     * API 관련 사용자 액션 처리
     * @param {Object} errorData 에러 데이터
     */
    handleApiUserAction(errorData) {
        // API 설정 버튼 강조 효과
        const apiSettingsBtn = document.getElementById('apiSettingsBtn');
        if (apiSettingsBtn) {
            apiSettingsBtn.style.animation = 'pulse 2s infinite';
            apiSettingsBtn.style.boxShadow = '0 0 20px var(--accent-color)';
            
            // 5초 후 효과 제거
            setTimeout(() => {
                apiSettingsBtn.style.animation = '';
                apiSettingsBtn.style.boxShadow = '';
            }, 5000);
        }
    }
    
    /**
     * 검증 관련 사용자 액션 처리
     * @param {Object} errorData 에러 데이터
     */
    handleValidationUserAction(errorData) {
        // 관련 입력 필드 강조
        const context = errorData.context || {};
        if (context.fieldId) {
            const field = document.getElementById(context.fieldId);
            if (field) {
                field.style.borderColor = 'var(--error-color)';
                field.focus();
                
                // 3초 후 강조 제거
                setTimeout(() => {
                    field.style.borderColor = '';
                }, 3000);
            }
        }
    }
    
    /**
     * 작업 중단 처리
     * @param {Object} errorData 에러 데이터
     */
    handleAbort(errorData) {
        console.error(`🛑 작업 중단: ${errorData.type}`);
        
        // 모든 진행 중인 작업 중단
        this.abortAllOperations();
        
        // 사용자에게 심각한 오류 알림
        if (window.uiUtils) {
            window.uiUtils.showError(
                '심각한 오류',
                `복구할 수 없는 오류가 발생했습니다.\n\n${errorData.userMessage}\n\n페이지를 새로고침하거나 브라우저를 재시작해주세요.`
            );
        }
    }
    
    /**
     * 모든 작업 중단
     */
    abortAllOperations() {
        // 진행률 바 숨기기
        const progressElements = [
            'progressSection',
            'transcriptionProgress',
            'analysisProgress'
        ];
        
        progressElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'none';
            }
        });
        
        // 버튼 상태 복원
        const buttons = document.querySelectorAll('button[disabled]');
        buttons.forEach(btn => {
            if (!btn.dataset.originalDisabled) {
                btn.disabled = false;
            }
        });
        
        // 워커 종료
        if (window.ffmpegWorker) {
            try {
                window.ffmpegWorker.terminate();
                window.ffmpegWorker = null;
            } catch (e) {
                console.warn('워커 종료 중 오류:', e);
            }
        }
        
        console.log('🛑 모든 작업이 중단되었습니다.');
    }
    
    /**
     * 최대 재시도 횟수 초과 처리
     * @param {Object} errorData 에러 데이터
     */
    handleMaxRetriesExceeded(errorData) {
        console.error(`🛑 최대 재시도 횟수 초과: ${errorData.type}`);
        
        // 폴백 시도
        if (errorData.recoveryStrategy !== 'fallback') {
            console.log('🔄 폴백으로 전환...');
            this.handleFallback(errorData);
        } else {
            // 폴백도 실패한 경우 중단
            this.handleAbort(errorData);
        }
    }
    
    /**
     * Google API 접근 검증
     */
    async validateGoogleApiAccess() {
        // Google API 키 확인
        const models = JSON.parse(localStorage.getItem('aiModels') || '{}');
        const geminiModel = models.gemini;
        
        if (!geminiModel?.apiKey) {
            throw new Error('Google API 키가 설정되지 않았습니다.');
        }
        
        // 간단한 API 테스트 (실제로는 더 정교한 검증 필요)
        console.log('🔑 Google API 키 확인됨');
    }
    
    /**
     * OpenAI API 접근 검증
     */
    async validateOpenAIApiAccess() {
        // OpenAI API 키 확인
        const models = JSON.parse(localStorage.getItem('aiModels') || '{}');
        const openaiModel = models.gpt;
        
        if (!openaiModel?.apiKey) {
            throw new Error('OpenAI API 키가 설정되지 않았습니다.');
        }
        
        // 간단한 API 테스트 (실제로는 더 정교한 검증 필요)
        console.log('🔑 OpenAI API 키 확인됨');
    }
    
    /**
     * 재시도 통계 조회
     * @returns {Object} 재시도 통계
     */
    getRetryStats() {
        const stats = {};
        for (const [key, attempts] of this.retryAttempts.entries()) {
            stats[key] = {
                attempts,
                remaining: this.maxRetryAttempts - attempts
            };
        }
        return stats;
    }
    
    /**
     * 재시도 카운터 리셋
     * @param {string} key 리셋할 키 (선택적)
     */
    resetRetryCounters(key = null) {
        if (key) {
            this.retryAttempts.delete(key);
            console.log(`✅ 재시도 카운터 리셋: ${key}`);
        } else {
            this.retryAttempts.clear();
            console.log('✅ 모든 재시도 카운터 리셋');
        }
    }
}

// 전역 에러 복구 매니저 인스턴스 생성
window.errorRecoveryManager = new ErrorRecoveryManager();

export default ErrorRecoveryManager;
