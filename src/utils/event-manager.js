/**
 * 이벤트 리스너 관리 유틸리티
 * 메모리 누수 방지 및 중복 등록 방지
 */
class EventManager {
    constructor() {
        this.listeners = new Map();
        this.abortController = new AbortController();
    }

    /**
     * 이벤트 리스너 등록 (중복 방지)
     * @param {Element|Window|Document} element 
     * @param {string} event 
     * @param {Function} handler 
     * @param {Object} options 
     */
    addEventListener(element, event, handler, options = {}) {
        const key = this.getListenerKey(element, event, handler);
        
        // 중복 등록 방지
        if (this.listeners.has(key)) {
            console.warn(`⚠️ 중복 이벤트 리스너 등록 시도: ${event}`);
            return;
        }

        // AbortController를 사용한 자동 정리 지원
        const listenerOptions = {
            ...options,
            signal: this.abortController.signal
        };

        element.addEventListener(event, handler, listenerOptions);
        
        // 등록된 리스너 추적
        this.listeners.set(key, {
            element,
            event,
            handler,
            options: listenerOptions
        });

        console.log(`✅ 이벤트 리스너 등록: ${event}`);
    }

    /**
     * 특정 이벤트 리스너 제거
     * @param {Element|Window|Document} element 
     * @param {string} event 
     * @param {Function} handler 
     */
    removeEventListener(element, event, handler) {
        const key = this.getListenerKey(element, event, handler);
        const listener = this.listeners.get(key);
        
        if (listener) {
            element.removeEventListener(event, handler, listener.options);
            this.listeners.delete(key);
            console.log(`🗑️ 이벤트 리스너 제거: ${event}`);
        }
    }

    /**
     * 모든 이벤트 리스너 제거 (메모리 정리)
     */
    removeAllListeners() {
        this.abortController.abort();
        this.listeners.clear();
        this.abortController = new AbortController();
        console.log('🧹 모든 이벤트 리스너 정리 완료');
    }

    /**
     * 리스너 고유 키 생성
     * @param {Element|Window|Document} element 
     * @param {string} event 
     * @param {Function} handler 
     * @returns {string}
     */
    getListenerKey(element, event, handler) {
        const elementId = element.id || element.tagName || 'unknown';
        const handlerName = handler.name || 'anonymous';
        return `${elementId}-${event}-${handlerName}`;
    }

    /**
     * 등록된 리스너 수 반환
     * @returns {number}
     */
    getListenerCount() {
        return this.listeners.size;
    }

    /**
     * 등록된 리스너 목록 반환 (디버깅용)
     * @returns {Array}
     */
    getListenerList() {
        return Array.from(this.listeners.keys());
    }
}

// 전역 이벤트 매니저 인스턴스
const eventManager = new EventManager();

// 페이지 언로드 시 자동 정리
window.addEventListener('beforeunload', () => {
    eventManager.removeAllListeners();
});

export default eventManager;
