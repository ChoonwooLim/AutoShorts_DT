/**
 * 통합 에러 처리 시스템
 * Phase C: 에러 처리 강화
 */
class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.errorStats = new Map();
        this.maxLogSize = 100;
        this.isLoggingEnabled = true;
        
        // 에러 타입 정의
        this.ERROR_TYPES = {
            NETWORK: 'network',
            API: 'api',
            FILE: 'file',
            AUDIO: 'audio',
            VALIDATION: 'validation',
            MEMORY: 'memory',
            FFMPEG: 'ffmpeg',
            TRANSCRIPTION: 'transcription',
            UI: 'ui',
            UNKNOWN: 'unknown'
        };
        
        // 심각도 레벨
        this.SEVERITY_LEVELS = {
            LOW: 'low',
            MEDIUM: 'medium',
            HIGH: 'high',
            CRITICAL: 'critical'
        };
        
        // 복구 전략
        this.RECOVERY_STRATEGIES = {
            RETRY: 'retry',
            FALLBACK: 'fallback',
            IGNORE: 'ignore',
            ABORT: 'abort',
            USER_ACTION: 'user_action'
        };
        
        this.initializeGlobalErrorHandling();
    }
    
    /**
     * 전역 에러 핸들링 초기화
     */
    initializeGlobalErrorHandling() {
        // 전역 JavaScript 에러 캐치
        window.addEventListener('error', (event) => {
            this.handleError({
                type: this.ERROR_TYPES.UNKNOWN,
                message: event.message,
                filename: event.filename,
                line: event.lineno,
                column: event.colno,
                stack: event.error?.stack,
                severity: this.SEVERITY_LEVELS.HIGH
            });
        });
        
        // Promise rejection 캐치
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: this.ERROR_TYPES.UNKNOWN,
                message: event.reason?.message || 'Unhandled Promise Rejection',
                originalError: event.reason,
                severity: this.SEVERITY_LEVELS.MEDIUM
            });
        });
    }
    
    /**
     * 메인 에러 처리 함수
     * @param {Object} errorInfo 에러 정보 객체
     */
    handleError(errorInfo) {
        const processedError = this.processError(errorInfo);
        
        // 로깅
        if (this.isLoggingEnabled) {
            this.logError(processedError);
        }
        
        // 통계 업데이트
        this.updateErrorStats(processedError);
        
        // 사용자 알림
        this.notifyUser(processedError);
        
        // 복구 시도
        this.attemptRecovery(processedError);
        
        return processedError;
    }
    
    /**
     * 에러 정보 처리 및 분류
     * @param {Object} errorInfo 원본 에러 정보
     * @returns {Object} 처리된 에러 객체
     */
    processError(errorInfo) {
        const timestamp = new Date().toISOString();
        const errorId = this.generateErrorId();
        
        // 에러 타입 자동 분류
        const type = this.classifyError(errorInfo);
        
        // 심각도 평가
        const severity = this.evaluateSeverity(errorInfo, type);
        
        // 복구 전략 결정
        const recoveryStrategy = this.determineRecoveryStrategy(type, severity);
        
        return {
            id: errorId,
            timestamp,
            type,
            severity,
            recoveryStrategy,
            message: errorInfo.message || 'Unknown error',
            originalError: errorInfo.originalError,
            stack: errorInfo.stack,
            context: errorInfo.context || {},
            userMessage: this.generateUserMessage(type, errorInfo),
            technicalDetails: this.generateTechnicalDetails(errorInfo),
            suggestions: this.generateSuggestions(type, errorInfo)
        };
    }
    
    /**
     * 에러 타입 자동 분류
     * @param {Object} errorInfo 에러 정보
     * @returns {string} 에러 타입
     */
    classifyError(errorInfo) {
        const message = (errorInfo.message || '').toLowerCase();
        const stack = (errorInfo.stack || '').toLowerCase();
        
        // API 관련 에러
        if (message.includes('api') || message.includes('401') || message.includes('403') || 
            message.includes('api 키') || message.includes('unauthorized')) {
            return this.ERROR_TYPES.API;
        }
        
        // 네트워크 관련 에러
        if (message.includes('network') || message.includes('fetch') || message.includes('connection') ||
            message.includes('timeout') || message.includes('cors')) {
            return this.ERROR_TYPES.NETWORK;
        }
        
        // 파일 관련 에러
        if (message.includes('file') || message.includes('upload') || message.includes('download') ||
            message.includes('blob') || message.includes('size')) {
            return this.ERROR_TYPES.FILE;
        }
        
        // 오디오 관련 에러
        if (message.includes('audio') || message.includes('wav') || message.includes('mp3') ||
            message.includes('codec') || message.includes('sample')) {
            return this.ERROR_TYPES.AUDIO;
        }
        
        // FFmpeg 관련 에러
        if (message.includes('ffmpeg') || stack.includes('ffmpeg')) {
            return this.ERROR_TYPES.FFMPEG;
        }
        
        // 자막 관련 에러
        if (message.includes('transcription') || message.includes('stt') || message.includes('whisper')) {
            return this.ERROR_TYPES.TRANSCRIPTION;
        }
        
        // 검증 관련 에러
        if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
            return this.ERROR_TYPES.VALIDATION;
        }
        
        // 메모리 관련 에러
        if (message.includes('memory') || message.includes('heap') || message.includes('allocation')) {
            return this.ERROR_TYPES.MEMORY;
        }
        
        // UI 관련 에러
        if (message.includes('dom') || message.includes('element') || message.includes('ui')) {
            return this.ERROR_TYPES.UI;
        }
        
        return this.ERROR_TYPES.UNKNOWN;
    }
    
    /**
     * 심각도 평가
     * @param {Object} errorInfo 에러 정보
     * @param {string} type 에러 타입
     * @returns {string} 심각도 레벨
     */
    evaluateSeverity(errorInfo, type) {
        // 명시적 심각도가 있으면 사용
        if (errorInfo.severity) {
            return errorInfo.severity;
        }
        
        const message = (errorInfo.message || '').toLowerCase();
        
        // Critical 에러
        if (message.includes('critical') || message.includes('fatal') || 
            message.includes('crashed') || type === this.ERROR_TYPES.MEMORY) {
            return this.SEVERITY_LEVELS.CRITICAL;
        }
        
        // High 에러
        if (type === this.ERROR_TYPES.API || type === this.ERROR_TYPES.FFMPEG ||
            message.includes('failed to load') || message.includes('cannot')) {
            return this.SEVERITY_LEVELS.HIGH;
        }
        
        // Medium 에러
        if (type === this.ERROR_TYPES.NETWORK || type === this.ERROR_TYPES.FILE ||
            type === this.ERROR_TYPES.TRANSCRIPTION) {
            return this.SEVERITY_LEVELS.MEDIUM;
        }
        
        // Low 에러
        return this.SEVERITY_LEVELS.LOW;
    }
    
    /**
     * 복구 전략 결정
     * @param {string} type 에러 타입
     * @param {string} severity 심각도
     * @returns {string} 복구 전략
     */
    determineRecoveryStrategy(type, severity) {
        // Critical 에러는 중단
        if (severity === this.SEVERITY_LEVELS.CRITICAL) {
            return this.RECOVERY_STRATEGIES.ABORT;
        }
        
        // 타입별 전략
        switch (type) {
            case this.ERROR_TYPES.NETWORK:
                return this.RECOVERY_STRATEGIES.RETRY;
            case this.ERROR_TYPES.API:
                return this.RECOVERY_STRATEGIES.USER_ACTION;
            case this.ERROR_TYPES.FFMPEG:
            case this.ERROR_TYPES.AUDIO:
                return this.RECOVERY_STRATEGIES.FALLBACK;
            case this.ERROR_TYPES.VALIDATION:
                return this.RECOVERY_STRATEGIES.USER_ACTION;
            case this.ERROR_TYPES.UI:
                return this.RECOVERY_STRATEGIES.IGNORE;
            default:
                return this.RECOVERY_STRATEGIES.RETRY;
        }
    }
    
    /**
     * 사용자 친화적 메시지 생성
     * @param {string} type 에러 타입
     * @param {Object} errorInfo 에러 정보
     * @returns {string} 사용자 메시지
     */
    generateUserMessage(type, errorInfo) {
        const baseMessages = {
            [this.ERROR_TYPES.NETWORK]: '🌐 네트워크 연결에 문제가 있습니다',
            [this.ERROR_TYPES.API]: '🔑 API 서비스에 문제가 발생했습니다',
            [this.ERROR_TYPES.FILE]: '📁 파일 처리 중 문제가 발생했습니다',
            [this.ERROR_TYPES.AUDIO]: '🎵 오디오 처리 중 문제가 발생했습니다',
            [this.ERROR_TYPES.FFMPEG]: '🎬 영상 처리 중 문제가 발생했습니다',
            [this.ERROR_TYPES.TRANSCRIPTION]: '🎙️ 자막 생성 중 문제가 발생했습니다',
            [this.ERROR_TYPES.VALIDATION]: '⚠️ 입력 데이터에 문제가 있습니다',
            [this.ERROR_TYPES.MEMORY]: '💾 메모리 부족 문제가 발생했습니다',
            [this.ERROR_TYPES.UI]: '🖥️ 화면 표시 중 문제가 발생했습니다',
            [this.ERROR_TYPES.UNKNOWN]: '❓ 예상치 못한 문제가 발생했습니다'
        };
        
        return baseMessages[type] || baseMessages[this.ERROR_TYPES.UNKNOWN];
    }
    
    /**
     * 기술적 세부사항 생성
     * @param {Object} errorInfo 에러 정보
     * @returns {string} 기술적 세부사항
     */
    generateTechnicalDetails(errorInfo) {
        const details = [];
        
        if (errorInfo.message) {
            details.push(`메시지: ${errorInfo.message}`);
        }
        
        if (errorInfo.filename) {
            details.push(`파일: ${errorInfo.filename}:${errorInfo.line}:${errorInfo.column}`);
        }
        
        if (errorInfo.context && Object.keys(errorInfo.context).length > 0) {
            details.push(`컨텍스트: ${JSON.stringify(errorInfo.context, null, 2)}`);
        }
        
        return details.join('\n');
    }
    
    /**
     * 해결 제안 생성
     * @param {string} type 에러 타입
     * @param {Object} errorInfo 에러 정보
     * @returns {Array} 해결 제안 배열
     */
    generateSuggestions(type, errorInfo) {
        const suggestions = {
            [this.ERROR_TYPES.NETWORK]: [
                '인터넷 연결 상태를 확인해주세요',
                '브라우저를 새로고침해주세요',
                'VPN 또는 방화벽 설정을 확인해주세요'
            ],
            [this.ERROR_TYPES.API]: [
                'API 키가 올바르게 설정되어 있는지 확인해주세요',
                '⚙️ 설정 버튼을 클릭하여 API 키를 재입력해주세요',
                'API 사용량 한도를 확인해주세요'
            ],
            [this.ERROR_TYPES.FILE]: [
                '파일 형식이 지원되는지 확인해주세요 (MP4, WebM, OGG)',
                '파일 크기가 100MB 이하인지 확인해주세요',
                '다른 파일로 시도해주세요'
            ],
            [this.ERROR_TYPES.AUDIO]: [
                '영상에 오디오 트랙이 있는지 확인해주세요',
                '다른 압축 방식을 시도해주세요',
                '브라우저를 새로고침 후 재시도해주세요'
            ],
            [this.ERROR_TYPES.FFMPEG]: [
                '브라우저를 새로고침해주세요',
                '다른 브라우저에서 시도해주세요',
                '파일 크기를 줄여서 시도해주세요'
            ],
            [this.ERROR_TYPES.TRANSCRIPTION]: [
                '다른 음성 인식 엔진을 시도해주세요',
                '영상의 음질이 명확한지 확인해주세요',
                '영상 길이를 줄여서 시도해주세요'
            ],
            [this.ERROR_TYPES.VALIDATION]: [
                '입력 데이터를 다시 확인해주세요',
                '필수 항목이 모두 입력되었는지 확인해주세요'
            ],
            [this.ERROR_TYPES.MEMORY]: [
                '브라우저 탭을 정리해주세요',
                '더 작은 파일로 시도해주세요',
                '브라우저를 재시작해주세요'
            ],
            [this.ERROR_TYPES.UI]: [
                '페이지를 새로고침해주세요',
                '브라우저 캐시를 삭제해주세요'
            ],
            [this.ERROR_TYPES.UNKNOWN]: [
                '브라우저를 새로고침해주세요',
                '다른 브라우저에서 시도해주세요',
                '문제가 지속되면 개발자에게 문의해주세요'
            ]
        };
        
        return suggestions[type] || suggestions[this.ERROR_TYPES.UNKNOWN];
    }
    
    /**
     * 에러 로깅
     * @param {Object} processedError 처리된 에러 객체
     */
    logError(processedError) {
        // 콘솔 로깅
        console.group(`🚨 Error [${processedError.id}] - ${processedError.type.toUpperCase()}`);
        console.error('메시지:', processedError.message);
        console.warn('심각도:', processedError.severity);
        console.info('복구 전략:', processedError.recoveryStrategy);
        console.log('시간:', processedError.timestamp);
        
        if (processedError.stack) {
            console.trace('스택 트레이스:', processedError.stack);
        }
        
        if (Object.keys(processedError.context).length > 0) {
            console.log('컨텍스트:', processedError.context);
        }
        
        console.groupEnd();
        
        // 메모리 로그에 추가
        this.errorLog.push(processedError);
        
        // 로그 크기 제한
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }
        
        // 로컬 스토리지에 저장 (선택적)
        this.saveErrorToStorage(processedError);
    }
    
    /**
     * 에러 통계 업데이트
     * @param {Object} processedError 처리된 에러 객체
     */
    updateErrorStats(processedError) {
        const key = `${processedError.type}_${processedError.severity}`;
        const current = this.errorStats.get(key) || { count: 0, lastOccurred: null };
        
        this.errorStats.set(key, {
            count: current.count + 1,
            lastOccurred: processedError.timestamp,
            type: processedError.type,
            severity: processedError.severity
        });
    }
    
    /**
     * 사용자 알림
     * @param {Object} processedError 처리된 에러 객체
     */
    notifyUser(processedError) {
        // UIUtils를 통한 알림
        if (window.uiUtils) {
            const message = `${processedError.userMessage}\n\n💡 해결 방법:\n${processedError.suggestions.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
            
            switch (processedError.severity) {
                case this.SEVERITY_LEVELS.CRITICAL:
                    window.uiUtils.showError('심각한 오류', message);
                    break;
                case this.SEVERITY_LEVELS.HIGH:
                    window.uiUtils.showError('오류', message);
                    break;
                case this.SEVERITY_LEVELS.MEDIUM:
                    window.uiUtils.showWarning('경고', message);
                    break;
                case this.SEVERITY_LEVELS.LOW:
                    window.uiUtils.showInfo('알림', message);
                    break;
            }
        }
    }
    
    /**
     * 복구 시도
     * @param {Object} processedError 처리된 에러 객체
     */
    attemptRecovery(processedError) {
        switch (processedError.recoveryStrategy) {
            case this.RECOVERY_STRATEGIES.RETRY:
                this.scheduleRetry(processedError);
                break;
            case this.RECOVERY_STRATEGIES.FALLBACK:
                this.triggerFallback(processedError);
                break;
            case this.RECOVERY_STRATEGIES.USER_ACTION:
                this.requestUserAction(processedError);
                break;
            case this.RECOVERY_STRATEGIES.IGNORE:
                console.log(`🔇 에러 무시: ${processedError.id}`);
                break;
            case this.RECOVERY_STRATEGIES.ABORT:
                this.abortOperation(processedError);
                break;
        }
    }
    
    /**
     * 재시도 스케줄링
     * @param {Object} processedError 처리된 에러 객체
     */
    scheduleRetry(processedError) {
        const retryDelay = this.calculateRetryDelay(processedError);
        console.log(`🔄 ${retryDelay}ms 후 재시도 예정: ${processedError.id}`);
        
        setTimeout(() => {
            console.log(`🔄 재시도 중: ${processedError.id}`);
            // 재시도 로직은 호출하는 쪽에서 구현
            this.dispatchEvent('error-retry', processedError);
        }, retryDelay);
    }
    
    /**
     * 폴백 트리거
     * @param {Object} processedError 처리된 에러 객체
     */
    triggerFallback(processedError) {
        console.log(`🔄 폴백 실행: ${processedError.id}`);
        this.dispatchEvent('error-fallback', processedError);
    }
    
    /**
     * 사용자 액션 요청
     * @param {Object} processedError 처리된 에러 객체
     */
    requestUserAction(processedError) {
        console.log(`👤 사용자 액션 필요: ${processedError.id}`);
        this.dispatchEvent('error-user-action', processedError);
    }
    
    /**
     * 작업 중단
     * @param {Object} processedError 처리된 에러 객체
     */
    abortOperation(processedError) {
        console.error(`🛑 작업 중단: ${processedError.id}`);
        this.dispatchEvent('error-abort', processedError);
    }
    
    /**
     * 재시도 지연 시간 계산
     * @param {Object} processedError 처리된 에러 객체
     * @returns {number} 지연 시간 (ms)
     */
    calculateRetryDelay(processedError) {
        const baseDelay = 1000; // 1초
        const key = `${processedError.type}_${processedError.severity}`;
        const stats = this.errorStats.get(key);
        
        if (!stats) return baseDelay;
        
        // 지수 백오프: 재시도 횟수에 따라 지연 시간 증가
        return Math.min(baseDelay * Math.pow(2, Math.min(stats.count - 1, 5)), 30000); // 최대 30초
    }
    
    /**
     * 커스텀 이벤트 디스패치
     * @param {string} eventType 이벤트 타입
     * @param {Object} errorData 에러 데이터
     */
    dispatchEvent(eventType, errorData) {
        const event = new CustomEvent(eventType, {
            detail: errorData,
            bubbles: true
        });
        window.dispatchEvent(event);
    }
    
    /**
     * 에러 ID 생성
     * @returns {string} 고유 에러 ID
     */
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 로컬 스토리지에 에러 저장
     * @param {Object} processedError 처리된 에러 객체
     */
    saveErrorToStorage(processedError) {
        try {
            const storageKey = 'autoShorts_errorLog';
            const existingLog = JSON.parse(localStorage.getItem(storageKey) || '[]');
            
            // 민감한 정보 제거
            const sanitizedError = {
                id: processedError.id,
                timestamp: processedError.timestamp,
                type: processedError.type,
                severity: processedError.severity,
                message: processedError.message,
                userMessage: processedError.userMessage
            };
            
            existingLog.push(sanitizedError);
            
            // 최대 50개 항목만 유지
            if (existingLog.length > 50) {
                existingLog.shift();
            }
            
            localStorage.setItem(storageKey, JSON.stringify(existingLog));
        } catch (e) {
            console.warn('로컬 스토리지 저장 실패:', e.message);
        }
    }
    
    /**
     * 에러 통계 조회
     * @returns {Object} 에러 통계
     */
    getErrorStats() {
        const stats = {};
        for (const [key, value] of this.errorStats.entries()) {
            stats[key] = value;
        }
        return stats;
    }
    
    /**
     * 에러 로그 조회
     * @param {number} limit 조회할 개수
     * @returns {Array} 에러 로그 배열
     */
    getErrorLog(limit = 10) {
        return this.errorLog.slice(-limit);
    }
    
    /**
     * 에러 로그 초기화
     */
    clearErrorLog() {
        this.errorLog = [];
        this.errorStats.clear();
        localStorage.removeItem('autoShorts_errorLog');
        console.log('✅ 에러 로그가 초기화되었습니다.');
    }
    
    /**
     * 에러 처리 시스템 상태 조회
     * @returns {Object} 시스템 상태
     */
    getSystemStatus() {
        return {
            isEnabled: this.isLoggingEnabled,
            totalErrors: this.errorLog.length,
            errorTypes: Array.from(new Set(this.errorLog.map(e => e.type))),
            recentErrors: this.errorLog.slice(-5).map(e => ({
                id: e.id,
                type: e.type,
                severity: e.severity,
                timestamp: e.timestamp
            }))
        };
    }
}

// 전역 에러 핸들러 인스턴스 생성
window.errorHandler = new ErrorHandler();

export default ErrorHandler;
