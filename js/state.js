// js/state.js
// This file acts as a single source of truth for the application's state.

export const state = {
    /** @type {File | null} */
    uploadedFile: null,

    /** @type {Uint8Array | null} */
    uploadedFileData: null,

    /** @type {Array<object>} */
    subtitles: [],

    /** @type {Array<object>} */
    faceResults: [],
    
    /** @type {Array<object>} AI 생성 숏츠 정보 */
    aiGeneratedShorts: [],
    
    /**
     * @typedef {object} Actor
     * @property {string} id
     * @property {string} label
     * @property {string} image
     * @property {string} gender
     * @property {number} avgAge
     * @property {object} emotionSummary
     * @property {number} totalAppearances
     * @property {number[]} appearances
     * @property {object[]} detections
     */

    /**
     * @typedef {object} FaceAnalysisV2State
     * @property {'idle' | 'analyzing' | 'completed' | 'error'} status - 분석 상태
     * @property {string | null} error - 오류 메시지
     * @property {number} progress - 분석 진행률 (0-100)
     * @property {string} progressText - 진행 상태 텍스트
     * @property {Actor[]} actors - 분석된 인물 목록
     */

    /** @type {FaceAnalysisV2State} */
    v2FaceAnalysis: {
        status: 'idle',
        error: null,
        progress: 0,
        progressText: '',
        actors: [],
    },

    /** @type {Array<object>} */
    chats: [],

    /** @type {string | null} */
    currentChatId: null,
    
    /** @type {object} */
    processing: {
        isActive: false,
        currentStep: null,
        progress: 0,
        totalSteps: 0,
        results: []
    },

    /** @type {Array<object>} 작업 로그 */
    workLogs: [],

    /** @type {string} 현재 작업 날짜 */
    currentWorkDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD 형식
    // --- 저장 관리 상태 ---
    outputFolderHandle: null,
    storageSettings: {
        autoSave: false,
        fileNaming: 'timestamp',
        customName: 'MyShorts'
    }
    // --- ---
};

// 작업 로그 관리 함수들
export const workLogManager = {
    // 새 작업 로그 추가
    addWorkLog(type, description, details = {}) {
        const log = {
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('ko-KR'),
            timestamp: new Date().toISOString(),
            type: type, // 'upload', 'transcription', 'processing', 'chat', 'settings'
            description: description,
            details: details
        };
        
        state.workLogs.push(log);
        
        // 로그가 100개를 넘으면 오래된 것부터 삭제
        if (state.workLogs.length > 100) {
            state.workLogs.shift();
        }
        
        // 로컬 스토리지에 저장
        this.saveWorkLogs();
        
        console.log(`📝 작업 로그 추가: ${type} - ${description}`);
        return log;
    },

    // 날짜별 작업 로그 조회
    getWorkLogsByDate(date) {
        return state.workLogs.filter(log => log.date === date);
    },

    // 모든 작업 날짜 조회
    getAllWorkDates() {
        const dates = [...new Set(state.workLogs.map(log => log.date))];
        return dates.sort().reverse(); // 최신 순으로 정렬
    },

    // 오늘 작업 로그 조회
    getTodayWorkLogs() {
        const today = new Date().toISOString().split('T')[0];
        return this.getWorkLogsByDate(today);
    },

    // 작업 로그 저장
    saveWorkLogs() {
        try {
            localStorage.setItem('autoShorts_workLogs', JSON.stringify(state.workLogs));
        } catch (error) {
            console.error('❌ 작업 로그 저장 실패:', error);
        }
    },

    // 작업 로그 불러오기
    loadWorkLogs() {
        try {
            const saved = localStorage.getItem('autoShorts_workLogs');
            if (saved) {
                state.workLogs = JSON.parse(saved);
                console.log(`📚 작업 로그 로드됨: ${state.workLogs.length}개`);
            }
        } catch (error) {
            console.error('❌ 작업 로그 로드 실패:', error);
            state.workLogs = [];
        }
    },

    // 작업 로그 통계
    getWorkLogStats() {
        const stats = {
            total: state.workLogs.length,
            today: this.getTodayWorkLogs().length,
            dates: this.getAllWorkDates().length,
            byType: {}
        };

        // 타입별 통계
        state.workLogs.forEach(log => {
            stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
        });

        return stats;
    }
}; 