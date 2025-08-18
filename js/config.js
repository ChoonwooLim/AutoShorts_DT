// js/config.js

export const googleConfig = {
    _customClientId: null,
    
    // 사용자 정의 클라이언트 ID 저장소 키
    CUSTOM_CLIENT_ID_KEY: 'googleCustomClientId',

    // 기본 클라이언트 ID (개발용)
    defaultClientId: "YOUR_DEFAULT_GOOGLE_CLIENT_ID.apps.googleusercontent.com",

    // 현재 사용 중인 Client ID 가져오기
    getClientId() {
        if (this._customClientId === null) {
            this._customClientId = localStorage.getItem(this.CUSTOM_CLIENT_ID_KEY) || '';
        }
        return this._customClientId || this.defaultClientId;
    },
    
    // 사용자 정의 Client ID 설정
    setCustomClientId(id) {
        if (id && !id.endsWith('.apps.googleusercontent.com')) {
            console.error('❌ 잘못된 Google Client ID 형식');
            return false;
        }
        this._customClientId = id;
        localStorage.setItem(this.CUSTOM_CLIENT_ID_KEY, id);
        console.log(`✅ 사용자 정의 Google Client ID ${id ? '저장됨' : '제거됨'}`);
        return true;
    },

    // 현재 설정 정보 가져오기
    getCurrentIdInfo() {
        const customId = localStorage.getItem(this.CUSTOM_CLIENT_ID_KEY);
        return {
            clientId: customId || this.defaultClientId,
            isCustom: !!customId,
            source: customId ? '사용자 정의' : '기본값'
        };
    }
}; 