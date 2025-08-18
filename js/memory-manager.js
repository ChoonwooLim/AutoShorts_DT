// js/memory-manager.js
const MEMORY_LIMIT_KEY = 'memoryLimitMB';
let memoryLimitMB = parseInt(localStorage.getItem(MEMORY_LIMIT_KEY) || '4096', 10);
let monitoringInterval;

export function checkMemoryUsage() {
    // ...
}

export function startMemoryMonitoring(interval = 5000) {
    // ...
}

export function stopMemoryMonitoring() {
    // ...
}

export function setMemoryLimit(limitMB) {
    memoryLimitMB = parseInt(limitMB, 10);
    localStorage.setItem(MEMORY_LIMIT_KEY, memoryLimitMB);
    console.log(`🧠 새로운 메모리 한계 설정: ${memoryLimitMB} MB`);
    checkMemoryUsage();
}

export function getMemoryLimit() {
    return memoryLimitMB;
}

export function clearAllCache() {
    try {
        const confirmed = confirm('정말로 모든 캐시와 저장된 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.');
        if (confirmed) {
            localStorage.clear();
            sessionStorage.clear();
            console.log('🧹 모든 로컬 캐시와 데이터가 삭제되었습니다.');
            alert('모든 캐시가 성공적으로 삭제되었습니다. 페이지를 새로고침합니다.');
            window.location.reload();
        }
    } catch (error) {
        console.error('❌ 캐시 삭제 중 오류 발생:', error);
        alert('캐시를 삭제하는 데 실패했습니다.');
    }
} 