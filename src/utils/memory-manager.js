/**
 * 메모리 관리 유틸리티
 * 메모리 사용량 모니터링 및 자동 정리
 */
class MemoryManager {
    constructor() {
        this.allocatedObjects = new WeakSet();
        this.cleanupTasks = [];
        this.memoryThreshold = 100 * 1024 * 1024; // 100MB
        this.monitoringInterval = null;
        this.isMonitoring = false;
    }

    /**
     * 메모리 모니터링 시작
     */
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.checkMemoryUsage();
        }, 30000); // 30초마다 체크

        console.log('🔍 메모리 모니터링 시작');
    }

    /**
     * 메모리 모니터링 중지
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        console.log('⏹️ 메모리 모니터링 중지');
    }

    /**
     * 메모리 사용량 확인
     */
    async checkMemoryUsage() {
        if (!performance.memory) {
            console.warn('⚠️ 메모리 정보를 사용할 수 없습니다');
            return;
        }

        const memory = performance.memory;
        const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
        const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
        const usagePercentage = (usedMB / limitMB) * 100;

        console.log(`📊 메모리 사용량: ${usedMB}MB / ${totalMB}MB (한계: ${limitMB}MB, ${usagePercentage.toFixed(1)}%)`);

        // 더 엄격한 메모리 관리
        if (usagePercentage > 85) {
            console.error(`🚨 메모리 사용량 위험: ${usedMB}MB (${usagePercentage.toFixed(1)}%)`);
            await this.emergencyCleanup();
        } else if (usagePercentage > 70) {
            console.warn(`⚠️ 메모리 사용량 주의: ${usedMB}MB (${usagePercentage.toFixed(1)}%)`);
            await this.forceCleanup();
        } else if (memory.usedJSHeapSize > this.memoryThreshold) {
            console.warn(`⚠️ 메모리 사용량 초과: ${usedMB}MB > ${Math.round(this.memoryThreshold / 1024 / 1024)}MB`);
            await this.forceCleanup();
        }

        return { usedMB, totalMB, limitMB, usagePercentage };
    }

    /**
     * 정리 작업 등록
     * @param {Function} cleanupFn 정리 함수
     * @param {string} description 설명
     */
    registerCleanupTask(cleanupFn, description = 'Unknown task') {
        this.cleanupTasks.push({ fn: cleanupFn, description });
        console.log(`📝 정리 작업 등록: ${description}`);
    }

    /**
     * 강제 메모리 정리
     */
    async forceCleanup() {
        console.log('🧹 강제 메모리 정리 시작...');
        
        let cleanedTasks = 0;
        for (const task of this.cleanupTasks) {
            try {
                await task.fn();
                cleanedTasks++;
                console.log(`✅ 정리 완료: ${task.description}`);
            } catch (error) {
                console.error(`❌ 정리 실패: ${task.description}`, error);
            }
        }

        // 전역 오디오 컨텍스트 정리
        if (window.currentAudioContext) {
            await this.cleanupAudioContext(window.currentAudioContext);
            window.currentAudioContext = null;
        }

        // FFmpeg 워커 정리
        if (window.currentFFmpegWorker) {
            this.cleanupWorker(window.currentFFmpegWorker);
            window.currentFFmpegWorker = null;
        }

        // 가비지 컬렉션 강제 실행 (가능한 경우)
        if (window.gc) {
            window.gc();
            console.log('🗑️ 가비지 컬렉션 실행');
        }

        console.log(`🧹 메모리 정리 완료: ${cleanedTasks}개 작업 처리`);
    }

    /**
     * 응급 메모리 정리 (더 강력한 정리)
     */
    async emergencyCleanup() {
        console.error('🚨 응급 메모리 정리 시작...');
        
        // 기본 정리 실행
        await this.forceCleanup();
        
        // 추가 응급 조치
        try {
            // 모든 Blob URL 정리
            const blobUrls = Array.from(document.querySelectorAll('[src^="blob:"]'));
            blobUrls.forEach(element => {
                if (element.src) {
                    URL.revokeObjectURL(element.src);
                    element.src = '';
                }
            });
            
            // 캐시된 이미지 정리
            const images = document.querySelectorAll('img');
            images.forEach(img => {
                if (img.src && img.src.startsWith('data:')) {
                    img.src = '';
                }
            });
            
            // 비디오 요소 정리
            const videos = document.querySelectorAll('video');
            videos.forEach(video => {
                video.pause();
                video.src = '';
                video.load();
            });
            
            console.log('🚨 응급 정리 완료: DOM 요소 및 미디어 정리');
            
        } catch (error) {
            console.error('❌ 응급 정리 중 오류:', error);
        }
    }

    /**
     * Blob URL 자동 정리
     * @param {string} blobUrl 
     */
    createManagedBlobUrl(blob) {
        const url = URL.createObjectURL(blob);
        
        // 10분 후 자동 정리
        setTimeout(() => {
            URL.revokeObjectURL(url);
            console.log(`🗑️ Blob URL 자동 정리: ${url.substring(0, 50)}...`);
        }, 10 * 60 * 1000);

        return url;
    }

    /**
     * 오디오 컨텍스트 정리
     * @param {AudioContext} audioContext 
     */
    async cleanupAudioContext(audioContext) {
        if (audioContext && audioContext.state !== 'closed') {
            await audioContext.close();
            console.log('🎵 AudioContext 정리 완료');
        }
    }

    /**
     * Web Worker 정리
     * @param {Worker} worker 
     */
    cleanupWorker(worker) {
        if (worker) {
            worker.terminate();
            console.log('👷 Web Worker 정리 완료');
        }
    }

    /**
     * 대용량 배열 정리
     * @param {Array} array 
     */
    cleanupLargeArray(array) {
        if (Array.isArray(array) && array.length > 1000) {
            array.length = 0;
            console.log('📦 대용량 배열 정리 완료');
        }
    }

    setMemoryLimit(newLimitMB) {
        this.memoryThreshold = newLimitMB * 1024 * 1024;
        console.log(`🧠 메모리 한계 설정: ${newLimitMB}MB`);
    }

    getMemoryLimit() {
        return Math.round(this.memoryThreshold / 1024 / 1024);
    }

    clearAllCache() {
        console.warn('🗑️ 모든 캐시 및 임시 데이터 삭제 요청...');
        return this.forceCleanup();
    }

    /**
     * 메모리 정보 조회 (에러 디버깅용)
     */
    getMemoryInfo() {
        if (!performance.memory) {
            return null;
        }

        return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
    }

    /**
     * 메모리 사용량 보고서 생성
     */
    generateMemoryReport() {
        if (!performance.memory) {
            return '메모리 정보를 사용할 수 없습니다';
        }

        const memory = performance.memory;
        const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
        const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
        const usagePercentage = (usedMB / limitMB) * 100;
        
        const report = {
            used: usedMB,
            total: totalMB,
            limit: limitMB,
            percentage: usagePercentage.toFixed(1) + '%',
            cleanupTasks: this.cleanupTasks.length,
            isMonitoring: this.isMonitoring,
            status: usagePercentage > 85 ? '🚨 위험' : usagePercentage > 70 ? '⚠️ 주의' : '✅ 정상'
        };

        console.table(report);
        return report;
    }
}

// 전역 메모리 매니저 인스턴스
const memoryManager = new MemoryManager();

// 전역으로 노출 (에러 디버깅용)
window.memoryManager = memoryManager;

// 페이지 로드 시 모니터링 시작
document.addEventListener('DOMContentLoaded', () => {
    memoryManager.startMonitoring();
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    memoryManager.forceCleanup();
    memoryManager.stopMonitoring();
});

export default memoryManager;
