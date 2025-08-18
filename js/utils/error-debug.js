/**
 * 에러 디버깅 도구
 * Phase C: 에러 처리 강화 - 개발자 도구
 */
class ErrorDebugger {
    constructor() {
        this.isEnabled = false;
        this.realTimeMonitoring = false;
        this.monitoringInterval = null;
        
        this.initializeDebugCommands();
    }
    
    /**
     * 디버그 명령어 초기화
     */
    initializeDebugCommands() {
        // 전역 디버그 객체 생성
        window.errorDebug = {
            // 에러 통계 조회
            stats: () => this.showErrorStats(),
            
            // 에러 로그 조회
            logs: (limit = 10) => this.showErrorLogs(limit),
            
            // 실시간 모니터링 시작/중지
            monitor: (enable = true) => this.toggleRealTimeMonitoring(enable),
            
            // 에러 로그 초기화
            clear: () => this.clearAllLogs(),
            
            // 테스트 에러 발생
            test: (type = 'unknown') => this.generateTestError(type),
            
            // 재시도 통계
            retries: () => this.showRetryStats(),
            
            // 시스템 상태
            status: () => this.showSystemStatus(),
            
            // 도움말
            help: () => this.showHelp(),
            
            // 에러 상세 분석
            analyze: (errorId) => this.analyzeError(errorId),
            
            // 에러 패턴 분석
            patterns: () => this.analyzeErrorPatterns(),
            
            // 메모리 사용량 체크
            memory: () => this.checkMemoryUsage(),
            
            // 성능 메트릭
            performance: () => this.showPerformanceMetrics()
        };
        
        console.log(`
🐛 AutoShorts 에러 디버깅 도구가 활성화되었습니다!

사용 가능한 명령어:
- errorDebug.help()     : 전체 도움말
- errorDebug.stats()    : 에러 통계
- errorDebug.logs()     : 최근 에러 로그
- errorDebug.monitor()  : 실시간 모니터링
- errorDebug.status()   : 시스템 상태

자세한 사용법은 errorDebug.help()를 입력하세요.
        `);
    }
    
    /**
     * 에러 통계 표시
     */
    showErrorStats() {
        if (!window.errorHandler) {
            console.warn('❌ ErrorHandler가 초기화되지 않았습니다.');
            return;
        }
        
        const stats = window.errorHandler.getErrorStats();
        const totalErrors = window.errorHandler.getErrorLog().length;
        
        console.group('📊 에러 통계');
        console.log(`총 에러 수: ${totalErrors}`);
        
        if (Object.keys(stats).length === 0) {
            console.log('✅ 기록된 에러가 없습니다.');
        } else {
            console.table(stats);
            
            // 타입별 집계
            const typeStats = {};
            Object.values(stats).forEach(stat => {
                typeStats[stat.type] = (typeStats[stat.type] || 0) + stat.count;
            });
            
            console.log('\n📈 타입별 에러 수:');
            console.table(typeStats);
            
            // 심각도별 집계
            const severityStats = {};
            Object.values(stats).forEach(stat => {
                severityStats[stat.severity] = (severityStats[stat.severity] || 0) + stat.count;
            });
            
            console.log('\n⚠️ 심각도별 에러 수:');
            console.table(severityStats);
        }
        
        console.groupEnd();
        return stats;
    }
    
    /**
     * 에러 로그 표시
     * @param {number} limit 표시할 개수
     */
    showErrorLogs(limit = 10) {
        if (!window.errorHandler) {
            console.warn('❌ ErrorHandler가 초기화되지 않았습니다.');
            return;
        }
        
        const logs = window.errorHandler.getErrorLog(limit);
        
        console.group(`📋 최근 에러 로그 (${logs.length}개)`);
        
        if (logs.length === 0) {
            console.log('✅ 기록된 에러가 없습니다.');
        } else {
            logs.forEach((error, index) => {
                const timeAgo = this.getTimeAgo(error.timestamp);
                console.group(`${index + 1}. [${error.type.toUpperCase()}] ${error.severity} - ${timeAgo}`);
                console.log('ID:', error.id);
                console.log('메시지:', error.message);
                console.log('복구 전략:', error.recoveryStrategy);
                console.log('시간:', error.timestamp);
                
                if (Object.keys(error.context).length > 0) {
                    console.log('컨텍스트:', error.context);
                }
                
                if (error.suggestions.length > 0) {
                    console.log('해결 제안:', error.suggestions);
                }
                
                console.groupEnd();
            });
        }
        
        console.groupEnd();
        return logs;
    }
    
    /**
     * 실시간 모니터링 토글
     * @param {boolean} enable 활성화 여부
     */
    toggleRealTimeMonitoring(enable = true) {
        if (enable && !this.realTimeMonitoring) {
            this.realTimeMonitoring = true;
            this.monitoringInterval = setInterval(() => {
                this.updateRealTimeStatus();
            }, 5000); // 5초마다 업데이트
            
            console.log('🔄 실시간 에러 모니터링이 시작되었습니다.');
            console.log('중지하려면 errorDebug.monitor(false)를 입력하세요.');
            
        } else if (!enable && this.realTimeMonitoring) {
            this.realTimeMonitoring = false;
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
                this.monitoringInterval = null;
            }
            
            console.log('⏹️ 실시간 에러 모니터링이 중지되었습니다.');
        } else {
            console.log(`ℹ️ 실시간 모니터링이 이미 ${enable ? '활성화' : '비활성화'}되어 있습니다.`);
        }
    }
    
    /**
     * 실시간 상태 업데이트
     */
    updateRealTimeStatus() {
        if (!window.errorHandler) return;
        
        const recentErrors = window.errorHandler.getErrorLog(5);
        const newErrors = recentErrors.filter(error => {
            const errorTime = new Date(error.timestamp);
            const fiveSecondsAgo = new Date(Date.now() - 5000);
            return errorTime > fiveSecondsAgo;
        });
        
        if (newErrors.length > 0) {
            console.group('🚨 새로운 에러 감지!');
            newErrors.forEach(error => {
                console.warn(`[${error.type.toUpperCase()}] ${error.message}`);
            });
            console.groupEnd();
        }
        
        // 메모리 사용량 체크
        if (window.memoryManager) {
            const memoryInfo = window.memoryManager.getMemoryInfo();
            if (memoryInfo.usedJSHeapSize > 100 * 1024 * 1024) { // 100MB 초과
                console.warn(`⚠️ 메모리 사용량 주의: ${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
            }
        }
    }
    
    /**
     * 모든 로그 초기화
     */
    clearAllLogs() {
        if (window.errorHandler) {
            window.errorHandler.clearErrorLog();
        }
        
        if (window.errorRecoveryManager) {
            window.errorRecoveryManager.resetRetryCounters();
        }
        
        console.log('🧹 모든 에러 로그와 통계가 초기화되었습니다.');
    }
    
    /**
     * 테스트 에러 생성
     * @param {string} type 에러 타입
     */
    generateTestError(type = 'unknown') {
        if (!window.errorHandler) {
            console.warn('❌ ErrorHandler가 초기화되지 않았습니다.');
            return;
        }
        
        const testErrors = {
            network: {
                message: '테스트 네트워크 에러',
                type: 'network',
                context: { function: 'testFunction', test: true }
            },
            api: {
                message: '테스트 API 에러',
                type: 'api',
                context: { function: 'testApiCall', test: true }
            },
            transcription: {
                message: '테스트 자막 추출 에러',
                type: 'transcription',
                context: { function: 'testTranscription', test: true }
            },
            memory: {
                message: '테스트 메모리 에러',
                type: 'memory',
                severity: 'critical',
                context: { function: 'testMemory', test: true }
            },
            unknown: {
                message: '테스트 알 수 없는 에러',
                context: { function: 'testUnknown', test: true }
            }
        };
        
        const errorConfig = testErrors[type] || testErrors.unknown;
        const processedError = window.errorHandler.handleError(errorConfig);
        
        console.log(`🧪 테스트 에러 생성됨: ${processedError.id}`);
        return processedError;
    }
    
    /**
     * 재시도 통계 표시
     */
    showRetryStats() {
        if (!window.errorRecoveryManager) {
            console.warn('❌ ErrorRecoveryManager가 초기화되지 않았습니다.');
            return;
        }
        
        const retryStats = window.errorRecoveryManager.getRetryStats();
        
        console.group('🔄 재시도 통계');
        
        if (Object.keys(retryStats).length === 0) {
            console.log('✅ 진행 중인 재시도가 없습니다.');
        } else {
            console.table(retryStats);
        }
        
        console.groupEnd();
        return retryStats;
    }
    
    /**
     * 시스템 상태 표시
     */
    showSystemStatus() {
        console.group('🔍 시스템 상태');
        
        // ErrorHandler 상태
        if (window.errorHandler) {
            const status = window.errorHandler.getSystemStatus();
            console.log('ErrorHandler:', status);
        } else {
            console.warn('❌ ErrorHandler가 초기화되지 않았습니다.');
        }
        
        // MemoryManager 상태
        if (window.memoryManager) {
            const memoryInfo = window.memoryManager.getMemoryInfo();
            console.log('메모리 사용량:', {
                used: `${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
                total: `${(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
                limit: `${(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`
            });
        }
        
        // EventManager 상태
        if (window.eventManager) {
            console.log('EventManager: 활성화됨');
        }
        
        // 브라우저 정보
        console.log('브라우저:', {
            userAgent: navigator.userAgent,
            language: navigator.language,
            online: navigator.onLine,
            cookieEnabled: navigator.cookieEnabled
        });
        
        console.groupEnd();
    }
    
    /**
     * 도움말 표시
     */
    showHelp() {
        console.log(`
🐛 AutoShorts 에러 디버깅 도구 도움말

📊 통계 및 로그:
  errorDebug.stats()           - 에러 통계 표시
  errorDebug.logs(limit)       - 에러 로그 표시 (기본 10개)
  errorDebug.retries()         - 재시도 통계 표시
  errorDebug.status()          - 시스템 상태 표시

🔄 모니터링:
  errorDebug.monitor(true)     - 실시간 모니터링 시작
  errorDebug.monitor(false)    - 실시간 모니터링 중지

🧪 테스트:
  errorDebug.test()            - 테스트 에러 생성
  errorDebug.test('network')   - 네트워크 에러 테스트
  errorDebug.test('api')       - API 에러 테스트
  errorDebug.test('memory')    - 메모리 에러 테스트

🔍 분석:
  errorDebug.analyze(errorId)  - 특정 에러 상세 분석
  errorDebug.patterns()        - 에러 패턴 분석
  errorDebug.memory()          - 메모리 사용량 체크
  errorDebug.performance()     - 성능 메트릭 표시

🧹 관리:
  errorDebug.clear()           - 모든 로그 초기화

예시:
  errorDebug.stats()           // 에러 통계 확인
  errorDebug.logs(5)           // 최근 5개 에러 확인
  errorDebug.test('network')   // 네트워크 에러 테스트
  errorDebug.monitor()         // 실시간 모니터링 시작
        `);
    }
    
    /**
     * 특정 에러 상세 분석
     * @param {string} errorId 에러 ID
     */
    analyzeError(errorId) {
        if (!window.errorHandler) {
            console.warn('❌ ErrorHandler가 초기화되지 않았습니다.');
            return;
        }
        
        const allLogs = window.errorHandler.getErrorLog(100);
        const error = allLogs.find(e => e.id === errorId);
        
        if (!error) {
            console.warn(`❌ 에러 ID '${errorId}'를 찾을 수 없습니다.`);
            return;
        }
        
        console.group(`🔍 에러 상세 분석: ${errorId}`);
        console.log('기본 정보:', {
            id: error.id,
            type: error.type,
            severity: error.severity,
            timestamp: error.timestamp,
            recoveryStrategy: error.recoveryStrategy
        });
        
        console.log('메시지:', error.message);
        console.log('사용자 메시지:', error.userMessage);
        console.log('기술적 세부사항:', error.technicalDetails);
        console.log('해결 제안:', error.suggestions);
        console.log('컨텍스트:', error.context);
        
        if (error.stack) {
            console.log('스택 트레이스:', error.stack);
        }
        
        // 유사한 에러 찾기
        const similarErrors = allLogs.filter(e => 
            e.id !== errorId && 
            e.type === error.type && 
            e.message.includes(error.message.split(' ')[0])
        );
        
        if (similarErrors.length > 0) {
            console.log(`\n🔗 유사한 에러 ${similarErrors.length}개 발견:`);
            similarErrors.forEach(e => {
                console.log(`- ${e.id} (${this.getTimeAgo(e.timestamp)})`);
            });
        }
        
        console.groupEnd();
        return error;
    }
    
    /**
     * 에러 패턴 분석
     */
    analyzeErrorPatterns() {
        if (!window.errorHandler) {
            console.warn('❌ ErrorHandler가 초기화되지 않았습니다.');
            return;
        }
        
        const allLogs = window.errorHandler.getErrorLog(100);
        
        console.group('🔍 에러 패턴 분석');
        
        if (allLogs.length === 0) {
            console.log('✅ 분석할 에러가 없습니다.');
            console.groupEnd();
            return;
        }
        
        // 시간대별 분석
        const hourlyStats = {};
        allLogs.forEach(error => {
            const hour = new Date(error.timestamp).getHours();
            hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
        });
        
        console.log('⏰ 시간대별 에러 발생:');
        console.table(hourlyStats);
        
        // 연속 에러 패턴
        const consecutiveErrors = this.findConsecutiveErrors(allLogs);
        if (consecutiveErrors.length > 0) {
            console.log('\n⚡ 연속 에러 패턴:');
            consecutiveErrors.forEach(pattern => {
                console.log(`- ${pattern.type}: ${pattern.count}회 연속 (${pattern.timeSpan}초 간격)`);
            });
        }
        
        // 에러 메시지 키워드 분석
        const keywords = this.analyzeErrorKeywords(allLogs);
        console.log('\n🔤 자주 나타나는 에러 키워드:');
        console.table(keywords);
        
        console.groupEnd();
    }
    
    /**
     * 메모리 사용량 체크
     */
    checkMemoryUsage() {
        if (!window.memoryManager) {
            console.warn('❌ MemoryManager가 초기화되지 않았습니다.');
            return;
        }
        
        const memoryInfo = window.memoryManager.getMemoryInfo();
        const usage = (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;
        
        console.group('💾 메모리 사용량 분석');
        console.log('현재 사용량:', {
            used: `${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
            total: `${(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
            limit: `${(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`,
            percentage: `${usage.toFixed(2)}%`
        });
        
        if (usage > 80) {
            console.warn('⚠️ 메모리 사용량이 높습니다! 정리가 필요할 수 있습니다.');
        } else if (usage > 60) {
            console.warn('⚠️ 메모리 사용량이 증가하고 있습니다.');
        } else {
            console.log('✅ 메모리 사용량이 정상 범위입니다.');
        }
        
        console.groupEnd();
        return memoryInfo;
    }
    
    /**
     * 성능 메트릭 표시
     */
    showPerformanceMetrics() {
        console.group('⚡ 성능 메트릭');
        
        // 페이지 로드 시간
        if (performance.timing) {
            const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
            console.log(`페이지 로드 시간: ${loadTime}ms`);
        }
        
        // 현재 성능 정보
        if (performance.now) {
            console.log(`페이지 실행 시간: ${performance.now().toFixed(2)}ms`);
        }
        
        // 리소스 타이밍
        if (performance.getEntriesByType) {
            const resources = performance.getEntriesByType('resource');
            const slowResources = resources.filter(r => r.duration > 1000);
            
            if (slowResources.length > 0) {
                console.log('느린 리소스 (1초 이상):');
                slowResources.forEach(r => {
                    console.log(`- ${r.name}: ${r.duration.toFixed(2)}ms`);
                });
            }
        }
        
        console.groupEnd();
    }
    
    /**
     * 시간 경과 계산
     * @param {string} timestamp ISO 타임스탬프
     * @returns {string} 시간 경과 문자열
     */
    getTimeAgo(timestamp) {
        const now = new Date();
        const errorTime = new Date(timestamp);
        const diffMs = now - errorTime;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        
        if (diffSec < 60) return `${diffSec}초 전`;
        if (diffMin < 60) return `${diffMin}분 전`;
        if (diffHour < 24) return `${diffHour}시간 전`;
        return `${Math.floor(diffHour / 24)}일 전`;
    }
    
    /**
     * 연속 에러 패턴 찾기
     * @param {Array} logs 에러 로그 배열
     * @returns {Array} 연속 에러 패턴 배열
     */
    findConsecutiveErrors(logs) {
        const patterns = [];
        let currentPattern = null;
        
        logs.forEach((error, index) => {
            if (index === 0) {
                currentPattern = { type: error.type, count: 1, startTime: error.timestamp };
                return;
            }
            
            const prevError = logs[index - 1];
            const timeDiff = new Date(error.timestamp) - new Date(prevError.timestamp);
            
            if (error.type === currentPattern.type && timeDiff < 60000) { // 1분 이내
                currentPattern.count++;
            } else {
                if (currentPattern.count >= 3) {
                    currentPattern.timeSpan = (new Date(prevError.timestamp) - new Date(currentPattern.startTime)) / 1000;
                    patterns.push({ ...currentPattern });
                }
                currentPattern = { type: error.type, count: 1, startTime: error.timestamp };
            }
        });
        
        return patterns;
    }
    
    /**
     * 에러 메시지 키워드 분석
     * @param {Array} logs 에러 로그 배열
     * @returns {Object} 키워드 빈도 객체
     */
    analyzeErrorKeywords(logs) {
        const keywords = {};
        const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        
        logs.forEach(error => {
            const words = error.message.toLowerCase().split(/\s+/);
            words.forEach(word => {
                const cleanWord = word.replace(/[^\w]/g, '');
                if (cleanWord.length > 2 && !stopWords.includes(cleanWord)) {
                    keywords[cleanWord] = (keywords[cleanWord] || 0) + 1;
                }
            });
        });
        
        // 빈도순 정렬
        return Object.fromEntries(
            Object.entries(keywords)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
        );
    }
}

// 전역 에러 디버거 인스턴스 생성
window.errorDebugger = new ErrorDebugger();

export default ErrorDebugger;