import * as DOM from '../dom-elements.js';
import { callAI, aiModels, testAIConnection } from '../api.js';
import { state, workLogManager } from '../state.js';
import { collectProgramContext, formatContextForAI, extractVideoFrames } from '../modules/program-context.js';

// 전역에서 접근 가능하도록 일부 함수 노출
window.addSystemMessageToChat = addSystemMessageToChat;

// 디바운스 함수 추가
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// 이미지 업로드 관련 변수
let currentUploadedImage = null;

// 이미지 관련 함수들 - initializeImageUpload 함수 제거 (더 이상 필요 없음)

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showImagePreview(file, dataUrl) {
    currentUploadedImage = {
        file: file,
        dataUrl: dataUrl,
        name: file.name,
        size: file.size
    };
    
    console.log('📷 이미지 업로드:', currentUploadedImage);
    
    // 즉시 채팅 히스토리에 이미지 표시
    const currentChat = state.chats.find(c => c.id === state.currentChatId);
    if (currentChat) {
        const imageMessage = {
            role: 'user',
            content: `📷 이미지 업로드: ${file.name}`,
            hasImage: true,
            imageData: currentUploadedImage
        };
        
        currentChat.messages.push(imageMessage);
        console.log('💾 이미지 메시지 저장됨:', imageMessage);
        
        addMessageToHistory('user', `📷 이미지 업로드: ${file.name}`, false, true, currentUploadedImage);
    }
    
    // 간단한 업로드 완료 알림 표시
    if (DOM.imagePreviewContainer) {
        DOM.imagePreviewContainer.innerHTML = `
            <div style="padding: 0.5rem 1rem; background: rgba(0, 137, 123, 0.1); border-radius: 8px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--accent-color); font-size: 0.9rem;">📷 ${file.name} 업로드 완료</span>
                <button id="clearImageBtn" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 1.1rem;">✕</button>
            </div>
        `;
        DOM.imagePreviewContainer.style.display = 'block';
        
        // 클리어 버튼 이벤트 추가
        const clearBtn = document.getElementById('clearImageBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', hideImagePreview);
        }
    }
    
    // 전송 버튼 상태 업데이트
    updateSendButtonState();
}

function hideImagePreview() {
    if (DOM.imagePreviewContainer) {
        DOM.imagePreviewContainer.style.display = 'none';
        DOM.imagePreviewContainer.innerHTML = ''; // 내용도 초기화
    }
    currentUploadedImage = null;
    
    // 파일 입력 초기화
    if (DOM.imageInput) {
        DOM.imageInput.value = '';
    }
    
    // 전송 버튼 상태 업데이트
    updateSendButtonState();
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // 파일 크기 체크 (100MB 제한)
    if (file.size > 100 * 1024 * 1024) {
        alert('이미지 파일 크기는 100MB 이하여야 합니다.');
        return;
    }
    
    // 이미지 파일 타입 체크
    if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드할 수 있습니다.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        showImagePreview(file, e.target.result);
    };
    reader.readAsDataURL(file);
}

function addMessageToHistory(role, content, isThinking = false, hasImage = false, imageData = null) {
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${role}-message`;

    let contentHTML = '';
    if (isThinking) {
        contentHTML = content ? `<p class="thinking">${content}</p>` : `<p class="thinking">● ● ●</p>`;
    } else {
        let formattedContent = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/```([\s\S]*?)```/g, (match, p1) => `<pre><code>${p1.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`)
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
        
        if (hasImage && imageData) {
            // onclick에서 작은따옴표 이스케이프 처리
            const escapedDataUrl = imageData.dataUrl.replace(/'/g, "\\'");
            const escapedName = imageData.name.replace(/'/g, "\\'");
            
            contentHTML = `
                <div class="message-image">
                    <img src="${imageData.dataUrl}" alt="${imageData.name}" class="chat-image" data-src="${imageData.dataUrl}" data-name="${imageData.name}">
                    <div class="image-info-text">${imageData.name} (${formatFileSize(imageData.size)})</div>
                </div>
                <p>${formattedContent}</p>
            `;
        } else {
            contentHTML = `<p>${formattedContent}</p>`;
        }
    }

    messageEl.innerHTML = `
        <div class="avatar">${role === 'ai' ? '🤖' : '👤'}</div>
        <div class="message-content">${contentHTML}</div>
    `;

    if (isThinking) {
        // 기존 thinking 메시지가 있으면 교체, 없으면 추가
        const existingThinking = DOM.chatHistory.querySelector('.thinking');
        if (existingThinking) {
            existingThinking.parentElement.parentElement.replaceWith(messageEl);
        } else {
            DOM.chatHistory.appendChild(messageEl);
        }
    } else {
        // 모든 thinking 메시지 제거하고 실제 응답 추가
        const allThinking = DOM.chatHistory.querySelectorAll('.thinking');
        allThinking.forEach(thinking => {
            thinking.parentElement.parentElement.remove();
        });
        DOM.chatHistory.appendChild(messageEl);
    }
    DOM.chatHistory.scrollTop = DOM.chatHistory.scrollHeight;
}

function renderChatList() {
    DOM.chatList.innerHTML = '';
    state.chats.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    state.chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'chat-list-item';
        item.dataset.id = chat.id;
        
        // 날짜 포맷팅
        const chatDate = new Date(chat.createdAt);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        let dateDisplay;
        if (chatDate.toDateString() === today.toDateString()) {
            dateDisplay = `오늘 ${chatDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (chatDate.toDateString() === yesterday.toDateString()) {
            dateDisplay = `어제 ${chatDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            dateDisplay = chatDate.toLocaleDateString('ko-KR', { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        item.innerHTML = `
            <input type="checkbox" class="chat-checkbox">
            <div class="chat-list-item-content">
            <span class="chat-list-item-title" data-chat-id="${chat.id}" title="더블클릭하여 제목 수정">${chat.title}</span>
                <div class="chat-list-item-date">${dateDisplay}</div>
            </div>
            <input type="text" class="chat-title-edit-input" data-chat-id="${chat.id}" value="${chat.title}" style="display: none;">
        `;
        if (chat.id === state.currentChatId) {
            item.classList.add('active');
        }
        DOM.chatList.appendChild(item);
    });
}

function renderActiveChat() {
    DOM.chatHistory.innerHTML = '';
    const chat = state.chats.find(c => c.id === state.currentChatId);
    if (chat) {
        console.log('🔄 채팅 렌더링 중, 메시지 수:', chat.messages.length);
        chat.messages.forEach((msg, index) => {
            console.log(`메시지 ${index}:`, msg.hasImage ? '이미지 포함' : '텍스트만', msg.imageData ? '이미지 데이터 있음' : '이미지 데이터 없음');
            addMessageToHistory(msg.role, msg.content, false, msg.hasImage, msg.imageData);
        });
    }
    document.querySelectorAll('.chat-list-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id === state.currentChatId);
    });
}

function renderAll() {
    renderChatList();
    renderActiveChat();
}

export async function handleSendMessage() {
    const userInput = DOM.chatInput.value.trim();
    if (!userInput && !currentUploadedImage) return;

    const currentChat = state.chats.find(c => c.id === state.currentChatId);
    if (!currentChat) return;

    if (userInput) {
        const messageData = {
            role: 'user',
            content: userInput,
            hasImage: false,
            imageData: null
        };
        
        currentChat.messages.push(messageData);
        addMessageToHistory('user', userInput, false, false, null);
    }
    
    DOM.chatInput.value = '';
    
    // AI에 보낼 이미지들을 여기서 미리 초기화합니다.
    let imagesToSend = currentUploadedImage ? [currentUploadedImage] : [];
    
    // 이미지 미리보기 숨기기 및 전역 변수 초기화
    hideImagePreview();
    
    updateSendButtonState();

    try {
        // 현재 선택된 AI 모델 정보 가져오기
        const mainModelSelect = DOM.mainModelSelect;
        const subModelSelect = DOM.subModelSelect;
        
        if (!mainModelSelect || !subModelSelect) {
            throw new Error('AI 모델 선택기를 찾을 수 없습니다.');
        }
        
        const modelKey = mainModelSelect.value;
        const subModel = subModelSelect.value;
        
        if (!modelKey || !subModel) {
            throw new Error('AI 모델이 선택되지 않았습니다. 설정 메뉴에서 모델을 선택해주세요.');
        }
        
        // AI 모델 정보 가져오기
        const modelData = aiModels[modelKey];
        
        if (!modelData) {
            throw new Error(`선택된 AI 모델(${modelKey})을 찾을 수 없습니다.`);
        }
        
        // API 키 확인 (다중 방법으로 검증)
        let apiKey = modelData.apiKey;
        
        // 1차: 메모리에서 확인
        if (!apiKey) {
            // 2차: window.apiKeyManager에서 확인
            if (window.apiKeyManager) {
                apiKey = window.apiKeyManager.loadApiKey(modelKey);
                if (apiKey) {
                    // 메모리에 반영
                    modelData.apiKey = apiKey;
                    console.log(`🔄 ${modelData.name} API 키 메모리 동기화`);
                }
            }
        }
        
        // 3차: localStorage에서 직접 확인
        if (!apiKey) {
            apiKey = localStorage.getItem(`apiKey_${modelKey}`);
            if (apiKey) {
                // 메모리에 반영
                modelData.apiKey = apiKey;
                console.log(`🔄 ${modelData.name} API 키 localStorage에서 복구`);
            }
        }
        
        if (!apiKey) {
            throw new Error(`${modelData.name} API 키가 설정되지 않았습니다. 설정 메뉴에서 API 키를 입력해주세요.`);
        }
        
        // 프로그램 현재 상태 수집
        const programContext = collectProgramContext();
        const contextText = formatContextForAI(programContext);
        
        // 동영상 분석 여부 확인
        const isVideoAnalysisRequest = userInput && (
            userInput.includes('동영상') || userInput.includes('비디오') || userInput.includes('영상') ||
            userInput.includes('분석') || userInput.includes('프레임') || userInput.includes('영화') ||
            userInput.includes('화면') || userInput.includes('장면') || userInput.includes('내용')
        ) && state.uploadedFile && DOM.videoPreview && DOM.videoPreview.src;
        
        // 동영상 프레임 추출 (동영상 분석 요청 시, 그리고 이미지가 첨부되지 않았을 때)
        let videoFrames = [];
        if (isVideoAnalysisRequest && imagesToSend.length === 0) {
            try {
                console.log('🎬 동영상 프레임 추출 시작...');
                addMessageToHistory('ai', '동영상을 분석하기 위해 프레임을 추출하고 있습니다...', true);
                
                videoFrames = await extractVideoFrames();
                console.log(`✅ ${videoFrames.length}개 프레임 추출 완료`);
                
                addMessageToHistory('ai', 'AI가 동영상을 분석하고 있습니다...', true);
                
            } catch (error) {
                console.warn('동영상 프레임 추출 실패:', error);
                addMessageToHistory('ai', `⚠️ 동영상 프레임 추출에 실패했습니다: ${error.message}. 텍스트로만 답변드리겠습니다.`);
                return;
            }
        } else {
            addMessageToHistory('ai', '', true);
        }
        
        // 시스템 프롬프트 구성 (프로그램 컨텍스트 포함)
        let systemPrompt;
        const isSubtitleAnalysisRequest = userInput && (userInput.includes('자막') && (userInput.includes('분석') || userInput.includes('정리') || userInput.includes('요약')));
        
        const isPersonAnalysisRequest = userInput && 
            (userInput.includes('인물') || userInput.includes('사람') || userInput.includes('누구') || userInput.includes('그는') || userInput.includes('그녀는')) &&
            programContext.v2FaceAnalysis;


        if (isSubtitleAnalysisRequest) {
            systemPrompt = `
당신은 AutoShorts 프로그램의 AI 어시스턴트입니다. 사용자가 **자막 분석**을 요청했습니다.

📋 **현재 작업:**
- 오직 '현재 프로그램 상황'에 제공된 **자막 내용**만을 분석하고 요약하여 답변해주세요.
- 사용자가 명시적으로 요청하지 않는 한, 영상 편집, 숏츠 제작 제안, 또는 기타 조언을 절대 먼저 제공하지 마세요.
- 답변은 자막 내용에 기반해야 합니다.

📊 **현재 프로그램 상황:**
${contextText}
            `.trim();
        } else if (isPersonAnalysisRequest) {
            systemPrompt = `
당신은 AutoShorts 프로그램의 전문 영상 분석 AI 어시스턴트입니다. 사용자가 **특정 인물의 행동 및 동선 분석**을 요청했습니다.

🎯 **최우선 임무:**
- 'V2 얼굴 분석 결과'에 제공된 인물 정보와 등장 시간(타임라인) 데이터를 **반드시** 활용하여 답변해야 합니다.
- 사용자가 질문한 인물(예: '1번 인물', '그 남자')이 영상 속에서 어떤 행동을 하고, 어떤 역할을 수행하는지 구체적으로 분석하고 설명해주세요.
- 필요하다면, 각 인물의 등장 시간 정보를 바탕으로 여러 장면에 걸친 행동의 변화나 스토리 라인을 추론하여 설명해주세요.

📊 **현재 프로그램 상황:**
${contextText}

💡 **지침:**
- "인물 #1은 15초, 45초, 1분 10초에 등장합니다. 15초에는 웃고 있고, 45초에는 심각한 표정으로 문서를 보고 있으며..." 와 같이 시간대별로 구체적인 행동을 묘사해주세요.
- 단순히 정보를 나열하는 것을 넘어, 인물의 행동을 종합하여 영상의 전체적인 스토리나 분위기 파악에 도움을 주는 답변을 구성해주세요.
            `.trim();
        } else {
            systemPrompt = `
당신은 AutoShorts 영상 편집 프로그램의 AI 어시스턴트입니다.

📋 핵심 역할:
- AutoShorts 프로그램 사용법 안내 및 도움
- 업로드된 동영상/이미지 분석 및 설명
- 영상 편집 관련 조언 및 최적화 제안
- 플랫폼별 숏츠 제작 가이드라인 제공
- 프로그램 설정 및 기능 설명

📊 **현재 프로그램 상황:**
${contextText}

💡 **지침:**
- 현재 프로그램 상태를 고려하여 맞춤형 답변 제공
- 동영상이 업로드된 경우 구체적인 분석과 편집 제안
- 플랫폼이 선택된 경우 해당 플랫폼 최적화 조언
- 설정값들을 고려한 실용적인 가이드 제공
- 사용자의 작업 흐름을 이해하고 다음 단계 제안
                    `.trim();
        }
        
        // 이전 대화 내용 추가 (최근 3개만)
        const previousMessages = currentChat.messages.slice(-6, -1); // 최근 3쌍의 대화
        if (previousMessages.length > 0) {
            systemPrompt += `\n\n📝 **최근 대화:**\n${previousMessages.map(msg => `${msg.role === 'user' ? '👤 사용자' : '🤖 AI'}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`).join('\n')}\n`;
        }
        
        // AI에 전송할 메시지 구성
        let aiMessage = userInput;
        
        if (videoFrames.length > 0) {
            imagesToSend = videoFrames;
            aiMessage = `**동영상 종합 분석 요청**\n\n사용자 질문: "${userInput || '업로드된 동영상을 전체적으로 분석하고 편집 방향을 제안해주세요.'}"\n\n**분석 자료:**\n1.  **전체 자막:** (시스템 프롬프트에 포함된 '현재 프로그램 상황' 섹션의 자막 내용 참고)\n2.  **추출된 프레임:** 아래 제공된 ${videoFrames.length}개의 프레임은 영상의 시간 순서에 따른 주요 장면들입니다.\n\n**분석 지시:**\n제공된 **모든 프레임**과 **전체 자막 내용**을 종합적으로 고려하여, 영상의 전체적인 스토리, 분위기, 그리고 시간의 흐름에 따른 변화를 분석해주세요. 이를 바탕으로 AutoShorts 편집을 위한 창의적이고 구체적인 제안을 해주세요.`;
        } else if (imagesToSend.length > 0 && !userInput) {
            aiMessage = '업로드된 이미지를 분석해주세요. AutoShorts 편집에 도움이 될 만한 내용들을 중심으로 설명해주세요.';
        } else if (imagesToSend.length > 0 && userInput) {
            aiMessage = `이미지 관련 질문: ${userInput}`;
        } else if (!userInput && programContext.uploadedFile) {
            aiMessage = '현재 업로드된 동영상과 설정을 바탕으로 AutoShorts 편집을 위한 조언을 해주세요.';
        }
        
        console.log(`🔄 AI 호출 시작:`, { 
            modelKey, 
            subModel, 
            userInput: aiMessage.substring(0, 50) + '...',
            imageCount: imagesToSend.length,
            contextIncluded: true
        });
        
        const aiResponse = await callAI(modelKey, subModel, systemPrompt, aiMessage, imagesToSend);
        currentChat.messages.push({ role: 'ai', content: aiResponse });
        addMessageToHistory('ai', aiResponse);
        
        console.log(`✅ AI 응답 완료`);
    } catch (error) {
        console.error('Error calling AI:', error);
        
        // 더 구체적인 오류 메시지 제공
        let errorMessage = '죄송합니다. 오류가 발생했습니다.';
        if (error.message.includes('모델 선택기를 찾을 수 없습니다')) {
            errorMessage = '⚙️ 설정 메뉴를 열고 AI 모델을 선택해주세요.';
        } else if (error.message.includes('모델이 선택되지 않았습니다')) {
            errorMessage = '📋 하단의 모델 선택 드롭다운에서 AI 모델을 선택해주세요.';
        } else if (error.message.includes('API 키')) {
            errorMessage = error.message; // API 키 관련 오류는 그대로 표시
        } else {
            errorMessage = `❌ 오류: ${error.message}`;
        }
        
        addMessageToHistory('ai', errorMessage);
    }
}

/**
 * 시스템 메시지를 현재 대화에 추가하는 함수
 * @param {string} content - 추가할 메시지 내용
 * @param {string} [title] - 메시지 상단에 표시될 제목 (옵션)
 */
export function addSystemMessageToChat(content, title = '시스템 메시지') {
    const currentChat = state.chats.find(c => c.id === state.currentChatId);
    if (!currentChat) {
        console.error('현재 활성화된 대화가 없어 시스템 메시지를 추가할 수 없습니다.');
        return;
    }

    const messageData = {
        role: 'ai', // 시스템 메시지도 AI 역할로 처리
        content: `**${title}**\n\n${content}`,
        isSystem: true // 시스템 메시지임을 구분하는 플래그
    };

    currentChat.messages.push(messageData);
    
    // UI에 메시지 추가
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-message ai-message system-message'; // 시스템 메시지용 클래스 추가

    let formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/```([\s\S]*?)```/g, (match, p1) => `<pre><code>${p1.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`)
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');

    messageEl.innerHTML = `
        <div class="avatar">⚙️</div>
        <div class="message-content">
            <p><strong>${title}</strong></p>
            <p>${formattedContent}</p>
        </div>
    `;

    DOM.chatHistory.appendChild(messageEl);
    DOM.chatHistory.scrollTop = DOM.chatHistory.scrollHeight;

    console.log(`⚙️ 시스템 메시지 추가: "${title}"`);
}


export function updateSendButtonState() {
    const hasText = DOM.chatInput.value.trim() !== '';
    const hasImage = !!currentUploadedImage;
    DOM.sendChatBtn.disabled = !hasText && !hasImage;
    
    // 동영상 분석 버튼 표시/숨김
    if (DOM.videoAnalysisBtn) {
        const hasVideo = state.uploadedFile && DOM.videoPreview && DOM.videoPreview.src;
        DOM.videoAnalysisBtn.style.display = hasVideo ? 'flex' : 'none';
    }
}

export function startNewChat() {
    const newId = `chat_${Date.now()}`;
    const now = new Date();
    const newChat = {
        id: newId,
        title: `새 대화 - ${now.toLocaleTimeString()}`,
        messages: [{ role: 'ai', content: '안녕하세요! 무엇을 도와드릴까요?' }],
        createdAt: now.toISOString()  // 명확한 ISO 시간 설정
    };
    state.chats.push(newChat);
    state.currentChatId = newId;
    
    // 작업 로그 기록
    workLogManager.addWorkLog('chat', '새 대화 시작', { 
        chatId: newChat.id,
        title: newChat.title 
    });
    
    console.log('📝 새 대화 생성:', newChat);
    renderAll();
}

// 동영상 분석 요청 함수
export async function handleVideoAnalysisRequest() {
    if (!state.uploadedFile || !DOM.videoPreview || !DOM.videoPreview.src) {
        alert('분석할 동영상이 없습니다. 먼저 동영상을 업로드해주세요.');
        return;
    }
    
    // 입력창에 동영상 분석 요청 메시지 설정
    DOM.chatInput.value = '업로드된 동영상을 분석해서 AutoShorts 편집을 위한 구체적인 조언을 해주세요. 영상의 내용, 장면 구성, 하이라이트 포인트 등을 분석해주세요.';
    
    // 메시지 전송
    await handleSendMessage();
}

// 대화 제목 편짓 기능들
export function startEditChatTitle(chatId) {
    const titleSpan = document.querySelector(`.chat-list-item-title[data-chat-id="${chatId}"]`);
    const titleInput = document.querySelector(`.chat-title-edit-input[data-chat-id="${chatId}"]`);
    
    if (!titleSpan || !titleInput) return;
    
    // 편집 모드로 전환
    titleSpan.style.display = 'none';
    titleInput.style.display = 'block';
    titleInput.focus();
    titleInput.select();
    
    // 편짓 모드 표시를 위한 클래스 추가
    titleInput.parentElement.classList.add('editing');
}

export function saveChatTitle(chatId, newTitle) {
    const trimmedTitle = newTitle.trim();
    
    // 빈 제목은 허용하지 않음
    if (!trimmedTitle) {
        cancelEditChatTitle(chatId);
        return;
    }
    
    // 상태 업데이트
    const chat = state.chats.find(c => c.id === chatId);
    if (chat) {
        chat.title = trimmedTitle;
        console.log(`✅ 대화 제목 변경: "${trimmedTitle}"`);
    }
    
    // UI 업데이트
    finishEditChatTitle(chatId);
    renderChatList(); // 제목 변경사항 반영
}

export function cancelEditChatTitle(chatId) {
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;
    
    const titleInput = document.querySelector(`.chat-title-edit-input[data-chat-id="${chatId}"]`);
    if (titleInput) {
        titleInput.value = chat.title; // 원래 제목으로 복원
    }
    
    finishEditChatTitle(chatId);
}

function finishEditChatTitle(chatId) {
    const titleSpan = document.querySelector(`.chat-list-item-title[data-chat-id="${chatId}"]`);
    const titleInput = document.querySelector(`.chat-title-edit-input[data-chat-id="${chatId}"]`);
    
    if (!titleSpan || !titleInput) return;
    
    // 일반 모드로 전환
    titleSpan.style.display = 'inline';
    titleInput.style.display = 'none';
    
    // 편짓 모드 클래스 제거
    titleInput.parentElement.classList.remove('editing');
}

// 대화 관리 기능들
export function toggleSelectAllChats() {
    const selectAllCheckbox = DOM.selectAllChats;
    const chatCheckboxes = document.querySelectorAll('.chat-checkbox');
    const isSelectAll = selectAllCheckbox.checked;
    
    chatCheckboxes.forEach(checkbox => {
        checkbox.checked = isSelectAll;
    });
    
    console.log(`✅ 전체 대화 ${isSelectAll ? '선택' : '해제'}: ${chatCheckboxes.length}개`);
}

export function getSelectedChatIds() {
    const selectedCheckboxes = document.querySelectorAll('.chat-checkbox:checked');
    const selectedIds = [];
    
    selectedCheckboxes.forEach(checkbox => {
        const chatItem = checkbox.closest('.chat-list-item');
        if (chatItem && chatItem.dataset.id) {
            selectedIds.push(chatItem.dataset.id);
        }
    });
    
    return selectedIds;
}

export function saveChatsToFile() {
    try {
        const chatData = {
            version: "1.0",
            exportDate: new Date().toISOString(),
            totalChats: state.chats.length,
            chats: state.chats
        };
        
        const jsonString = JSON.stringify(chatData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `autoshorts-chats-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`✅ 대화 저장 완료: ${state.chats.length}개 대화`);
        alert(`💾 대화 저장 완료!\n- 저장된 대화 수: ${state.chats.length}개\n- 파일명: autoshorts-chats-${new Date().toISOString().slice(0, 10)}.json`);
        
    } catch (error) {
        console.error('❌ 대화 저장 오류:', error);
        alert('❌ 대화 저장 중 오류가 발생했습니다.');
    }
}

export function triggerLoadChats() {
    DOM.loadChatsInput.click();
}

export function loadChatsFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const chatData = JSON.parse(e.target.result);
            
            // 데이터 유효성 검증
            if (!chatData.chats || !Array.isArray(chatData.chats)) {
                throw new Error('올바르지 않은 대화 파일 형식입니다.');
            }
            
            // 기존 대화와 중복 확인
            const duplicateCount = chatData.chats.filter(importChat => 
                state.chats.some(existingChat => existingChat.id === importChat.id)
            ).length;
            
            let confirmMessage = `📂 대화 불러오기\n\n`;
            confirmMessage += `- 불러올 대화 수: ${chatData.chats.length}개\n`;
            confirmMessage += `- 내보낸 날짜: ${chatData.exportDate ? new Date(chatData.exportDate).toLocaleString() : '알 수 없음'}\n`;
            
            if (duplicateCount > 0) {
                confirmMessage += `- 중복 대화: ${duplicateCount}개 (덮어쓰기됩니다)\n`;
            }
            
            confirmMessage += `\n계속하시겠습니까?`;
            
            if (!confirm(confirmMessage)) {
                event.target.value = ''; // 파일 선택 초기화
                return;
            }
            
            // 중복 대화 제거 (ID 기준)
            chatData.chats.forEach(importChat => {
                const existingIndex = state.chats.findIndex(chat => chat.id === importChat.id);
                if (existingIndex !== -1) {
                    state.chats.splice(existingIndex, 1);
                }
            });
            
            // 새 대화들 추가
            state.chats.push(...chatData.chats);
            
            // 첫 번째 불러온 대화를 활성화
            if (chatData.chats.length > 0) {
                state.currentChatId = chatData.chats[0].id;
            }
            
            renderAll();
            
            console.log(`✅ 대화 불러오기 완료: ${chatData.chats.length}개 대화`);
            alert(`📂 대화 불러오기 완료!\n- 불러온 대화 수: ${chatData.chats.length}개\n- 총 대화 수: ${state.chats.length}개`);
            
        } catch (error) {
            console.error('❌ 대화 불러오기 오류:', error);
            alert(`❌ 대화 불러오기 실패\n\n오류: ${error.message}\n\n올바른 대화 파일을 선택해주세요.`);
        }
        
        // 파일 선택 초기화
        event.target.value = '';
    };
    
    reader.readAsText(file);
}

export function deleteSelectedChats() {
    const selectedIds = getSelectedChatIds();
    
    if (selectedIds.length === 0) {
        alert('🗑️ 삭제할 대화를 선택해주세요.\n\n체크박스를 선택한 후 삭제 버튼을 클릭하세요.');
        return;
    }
    
    const confirmMessage = `🗑️ 선택된 대화 삭제\n\n- 삭제할 대화 수: ${selectedIds.length}개\n- 삭제된 대화는 복구할 수 없습니다.\n\n정말 삭제하시겠습니까?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // 현재 활성 대화가 삭제되는지 확인
    const currentChatWillBeDeleted = selectedIds.includes(state.currentChatId);
    
    // 선택된 대화들 삭제
    selectedIds.forEach(chatId => {
        const index = state.chats.findIndex(chat => chat.id === chatId);
        if (index !== -1) {
            state.chats.splice(index, 1);
        }
    });
    
    // 현재 대화가 삭제되었다면 다른 대화로 이동
    if (currentChatWillBeDeleted) {
        if (state.chats.length > 0) {
            state.currentChatId = state.chats[0].id;
        } else {
            // 모든 대화가 삭제되었다면 새 대화 생성
            startNewChat();
        }
    }
    
    // 전체 선택 체크박스 해제
    DOM.selectAllChats.checked = false;
    
    renderAll();
    
    console.log(`✅ 대화 삭제 완료: ${selectedIds.length}개 대화`);
    alert(`🗑️ 대화 삭제 완료!\n- 삭제된 대화 수: ${selectedIds.length}개\n- 남은 대화 수: ${state.chats.length}개`);
}

// AI 연결 테스트 기능
export async function handleAIConnectionTest() {
    const mainModelSelect = DOM.mainModelSelect;
    const subModelSelect = DOM.subModelSelect;
    
    if (!mainModelSelect || !subModelSelect) {
        alert('AI 모델 선택기를 찾을 수 없습니다.');
        return;
    }
    
    const modelKey = mainModelSelect.value;
    const subModel = subModelSelect.value;
    
    if (!modelKey || !subModel) {
        alert('먼저 AI 모델을 선택해주세요.');
        return;
    }
    
    // 현재 채팅에 테스트 시작 메시지 추가
    const currentChat = state.chats.find(c => c.id === state.currentChatId);
    if (!currentChat) return;
    
    const testMessage = `🔬 ${aiModels[modelKey]?.name} ${subModel} 연결 테스트를 시작합니다...`;
    currentChat.messages.push({ role: 'user', content: testMessage });
    addMessageToHistory('user', testMessage);
    
    // 로딩 메시지 표시
    addMessageToHistory('ai', '', true);
    
    try {
        console.log(`🔬 AI 연결 테스트 시작: ${modelKey} - ${subModel}`);
        
        const testResult = await testAIConnection(modelKey, subModel);
        
        // 결과를 채팅에 추가
        currentChat.messages.push({ role: 'ai', content: testResult });
        addMessageToHistory('ai', testResult);
        
        console.log(`✅ AI 연결 테스트 완료`);
        
    } catch (error) {
        console.error('AI 연결 테스트 오류:', error);
        
        const errorMessage = `❌ **AI 연결 테스트 실패**
        
**오류:** ${error.message}

**확인사항:**
1. API 키가 올바르게 설정되었는지 확인
2. 인터넷 연결 상태 확인
3. API 서비스 상태 확인

⚙️ 설정 버튼을 클릭하여 API 키를 다시 확인해보세요.`;
        
        currentChat.messages.push({ role: 'ai', content: errorMessage });
        addMessageToHistory('ai', errorMessage);
    }
}

export function setupChatEventListeners() {
    DOM.newChatBtn.addEventListener('click', startNewChat);
    DOM.sendChatBtn.addEventListener('click', handleSendMessage);
    DOM.testAIBtn.addEventListener('click', handleAIConnectionTest);
    // 디바운스를 적용하여 input 이벤트 핸들러 최적화
    const debouncedUpdateSendButtonState = debounce(updateSendButtonState, 250);
    DOM.chatInput.addEventListener('input', debouncedUpdateSendButtonState);

    DOM.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    DOM.chatList.addEventListener('click', (e) => {
        const item = e.target.closest('.chat-list-item');
        if (item && item.dataset.id !== state.currentChatId) {
            state.currentChatId = item.dataset.id;
            renderAll();
        }
    });

    // 대화 제목 편짓 이벤트 리스너들
    DOM.chatList.addEventListener('dblclick', (e) => {
        const titleSpan = e.target.closest('.chat-list-item-title');
        if (titleSpan) {
            e.preventDefault();
            e.stopPropagation();
            const chatId = titleSpan.dataset.chatId;
            startEditChatTitle(chatId);
        }
    });

    // 제목 편짓 입력 필드 이벤트들 (이벤트 위임 사용)
    DOM.chatList.addEventListener('keydown', (e) => {
        const titleInput = e.target.closest('.chat-title-edit-input');
        if (!titleInput) return;

        const chatId = titleInput.dataset.chatId;
        
        if (e.key === 'Enter') {
            e.preventDefault();
            saveChatTitle(chatId, titleInput.value);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEditChatTitle(chatId);
        }
    });

    // 포커스 아웃시 저장 (이벤트 위임 사용)
    DOM.chatList.addEventListener('blur', (e) => {
        const titleInput = e.target.closest('.chat-title-edit-input');
        if (!titleInput) return;

        const chatId = titleInput.dataset.chatId;
        saveChatTitle(chatId, titleInput.value);
    }, true); // true로 설정하여 캡처 단계에서 처리

    // 제목 편짓 중 다른 곳 클릭 방지
    DOM.chatList.addEventListener('click', (e) => {
        const editingInput = DOM.chatList.querySelector('.chat-title-edit-input[style*="block"]');
        if (editingInput && !e.target.closest('.chat-title-edit-input')) {
            const chatId = editingInput.dataset.chatId;
            saveChatTitle(chatId, editingInput.value);
        }
    });

    // 대화 관리 버튼 이벤트 리스너들
    DOM.selectAllChats.addEventListener('change', toggleSelectAllChats);
    DOM.saveChatsBtn.addEventListener('click', saveChatsToFile);
    DOM.loadChatsBtn.addEventListener('click', triggerLoadChats);
    DOM.loadChatsInput.addEventListener('change', loadChatsFromFile);
    DOM.deleteChatsBtn.addEventListener('click', deleteSelectedChats);
    
    // 채팅 이미지 클릭 이벤트 (이벤트 위임)
    DOM.chatHistory.addEventListener('click', (e) => {
        const chatImage = e.target.closest('.chat-image');
        if (chatImage) {
            const imageSrc = chatImage.dataset.src;
            const imageName = chatImage.dataset.name;
            if (imageSrc && imageName) {
                window.openImageModal(imageSrc, imageName);
            }
        }
    });
    
    // 이미지 업로드 초기화 및 이벤트 리스너 설정
    if (DOM.imageUploadBtn) {
        DOM.imageUploadBtn.addEventListener('click', () => {
            if (DOM.imageInput) {
                DOM.imageInput.click();
            }
        });
    }
    
    // 동영상 분석 버튼 이벤트 리스너
    if (DOM.videoAnalysisBtn) {
        DOM.videoAnalysisBtn.addEventListener('click', handleVideoAnalysisRequest);
    }
    
    if (DOM.imageInput) {
        DOM.imageInput.addEventListener('change', handleImageUpload);
    }
    
    if (DOM.removeImageBtn) {
        DOM.removeImageBtn.addEventListener('click', hideImagePreview);
    }
    
    // 드래그 앤 드롭 지원
    const chatInputArea = document.querySelector('.chat-input-area');
    if (chatInputArea) {
        chatInputArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chatInputArea.classList.add('dragover');
        });
        
        chatInputArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chatInputArea.classList.remove('dragover');
        });
        
        chatInputArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chatInputArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.type.startsWith('image/')) {
                    const fakeEvent = { target: { files: [file] } };
                    handleImageUpload(fakeEvent);
                } else {
                    alert('이미지 파일만 업로드할 수 있습니다.');
                }
            }
        });
    }
    
    console.log('✅ 대화 관리 및 이미지 업로드 이벤트 리스너 설정 완료');
}

// 이미지 모달 관련 함수들 (전역으로 추가)
window.openImageModal = function(imageSrc, imageName) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('imageModalContent');
    
    if (modal && modalImg) {
        modal.classList.add('show');
        modalImg.src = imageSrc;
        modalImg.alt = imageName;
        
        // ESC 키로 닫기
        document.addEventListener('keydown', handleModalKeydown);
    }
};

window.closeImageModal = function() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.classList.remove('show');
        document.removeEventListener('keydown', handleModalKeydown);
    }
};

function handleModalKeydown(e) {
    if (e.key === 'Escape') {
        window.closeImageModal();
    }
}

// 모달 배경 클릭으로 닫기
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                window.closeImageModal();
            }
        });
    }
});
