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
        
        // 먼저 AI 채팅창에 자막 내용을 표시
        displaySubtitlesInChat(subtitleData);
        
        // 자막 컨텍스트를 전역 상태에 저장
        window.currentSubtitleContext = {
            data: subtitleData,
            aiAnalyzed: false,
            analyzedAt: new Date().toISOString()
        };
        
        // UI에 상태 표시
        showAINotification('자막이 로드되었습니다', 'success');
        
        console.log('✅ 자막이 AI 채팅창에 표시되었습니다');
        
        // AI에게 자막을 자동으로 분석시키지 않고, 사용자가 요청할 때만 분석
        // 자막 데이터는 이미 전역 컨텍스트에 저장되어 있으므로 
        // 사용자가 질문하면 자동으로 참조됩니다
        
        return '자막이 성공적으로 로드되었습니다';
        
    } catch (error) {
        console.error('❌ AI 자막 분석 실패:', error);
        showAINotification('AI 자막 분석 실패: ' + error.message, 'error');
        throw error;
    }
}

/**
 * 자막을 AI 채팅창에 표시
 */
function displaySubtitlesInChat(subtitleData) {
    try {
        // 깨끗하게 포맷팅된 자막 HTML 생성
        let formattedHTML = '';
        
        // 헤더 정보
        formattedHTML += `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                <h3 style="margin: 0 0 10px 0; font-size: 18px;">📝 자막 로드 완료</h3>
                <div style="font-size: 14px; opacity: 0.95;">
                    ${subtitleData.fileName ? `<div>📁 파일: ${subtitleData.fileName}</div>` : ''}
                    <div>🎬 추출 방법: ${getMethodName(subtitleData.method)}</div>
                    <div>📊 총 ${subtitleData.segments?.length || 0}개 세그먼트</div>
                    <div>⏱️ 총 길이: ${calculateTotalDuration(subtitleData.segments)}</div>
                </div>
            </div>
        `;
        
        // 자막 내용을 소설 형식으로 표시
        const novelText = formatSubtitlesAsNovel(subtitleData);
        
        formattedHTML += `
            <div class="subtitle-content-scroll" style="background: var(--bg-secondary, #2a2a2a); border-radius: 10px; padding: 20px; max-height: 600px; overflow-y: auto;">
                <h4 style="color: var(--text-primary, #e0e0e0); margin: 0 0 20px 0; text-align: center;">📖 자막 내용</h4>
                <div style="color: var(--text-primary, #e0e0e0); line-height: 1.8; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    ${novelText}
                </div>
            </div>
        `;
        
        // AI 채팅창에 추가
        if (window.addSystemMessageToChat) {
            window.addSystemMessageToChat(formattedHTML, '');
        } else {
            // 폴백: addMessageToHistory 사용
            const chatHistory = document.getElementById('chatHistory');
            if (chatHistory) {
                const messageEl = document.createElement('div');
                messageEl.className = 'chat-message system-message';
                messageEl.innerHTML = `
                    <div class="avatar">📝</div>
                    <div class="message-content">
                        ${formattedHTML}
                    </div>
                `;
                chatHistory.appendChild(messageEl);
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }
        }
        
        console.log('✅ 자막이 AI 채팅창에 표시되었습니다');
        
    } catch (error) {
        console.error('❌ 자막 표시 실패:', error);
    }
}

/**
 * 자막을 소설 형식으로 포맷팅
 */
function formatSubtitlesAsNovel(subtitleData) {
    let novelText = '';
    
    if (subtitleData.segments && subtitleData.segments.length > 0) {
        // 화자별로 그룹화
        const groupedBySpeaker = groupSubtitlesBySpeaker(subtitleData.segments);
        const speakers = Object.keys(groupedBySpeaker);
        
        if (speakers.length > 1 && !speakers.includes('알 수 없음')) {
            // 화자가 여러 명인 경우 - 대화 형식
            subtitleData.segments.forEach((segment, index) => {
                if (segment.text && segment.text.trim()) {
                    if (segment.speaker) {
                        // 화자가 있는 경우
                        novelText += `<p style="margin-bottom: 15px;"><strong style="color: #667eea;">${segment.speaker}:</strong> "${segment.text.trim()}"</p>`;
                    } else {
                        // 화자가 없는 경우 (나레이션으로 처리)
                        novelText += `<p style="margin-bottom: 15px; font-style: italic; color: var(--text-secondary, #b0b0b0);">${segment.text.trim()}</p>`;
                    }
                }
            });
        } else {
            // 화자가 한 명이거나 없는 경우 - 일반 텍스트 형식
            let paragraphText = '';
            
            subtitleData.segments.forEach((segment, index) => {
                if (segment.text && segment.text.trim()) {
                    let text = segment.text.trim();
                    
                    // 문장 끝 처리
                    if (!text.match(/[.!?]$/)) {
                        // 다음 세그먼트가 있고, 현재 문장이 완전하지 않으면 공백 추가
                        if (index < subtitleData.segments.length - 1) {
                            text += ' ';
                        }
                    } else {
                        // 문장이 끝나면 새 문단 시작
                        text += ' ';
                    }
                    
                    paragraphText += text;
                    
                    // 문단이 너무 길어지면 나누기 (약 200자마다)
                    if (paragraphText.length > 200 && text.match(/[.!?]$/)) {
                        novelText += `<p style="margin-bottom: 18px; text-align: justify;">${paragraphText.trim()}</p>`;
                        paragraphText = '';
                    }
                }
            });
            
            // 남은 텍스트 추가
            if (paragraphText.trim()) {
                novelText += `<p style="margin-bottom: 18px; text-align: justify;">${paragraphText.trim()}</p>`;
            }
        }
    } else if (subtitleData.text) {
        // 타임스탬프 없는 텍스트만 있는 경우
        const sentences = subtitleData.text.split(/[.!?]+/).filter(s => s.trim());
        let currentParagraph = '';
        
        sentences.forEach((sentence, index) => {
            currentParagraph += sentence.trim() + '. ';
            
            // 3-4문장마다 새 문단
            if ((index + 1) % 3 === 0 || index === sentences.length - 1) {
                novelText += `<p style="margin-bottom: 18px; text-align: justify;">${currentParagraph.trim()}</p>`;
                currentParagraph = '';
            }
        });
    } else {
        novelText = '<p style="text-align: center; color: var(--text-secondary, #999); font-style: italic;">자막 내용이 없습니다.</p>';
    }
    
    return novelText;
}

/**
 * 화자별로 자막 그룹화
 */
function groupSubtitlesBySpeaker(segments) {
    const grouped = {};
    
    segments.forEach(segment => {
        const speaker = segment.speaker || '알 수 없음';
        if (!grouped[speaker]) {
            grouped[speaker] = [];
        }
        grouped[speaker].push(segment);
    });
    
    return grouped;
}

/**
 * 추출 방법 이름 변환
 */
function getMethodName(method) {
    const methodNames = {
        'whisper': 'OpenAI Whisper',
        'assemblyai': 'AssemblyAI',
        'google': 'Google Speech-to-Text',
        'import': '파일 가져오기'
    };
    return methodNames[method] || method;
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

// CSS 애니메이션 및 스타일 추가
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
        
        /* 시스템 메시지 스타일 */
        .chat-message.system-message {
            background: transparent;
            border: none;
            padding: 10px;
        }
        
        .chat-message.system-message .message-content {
            max-width: 100%;
            background: transparent;
        }
        
        /* 자막 내용 스크롤바 스타일 */
        .subtitle-content-scroll::-webkit-scrollbar {
            width: 8px;
        }
        
        .subtitle-content-scroll::-webkit-scrollbar-track {
            background: var(--bg-tertiary, #3a3a3a);
            border-radius: 4px;
        }
        
        .subtitle-content-scroll::-webkit-scrollbar-thumb {
            background: #667eea;
            border-radius: 4px;
        }
        
        .subtitle-content-scroll::-webkit-scrollbar-thumb:hover {
            background: #764ba2;
        }
    `;
    document.head.appendChild(style);
}

// 전역 함수로 노출
window.sendSubtitlesToAI = sendSubtitlesToAI;

console.log('✅ AI 자막 통합 모듈 로드됨');