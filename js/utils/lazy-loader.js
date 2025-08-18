/**
 * LazyLoader - 지연 로딩 시스템
 * 필요한 모듈만 동적으로 로드하여 초기 로딩 시간을 단축합니다.
 */
class LazyLoader {
    constructor() {
        this.loadedModules = new Map();
        this.loadingPromises = new Map();
        this.preloadQueue = [];
        this.isPreloading = false;
    }

    /**
     * 모듈을 지연 로드합니다
     * @param {string} moduleName - 모듈 이름
     * @param {Function} importFunction - import() 함수
     * @returns {Promise} 로드된 모듈
     */
    async loadModule(moduleName, importFunction) {
        // 이미 로드된 모듈 반환
        if (this.loadedModules.has(moduleName)) {
            return this.loadedModules.get(moduleName);
        }

        // 로딩 중인 모듈의 Promise 반환
        if (this.loadingPromises.has(moduleName)) {
            return this.loadingPromises.get(moduleName);
        }

        // 새로운 모듈 로드 시작
        const loadingPromise = this._loadModuleInternal(moduleName, importFunction);
        this.loadingPromises.set(moduleName, loadingPromise);

        try {
            const module = await loadingPromise;
            this.loadedModules.set(moduleName, module);
            this.loadingPromises.delete(moduleName);
            return module;
        } catch (error) {
            this.loadingPromises.delete(moduleName);
            throw error;
        }
    }

    /**
     * 내부 모듈 로딩 로직
     */
    async _loadModuleInternal(moduleName, importFunction) {
        const startTime = performance.now();
        
        try {
            console.log(`🔄 모듈 로딩 시작: ${moduleName}`);
            const module = await importFunction();
            
            const loadTime = performance.now() - startTime;
            console.log(`✅ 모듈 로딩 완료: ${moduleName} (${loadTime.toFixed(2)}ms)`);
            
            return module;
        } catch (error) {
            console.error(`❌ 모듈 로딩 실패: ${moduleName}`, error);
            throw error;
        }
    }

    /**
     * FFmpeg 모듈 로드
     */
    async loadFFmpeg() {
        return this.loadModule('ffmpeg', () => import('@ffmpeg/ffmpeg'));
    }

    /**
     * Face-API 모듈 로드
     */
    async loadFaceAPI() {
        return this.loadModule('face-api', () => import('face-api.js'));
    }

    /**
     * 자막 추출 유틸리티 로드
     */
    async loadTranscriptionUtils() {
        return this.loadModule('transcription-utils', () => import('./transcription-utils.js'));
    }

    /**
     * 오디오 유틸리티 로드
     */
    async loadAudioUtils() {
        return this.loadModule('audio-utils', () => import('./audio-utils.js'));
    }

    /**
     * 에러 핸들러 로드
     */
    async loadErrorHandler() {
        return this.loadModule('error-handler', () => import('./error-handler.js'));
    }

    /**
     * UI 유틸리티 로드
     */
    async loadUIUtils() {
        return this.loadModule('ui-utils', () => import('./ui-utils.js'));
    }

    /**
     * 모듈을 프리로드 큐에 추가
     */
    addToPreloadQueue(moduleName, importFunction) {
        this.preloadQueue.push({ moduleName, importFunction });
    }

    /**
     * 백그라운드에서 모듈들을 프리로드
     */
    async startPreloading() {
        if (this.isPreloading || this.preloadQueue.length === 0) {
            return;
        }

        this.isPreloading = true;
        console.log(`🚀 백그라운드 프리로딩 시작 (${this.preloadQueue.length}개 모듈)`);

        // 우선순위가 낮은 모듈들을 천천히 로드
        for (const { moduleName, importFunction } of this.preloadQueue) {
            try {
                // 메인 스레드를 블록하지 않도록 지연
                await new Promise(resolve => setTimeout(resolve, 100));
                await this.loadModule(moduleName, importFunction);
            } catch (error) {
                console.warn(`⚠️ 프리로드 실패: ${moduleName}`, error);
            }
        }

        this.preloadQueue = [];
        this.isPreloading = false;
        console.log('✅ 백그라운드 프리로딩 완료');
    }

    /**
     * 중요한 모듈들을 우선 로드
     */
    async preloadCriticalModules() {
        const criticalModules = [
            { name: 'ui-utils', loader: () => this.loadUIUtils() },
            { name: 'error-handler', loader: () => this.loadErrorHandler() }
        ];

        console.log('🎯 중요 모듈 우선 로딩 시작');
        
        const loadPromises = criticalModules.map(async ({ name, loader }) => {
            try {
                await loader();
                console.log(`✅ 중요 모듈 로딩 완료: ${name}`);
            } catch (error) {
                console.error(`❌ 중요 모듈 로딩 실패: ${name}`, error);
            }
        });

        await Promise.all(loadPromises);
        console.log('🎯 중요 모듈 우선 로딩 완료');
    }

    /**
     * 메모리 정리
     */
    cleanup() {
        console.log('🧹 LazyLoader 메모리 정리');
        this.loadedModules.clear();
        this.loadingPromises.clear();
        this.preloadQueue = [];
        this.isPreloading = false;
    }

    /**
     * 로딩 상태 정보
     */
    getStatus() {
        return {
            loadedModules: Array.from(this.loadedModules.keys()),
            loadingModules: Array.from(this.loadingPromises.keys()),
            preloadQueue: this.preloadQueue.map(item => item.moduleName),
            isPreloading: this.isPreloading
        };
    }
}

// 싱글톤 인스턴스 생성
const lazyLoader = new LazyLoader();

// 전역 접근을 위한 노출
window.lazyLoader = lazyLoader;

export default lazyLoader; 