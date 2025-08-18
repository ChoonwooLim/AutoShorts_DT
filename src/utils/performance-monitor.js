/**
 * PerformanceMonitor - 성능 모니터링 시스템
 * 로딩 시간, 메모리 사용량, 번들 크기 등을 실시간으로 추적합니다.
 */
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            loadTimes: new Map(),
            bundleSizes: new Map(),
            memoryUsage: [],
            networkRequests: [],
            renderTimes: []
        };
        
        this.observers = {
            performance: null,
            navigation: null,
            resource: null
        };
        
        this.isMonitoring = false;
        this.startTime = performance.now();
    }

    /**
     * 모니터링 시작
     */
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        console.log('📊 성능 모니터링 시작');
        
        this.setupPerformanceObserver();
        this.setupNavigationObserver();
        this.setupResourceObserver();
        this.startMemoryMonitoring();
        this.trackInitialMetrics();
    }

    /**
     * Performance Observer 설정
     */
    setupPerformanceObserver() {
        if (!window.PerformanceObserver) return;

        try {
            this.observers.performance = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.processPerformanceEntry(entry);
                }
            });

            this.observers.performance.observe({ 
                entryTypes: ['measure', 'navigation', 'resource', 'paint'] 
            });
        } catch (error) {
            console.warn('Performance Observer 설정 실패:', error);
        }
    }

    /**
     * Navigation Observer 설정
     */
    setupNavigationObserver() {
        if (!window.PerformanceObserver) return;

        try {
            this.observers.navigation = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.trackNavigationTiming(entry);
                }
            });

            this.observers.navigation.observe({ entryTypes: ['navigation'] });
        } catch (error) {
            console.warn('Navigation Observer 설정 실패:', error);
        }
    }

    /**
     * Resource Observer 설정
     */
    setupResourceObserver() {
        if (!window.PerformanceObserver) return;

        try {
            this.observers.resource = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.trackResourceTiming(entry);
                }
            });

            this.observers.resource.observe({ entryTypes: ['resource'] });
        } catch (error) {
            console.warn('Resource Observer 설정 실패:', error);
        }
    }

    /**
     * Performance Entry 처리
     */
    processPerformanceEntry(entry) {
        switch (entry.entryType) {
            case 'measure':
                this.metrics.loadTimes.set(entry.name, entry.duration);
                break;
            case 'paint':
                this.trackPaintTiming(entry);
                break;
        }
    }

    /**
     * Navigation Timing 추적
     */
    trackNavigationTiming(entry) {
        const metrics = {
            domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
            loadComplete: entry.loadEventEnd - entry.loadEventStart,
            domInteractive: entry.domInteractive - entry.fetchStart,
            firstByte: entry.responseStart - entry.requestStart,
            dnsLookup: entry.domainLookupEnd - entry.domainLookupStart,
            tcpConnect: entry.connectEnd - entry.connectStart
        };

        console.log('🚀 Navigation Timing:', metrics);
        this.metrics.loadTimes.set('navigation', metrics);
    }

    /**
     * Resource Timing 추적
     */
    trackResourceTiming(entry) {
        const resource = {
            name: entry.name,
            type: this.getResourceType(entry.name),
            size: entry.transferSize || entry.encodedBodySize || 0,
            duration: entry.duration,
            startTime: entry.startTime
        };

        this.metrics.networkRequests.push(resource);
        
        // 번들 크기 추적
        if (resource.type === 'script' || resource.type === 'module') {
            this.metrics.bundleSizes.set(resource.name, resource.size);
        }
    }

    /**
     * Paint Timing 추적
     */
    trackPaintTiming(entry) {
        this.metrics.renderTimes.push({
            name: entry.name,
            startTime: entry.startTime
        });

        if (entry.name === 'first-contentful-paint') {
            console.log(`🎨 First Contentful Paint: ${entry.startTime.toFixed(2)}ms`);
        }
    }

    /**
     * 메모리 모니터링 시작
     */
    startMemoryMonitoring() {
        const trackMemory = () => {
            if (performance.memory) {
                const memory = {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit,
                    timestamp: performance.now()
                };
                
                this.metrics.memoryUsage.push(memory);
                
                // 최근 100개 기록만 유지
                if (this.metrics.memoryUsage.length > 100) {
                    this.metrics.memoryUsage.shift();
                }
            }
        };

        // 5초마다 메모리 사용량 기록
        setInterval(trackMemory, 5000);
        trackMemory(); // 즉시 한 번 실행
    }

    /**
     * 초기 메트릭 추적
     */
    trackInitialMetrics() {
        // 페이지 로드 시간
        if (performance.timing) {
            const timing = performance.timing;
            const loadTime = timing.loadEventEnd - timing.navigationStart;
            
            console.log(`📈 페이지 로드 시간: ${loadTime}ms`);
            this.metrics.loadTimes.set('pageLoad', loadTime);
        }
    }

    /**
     * 모듈 로딩 시간 측정 시작
     */
    startModuleTimer(moduleName) {
        performance.mark(`module-${moduleName}-start`);
    }

    /**
     * 모듈 로딩 시간 측정 종료
     */
    endModuleTimer(moduleName) {
        performance.mark(`module-${moduleName}-end`);
        performance.measure(
            `module-${moduleName}`,
            `module-${moduleName}-start`,
            `module-${moduleName}-end`
        );
    }

    /**
     * 리소스 타입 판별
     */
    getResourceType(url) {
        if (url.includes('.js') || url.includes('.mjs')) return 'script';
        if (url.includes('.css')) return 'stylesheet';
        if (url.includes('.wasm')) return 'wasm';
        if (url.includes('.json')) return 'json';
        if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
        if (url.match(/\.(mp4|webm|ogg|avi|mov)$/)) return 'video';
        if (url.match(/\.(mp3|wav|ogg|aac|flac)$/)) return 'audio';
        return 'other';
    }

    /**
     * 성능 리포트 생성
     */
    generateReport() {
        const report = {
            summary: this.getSummary(),
            loadTimes: Object.fromEntries(this.metrics.loadTimes),
            bundleSizes: this.getBundleSizeReport(),
            memoryUsage: this.getMemoryReport(),
            networkRequests: this.getNetworkReport(),
            recommendations: this.getRecommendations()
        };

        console.group('📊 성능 리포트');
        console.log('📈 요약:', report.summary);
        console.log('⏱️ 로딩 시간:', report.loadTimes);
        console.log('📦 번들 크기:', report.bundleSizes);
        console.log('🧠 메모리 사용량:', report.memoryUsage);
        console.log('🌐 네트워크 요청:', report.networkRequests);
        console.log('💡 최적화 권장사항:', report.recommendations);
        console.groupEnd();

        return report;
    }

    /**
     * 요약 정보 생성
     */
    getSummary() {
        const totalBundleSize = Array.from(this.metrics.bundleSizes.values())
            .reduce((sum, size) => sum + size, 0);
        
        const currentMemory = this.metrics.memoryUsage.length > 0 
            ? this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1]
            : null;

        return {
            totalBundleSize: this.formatBytes(totalBundleSize),
            currentMemoryUsage: currentMemory ? this.formatBytes(currentMemory.used) : 'N/A',
            totalRequests: this.metrics.networkRequests.length,
            monitoringDuration: `${((performance.now() - this.startTime) / 1000).toFixed(1)}초`
        };
    }

    /**
     * 번들 크기 리포트
     */
    getBundleSizeReport() {
        const sizes = Array.from(this.metrics.bundleSizes.entries())
            .map(([name, size]) => ({
                name: name.split('/').pop(),
                size: this.formatBytes(size),
                sizeBytes: size
            }))
            .sort((a, b) => b.sizeBytes - a.sizeBytes);

        return sizes;
    }

    /**
     * 메모리 리포트
     */
    getMemoryReport() {
        if (this.metrics.memoryUsage.length === 0) return null;

        const latest = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
        const peak = this.metrics.memoryUsage.reduce((max, current) => 
            current.used > max.used ? current : max
        );

        return {
            current: this.formatBytes(latest.used),
            peak: this.formatBytes(peak.used),
            limit: this.formatBytes(latest.limit),
            utilization: `${((latest.used / latest.limit) * 100).toFixed(1)}%`
        };
    }

    /**
     * 네트워크 리포트
     */
    getNetworkReport() {
        const byType = {};
        let totalSize = 0;

        this.metrics.networkRequests.forEach(request => {
            if (!byType[request.type]) {
                byType[request.type] = { count: 0, size: 0 };
            }
            byType[request.type].count++;
            byType[request.type].size += request.size;
            totalSize += request.size;
        });

        return {
            totalSize: this.formatBytes(totalSize),
            byType: Object.entries(byType).map(([type, data]) => ({
                type,
                count: data.count,
                size: this.formatBytes(data.size)
            }))
        };
    }

    /**
     * 최적화 권장사항
     */
    getRecommendations() {
        const recommendations = [];
        
        // 번들 크기 체크
        const totalBundleSize = Array.from(this.metrics.bundleSizes.values())
            .reduce((sum, size) => sum + size, 0);
        
        if (totalBundleSize > 1024 * 1024) { // 1MB
            recommendations.push('📦 번들 크기가 큽니다. 코드 스플리팅을 고려해보세요.');
        }

        // 메모리 사용량 체크
        if (this.metrics.memoryUsage.length > 0) {
            const latest = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
            const utilization = (latest.used / latest.limit) * 100;
            
            if (utilization > 80) {
                recommendations.push('🧠 메모리 사용량이 높습니다. 메모리 정리를 고려해보세요.');
            }
        }

        // 네트워크 요청 체크
        if (this.metrics.networkRequests.length > 50) {
            recommendations.push('🌐 네트워크 요청이 많습니다. 리소스 번들링을 고려해보세요.');
        }

        // 로딩 시간 체크
        const pageLoadTime = this.metrics.loadTimes.get('pageLoad');
        if (pageLoadTime && pageLoadTime > 3000) {
            recommendations.push('⏱️ 페이지 로딩이 느립니다. 지연 로딩을 활용해보세요.');
        }

        return recommendations.length > 0 ? recommendations : ['✅ 성능이 양호합니다!'];
    }

    /**
     * 바이트를 읽기 쉬운 형태로 변환
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 모니터링 중지
     */
    stopMonitoring() {
        if (!this.isMonitoring) return;
        
        this.isMonitoring = false;
        
        // Observer들 정리
        Object.values(this.observers).forEach(observer => {
            if (observer) {
                observer.disconnect();
            }
        });
        
        console.log('📊 성능 모니터링 중지');
    }

    /**
     * 메트릭 초기화
     */
    reset() {
        this.metrics = {
            loadTimes: new Map(),
            bundleSizes: new Map(),
            memoryUsage: [],
            networkRequests: [],
            renderTimes: []
        };
        
        this.startTime = performance.now();
        console.log('📊 성능 메트릭 초기화');
    }
}

// 싱글톤 인스턴스 생성
const performanceMonitor = new PerformanceMonitor();

// 전역 접근을 위한 노출
window.performanceMonitor = performanceMonitor;

// 개발자 도구용 명령어
window.perfReport = () => performanceMonitor.generateReport();

export default performanceMonitor;
