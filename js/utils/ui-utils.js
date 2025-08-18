/**
 * 🎨 UIUtils - UI 관련 유틸리티 클래스
 * 
 * 중복 코드 제거를 위한 UI 관련 공통 기능 모음
 * - 플레이스홀더 업데이트
 * - 진행률 표시
 * - 알림 메시지
 * - 로딩 상태 관리
 */

class UIUtils {
    constructor() {
        this.progressContainer = null;
        this.progressBar = null;
        this.progressText = null;
        this.progressDetails = null;
        this.subtitleDisplay = null;
        this.initializeElements();
    }

    /**
     * DOM 요소 초기화
     */
    initializeElements() {
        // 지연 초기화 - DOM이 로드된 후에 실행
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.findElements());
        } else {
            this.findElements();
        }
    }

    /**
     * DOM 요소 찾기 - 자막 추출 프로그레스바 전용
     */
    findElements() {
        try {
            // 자막 추출 프로그레스바 요소들 (실제 HTML ID 사용)
            this.progressContainer = document.getElementById('transcriptionProgress');
            this.progressBar = document.getElementById('transcriptionProgressFill');
            this.progressText = document.getElementById('transcriptionProgressText');
            this.progressDetails = document.getElementById('transcriptionProgressDetails');
            
            // 자막 표시 영역 (여러 후보 중 찾기)
            this.subtitleDisplay = document.getElementById('subtitleResultsContainer') || 
                                  document.getElementById('subtitleContainer') ||
                                  document.querySelector('.subtitle-placeholder');
            
            const result = {
                progressContainer: !!this.progressContainer,
                progressBar: !!this.progressBar,
                progressText: !!this.progressText,
                progressDetails: !!this.progressDetails,
                subtitleDisplay: !!this.subtitleDisplay
            };
            
            console.log('🔍 UIUtils DOM 요소 찾기 결과:', result);
            
            // 중요한 요소가 없으면 경고
            if (!this.progressContainer) {
                console.warn('⚠️ transcriptionProgress 요소를 찾을 수 없습니다');
            }
            if (!this.progressBar) {
                console.warn('⚠️ transcriptionProgressFill 요소를 찾을 수 없습니다');
            }
            if (!this.progressText) {
                console.warn('⚠️ transcriptionProgressText 요소를 찾을 수 없습니다');
            }
            
        } catch (error) {
            console.error('❌ findElements 에러:', error);
        }
    }

    /**
     * 플레이스홀더 텍스트 업데이트 (통합 함수)
     * @param {string} text 
     */
    updatePlaceholder(text) {
        try {
            if (!text || typeof text !== 'string') {
                console.warn('⚠️ updatePlaceholder: 유효하지 않은 텍스트:', text);
                return;
            }
            
            // 텍스트 길이 제한 (너무 긴 텍스트는 잘라내기)
            const safeText = text.length > 200 ? text.substring(0, 200) + '...' : text;
            
            if (!this.subtitleDisplay) {
                this.findElements();
            }
            
            // 자막 플레이스홀더 업데이트 (안전한 방식)
            const subtitlePlaceholder = document.querySelector('.subtitle-placeholder') || 
                                      document.querySelector('.subtitle-placeholder-results');
            
            if (subtitlePlaceholder) {
                try {
                    subtitlePlaceholder.innerHTML = `
                        <div class="placeholder-icon">🎙️</div>
                        <p>${safeText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                    `;
                    console.log(`📝 UI 플레이스홀더 업데이트 성공: ${safeText.substring(0, 50)}...`);
                } catch (htmlError) {
                    // HTML 삽입 실패 시 텍스트만 업데이트
                    subtitlePlaceholder.textContent = safeText;
                    console.warn('⚠️ HTML 업데이트 실패, 텍스트로 대체:', htmlError.message);
                }
            } else {
                console.warn('⚠️ 플레이스홀더 요소를 찾을 수 없습니다');
            }
            
            // 기존 호환성 유지 (안전한 방식)
            if (this.subtitleDisplay && this.subtitleDisplay.classList && this.subtitleDisplay.classList.contains('subtitle-container')) {
                try {
                    this.subtitleDisplay.innerHTML = `
                        <div class="placeholder-message">
                            <p>${safeText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                        </div>
                    `;
                } catch (htmlError) {
                    this.subtitleDisplay.textContent = safeText;
                    console.warn('⚠️ 호환성 HTML 업데이트 실패, 텍스트로 대체:', htmlError.message);
                }
            }
            
        } catch (error) {
            console.error('❌ updatePlaceholder 에러:', error);
            // 최후의 수단: 기본 메시지 표시
            try {
                const fallbackElement = document.querySelector('.subtitle-placeholder');
                if (fallbackElement) {
                    fallbackElement.textContent = '자막 처리 중...';
                }
            } catch (fallbackError) {
                console.error('❌ 폴백 플레이스홀더 업데이트도 실패:', fallbackError);
            }
        }
    }

    /**
     * 진행률 표시 (통합 함수)
     * @param {number} current 현재 진행도
     * @param {number} total 전체 작업량
     * @param {string} text 진행 상태 텍스트
     */
    updateProgress(current, total, text) {
        const percentage = Math.round((current / total) * 100);
        
        if (this.progressBar) {
            this.progressBar.style.width = `${percentage}%`;
            this.progressBar.setAttribute('aria-valuenow', percentage);
        }
        
        if (this.progressText) {
            this.progressText.textContent = `${text} (${percentage}%)`;
        }
        
        // 플레이스홀더도 함께 업데이트
        this.updatePlaceholder(`${text} (${current}/${total} - ${percentage}%)`);
        
        console.log(`📊 진행률: ${percentage}% - ${text}`);
    }

    /**
     * 진행률 바 표시
     * @param {number} progress 0-1 사이의 진행률
     * @param {string} text 표시할 텍스트
     */
    updateProgressBar(progress, text) {
        const percentage = Math.round(progress * 100);
        
        if (this.progressBar) {
            this.progressBar.style.width = `${percentage}%`;
            this.progressBar.setAttribute('aria-valuenow', percentage);
        }
        
        if (this.progressText) {
            this.progressText.textContent = text;
        }
        
        this.updatePlaceholder(`${text} (${percentage}%)`);
        
        console.log(`📊 진행률 바: ${percentage}% - ${text}`);
    }

    /**
     * 진행률 표시 (스마트 자동 숨김) - 자막 추출 전용
     * @param {number} percentage 
     * @param {string} message 
     * @param {boolean} isComplete 완료 여부
     * @param {string} detailText 상세 정보 (선택사항)
     */
    showProgress(percentage, message, isComplete = false, detailText = '') {
        try {
            // 입력 검증
            if (typeof percentage !== 'number' || !message || typeof message !== 'string') {
                console.warn('⚠️ showProgress: 유효하지 않은 파라미터:', { percentage, message });
                return;
            }
            
            if (!this.progressContainer || !this.progressBar || !this.progressText) {
                this.findElements();
            }

            // 프로그레스 컨테이너 표시
            if (this.progressContainer) {
                this.progressContainer.style.display = 'block';
            } else {
                console.warn('⚠️ 프로그레스 컨테이너를 찾을 수 없습니다');
            }

            // 진행률 바 업데이트
            if (this.progressBar) {
                const safePercentage = Math.min(100, Math.max(0, percentage));
                this.progressBar.style.width = `${safePercentage}%`;
            } else {
                console.warn('⚠️ 프로그레스 바를 찾을 수 없습니다');
            }

            // 텍스트 업데이트
            if (this.progressText) {
                this.progressText.textContent = message;
            } else {
                console.warn('⚠️ 프로그레스 텍스트를 찾을 수 없습니다');
            }

            // 상세 정보 업데이트
            if (this.progressDetails) {
                this.progressDetails.textContent = detailText || '';
            }

            // 플레이스홀더 업데이트
            this.updatePlaceholder(message);

            // 완료 시 자동 숨김 (100% 완료된 경우에만)
            if (isComplete && percentage === 100) {
                setTimeout(() => {
                    this.hideProgress();
                }, 3000); // 성공 시 3초 후 숨김
            }

            console.log(`📈 자막 추출 진행률 표시: ${percentage}% - ${message}${detailText ? ` (${detailText})` : ''}`);
            
        } catch (error) {
            console.error('❌ showProgress 에러:', error);
        }
    }

    /**
     * 진행률 숨김
     */
    hideProgress() {
        if (this.progressContainer) {
            this.progressContainer.style.display = 'none';
        }
        console.log('📉 자막 추출 진행률 숨김');
    }

    /**
     * 성공 메시지 표시
     * @param {string} message 
     */
    showSuccess(message) {
        this.updatePlaceholder(`✅ ${message}`);
        this.showProgress(100, message, true);
        console.log(`✅ 성공: ${message}`);
    }

    /**
     * 오류 메시지 표시
     * @param {string} message 
     * @param {string} details 상세 정보 (선택사항)
     */
    showError(message, details = '') {
        const fullMessage = details ? `❌ ${message}\n\n${details}` : `❌ ${message}`;
        this.updatePlaceholder(fullMessage);
        this.showProgress(0, message, true);
        console.error(`❌ 오류: ${message}`, details);
    }

    /**
     * 경고 메시지 표시
     * @param {string} message 
     */
    showWarning(message) {
        this.updatePlaceholder(`⚠️ ${message}`);
        console.warn(`⚠️ 경고: ${message}`);
    }

    /**
     * 정보 메시지 표시
     * @param {string} message 
     */
    showInfo(message) {
        this.updatePlaceholder(`ℹ️ ${message}`);
        console.info(`ℹ️ 정보: ${message}`);
    }

    /**
     * 로딩 상태 표시
     * @param {string} message 
     */
    showLoading(message) {
        this.updatePlaceholder(`🔄 ${message}`);
        console.log(`🔄 로딩: ${message}`);
    }

    /**
     * 자막 표시 영역 클리어
     */
    clearSubtitleDisplay() {
        if (this.subtitleDisplay) {
            this.subtitleDisplay.innerHTML = '';
        }
        console.log('🧹 자막 표시 영역 클리어');
    }

    /**
     * 자막 엔트리 추가 (타임스탬프 포함)
     * @param {string} text 자막 텍스트
     * @param {number} startTime 시작 시간 (초)
     * @param {number} endTime 종료 시간 (초)
     */
    addSubtitleEntry(text, startTime = null, endTime = null) {
        if (!this.subtitleDisplay) {
            this.findElements();
        }

        if (this.subtitleDisplay) {
            const entry = document.createElement('div');
            entry.className = 'subtitle-entry';
            
            if (startTime !== null && endTime !== null) {
                const timestamp = this.formatTimestamp(startTime, endTime);
                entry.innerHTML = `
                    <div class="subtitle-timestamp">${timestamp}</div>
                    <div class="subtitle-text">${text}</div>
                `;
            } else {
                entry.innerHTML = `<div class="subtitle-text">${text}</div>`;
            }
            
            this.subtitleDisplay.appendChild(entry);
            
            // 자동 스크롤
            this.subtitleDisplay.scrollTop = this.subtitleDisplay.scrollHeight;
        }
    }

    /**
     * 타임스탬프 포맷팅
     * @param {number} startTime 
     * @param {number} endTime 
     * @returns {string}
     */
    formatTimestamp(startTime, endTime) {
        const formatTime = (seconds) => {
            const minutes = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        };
        
        return `[${formatTime(startTime)}-${formatTime(endTime)}]`;
    }

    /**
     * 애니메이션 효과와 함께 메시지 표시
     * @param {string} message 
     * @param {string} type 메시지 타입 (success, error, warning, info)
     * @param {number} duration 표시 시간 (ms)
     */
    showAnimatedMessage(message, type = 'info', duration = 3000) {
        const messageElement = document.createElement('div');
        messageElement.className = `animated-message ${type}`;
        messageElement.textContent = message;
        
        // 스타일 적용
        messageElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        // 타입별 배경색
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        messageElement.style.backgroundColor = colors[type] || colors.info;
        
        document.body.appendChild(messageElement);
        
        // 애니메이션 시작
        setTimeout(() => {
            messageElement.style.transform = 'translateX(0)';
        }, 10);
        
        // 자동 제거
        setTimeout(() => {
            messageElement.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, 300);
        }, duration);
    }

    /**
     * 디버그 모드에서만 콘솔 출력
     * @param {string} message 
     * @param {any} data 
     */
    debugLog(message, data = null) {
        if (window.DEBUG_MODE || localStorage.getItem('debug') === 'true') {
            if (data) {
                console.log(`🐛 ${message}`, data);
            } else {
                console.log(`🐛 ${message}`);
            }
        }
    }
}

// 싱글톤 인스턴스 생성
const uiUtils = new UIUtils();

// ES6 모듈과 전역 스코프 모두 지원
if (typeof module !== 'undefined' && module.exports) {
    module.exports = uiUtils;
} else {
    window.uiUtils = uiUtils;
} 