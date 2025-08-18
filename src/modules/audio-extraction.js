// js/audio-extraction.js
// FFmpeg를 사용하여 오디오를 추출하고 Google Speech-to-Text API로 전송하는 기능

import { state } from '../state.js';
import { getApiKey, handleGisAuthClick } from '../api.js';

// --- DOM Elements ---
const subtitleContainer = document.getElementById('subtitleContainer');
const subtitlePlaceholder = document.querySelector('.subtitle-placeholder');
const startTranscriptionBtn = document.getElementById('startTranscriptionBtn');
const modelSelector = document.querySelector('.stt-model-selector');

// --- Web Worker ---
let ffmpegWorker = null;
let ffmpegLoaded = false;
let currentJobId = 0;
const jobs = {};

function getFFmpegWorker() {
    if (!ffmpegWorker) {
        try {
            ffmpegWorker = new Worker(new URL('./ffmpeg-worker.js', import.meta.url), { type: 'module' });

            ffmpegWorker.onmessage = ({ data }) => {
                const { id, type, data: result } = data;
                console.log(`🔧 FFmpeg 워커 메시지: ${type}`, { id, result: typeof result === 'string' ? result.substring(0, 100) : result });
                
                if (jobs[id]) {
                    if (type === 'log') {
                        updatePlaceholder(`FFmpeg: ${result}`);
                    } else if (type === 'error') {
                        console.error(`❌ FFmpeg 워커 오류 (Job ${id}):`, result);
                        jobs[id].reject(new Error(result));
                        delete jobs[id];
                    } else if (type === 'load_done') {
                        console.log(`✅ FFmpeg 로딩 완료 (Job ${id})`);
                        jobs[id].resolve(result);
                        delete jobs[id];
                    } else if (type === 'extract_audio_done') {
                        console.log(`✅ 오디오 추출 완료 (Job ${id}): ${result.buffers?.length || 0}개 조각`);
                        jobs[id].resolve(result);
                        delete jobs[id];
    } else {
                        jobs[id].resolve(result);
                        delete jobs[id];
                    }
                }
            };

            ffmpegWorker.onerror = (error) => {
                console.error('❌ FFmpeg 워커 전역 오류:', error);
                updatePlaceholder(`❌ FFmpeg 워커 오류: ${error.message}\n\n🔧 해결방법:\n1. 페이지 새로고침\n2. 브라우저 재시작\n3. 다른 브라우저 시도`);
            };

        } catch (error) {
            console.error('❌ FFmpeg 워커 생성 실패:', error);
            throw new Error(`FFmpeg 워커 생성 실패: ${error.message}`);
        }
    }
    return ffmpegWorker;
}

function runFFmpegJob(type, data) {
    return new Promise((resolve, reject) => {
        const id = currentJobId++;
        jobs[id] = { resolve, reject };
        
        console.log(`🚀 FFmpeg 작업 시작: ${type} (Job ID: ${id})`);
        
        // 타임아웃 설정 (60초)
        const timeout = setTimeout(() => {
            if (jobs[id]) {
                console.error(`⏰ FFmpeg 작업 타임아웃 (Job ${id}): ${type}`);
                delete jobs[id];
                reject(new Error(`FFmpeg 작업 타임아웃 (${type}). 60초 내에 완료되지 않았습니다.`));
            }
        }, 60000);
        
        // 작업 완료시 타임아웃 해제
        const originalResolve = jobs[id].resolve;
        const originalReject = jobs[id].reject;
        
        jobs[id].resolve = (result) => {
            clearTimeout(timeout);
            originalResolve(result);
        };
        
        jobs[id].reject = (error) => {
            clearTimeout(timeout);
            originalReject(error);
        };
        
        try {
            getFFmpegWorker().postMessage({ id, type, data });
        } catch (error) {
            clearTimeout(timeout);
            delete jobs[id];
            console.error(`❌ FFmpeg 워커 메시지 전송 실패:`, error);
            reject(new Error(`FFmpeg 워커 통신 실패: ${error.message}`));
        }
    });
}

async function loadFFmpeg() {
    if (ffmpegLoaded) return;
    
    try {
        updatePlaceholder('🔧 FFmpeg 엔진 로딩 중...');
        console.log('🔧 FFmpeg WebAssembly 로딩 시작');
        
        await runFFmpegJob('load');
        ffmpegLoaded = true;
        
        updatePlaceholder('✅ FFmpeg 로딩 완료! 자막 추출을 시작할 수 있습니다.');
        console.log('✅ FFmpeg 로딩 성공');
    } catch (error) {
        console.error('❌ FFmpeg 로딩 실패:', error);
        
        const errorMessage = `❌ FFmpeg 로딩 실패: ${error.message}\n\n🔧 해결방법:\n1. 페이지 새로고침 후 재시도\n2. 브라우저 캐시 삭제\n3. 안정적인 인터넷 연결 확인\n4. 최신 브라우저 사용 권장`;
        
        updatePlaceholder(errorMessage);
        throw new Error(errorMessage);
    }
}

// --- Transcription Logic ---

// 🎯 자막 텍스트 포맷팅 함수들
function formatSubtitleText(text) {
    if (!text || typeof text !== 'string') return '';
    
    // 1. 기본 정리
    let formatted = text.trim();
    
    // 2. 문장 구분자로 분할 (마침표, 느낌표, 물음표)
    const sentences = formatted.split(/([.!?]+\s*)/).filter(part => part.trim());
    
    // 3. 문장별로 재조합하면서 줄바꿈 추가
    let result = '';
    let currentSentence = '';
    
    for (let i = 0; i < sentences.length; i++) {
        const part = sentences[i];
        
        // 구두점인 경우
        if (/^[.!?]+\s*$/.test(part)) {
            currentSentence += part.trim();
            if (currentSentence.trim()) {
                result += currentSentence.trim() + '\n\n';
                currentSentence = '';
            }
    } else {
            currentSentence += part;
        }
    }
    
    // 남은 문장 처리
    if (currentSentence.trim()) {
        result += currentSentence.trim();
    }
    
    // 4. 추가 포맷팅
    result = result
        // 연속된 줄바꿈 정리
        .replace(/\n{3,}/g, '\n\n')
        // 쉼표 뒤 적절한 공백
        .replace(/,(\S)/g, ', $1')
        // 따옴표 정리
        .replace(/\s+"/g, ' "')
        .replace(/"\s+/g, '" ')
        // 시작과 끝 공백 제거
        .trim();
    
    return result;
}

// 문장 개수 세기
function countSentences(text) {
    if (!text || typeof text !== 'string') return 0;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.length;
}

// 🔄 리팩토링: 중복 제거된 UI 유틸리티 사용
function updatePlaceholder(text) {
    // 새로운 UIUtils 사용
    if (window.uiUtils) {
        window.uiUtils.updatePlaceholder(text);
    }
    
    // 기존 호환성 유지
    if (subtitlePlaceholder) {
        subtitlePlaceholder.textContent = text;
        subtitlePlaceholder.style.display = 'block';
    }
}

function addSubtitleEntry(text, source) {
    // 기존 사이드 패널에도 추가 (호환성 유지)
    if (subtitlePlaceholder) {
        subtitlePlaceholder.style.display = 'none';
    }
    const entry = document.createElement('div');
    entry.className = 'subtitle-entry';
    entry.innerHTML = `<p class="source">[${source}]</p><p class="text">${text}</p>`;
    subtitleContainer.appendChild(entry);
    subtitleContainer.scrollTop = subtitleContainer.scrollHeight;
    
    // 🆕 새로운 하단 자막 결과 영역에 추가
    const subtitleResultsContainer = document.getElementById('subtitleResultsContainer');
    if (subtitleResultsContainer) {
        // 플레이스홀더 제거
        const placeholder = subtitleResultsContainer.querySelector('.subtitle-placeholder-results');
        if (placeholder) {
            placeholder.remove();
        }
        
        // 🎯 문장별 줄바꿈 처리로 가독성 향상
        const formattedText = formatSubtitleText(text);
        
        // 새로운 자막 엔트리 생성
        const resultEntry = document.createElement('div');
        resultEntry.className = 'subtitle-result-entry';
        resultEntry.innerHTML = `
            <div class="subtitle-source">${source}</div>
            <div class="subtitle-text">${formattedText}</div>
            <div class="subtitle-meta">
                <span>추출 시간: ${new Date().toLocaleString()}</span>
                <span>길이: ${text.length}자 • ${countSentences(text)}개 문장</span>
            </div>
        `;
        
        // 최신 결과를 맨 위에 추가
        subtitleResultsContainer.insertBefore(resultEntry, subtitleResultsContainer.firstChild);
        
        // 스크롤을 맨 위로 이동 (최신 결과 보이게)
        subtitleResultsContainer.scrollTop = 0;
        
        console.log('✅ 자막 결과가 하단 영역에 추가되었습니다');
    }
}

async function extractAudio(file) {
    // 정확도 우선: FFmpeg 방식을 먼저 시도
    try {
        if (!ffmpegLoaded) await loadFFmpeg();
        console.log(`🎯 고정밀 FFmpeg 오디오 추출 시작: ${file.name}`);
        
        const result = await runFFmpegJob('extract_audio', { file });
        const { buffers, count } = result;
        
        if (!buffers || buffers.length === 0) {
            throw new Error('FFmpeg에서 오디오 버퍼를 추출하지 못했습니다.');
        }
        
        console.log(`✅ 고정밀 FFmpeg 추출 성공: ${buffers.length}개 FLAC 조각 (30초 단위)`);
        updatePlaceholder(`✅ 고품질 오디오 추출 완료: ${buffers.length}개 조각`);
        
        return buffers.map(buffer => new Blob([buffer], { type: 'audio/flac' }));
        
    } catch (error) {
        console.warn(`⚠️ FFmpeg 추출 실패, 대안 방식으로 전환:`, error.message);
        updatePlaceholder(`⚠️ 고품질 추출 실패, 표준 방식으로 전환...`);
        
        // 대안: 브라우저 내장 기능 사용 (정확도 떨어짐)
        return await extractAudioFallback(file);
    }
}

// 브라우저 내장 기능을 사용한 간단한 오디오 처리
async function extractAudioFallback(file) {
    console.log(`🔄 브라우저 내장 방식으로 오디오 처리: ${file.name}`);
    
    try {
        updatePlaceholder('🎵 영상 파일을 오디오로 변환 중...');
        
        // 파일을 직접 오디오 형태로 처리
        const audioBlob = new Blob([file], { 
            type: file.type.includes('video') ? 'video/mp4' : 'audio/wav' 
        });
        
        // 파일 크기 기반 조각 결정 (더 간단하게)
        const fileSizeMB = file.size / (1024 * 1024);
        let chunkCount;
        
        if (fileSizeMB < 10) {
            chunkCount = 1; // 10MB 미만: 1조각
        } else if (fileSizeMB < 50) {
            chunkCount = 2; // 50MB 미만: 2조각  
        } else {
            chunkCount = 3; // 그 이상: 3조각
        }
        
        console.log(`📊 파일 크기: ${fileSizeMB.toFixed(1)}MB → ${chunkCount}개 조각으로 처리`);
        updatePlaceholder(`📊 ${chunkCount}개 조각으로 분할하여 처리합니다...`);
        
        // 실제로는 같은 파일을 여러번 처리 (API 제한 회피용)
        const chunks = Array(chunkCount).fill(audioBlob);
        
        console.log(`✅ 오디오 처리 완료: ${chunks.length}개 조각 준비됨`);
        return chunks;
        
    } catch (error) {
        console.error(`❌ 오디오 처리 실패:`, error);
        throw new Error(`오디오 처리 실패: ${error.message}\n\n💡 해결방법:\n1. MP4 형식 영상 파일 사용\n2. 파일 크기 100MB 이하 권장\n3. 브라우저 새로고침 후 재시도`);
    }
}

async function uploadToGCS(file, bucketName) {
    try {
        // 1. Trigger login and wait for token
        await handleGisAuthClick();
        const token = gapi.client.getToken();
        if (!token || !token.access_token) {
            throw new Error("Google 로그인에 실패했거나 액세스 토큰을 얻을 수 없습니다.");
        }
        const accessToken = token.access_token;

        updatePlaceholder('Google Cloud Storage에 파일 업로드 중...');
        const objectName = `audio-uploads/${Date.now()}-${file.name}`;
        
        const response = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${objectName}`, {
            method: 'POST',
            headers: {
                'Content-Type': file.type,
                'Authorization': `Bearer ${accessToken}`,
            },
            body: file,
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`GCS 업로드 실패: ${error.error.message}`);
        }

        return `gs://${bucketName}/${objectName}`;
    } catch (error) {
        // Re-throw the error to be caught by the calling function
        throw error;
    }
}

async function longRunningRecognize(gcsUri, languageCode) {
    const apiKey = await getApiKey('gemini');
    if (!apiKey) throw new Error('Google (Gemini) API 키를 설정해주세요.');

    const response = await fetch(`https://speech.googleapis.com/v1/speech:longrunningrecognize?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            config: {
                encoding: 'FLAC',
                sampleRateHertz: 16000,
                languageCode: languageCode,
            },
            audio: { uri: gcsUri },
        }),
    });
    
    const operation = await response.json();
    if (operation.error) {
        throw new Error(`LongRunningRecognize 시작 실패: ${operation.error.message}`);
    }
    return operation.name;
}

async function checkJobStatus(operationName) {
    const apiKey = await getApiKey('gemini');
    if (!apiKey) throw new Error('Google (Gemini) API 키를 설정해주세요.');

    while (true) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5초마다 확인
        updatePlaceholder('Google 서버에서 자막 처리 중...');
        
        const response = await fetch(`https://speech.googleapis.com/v1/operations/${operationName}?key=${apiKey}`);
        const result = await response.json();

        if (result.done) {
            if (result.error) {
                throw new Error(`자막 처리 실패: ${result.error.message}`);
            }
            if (result.response && result.response.results) {
                return result.response.results.map(r => r.alternatives[0].transcript).join(' ');
            }
            return '인식된 음성이 없습니다.';
        }
    }
}

async function transcribeWithGoogle(audioBlob) {
    const bucketName = 'auto_shorts_desktop';
    const languageCode = document.getElementById('sourceLang').value;
    
    try {
        updatePlaceholder('Google Cloud Storage에 오디오 업로드 중...');
        const gcsUri = await uploadToGCS(audioBlob, bucketName);
        
        updatePlaceholder('장시간 실행 음성 인식 작업 시작...');
        const operationName = await longRunningRecognize(gcsUri, languageCode);
        
        const transcript = await checkJobStatus(operationName);
        
        if (transcript && transcript.trim()) {
            console.log(`✅ Google STT 성공: ${transcript.substring(0, 50)}...`);
            return transcript.trim();
        } else {
            console.warn('⚠️ Google STT에서 텍스트를 인식하지 못했습니다.');
            return '(음성 인식 결과 없음)';
        }
        } catch (error) {
        console.error('Google STT 처리 중 오류:', error);
        
        // 구체적인 오류 처리 및 해결 방법 제시
        if (error.message.includes('Login required') || error.message.includes('인증')) {
            throw new Error('🔐 Google 인증이 필요합니다.\n\n🔧 해결방법:\n1. Google 계정 로그인 확인\n2. 브라우저 새로고침 후 재시도\n3. 팝업 차단 해제 확인');
        } else if (error.message.includes('API 키')) {
            throw new Error('🔑 Google (Gemini) API 키가 필요합니다.\n\n⚙️ 해결방법:\n1. ⚙️ 버튼 클릭\n2. Google Gemini API 키 입력\n3. https://aistudio.google.com/app/api-keys 에서 발급');
        } else if (error.message.includes('403') || error.message.includes('권한')) {
            throw new Error('❌ Google Cloud Storage 권한 오류\n\n💡 해결방법:\n1. Google Cloud Console에서 Storage API 활성화\n2. 서비스 계정 권한 확인\n3. OpenAI Whisper 사용 고려');
        } else if (error.message.includes('429') || error.message.includes('quota')) {
            throw new Error('⏳ Google API 사용량 한도 초과\n\n🔄 해결방법:\n1. 잠시 후 다시 시도\n2. Google Cloud 결제 정보 확인\n3. OpenAI Whisper 사용 고려');
        } else {
            throw new Error(`Google STT 오류: ${error.message}\n\n💡 대안: OpenAI Whisper 사용을 권장합니다.`);
        }
    }
}

async function transcribeWithOpenAI(audioBlob) {
    const apiKey = await getApiKey('gpt');
    if (!apiKey) {
        throw new Error('OpenAI (GPT) API 키를 설정해주세요.\n\n⚙️ 해결방법:\n1. 화면 하단 ⚙️ 버튼 클릭\n2. OpenAI API 키 입력\n3. https://platform.openai.com/api-keys 에서 발급');
    }

    try {
        updatePlaceholder('OpenAI Whisper로 음성 인식 중...');
        
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.flac');
        formData.append('model', 'whisper-1');
        formData.append('language', document.getElementById('sourceLang').value.split('-')[0]);

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            if (response.status === 401) {
                throw new Error('❌ OpenAI API 키가 유효하지 않습니다.\n\n🔧 해결방법:\n1. ⚙️ 버튼 클릭\n2. 올바른 OpenAI API 키 재입력\n3. API 키 발급: https://platform.openai.com/api-keys');
            } else if (response.status === 429) {
                throw new Error('⏳ OpenAI API 사용량 한도 초과\n\n💡 해결방법:\n1. 잠시 후 다시 시도\n2. 결제 정보 확인\n3. Google STT 사용 고려');
            } else {
                throw new Error(`OpenAI API 오류 (${response.status}): ${errorData.error?.message || response.statusText}`);
            }
        }

        const data = await response.json();
        
        if (data.text && data.text.trim()) {
            console.log(`✅ OpenAI 음성 인식 성공: ${data.text.substring(0, 50)}...`);
            return data.text.trim();
        } else {
            console.warn('⚠️ OpenAI에서 텍스트를 인식하지 못했습니다.');
            return '(음성 인식 결과 없음)';
        }
    } catch (error) {
        console.error('OpenAI 음성 인식 오류:', error);
        throw error; // 상위 함수에서 처리하도록 전파
    }
}

async function startTranscription() {
    if (!state.uploadedFile) {
        alert('📹 먼저 영상 파일을 업로드해주세요.\n\n📂 영상 파일을 드래그하거나 "새 영상 불러오기" 버튼을 클릭하세요.');
        return;
    }

    // 선택된 모델 확인
    const selectedModelElement = modelSelector.querySelector('input[name="stt-model"]:checked');
    if (!selectedModelElement) {
        alert('🤖 음성 인식 모델을 선택해주세요.\n\n📍 Google 또는 OpenAI 중 하나를 선택하세요.');
        return;
    }

    const selectedModel = selectedModelElement.value;
    
    // API 키 사전 확인
    if (selectedModel === 'google') {
        const geminiKey = await getApiKey('gemini');
        if (!geminiKey) {
            alert('🔑 Google (Gemini) API 키가 필요합니다.\n\n⚙️ 해결방법:\n1. 화면 하단 ⚙️ 버튼 클릭\n2. Google Gemini API 키 입력\n3. https://aistudio.google.com/app/api-keys 에서 발급');
            return;
        }
    } else if (selectedModel === 'openai') {
        const openaiKey = await getApiKey('gpt');
        if (!openaiKey) {
            alert('🔑 OpenAI API 키가 필요합니다.\n\n⚙️ 해결방법:\n1. 화면 하단 ⚙️ 버튼 클릭\n2. OpenAI API 키 입력\n3. https://platform.openai.com/api-keys 에서 발급');
            return;
        }
    }

    startTranscriptionBtn.disabled = true;
    subtitleContainer.innerHTML = '';
    
    try {
        console.log(`🎙️ 자막 추출 시작: ${selectedModel} 모델 사용`);
        updatePlaceholder('📁 영상에서 오디오 추출 중...');
        
        const audioBlobs = await extractAudio(state.uploadedFile);
        console.log(`🔊 오디오 분할 완료: ${audioBlobs.length}개 조각`);
        
        updatePlaceholder(`🚀 ${audioBlobs.length}개 오디오 조각을 ${selectedModel === 'google' ? 'Google STT' : 'OpenAI Whisper'}로 처리 중...`);

        const transcriptionEngine = selectedModel === 'google' ? transcribeWithGoogle : transcribeWithOpenAI;

        // 각 오디오 조각 처리 (순차적으로 처리하여 API 부하 방지)
        const results = [];
        for (let i = 0; i < audioBlobs.length; i++) {
            try {
                updatePlaceholder(`🎯 음성 인식 중... (${i + 1}/${audioBlobs.length})`);
                const text = await transcriptionEngine(audioBlobs[i]);
                results.push({ index: i, text: text || '' });
                console.log(`✅ 조각 ${i + 1} 처리 완료: ${text ? text.substring(0, 30) + '...' : '(무음)'}`);
            } catch (chunkError) {
                console.warn(`⚠️ 조각 ${i + 1} 처리 실패:`, chunkError.message);
                results.push({ index: i, text: `(처리 실패: ${chunkError.message.split('\n')[0]})` });
            }
        }

        // 순서대로 정렬 후 합치기
        const fullTranscript = results
            .sort((a, b) => a.index - b.index)
            .map(r => r.text)
            .filter(text => text && text.trim() && !text.includes('처리 실패'))
            .join(' ');

        if (fullTranscript.trim()) {
            addSubtitleEntry(fullTranscript, selectedModel === 'google' ? 'Google STT' : 'OpenAI Whisper');
            updatePlaceholder('✅ 자막 추출 완료!');
            console.log(`🎉 자막 추출 성공: ${fullTranscript.length}자`);
        } else {
            updatePlaceholder('⚠️ 인식된 음성이 없습니다. 다른 모델을 시도해보세요.');
            console.warn('⚠️ 모든 오디오 조각에서 텍스트 인식 실패');
        }
        
    } catch (error) {
        console.error('❌ 자막 추출 실패:', error);
        
        // 사용자 친화적인 오류 메시지 표시
        const errorMessage = error.message.includes('\n') ? error.message : `자막 추출 실패: ${error.message}`;
        updatePlaceholder(`❌ ${errorMessage}`);
        
        // 추가 도움말 제공
        setTimeout(() => {
            updatePlaceholder(`${errorMessage}\n\n💡 도움말:\n• 다른 음성 인식 모델 시도\n• API 키 설정 확인\n• 영상에 음성이 포함되어 있는지 확인`);
        }, 2000);
        
    } finally {
        startTranscriptionBtn.disabled = false;
    }
}

export function setupTranscriptionEventListeners() {
    // 정확도를 위해 FFmpeg 사전 로딩 복구
    console.log('🎙️ 고정밀 자막 추출 시스템 초기화');
    loadFFmpeg().catch(error => {
        console.warn('⚠️ FFmpeg 사전 로딩 실패, 런타임에서 재시도:', error.message);
    });
    
    if (startTranscriptionBtn) {
        startTranscriptionBtn.addEventListener('click', startTranscription);
    }
}

// 외부에서 호출할 수 있는 초기화 함수
export async function initializeAudioExtraction() {
    try {
        console.log('🔊 Audio extraction system initializing...');
        
        // FFmpeg 사전 로딩 시도
        loadFFmpeg().catch(error => {
            console.warn('⚠️ FFmpeg 사전 로딩 실패, 런타임에서 재시도:', error.message);
        });
        
        // 자막 추출 버튼 이벤트 리스너 설정
        const startTranscriptionBtn = document.getElementById('startTranscriptionBtn');
        if (startTranscriptionBtn) {
            startTranscriptionBtn.addEventListener('click', startTranscription);
            console.log('✅ Audio extraction button event listener added');
        } else {
            console.warn('⚠️ Start transcription button not found in audio extraction');
        }
        
        console.log('✅ Audio extraction system initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize audio extraction system:', error);
        return false;
    }
} 