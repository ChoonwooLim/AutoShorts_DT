import * as DOM from './dom-elements.js';
import { googleConfig } from './config.js';
import { state, workLogManager } from './state.js';

class ApiKeyManager {
    constructor() {
        this.keys = {}; // 메모리 내 API 키 캐시
        this.isInitialized = false;
        console.log('🔑 ApiKeyManager 인스턴스 생성됨');
    }

    async initialize() {
        if (this.isInitialized) return;
        
        console.log('🔑 저장된 API 키 로드 시작...');
        const storedKeys = JSON.parse(localStorage.getItem('apiKeys')) || {};
        
        for (const provider of Object.keys(aiModels)) {
            if (storedKeys[provider]) {
                this.keys[provider] = storedKeys[provider];
                aiModels[provider].apiKey = storedKeys[provider];
            }
        }
        
        this.isInitialized = true;
        console.log(`🔑 API 키 로드 완료: ${Object.keys(this.keys).length}/${Object.keys(aiModels).length}개 모델`);
    }

    saveApiKey(provider, apiKey) {
        if (!provider || !apiKey) {
            const error = 'Provider 또는 API 키가 없습니다.';
            console.error(`❌ API 키 저장 실패: ${error}`);
            return { success: false, error };
        }
        this.keys[provider] = apiKey;
        aiModels[provider].apiKey = apiKey;
        
        localStorage.setItem('apiKeys', JSON.stringify(this.keys));
        console.log(`✅ ${provider} API 키가 저장되었습니다.`);
        return { success: true };
    }

    loadApiKey(provider) {
        if (!provider) return null;
        return this.keys[provider] || null;
    }

    getAllApiKeys() {
        return { ...this.keys };
    }
}

const apiKeyManager = new ApiKeyManager();
window.apiKeyManager = apiKeyManager;

export const aiModels = {
    claude: {
        name: 'Anthropic Claude',
        subModels: [
            "Claude 3.5 Sonnet",
            "Claude 3.5 Haiku",
            "Claude 3 Opus",
            "Claude 3 Sonnet",
            "Claude 3 Haiku"
        ],
        apiKey: '',
        apiKeyUrl: 'https://console.anthropic.com/settings/keys',
        endpoint: "https://api.anthropic.com/v1/messages"
    },
    gpt: {
        name: 'OpenAI GPT',
        subModels: [
            "ChatGPT-5",
            "GPT-4.1",
            "GPT-4o",
            "GPT-4o Mini",
            "GPT-4 Turbo",
            "o4-mini",
            "o3-mini",
            "o1",
            "o1-mini",
            "GPT-3.5 Turbo"
        ],
        apiKey: '',
        apiKeyUrl: 'https://platform.openai.com/api-keys',
        endpoint: "https://api.openai.com/v1/chat/completions"
    },
    gemini: {
        name: 'Google Gemini',
        subModels: [
            "Gemini 2.0 Flash",
            "Gemini 1.5 Pro",
            "Gemini 1.5 Flash",
            "Gemini 1.0 Pro"
        ],
        apiKey: '',
        apiKeyUrl: 'https://aistudio.google.com/app/apikey',
        endpoint: "https://generativelanguage.googleapis.com/v1beta/models"
    },
    groq: {
        name: 'Groq (Meta Llama)',
        subModels: [
            "LLaMA3.1 8b",
            "LLaMA3.1 70b",
            "LLaMA3 8b",
            "LLaMA3 70b",
            "Mixtral 8x7b"
        ],
        apiKey: '',
        apiKeyUrl: 'https://console.groq.com/keys',
        endpoint: "https://api.groq.com/openai/v1/chat/completions"
    },
    openrouter: {
        name: 'OpenRouter',
        subModels: [
            "OpenAI o4-mini",
            "Claude 3.5 Sonnet",
            "LLaMA 3.1 70B",
            "Mistral Large",
            "Qwen2.5-72B"
        ],
        apiKey: '',
        apiKeyUrl: 'https://openrouter.ai/keys',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions'
    },
    mistral: {
        name: 'Mistral',
        subModels: [
            "Mistral Large",
            "Mistral Small",
            "Codestral"
        ],
        apiKey: '',
        apiKeyUrl: 'https://console.mistral.ai/api-keys/',
        endpoint: 'https://api.mistral.ai/v1/chat/completions'
    },
    deepseek: {
        name: 'DeepSeek',
        subModels: [
            "DeepSeek-Chat",
            "DeepSeek-Reasoner"
        ],
        apiKey: '',
        apiKeyUrl: 'https://platform.deepseek.com/api-keys',
        endpoint: 'https://api.deepseek.com/v1/chat/completions'
    }
};

async function loadSavedApiKeys() {
    console.log('🔑 저장된 API 키들 로드 및 마이그레이션 시작...');
    let loadedCount = 0;

    // 1. 새로운 safeStorage에서 모든 키를 먼저 로드합니다.
    const securelyLoadedKeys = await apiKeyManager.getAllApiKeys();
    for (const [provider, apiKey] of Object.entries(securelyLoadedKeys)) {
        if (aiModels[provider]) {
            aiModels[provider].apiKey = apiKey;
            loadedCount++;
        }
    }

    // 2. 이전 localStorage 방식의 키가 있는지 확인하고 마이그레이션합니다.
    for (const provider of Object.keys(aiModels)) {
        const oldKey = localStorage.getItem(`apiKey_${provider}`);
        if (oldKey) {
            console.log(`🔄 ${provider}: 이전 방식(localStorage) API 키 발견, 마이그레이션 시작...`);
            try {
                // 새로운 방식으로 저장
                const success = await apiKeyManager.saveApiKey(provider, oldKey);
                if (success) {
                    // 메모리에 반영
                    aiModels[provider].apiKey = oldKey;
                    // 기존 키 삭제
                    localStorage.removeItem(`apiKey_${provider}`);
                    console.log(`✅ ${provider}: API 키 마이그레이션 성공`);
                    if (!securelyLoadedKeys[provider]) { // 새로 추가된 경우 카운트
                        loadedCount++;
                    }
                } else {
                    throw new Error('apiKeyManager.saveApiKey가 false를 반환했습니다.');
                }
            } catch (error) {
                console.error(`❌ ${provider}: API 키 마이그레이션 실패`, error);
                // 마이그레이션 실패 시에도 일단 메모리에는 로드
                if (!aiModels[provider].apiKey) {
                    aiModels[provider].apiKey = oldKey;
                }
            }
        }
    }
    
    console.log(`🔑 API 키 로드 완료: ${loadedCount}/${Object.keys(aiModels).length}개 모델`);

    // --- 세션 기반 키 복원 로직 ---
    if (loadedCount > 0) {
        // 성공적으로 로드된 키를 세션 스토리지에 백업
        sessionStorage.setItem('apiKey_backup', JSON.stringify(aiModels));
        console.log('💾 현재 API 키 상태를 세션에 백업했습니다.');
    } else if (sessionStorage.getItem('apiKey_backup')) {
        console.warn('🤔 저장된 API 키를 찾을 수 없지만, 세션 백업이 존재합니다.');
        if (confirm('저장된 API 키를 찾을 수 없습니다.\n\n이전 세션에서 사용하던 API 키를 복원하시겠습니까?')) {
            const backupModels = JSON.parse(sessionStorage.getItem('apiKey_backup'));
            for (const provider of Object.keys(aiModels)) {
                if (backupModels[provider] && backupModels[provider].apiKey) {
                    aiModels[provider].apiKey = backupModels[provider].apiKey;
                }
            }
            console.log('✅ 세션 백업에서 API 키를 복원했습니다.');
            alert('이전 세션의 API 키가 복원되었습니다. 다시 저장하여 영구적으로 보관해주세요.');
        }
    }
}

// 디버깅/문제 해결을 위한 전역 함수
window.restoreApiKeysFromSession = function() {
    const backup = sessionStorage.getItem('apiKey_backup');
    if (backup) {
        const backupModels = JSON.parse(backup);
        for (const provider of Object.keys(aiModels)) {
            if (backupModels[provider] && backupModels[provider].apiKey) {
                aiModels[provider].apiKey = backupModels[provider].apiKey;
            }
        }
        console.log('✅ 수동으로 API 키를 세션 백업에서 복원했습니다.');
        alert('세션에서 API 키를 복원했습니다. 각 키를 다시 저장해주세요.');
    } else {
        console.log('ℹ️ 복원할 세션 백업이 없습니다.');
        alert('복원할 세션 백업 데이터가 없습니다.');
    }
};

export async function getApiKey(modelKey) {
    // For transcription services, we can alias them to the main model
    const key = modelKey === 'google_stt' ? 'gemini' : modelKey;
    
    // 새로운 apiKeyManager 사용
    const apiKey = await apiKeyManager.loadApiKey(key);
    
    console.log(`API Key for ${key} requested. Found: ${!!apiKey}`);
    return apiKey;
}

export async function saveApiKey(modelKey, apiKey) {
    if (aiModels[modelKey]) {
        // 새로운 apiKeyManager 사용, 결과를 그대로 반환
        return await apiKeyManager.saveApiKey(modelKey, apiKey);
    }
    return { success: false, error: '해당 모델을 찾을 수 없습니다.' };
}

// --- API Call Functions ---

async function callClaudeAPI(message, systemPrompt, modelData, subModel, imagesData = []) {
    if (!modelData.apiKey) throw new Error("API 키가 설정되지 않았습니다.");
    const modelMap = {
        "Claude 3.5 Sonnet": "claude-3-5-sonnet-20240620",
        "Claude 3.5 Haiku": "claude-3-5-haiku-20240725",
        "Claude 3 Opus": "claude-3-opus-20240229",
        "Claude 3 Sonnet": "claude-3-sonnet-20240229",
        "Claude 3 Haiku": "claude-3-haiku-20240307"
    };
    
    const messageContent = [];

    // 여러 이미지 데이터 추가
    if (imagesData && imagesData.length > 0) {
        imagesData.forEach(img => {
            const base64Data = img.dataUrl.split(',')[1];
            const mimeType = img.dataUrl.split(';')[0].split(':')[1];
            messageContent.push({
                type: "image",
                source: { type: "base64", media_type: mimeType, data: base64Data }
            });
        });
        console.log(`🖼️ Claude에 이미지 전송: ${imagesData.length}개`);
    }
    
    if (message) {
        messageContent.push({ type: "text", text: message });
    }
    
    const response = await fetch(modelData.endpoint, {
        method: 'POST',
        headers: {
            'x-api-key': modelData.apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            model: modelMap[subModel] || "claude-3-5-sonnet-20240620",
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: messageContent }]
        })
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({error:{message: response.statusText}}));
        throw new Error(err.error.message);
    }
    const result = await response.json();
    return result.content[0].text;
}

async function callGenericOpenAIAPI(message, systemPrompt, modelData, subModel, modelMap, imagesData = []) {
    if (!modelData.apiKey) throw new Error("API 키가 설정되지 않았습니다.");
    
    const userContent = [];

    // 여러 이미지 데이터 추가
    if (imagesData && imagesData.length > 0) {
        imagesData.forEach(img => {
            userContent.push({
                type: "image_url",
                image_url: { url: img.dataUrl }
            });
        });
        console.log(`🖼️ OpenAI 호환 API에 이미지 전송: ${imagesData.length}개`);
    }
    
    if (message) {
        userContent.push({ type: "text", text: message });
    }
    
    const response = await fetch(modelData.endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${modelData.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: modelMap[subModel],
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent.length > 0 ? userContent : message }
            ]
        })
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({error:{message: response.statusText}}));
        throw new Error(err.error.message);
    }
    const result = await response.json();
    return result.choices[0].message.content;
}

async function callOpenAIAPI(message, systemPrompt, modelData, subModel, imagesData = []) {
    const modelMap = {
        "ChatGPT-5": "gpt-4.1",
        "GPT-4.1": "gpt-4.1",
        "GPT-4o": "gpt-4o",
        "GPT-4o Mini": "gpt-4o-mini",
        "GPT-4 Turbo": "gpt-4-turbo",
        "GPT-4": "gpt-4",
        "o4-mini": "o4-mini",
        "o3-mini": "o3-mini",
        "o1": "o1",
        "o1-mini": "o1-mini",
        "GPT-3.5 Turbo": "gpt-3.5-turbo"
    };
    
    // 이미지 분석을 지원하는 모델들
    const visionModels = ["GPT-4o", "GPT-4o Mini", "GPT-4 Turbo"];
    
    // 이미지가 있는데 vision을 지원하지 않는 모델인 경우
    if (imagesData.length > 0 && !visionModels.includes(subModel)) {
        console.warn(`⚠️ ${subModel} 모델은 이미지 분석을 지원하지 않습니다.`);
        return `⚠️ 죄송합니다. ${subModel} 모델은 이미지 분석을 지원하지 않습니다.\n\n**이미지 분석 가능한 모델:**\n• GPT-4o\n• GPT-4o Mini\n• GPT-4 Turbo\n\n이미지 분석을 위해서는 위 모델 중 하나를 선택해주세요.`;
    }
    
    return callGenericOpenAIAPI(message, systemPrompt, modelData, subModel, modelMap, imagesData);
}

async function callGroqAPI(message, systemPrompt, modelData, subModel, imagesData = []) {
    const modelMap = {
        "LLaMA3.1 8b": "llama-3.1-8b-instruct",
        "LLaMA3.1 70b": "llama-3.1-70b-instruct",
        "LLaMA3 8b": "llama-3-8b",
        "LLaMA3 70b": "llama-3-70b",
        "Mixtral 8x7b": "mixtral-8x7b"
    };
    
    // Groq는 현재 이미지를 지원하지 않으므로 경고 메시지
    if (imagesData.length > 0) {
        console.warn('⚠️ Groq 모델은 현재 이미지 분석을 지원하지 않습니다.');
        return "⚠️ 죄송합니다. Groq 모델은 현재 이미지 분석을 지원하지 않습니다. 이미지 분석을 위해서는 Google Gemini, OpenAI GPT-4o, 또는 Claude를 사용해주세요.";
    }
    
    return callGenericOpenAIAPI(message, systemPrompt, modelData, subModel, modelMap, imagesData);
}

// OpenRouter (OpenAI 호환 스키마)
async function callOpenRouterAPI(message, systemPrompt, modelData, subModel, imagesData = []) {
    const modelMap = {
        "OpenAI o4-mini": "openai/o4-mini",
        "Claude 3.5 Sonnet": "anthropic/claude-3.5-sonnet",
        "LLaMA 3.1 70B": "meta-llama/llama-3.1-70b-instruct",
        "Mistral Large": "mistralai/mistral-large-latest",
        "Qwen2.5-72B": "qwen/qwen2.5-72b-instruct"
    };
    return callGenericOpenAIAPI(message, systemPrompt, modelData, subModel, modelMap, imagesData);
}

// Mistral (OpenAI 호환 스키마)
async function callMistralAPI(message, systemPrompt, modelData, subModel, imagesData = []) {
    const modelMap = {
        "Mistral Large": "mistral-large-latest",
        "Mistral Small": "mistral-small-latest",
        "Codestral": "codestral-latest"
    };
    return callGenericOpenAIAPI(message, systemPrompt, modelData, subModel, modelMap, imagesData);
}

// DeepSeek (OpenAI 호환 스키마, 이미지 미지원)
async function callDeepSeekAPI(message, systemPrompt, modelData, subModel, imagesData = []) {
    const modelMap = {
        "DeepSeek-Chat": "deepseek-chat",
        "DeepSeek-Reasoner": "deepseek-reasoner"
    };
    if (imagesData && imagesData.length > 0) {
        console.warn('⚠️ DeepSeek 모델은 현재 이미지 입력을 지원하지 않습니다.');
        return "⚠️ DeepSeek 모델은 이미지 입력을 지원하지 않습니다. 텍스트-only로 요청해주세요.";
    }
    return callGenericOpenAIAPI(message, systemPrompt, modelData, subModel, modelMap, []);
}

async function callGeminiAPI(message, systemPrompt, modelData, subModel, imagesData = []) {
    if (!modelData.apiKey) throw new Error("API 키가 설정되지 않았습니다.");
    const modelMap = {
        "Gemini 2.0 Flash": "gemini-1.5-flash-latest", // NOTE: API v1beta uses 'gemini-1.5-flash-latest', not 2.0
        "Gemini 1.5 Pro": "gemini-1.5-pro-latest",
        "Gemini 1.5 Flash": "gemini-1.5-flash-latest",
        "Gemini 1.0 Pro": "gemini-pro-vision"
    };

    const modelToUse = modelMap[subModel] || "gemini-1.5-flash-latest";
    const endpoint = `${modelData.endpoint}/${modelToUse}:generateContent?key=${modelData.apiKey}`;

    const userParts = [];
    if (message) {
        userParts.push({ text: message });
    }

    if (imagesData && imagesData.length > 0) {
        imagesData.forEach(img => {
            const base64Data = img.dataUrl.split(',')[1];
            const mimeType = img.dataUrl.split(';')[0].split(':')[1];
            userParts.push({
                inline_data: { mime_type: mimeType, data: base64Data }
            });
        });
        console.log(`🖼️ Gemini에 이미지 전송: ${imagesData.length}개`);
    }

    const requestBody = {
        contents: [{ role: 'user', parts: userParts }],
        generationConfig: {
            maxOutputTokens: 8192,
            temperature: 1,
            topP: 0.95,
        }
    };

    // Gemini API는 systemInstruction을 별도로 전달합니다.
    if (systemPrompt) {
        requestBody.system_instruction = {
            parts: [{ text: systemPrompt }]
        };
    }

    console.log(`🔍 Gemini API 호출:`, {
        url: endpoint.replace(modelData.apiKey, '***'),
        modelName: modelToUse
    });

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('❌ Gemini API 응답 오류:', errText);
            let errJson;
            try {
                errJson = JSON.parse(errText);
            } catch (e) {
                throw new Error(`[${response.status}] ${response.statusText}`);
            }
            throw new Error(errJson.error.message);
        }

        const result = await response.json();
        
        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content) {
            return result.candidates[0].content.parts[0].text;
        } else {
            // "finishReason": "SAFETY" 등으로 인해 후보가 없는 경우
            console.warn('⚠️ Gemini API에서 유효한 응답을 받지 못했습니다.', result);
            return '죄송합니다. AI로부터 유효한 응답을 받지 못했습니다. 안전 설정에 의해 답변이 차단되었을 수 있습니다.';
        }

    } catch (error) {
        console.error('❌ Gemini API 호출 실패:', error);
        throw error;
    }
}

/**
 * AI 모델을 호출하는 메인 함수
 * @param {string} modelKey - 'claude', 'gpt', 'gemini', 'groq'
 * @param {string} subModel - 세부 모델 이름
 * @param {string} systemPrompt - 시스템 프롬프트
 * @param {string} userMessage - 사용자 메시지
 * @param {Array<object>} [imagesData=[]] - 전송할 이미지 데이터 배열
 * @returns {Promise<string>} AI 응답 텍스트
 */
export async function callAI(modelKey, subModel, systemPrompt, userMessage, imagesData = []) {
    console.log(`🤖 AI 호출: ${modelKey} - ${subModel}`, {
        messageLength: userMessage.length,
        imageCount: imagesData.length
    });
    
    if (imagesData.length > 0) {
        console.log(`   - 이미지 파일들:`, imagesData.map(img => `${img.name} (${(img.size/1024).toFixed(1)} KB)`).join(', '));
    }
    
    const modelData = aiModels[modelKey];
    if (!modelData) {
        throw new Error("알 수 없는 AI 모델 키입니다.");
    }
    if (!modelData.apiKey) {
        const apiKey = await getApiKey(modelKey);
        if (!apiKey) {
        throw new Error(`${modelData.name} API 키가 설정되지 않았습니다. 설정 메뉴에서 API 키를 입력해주세요.`);
        }
        modelData.apiKey = apiKey;
    }

    try {
        switch (modelKey) {
            case 'claude':
                return await callClaudeAPI(userMessage, systemPrompt, modelData, subModel, imagesData);
            case 'gpt':
                return await callOpenAIAPI(userMessage, systemPrompt, modelData, subModel, imagesData);
            case 'gemini':
                return await callGeminiAPI(userMessage, systemPrompt, modelData, subModel, imagesData);
            case 'groq':
                return await callGroqAPI(userMessage, systemPrompt, modelData, subModel, imagesData);
            case 'openrouter':
                return await callOpenRouterAPI(userMessage, systemPrompt, modelData, subModel, imagesData);
            case 'mistral':
                return await callMistralAPI(userMessage, systemPrompt, modelData, subModel, imagesData);
            case 'deepseek':
                return await callDeepSeekAPI(userMessage, systemPrompt, modelData, subModel, imagesData);
            default:
                throw new Error("지원하지 않는 AI 모델입니다.");
        }
    } catch (error) {
        console.error(`❌ ${modelData.name} API 호출 오류:`, error);
        throw new Error(`${modelData.name} API 호출 중 오류가 발생했습니다: ${error.message}`);
    }
}

// callAI를 전역으로 노출
window.callAI = callAI;

// --- Google Auth ---
let gapiInited = false;
let gisInited = false;
let tokenClient;

export function initializeGis(clientId) {
    if (!clientId) {
        console.error("Google Client ID가 없습니다.");
        return;
    }
    
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/devstorage.read_write',
        callback: '', // Immediate response, no need for a callback here
    });
    gisInited = true;
}

export function initializeGapiClient() {
    gapi.client.init({})
        .then(() => {
            gapiInited = true;
        });
}

export function handleGisAuthClick() {
    return new Promise((resolve, reject) => {
        // Wait for GIS to be initialized.
        const interval = setInterval(() => {
            if (gisInited) {
                clearInterval(interval);

                tokenClient.callback = (resp) => {
                    if (resp.error !== undefined) {
                        reject(resp);
                    }
                    console.log("GIS Auth successful:", resp);
                    resolve(resp);
                };

                if (gapi.client.getToken() === null) {
                    tokenClient.requestAccessToken({prompt: 'consent'});
                } else {
                    tokenClient.requestAccessToken({prompt: ''});
                }
            }
        }, 100);
    });
}

// 디버깅용 전역 함수들
window.testApiKey = async function(provider, apiKey) {
    console.log(`🔑 ${provider} API 키 테스트 시작...`);
    
    if (!apiKey) {
        // 저장된 키 사용 (비동기)
        apiKey = await apiKeyManager.loadApiKey(provider);
        if (!apiKey) {
            console.error('❌ 저장된 API 키가 없습니다');
            return false;
        }
    }
    
    // 메모리에 임시 설정
    if (aiModels[provider]) {
        aiModels[provider].apiKey = apiKey;
    }
    
    try {
        // 간단한 테스트 호출
        const result = await callAI(provider, aiModels[provider].subModels[0], 
            "테스트용 시스템 프롬프트", 
            "안녕하세요. API 연결 테스트입니다. 간단히 응답해주세요.");
        
        console.log('✅ API 테스트 성공:', result.substring(0, 100) + '...');
        return true;
    } catch (error) {
        console.error('❌ API 테스트 실패:', error.message);
        return false;
    }
};

window.debugApiKeys = async function() {
    console.log('🔍 저장된 API 키 상태:');
    for (const provider of Object.keys(aiModels)) {
        const savedKey = await apiKeyManager.loadApiKey(provider);
        const memoryKey = aiModels[provider].apiKey;
        
        console.log(`${provider}:`, {
            saved: !!savedKey,
            savedLength: savedKey ? savedKey.length : 0,
            memory: !!memoryKey,
            memoryLength: memoryKey ? memoryKey.length : 0,
            match: savedKey === memoryKey
        });
    }
};

window.clearApiKey = async function(provider) {
    if (await apiKeyManager.deleteApiKey(provider)) {
        console.log(`✅ ${provider} API 키 삭제됨`);
    } else {
        console.error(`❌ ${provider} API 키 삭제 실패`);
    }
};

// 전체 초기화
export async function initializeApiManagement() {
    await apiKeyManager.initialize();
    
    // GAPI client - gapi가 정의되어 있을 때만 실행
    if (typeof gapi !== 'undefined' && gapi.load) {
        gapi.load('client', async () => {
            await gapi.client.init({});
            gapiInited = true;
        });
    } else {
        console.log('🔍 GAPI 라이브러리가 아직 로드되지 않았습니다. Google STT 기능은 나중에 초기화됩니다.');
    }
}

// 각 AI 모델의 실제 연결 및 고유 특성 테스트
export async function testAIConnection(modelKey, subModel) {
    const modelData = aiModels[modelKey];
    if (!modelData || !modelData.apiKey) {
        return `❌ ${modelData?.name || modelKey} API 키가 설정되지 않았습니다.`;
    }

    try {
        console.log(`🔬 ${modelData.name} 연결 테스트 시작...`);
        
        // 각 AI의 고유한 특성을 확인하는 테스트 질문
        const testPrompt = getAISpecificTestPrompt(modelKey, subModel);
        const testMessage = "이 테스트는 당신이 실제로 연결되어 있는지 확인하는 것입니다. 당신의 고유한 특성을 보여주세요.";
        
        const startTime = Date.now();
        const response = await callAI(modelKey, subModel, testPrompt, testMessage);
        const responseTime = Date.now() - startTime;
        
        return `✅ **${modelData.name} ${subModel} 연결 성공!**
        
**응답 시간:** ${responseTime}ms
**실제 응답:**
${response}

---
🔍 **이 응답이 해당 AI의 실제 특성을 보여줍니다.**`;
        
    } catch (error) {
        console.error(`❌ ${modelData.name} 연결 테스트 실패:`, error);
        return `❌ **${modelData.name} 연결 실패**
        
**오류:** ${error.message}
        
**가능한 원인:**
- API 키가 유효하지 않음
- API 서비스 일시 중단
- 네트워크 연결 문제`;
    }
}

function getAISpecificTestPrompt(modelKey, subModel) {
    switch(modelKey) {
        case 'gemini':
            return `당신은 Google Gemini ${subModel}입니다. 
            다음 특성들을 보여주세요:
            1. 자신이 Google에서 개발된 Gemini임을 명확히 밝히세요
            2. 멀티모달 능력에 대해 언급하세요
            3. Google의 AI 철학을 간단히 설명하세요
            4. 절대로 OpenAI나 다른 회사 모델이라고 말하지 마세요`;
            
        case 'claude':
            return `당신은 Anthropic Claude ${subModel}입니다.
            다음 특성들을 보여주세요:
            1. 자신이 Anthropic에서 개발된 Claude임을 명확히 밝히세요
            2. Constitutional AI에 대해 간단히 설명하세요
            3. 안전성과 도움됨의 균형에 대해 언급하세요
            4. 절대로 OpenAI나 Google 모델이라고 말하지 마세요`;
            
        case 'gpt':
            return `당신은 OpenAI ${subModel}입니다.
            다음 특성들을 보여주세요:
            1. 자신이 OpenAI에서 개발된 GPT임을 명확히 밝히세요
            2. 트랜스포머 아키텍처에 대해 간단히 언급하세요
            3. ChatGPT와의 관계를 설명하세요
            4. 절대로 Anthropic이나 Google 모델이라고 말하지 마세요`;
            
        case 'groq':
            return `당신은 ${subModel}입니다 (Groq 플랫폼).
            다음 특성들을 보여주세요:
            1. 자신이 ${subModel}임을 명확히 밝히세요
            2. Groq의 초고속 추론에 대해 언급하세요
            3. 오픈소스 모델의 장점을 설명하세요
            4. 절대로 OpenAI나 Google 모델이라고 말하지 마세요`;
            
        default:
            return `당신의 실제 정체성과 고유한 특성을 보여주세요.`;
    }
}

// 모든 AI 모델 연결 상태를 한번에 테스트
export async function testAllAIConnections() {
    const results = {};
    
    for (const [modelKey, modelData] of Object.entries(aiModels)) {
        if (!modelData.apiKey) {
            results[modelKey] = `⚠️ API 키 없음`;
            continue;
        }
        
        // 각 모델의 첫 번째 서브모델로 테스트
        const subModel = modelData.subModels[0];
        
        try {
            const testResult = await testAIConnection(modelKey, subModel);
            results[modelKey] = testResult;
        } catch (error) {
            results[modelKey] = `❌ 오류: ${error.message}`;
        }
    }
    
    return results;
}

// 디버깅 및 복구용 전역 함수들
window.apiDebug = {
    // 모든 API 키 상태 확인
    checkAll: async function() {
        console.log('=== API 키 상태 확인 ===');
        
        // 메모리상의 API 키
        console.log('📝 메모리 상태:');
        for (const [provider, model] of Object.entries(aiModels)) {
            console.log(`${provider}: ${model.apiKey ? '✅ 있음' : '❌ 없음'} (길이: ${model.apiKey?.length || 0})`);
        }
        
        // localStorage 상태
        console.log('\n📦 localStorage 상태:');
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('apiKey_') || key === 'encryptedApiKeys') {
                const value = localStorage.getItem(key);
                console.log(`${key}: ${value ? value.substring(0, 30) + '...' : 'null'}`);
            }
        }
        
        return '완료';
    },
    
    // 특정 프로바이더의 API 키 복구
    restore: async function(provider, apiKey) {
        if (!provider || !apiKey) {
            console.error('사용법: apiDebug.restore("provider", "your-api-key")');
            console.log('예시: apiDebug.restore("gemini", "AIza...")');
            return false;
        }
        
        try {
            // 메모리에 직접 설정
            if (aiModels[provider]) {
                aiModels[provider].apiKey = apiKey;
                console.log(`✅ ${provider} API 키 메모리 설정 완료`);
                
                // 영구 저장 (비동기)
                await apiKeyManager.saveApiKey(provider, apiKey);
                console.log(`✅ ${provider} API 키 저장 완료`);
                
                return true;
            } else {
                console.error(`❌ 알 수 없는 프로바이더: ${provider}`);
                console.log('사용 가능한 프로바이더:', Object.keys(aiModels));
                return false;
            }
        } catch (error) {
            console.error('❌ API 키 복구 실패:', error);
            return false;
        }
    },
    
    // 모든 암호화된 데이터 제거 및 재설정
    reset: async function() {
        if (!confirm('⚠️ 모든 저장된 API 키가 삭제됩니다. 계속하시겠습니까?')) {
            return '취소됨';
        }
        
        // 모든 관련 localStorage 항목 제거
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('apiKey_') || key === 'encryptedApiKeys' || key === 'encryptionKey') {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log(`🗑️ 제거됨: ${key}`);
        });
        
        // 메모리 초기화
        for (const provider of Object.keys(aiModels)) {
            aiModels[provider].apiKey = '';
        }
        
        console.log('✅ 모든 API 키가 초기화되었습니다. 페이지를 새로고침해주세요.');
        return '완료';
    },
    
    // API 연결 테스트
    test: async function(provider) {
        if (!provider) {
            console.log('사용법: apiDebug.test("provider")');
            console.log('예시: apiDebug.test("gemini")');
            console.log('사용 가능한 프로바이더:', Object.keys(aiModels));
            return;
        }
        
        console.log(`🔍 ${provider} API 테스트 시작...`);
        
        try {
            const result = await testApiKey(provider);
            console.log(`✅ ${provider} API 테스트 성공!`);
            return result;
        } catch (error) {
            console.error(`❌ ${provider} API 테스트 실패:`, error);
            return false;
        }
    },
    
    // 도움말
    help: function() {
        console.log(`
🛠️ API 디버깅 도구 사용법:

1. apiDebug.checkAll()
   - 모든 API 키 상태 확인

2. apiDebug.restore("provider", "api-key")
   - 특정 프로바이더의 API 키 복구
   - 예: apiDebug.restore("gemini", "AIza...")

3. apiDebug.test("provider")
   - API 연결 테스트
   - 예: apiDebug.test("gemini")

4. apiDebug.reset()
   - 모든 저장된 API 키 제거 (주의!)

5. apiDebug.help()
   - 이 도움말 표시

사용 가능한 프로바이더: ${Object.keys(aiModels).join(', ')}
        `);
    }
};

// 시작시 자동으로 도움말 표시
console.log('💡 API 디버깅 도구가 로드되었습니다. apiDebug.help()를 입력하여 사용법을 확인하세요.');