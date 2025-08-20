// js/subtitle-ai-integration.js
// AI 어시스턴트와 자막 통합 모듈

import { callAI } from './api.js';
import * as DOM from './dom-elements.js';

/**
 * 자막 내용을 AI 어시스턴트로 전송
 * @param {Object} subtitleData - 자막 데이터 객체
 * @param {string} subtitleData.text - 전체 자막 텍스트
 * @param {Array} subtitleData.segments - 타임스탬프가 포함된 자막 세그먼트
 * @param {string} subtitleData.method - 자막 추출 방법 (whisper, assemblyai, google, import)
 * @param {string} subtitleData.fileName - 파일명 (import의 경우)
 */
export async function sendSubtitlesToAI(subtitleData) {
    try {
        console.log('🤖 자막을 AI 어시스턴트로 전송 중...');
        
        // 현재 선택된 AI 모델 확인
        const mainModelKey = DOM.mainModelSelect?.value || 'gemini';
        const subModel = DOM.subModelSelect?.value || 'Gemini 2.0 Flash';
        
        // 자막 데이터 포맷팅
        const formattedSubtitles = formatSubtitlesForAI(subtitleData);
        
        // 시스템 프롬프트 생성
        const systemPrompt = `당신은 비디오 자막 분석 전문가입니다. 
제공된 자막 내용을 완전히 이해하고 분석하여 다음 작업들을 수행할 수 있습니다:
- 자막 내용 요약 및 핵심 포인트 추출
- 흥미로운 구간 식별 및 하이라이트 추천
- 숏폼 비디오(쇼츠, 릴스) 제작을 위한 최적 구간 선택
- 자막 텍스트 개선 및 편집 제안
- 키워드 및 해시태그 추출

항상 한국어로 응답하고, 구체적이고 실용적인 제안을 제공하세요.`;

        // 사용자 메시지 생성
        const userMessage = `다음은 비디오 자막 내용입니다. 이 자막을 완전히 분석하고 이해해주세요:

${formattedSubtitles}

자막 메타데이터:
- 추출 방법: ${subtitleData.method}
- 총 세그먼트 수: ${subtitleData.segments?.length || 0}
- 총 길이: ${calculateTotalDuration(subtitleData.segments)}
${subtitleData.fileName ? `- 파일명: ${subtitleData.fileName}` : ''}

이제 이 자막 내용을 기반으로 다음을 수행할 준비가 되었습니다:
1. 숏폼 콘텐츠 제작을 위한 하이라이트 구간 추천
2. 자막 텍스트 개선 및 편집
3. 키워드 및 해시태그 추출
4. 콘텐츠 요약 및 분석

자막 내용을 완전히 파악했다면 "✅ 자막 내용을 완전히 이해했습니다" 라고 응답하고, 
주요 내용을 3-5줄로 요약해주세요.`;

        // AI에게 전송
        const response = await callAI(mainModelKey, subModel, systemPrompt, userMessage);
        
        console.log('✅ AI가 자막 내용을 파악했습니다:', response);
        
        // UI에 상태 표시
        showAINotification('AI가 자막 내용을 파악했습니다', 'success');
        
        // AI 응답을 UI에 표시 (채팅 인터페이스가 있다면)
        if (window.displayAIResponse) {
            window.displayAIResponse(response);
        }
        
        // 자막 컨텍스트를 전역 상태에 저장
        window.currentSubtitleContext = {
            data: subtitleData,
            aiAnalyzed: true,
            analyzedAt: new Date().toISOString(),
            model: `${mainModelKey}/${subModel}`
        };
        
        return response;
        
    } catch (error) {
        console.error('❌ AI 자막 분석 실패:', error);
        showAINotification('AI 자막 분석 실패: ' + error.message, 'error');
        throw error;
    }
}

/**
 * 자막 데이터를 AI가 이해하기 쉬운 형식으로 포맷팅
 */
function formatSubtitlesForAI(subtitleData) {
    let formatted = '';
    
    if (subtitleData.segments && subtitleData.segments.length > 0) {
        formatted = '=== 타임스탬프가 있는 자막 ===\n\n';
        
        subtitleData.segments.forEach((segment, index) => {
            const startTime = formatTime(segment.start);
            const endTime = formatTime(segment.end);
            const speaker = segment.speaker ? `[${segment.speaker}] ` : '';
            
            formatted += `${index + 1}. [${startTime} → ${endTime}] ${speaker}${segment.text}\n`;
        });
        
        formatted += '\n=== 전체 텍스트 ===\n';
        formatted += subtitleData.text || subtitleData.segments.map(s => s.text).join(' ');
        
    } else if (subtitleData.text) {
        formatted = '=== 자막 텍스트 ===\n\n';
        formatted += subtitleData.text;
    } else {
        formatted = '자막 내용이 비어있습니다.';
    }
    
    return formatted;
}

/**
 * 시간을 포맷팅 (초 -> MM:SS)
 */
function formatTime(seconds) {
    if (!seconds && seconds !== 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 총 재생 시간 계산
 */
function calculateTotalDuration(segments) {
    if (!segments || segments.length === 0) return '알 수 없음';
    
    const lastSegment = segments[segments.length - 1];
    const totalSeconds = lastSegment.end || 0;
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    if (hours > 0) {
        return `${hours}시간 ${minutes}분 ${seconds}초`;
    } else if (minutes > 0) {
        return `${minutes}분 ${seconds}초`;
    } else {
        return `${seconds}초`;
    }
}

/**
 * AI 알림 표시
 */
function showAINotification(message, type = 'info') {
    // 기존 알림 제거
    const existingNotification = document.querySelector('.ai-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // 새 알림 생성
    const notification = document.createElement('div');
    notification.className = `ai-notification ai-notification-${type}`;
    notification.innerHTML = `
        <div class="ai-notification-content">
            <span class="ai-notification-icon">
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <span class="ai-notification-message">${message}</span>
        </div>
    `;
    
    // 스타일 추가
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 100000;
        animation: slideIn 0.3s ease;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        font-weight: 500;
    `;
    
    document.body.appendChild(notification);
    
    // 3초 후 자동 제거
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// CSS 애니메이션 추가
if (!document.querySelector('#ai-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'ai-notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .ai-notification-content {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .ai-notification-icon {
            font-size: 18px;
        }
    `;
    document.head.appendChild(style);
}

// 전역 함수로 노출
window.sendSubtitlesToAI = sendSubtitlesToAI;

console.log('✅ AI 자막 통합 모듈 로드됨');