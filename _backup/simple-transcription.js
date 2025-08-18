// js/simple-transcription.js
// FFmpeg 없이 브라우저 Web Audio API를 사용한 간단하고 효과적인 자막 추출

import { state } from './state.js';
import { getApiKey } from './api.js';

// DOM 요소들 - 지연 로딩 환경에서 안전한 초기화
let subtitleContainer, subtitlePlaceholder, startTranscriptionBtn, modelSelector, compressionMethodSelector;
let transcriptionProgress, transcriptionProgressFill, transcriptionProgressText, transcriptionProgressDetails;

// DOM 요소 초기화 함수 (강화된 버전)
function initializeDOMElements() {
    // 여러 번 시도하여 DOM 요소 찾기
    const findElement = (selector, description) => {
        let element = null;
        if (selector.startsWith('#')) {
            element = document.getElementById(selector.substring(1));
        } else {
            element = document.querySelector(selector);
        }
        
        if (!element) {
            console.warn(`⚠️ ${description} 요소를 찾을 수 없습니다: ${selector}`);
        }
        return element;
    };
    
    // 기본 UI 요소들
    subtitleContainer = findElement('#subtitleContainer', '자막 컨테이너');
    subtitlePlaceholder = findElement('.subtitle-placeholder', '자막 플레이스홀더');
    startTranscriptionBtn = findElement('#startTranscriptionBtn', '자막 추출 시작 버튼');
    modelSelector = findElement('.stt-model-selector', 'STT 모델 선택기');
    compressionMethodSelector = findElement('.compression-method-selector', '압축 방식 선택기');

    // 프로그레스바 요소들
    transcriptionProgress = findElement('#transcriptionProgress', '자막 추출 프로그레스 컨테이너');
    transcriptionProgressFill = findElement('#transcriptionProgressFill', '자막 추출 프로그레스 바');
    transcriptionProgressText = findElement('#transcriptionProgressText', '자막 추출 프로그레스 텍스트');
    transcriptionProgressDetails = findElement('#transcriptionProgressDetails', '자막 추출 프로그레스 상세');
    
    const result = {
        subtitleContainer: !!subtitleContainer,
        startTranscriptionBtn: !!startTranscriptionBtn,
        transcriptionProgress: !!transcriptionProgress,
        transcriptionProgressFill: !!transcriptionProgressFill,
        transcriptionProgressText: !!transcriptionProgressText,
        transcriptionProgressDetails: !!transcriptionProgressDetails
    };
    
    console.log('🔍 자막 추출 DOM 요소 초기화 결과:', result);
    
    // 중요한 요소가 없으면 재시도
    if (!startTranscriptionBtn) {
        console.warn('⚠️ 중요한 DOM 요소가 없습니다. 0.5초 후 재시도...');
        setTimeout(() => {
            initializeDOMElements();
        }, 500);
    }
    
    return result;
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
    onSubtitleGenerated(text);
}

// Add event listener for subtitle generation
function onSubtitleGenerated(subtitle) {
    console.log('Subtitle generated:', subtitle);
    // Call AI model for analysis
    analyzeSubtitleWithAI(subtitle);
}

// Example function to analyze subtitle with AI
function analyzeSubtitleWithAI(subtitle) {
    // Simple AI analysis logic
    console.log('Analyzing subtitle with AI:', subtitle);
    // Example: Count words
    const wordCount = subtitle.split(' ').length;
    console.log('Word count:', wordCount);
}

// 🔄 리팩토링: UIUtils 사용으로 간소화된 프로그레스바 함수들
function updateTranscriptionProgress(percentage, mainText, detailText) {
    // DOM 요소가 초기화되지 않았다면 초기화
    if (!transcriptionProgress) {
        initializeDOMElements();
    }
    
    // 새로운 UIUtils 사용 (상세 정보 포함)
    if (window.uiUtils) {
        window.uiUtils.showProgress(percentage, mainText, false, detailText); // isComplete는 명시적으로 호출할 때만 true
    }
    
    // 기존 호환성 유지 (직접 DOM 조작)
    if (transcriptionProgress) {
        transcriptionProgress.style.display = 'block';
    }
    if (transcriptionProgressFill) {
        transcriptionProgressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    }
    if (transcriptionProgressText) {
        transcriptionProgressText.textContent = mainText;
    }
    if (transcriptionProgressDetails) {
        transcriptionProgressDetails.textContent = detailText || '';
    }
    
    console.log(`📊 자막 추출 진행률: ${percentage}% - ${mainText}${detailText ? ` (${detailText})` : ''}`);
}

// 🔄 리팩토링: UIUtils 사용
function hideTranscriptionProgress() {
    // DOM 요소가 초기화되지 않았다면 초기화
    if (!transcriptionProgress) {
        initializeDOMElements();
    }
    
    if (window.uiUtils) {
        window.uiUtils.hideProgress();
    }
    
    // 기존 호환성 유지
    if (transcriptionProgress) {
        transcriptionProgress.style.display = 'none';
    }
}

// 🔄 리팩토링: UIUtils 사용
function resetTranscriptionProgress() {
    updateTranscriptionProgress(0, '자막 추출 준비 중...', '');
}

// 🔄 리팩토링: 이 함수는 AudioUtils로 이동되었습니다.
// 호환성을 위해 래퍼 함수로 유지
function determineCompressionLevel(fileSizeMB, durationMinutes, originalSampleRate) {
    if (window.audioUtils && typeof window.audioUtils.determineCompressionLevel === 'function') {
        return window.audioUtils.determineCompressionLevel(fileSizeMB, durationMinutes, originalSampleRate);
    } else {
        console.warn('⚠️ AudioUtils.determineCompressionLevel를 찾을 수 없어 기본값 사용');
        return { targetSampleRate: 16000, compressionLevel: '표준 압축', quality: '균형 최적화' };
    }
}

// 🔄 리팩토링: AudioUtils 사용으로 중복 코드 제거
async function extractAudioWithWebAPI(file) {
    console.log(`🎵 Web Audio API로 스마트 오디오 추출: ${file.name}`);
    updatePlaceholder('🎵 브라우저 Web Audio API로 스마트 압축 처리 중...');
    
    try {
        // 1. 파일을 ArrayBuffer로 읽기
        const arrayBuffer = await file.arrayBuffer();
        const fileSizeMB = arrayBuffer.byteLength / (1024 * 1024);
        console.log(`📊 파일 크기: ${fileSizeMB.toFixed(1)}MB`);
        
        // 2. 🔄 리팩토링: AudioUtils 사용 (안전한 로딩)
        updatePlaceholder('🔄 오디오 데이터 디코딩 중...');
        
        // AudioUtils가 로드되지 않았다면 로드 (백업용 - main.js에서 이미 로드됨)
        if (!window.audioUtils) {
            console.log('🔄 AudioUtils 백업 로드 중... (main.js에서 미리 로드되지 않음)');
            updateTranscriptionProgress(15, '🔄 오디오 유틸리티 로드 중...', 'AudioUtils 모듈 초기화');
            
            try {
                // AudioUtils 동적 로드
                const audioUtilsModule = await import('./utils/audio-utils.js');
                window.audioUtils = audioUtilsModule.default || audioUtilsModule;
                
                // AudioUtils 로드 확인
                if (!window.audioUtils || typeof window.audioUtils.decodeAudioData !== 'function') {
                    throw new Error('AudioUtils 모듈이 올바르게 로드되지 않았습니다');
                }
                
                console.log('✅ AudioUtils 백업 로드 완료 - 바로 계속 진행합니다');
            } catch (loadError) {
                console.error('❌ AudioUtils 로드 실패:', loadError);
                throw new Error('오디오 처리 모듈을 로드할 수 없습니다. 브라우저를 새로고침해주세요.');
            }
        } else {
            console.log('✅ AudioUtils 이미 로드됨 - 바로 처리 시작');
        }
        
        // AudioUtils 메서드 존재 확인
    if (!window.audioUtils || typeof window.audioUtils.decodeAudioData !== 'function') {
        throw new Error('AudioUtils의 decodeAudioData 함수를 찾을 수 없습니다');
    }
    
    const audioBuffer = await window.audioUtils.decodeAudioData(arrayBuffer);
        
        console.log(`✅ 오디오 디코딩 성공: ${audioBuffer.duration.toFixed(1)}초, ${audioBuffer.sampleRate}Hz`);
        
        // 4. 모노 채널로 변환 (필요시)
        const channelData = audioBuffer.getChannelData(0); // 첫 번째 채널 사용
        
        // 5. 🔄 리팩토링: AudioUtils 압축 수준 결정 사용
        const durationMinutes = audioBuffer.duration / 60;
        
        console.log(`📊 원본 분석: ${fileSizeMB.toFixed(2)}MB, ${durationMinutes.toFixed(1)}분, ${audioBuffer.sampleRate}Hz`);
        
        // 🔄 리팩토링: AudioUtils 압축 수준 결정 사용
        let compression;
        if (window.audioUtils && typeof window.audioUtils.determineCompressionLevel === 'function') {
            compression = window.audioUtils.determineCompressionLevel(fileSizeMB, durationMinutes, audioBuffer.sampleRate);
        } else {
            console.warn('⚠️ AudioUtils.determineCompressionLevel를 찾을 수 없어 기본값 사용');
            compression = { targetSampleRate: 16000, compressionLevel: '표준 압축', quality: '균형 최적화' };
        }
        const { targetSampleRate, compressionLevel, quality } = compression;
        
        console.log(`🎛️ Google STT 최적화 압축 분석:`);
        console.log(`   📊 원본: ${audioBuffer.sampleRate}Hz → ${targetSampleRate}Hz`);
        console.log(`   🎚️ 수준: ${compressionLevel} (${quality})`);
        console.log(`   💾 예상 압축률: ${((audioBuffer.sampleRate / targetSampleRate) * 100).toFixed(0)}%`);
        console.log(`   🎯 Google STT 호환성: ${targetSampleRate <= 8000 ? '최적화됨' : '일반'}`);
        
        updatePlaceholder(`🎛️ ${compressionLevel} 적용 중... (${quality})`);
        
            // 6. 🔄 리팩토링: AudioUtils 리샘플링 사용
    let resampledData;
    if (window.audioUtils && typeof window.audioUtils.resampleAudio === 'function') {
        resampledData = window.audioUtils.resampleAudio(channelData, audioBuffer.sampleRate, targetSampleRate);
    } else {
        console.warn('⚠️ AudioUtils.resampleAudio를 찾을 수 없어 원본 데이터 사용');
        resampledData = channelData;
    } // 폴백: 원본 데이터 사용
        
        // 7. 선택된 방식으로 압축 변환
        const selectedCompressionMethod = getSelectedCompressionMethod();
        console.log(`🎵 ${selectedCompressionMethod} 압축 변환 시작...`);
        updateTranscriptionProgress(40, `🎵 ${selectedCompressionMethod} 압축 변환 중...`, '90% 크기 감소 예상 - 잠시만 기다려주세요');
        updatePlaceholder(`🎵 ${selectedCompressionMethod} 압축 변환 중... (90% 크기 감소 예상)`);
        
        const compressedBlob = await convertToCompressedAudio(resampledData, targetSampleRate, selectedCompressionMethod);
        
        // 🔄 리팩토링: AudioUtils 압축 분석 사용
        const originalSizeMB = (resampledData.length * 2) / (1024 * 1024); // Float32Array 크기
        const compressedSizeMB = compressedBlob.size / (1024 * 1024);
        let compressionRatio;
        if (window.audioUtils && typeof window.audioUtils.calculateCompressionRatio === 'function') {
            compressionRatio = window.audioUtils.calculateCompressionRatio(originalSizeMB * 1024 * 1024, compressedBlob.size);
        } else {
            compressionRatio = `${(((originalSizeMB * 1024 * 1024 - compressedBlob.size) / (originalSizeMB * 1024 * 1024)) * 100).toFixed(1)}%`;
        }
        
        console.log(`🎵 ${selectedCompressionMethod} 압축 완료: ${originalSizeMB.toFixed(2)}MB → ${compressedSizeMB.toFixed(2)}MB (${compressionRatio}% 감소)`);
        updateTranscriptionProgress(60, `✅ ${selectedCompressionMethod} 압축 완료`, `${originalSizeMB.toFixed(2)}MB → ${compressedSizeMB.toFixed(2)}MB (${compressionRatio}% 감소)`);
        updatePlaceholder(`✅ ${selectedCompressionMethod} 압축 완료: ${compressedSizeMB.toFixed(2)}MB (${compressionRatio}% 감소)`);
        
        // 8. 압축된 파일 기반 스마트 분할 수행
        console.log(`📊 ${selectedCompressionMethod} Google STT 호환성: ${compressedSizeMB <= 9.5 ? '✅ 분할 불필요' : '⚠️ 분할 필요'}`);
        
        const chunks = await splitAudioBlob(compressedBlob, audioBuffer.duration);
        
        console.log(`✅ ${selectedCompressionMethod} 기반 스마트 분할 완료:`);
        console.log(`   📦 조각 수: ${chunks.length}개`);
        console.log(`   🎵 품질: ${targetSampleRate}Hz ${selectedCompressionMethod} (${compressionLevel})`);
        console.log(`   📊 Google STT 호환성: ${compressedSizeMB <= 9.5 ? '✅ 완벽 호환' : '⚠️ 추가 분할 필요'}`);
        console.log(`   🎯 ${selectedCompressionMethod} 압축: ${compressionRatio}% 크기 감소로 최적화`);
        
        updatePlaceholder(`✅ ${selectedCompressionMethod} 압축 분할 완료: ${chunks.length}개 조각 (${compressionRatio}% 감소)`);
        
        return chunks;
        
    } catch (error) {
        console.error('❌ Web Audio API 처리 실패:', error);
        
        if (error.name === 'EncodingError' || error.message.includes('decode')) {
            throw new Error(`지원되지 않는 오디오 형식입니다.\n\n💡 해결방법:\n1. MP4, WebM, OGG 형식 사용\n2. 다른 영상 파일 시도\n3. 영상에 오디오 트랙이 있는지 확인`);
        } else {
            throw new Error(`오디오 처리 실패: ${error.message}\n\n🔧 해결방법:\n1. 브라우저 새로고침\n2. 파일 크기 확인 (100MB 이하 권장)\n3. 다른 브라우저 시도`);
        }
    }
}

// 🔄 리팩토링: 이 함수는 AudioUtils로 이동되었습니다.
// 호환성을 위해 래퍼 함수로 유지
function resampleAudio(inputData, inputSampleRate, outputSampleRate) {
    if (window.audioUtils && typeof window.audioUtils.resampleAudio === 'function') {
        return window.audioUtils.resampleAudio(inputData, inputSampleRate, outputSampleRate);
    } else {
        console.warn('⚠️ AudioUtils.resampleAudio를 찾을 수 없어 원본 데이터 반환');
        return inputData; // 폴백: 원본 데이터 반환
    }
}

// 🔄 리팩토링: 이 함수는 AudioUtils로 이동되었습니다.
// 호환성을 위해 래퍼 함수로 유지
function createWavBlob(audioData, sampleRate) {
    if (window.audioUtils && typeof window.audioUtils.encodeWAV === 'function') {
        const arrayBuffer = window.audioUtils.encodeWAV(audioData, sampleRate);
        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }
    
    // 폴백: 기본 WAV 생성
    const length = audioData.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    
    // 간단한 WAV 헤더
    view.setUint32(0, 0x52494646); // 'RIFF'
    view.setUint32(4, 36 + length * 2, true);
    view.setUint32(8, 0x57415645); // 'WAVE'
    view.setUint32(12, 0x666d7420); // 'fmt '
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    view.setUint32(36, 0x64617461); // 'data'
    view.setUint32(40, length * 2, true);
    
    // 오디오 데이터
    let offset = 44;
    for (let i = 0; i < length; i++) {
        const sample = Math.max(-1, Math.min(1, audioData[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// 압축된 WAV 파일 생성 (Google STT 최적화)
function createCompressedWavBlob(audioData, sampleRate) {
    // 1. 데이터 압축: 8비트로 변환하여 크기 절반으로 줄이기
    const length = audioData.length;
    const arrayBuffer = new ArrayBuffer(44 + length); // 16비트 → 8비트로 절반 크기
    const view = new DataView(arrayBuffer);
    
    // WAV 헤더 작성 (8비트 PCM)
    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true); // 8비트 크기
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true); // 8비트이므로 바이트/초 = 샘플/초
    view.setUint16(32, 1, true); // 8비트 = 1바이트
    view.setUint16(34, 8, true); // 8비트
    writeString(36, 'data');
    view.setUint32(40, length, true);
    
    // 오디오 데이터 작성 (8비트 압축)
    let offset = 44;
    for (let i = 0; i < length; i++) {
        const sample = Math.max(-1, Math.min(1, audioData[i]));
        // -1~1을 0~255로 변환 (8비트 unsigned)
        const compressed = Math.round((sample + 1) * 127.5);
        view.setUint8(offset, compressed);
        offset += 1;
    }
    
    console.log(`🗜️ WAV 압축: 16비트 → 8비트 (50% 크기 감소)`);
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// 압축 방식 선택 함수
function getSelectedCompressionMethod() {
    try {
        const compressionSelector = document.querySelector('.compression-method-selector');
        if (!compressionSelector) {
            console.warn('⚠️ 압축 방식 선택 UI를 찾을 수 없음, 기본값 사용');
            return 'mediarecorder';
        }
        
        const selectedMethod = compressionSelector.querySelector('input[name="compression-method"]:checked');
        const method = selectedMethod ? selectedMethod.value : 'mediarecorder';
        console.log(`🎵 선택된 압축 방식: ${method}`);
        return method;
    } catch (error) {
        console.error('❌ 압축 방식 선택 오류:', error);
        return 'mediarecorder';
    }
}

// 통합 압축 함수 (3가지 방식 지원)
async function convertToCompressedAudio(audioData, sampleRate, method) {
    const originalSizeKB = (audioData.length * 2 / 1024).toFixed(0);
    console.log(`🎵 ${method} 압축 시작: ${sampleRate}Hz, ${audioData.length}개 샘플 (${originalSizeKB}KB)`);
    
    try {
        let compressedBlob;
        
        switch (method) {
            case 'ffmpeg-wasm':
                compressedBlob = await compressWithFFmpegWasm(audioData, sampleRate);
                break;
            case 'web-workers':
                compressedBlob = await compressWithWebWorkers(audioData, sampleRate);
                break;
            case 'mediarecorder':
            default:
                compressedBlob = await compressWithMediaRecorder(audioData, sampleRate);
                break;
        }
        
        const compressedSizeKB = (compressedBlob.size / 1024).toFixed(0);
        const compressionRatio = ((1 - compressedBlob.size / (audioData.length * 2)) * 100).toFixed(1);
        
        console.log(`🎵 ${method} 압축 완료: ${originalSizeKB}KB → ${compressedSizeKB}KB (${compressionRatio}% 감소)`);
        
        return compressedBlob;
        
    } catch (error) {
        console.error(`❌ ${method} 압축 실패:`, error);
        console.log(`📋 ${method} 오류 상세:`, error.message);
        console.log('🔄 기본 MediaRecorder로 폴백...');
        
        // 실패 시 기본 방식으로 폴백
        try {
            updateTranscriptionProgress(42, '🔄 폴백 처리 중...', 'MediaRecorder로 안전하게 처리');
            return await compressWithMediaRecorder(audioData, sampleRate);
        } catch (fallbackError) {
            // 통합 에러 처리 시스템 사용
            if (window.errorHandler) {
                window.errorHandler.handleError({
                    type: 'audio',
                    message: fallbackError.message,
                    originalError: fallbackError,
                    context: { 
                        function: 'convertToCompressedAudio',
                        compressionMethod: method,
                        audioDataLength: audioData.length
                    },
                    severity: 'medium'
                });
            }
            
            console.error('❌ 폴백도 실패:', fallbackError);
            // 최후의 수단: WAV 형식 그대로 반환
            console.log('🔄 WAV 형식으로 최종 폴백...');
            updateTranscriptionProgress(50, '⚠️ WAV 형식 사용', '압축 없이 원본 형식 유지');
            return createWavBlob(audioData, sampleRate);
        }
    }
}

// 🔄 리팩토링: AudioUtils 사용
async function compressWithMediaRecorder(audioData, sampleRate) {
    console.log('🎵 MediaRecorder 압축 방식 시작...');
    updateTranscriptionProgress(42, '🎵 브라우저 압축 중...', 'MediaRecorder API 사용 - 안정적이지만 실시간 처리');
    
    // 1. 🔄 리팩토링: AudioUtils AudioContext 사용 (안전한 처리)
    let audioContext;
    if (window.audioUtils && typeof window.audioUtils.getAudioContext === 'function') {
        audioContext = window.audioUtils.getAudioContext();
    } else {
        console.warn('⚠️ AudioUtils.getAudioContext를 찾을 수 없어 새 AudioContext 생성');
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // 2. AudioBuffer 생성
    const audioBuffer = audioContext.createBuffer(1, audioData.length, sampleRate);
    audioBuffer.getChannelData(0).set(audioData);
    
    // 3. 🔄 리팩토링: AudioUtils MP3 압축 사용
    if (window.audioUtils && typeof window.audioUtils.encodeToMp3UsingMediaRecorder === 'function') {
        return await window.audioUtils.encodeToMp3UsingMediaRecorder(audioBuffer);
    } else {
        console.warn('⚠️ AudioUtils.encodeToMp3UsingMediaRecorder를 찾을 수 없어 기본 방식 사용');
        // 폴백: 기존 방식
        return await encodeToMp3UsingMediaRecorder(audioBuffer, audioContext);
    }
}

// FFmpeg.wasm 스크립트 태그 로드 함수
async function loadFFmpegViaScript() {
    return new Promise((resolve, reject) => {
        // 이미 로드되어 있는지 확인
        if (window.FFmpeg) {
            resolve(window.FFmpeg);
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.10.1/dist/ffmpeg.min.js';
        script.onload = () => {
            if (window.FFmpeg) {
                resolve(window.FFmpeg);
            } else {
                reject(new Error('FFmpeg 글로벌 객체를 찾을 수 없습니다.'));
            }
        };
        script.onerror = () => {
            reject(new Error('FFmpeg 스크립트 로드 실패'));
        };
        document.head.appendChild(script);
    });
}

// 방법 2: FFmpeg.wasm (고성능 - 전문가용)
async function compressWithFFmpegWasm(audioData, sampleRate) {
    console.log('🎵 FFmpeg.wasm 압축 방식 시작...');
    updateTranscriptionProgress(42, '🎵 FFmpeg.wasm 압축 중...', '고성능 네이티브 인코더 - 빠른 처리');
    
    try {
        // FFmpeg.wasm 동적 로드 (호환성 개선)
        console.log('🔄 FFmpeg.wasm 라이브러리 로드 시도...');
        updateTranscriptionProgress(43, '🎵 FFmpeg.wasm 로딩...', 'CDN에서 라이브러리 다운로드 중');
        
        // 안전한 CDN 우선 방식으로 변경
        let FFmpegModule;
        console.log('🔧 FFmpeg.wasm 라이브러리 로드 시작...');
        
        try {
            // 방법 1: 안정적인 CDN 버전 사용
            console.log('📡 CDN에서 FFmpeg 로드 시도...');
            FFmpegModule = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.10.1/dist/ffmpeg.min.js');
            console.log('✅ CDN FFmpeg 로드 성공');
        } catch (cdnError) {
            console.log('⚠️ CDN 로드 실패, 대체 CDN 시도...', cdnError.message);
            try {
                // 방법 2: 대체 CDN
                FFmpegModule = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.10.1/dist/ffmpeg.min.js');
                console.log('✅ 대체 CDN FFmpeg 로드 성공');
            } catch (altCdnError) {
                console.log('⚠️ 대체 CDN도 실패, 스크립트 태그 방식 시도...', altCdnError.message);
                try {
                    // 방법 3: 스크립트 태그로 로드
                    FFmpegModule = await loadFFmpegViaScript();
                    console.log('✅ 스크립트 태그 FFmpeg 로드 성공');
                } catch (scriptError) {
                    console.log('❌ 모든 FFmpeg 로드 방식 실패:', scriptError.message);
                    throw new Error('FFmpeg 라이브러리를 로드할 수 없습니다. 네트워크 연결을 확인해주세요.');
                }
            }
        }
        
        // FFmpeg 함수 추출 및 검증
        let createFFmpeg, fetchFile;
        
        console.log('🔍 FFmpeg 모듈 구조 분석:', {
            hasDefault: !!FFmpegModule.default,
            hasCreateFFmpeg: !!FFmpegModule.createFFmpeg,
            hasFFmpeg: !!FFmpegModule.FFmpeg,
            moduleKeys: Object.keys(FFmpegModule),
            windowFFmpeg: !!window.FFmpeg
        });
        
        // 다양한 모듈 구조에 대응
        if (FFmpegModule.default && FFmpegModule.default.createFFmpeg) {
            // ES 모듈 default export
            console.log('✅ ES 모듈 default export 감지');
            ({ createFFmpeg, fetchFile } = FFmpegModule.default);
        } else if (FFmpegModule.createFFmpeg) {
            // 직접 export
            console.log('✅ 직접 export 감지');
            ({ createFFmpeg, fetchFile } = FFmpegModule);
        } else if (window.FFmpeg && window.FFmpeg.createFFmpeg) {
            // 글로벌 객체
            console.log('✅ 글로벌 FFmpeg 객체 감지');
            ({ createFFmpeg, fetchFile } = window.FFmpeg);
        } else {
            // 모든 가능성 체크
            console.log('❌ FFmpeg 함수를 찾을 수 없습니다. 사용 가능한 속성들:', 
                Object.keys(FFmpegModule), 
                'window.FFmpeg:', !!window.FFmpeg
            );
            throw new Error('createFFmpeg 함수를 찾을 수 없습니다. 라이브러리 구조가 예상과 다릅니다.');
        }
        
        // 함수 유효성 검증
        if (typeof createFFmpeg !== 'function') {
            console.log('❌ createFFmpeg 타입 오류:', typeof createFFmpeg);
            throw new Error(`createFFmpeg이 함수가 아닙니다. 실제 타입: ${typeof createFFmpeg}`);
        }
        
        console.log('✅ FFmpeg 함수 추출 성공');
        
        updateTranscriptionProgress(45, '🎵 FFmpeg.wasm 초기화...', 'WebAssembly 엔진 시작');
        
        // FFmpeg 인스턴스 생성
        console.log('🔧 FFmpeg 인스턴스 생성 중...');
        const ffmpeg = createFFmpeg({ 
            log: false,
            // 안정적인 CDN 코어 사용
            corePath: 'https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js'
        });
        
        console.log('🔄 FFmpeg.wasm 로딩 시작...');
        updateTranscriptionProgress(47, '🎵 FFmpeg.wasm 로딩 중...', 'WebAssembly 초기화');
        
        // FFmpeg 로드
        if (typeof ffmpeg.load === 'function') {
            try {
                await ffmpeg.load();
                console.log('✅ FFmpeg.wasm 로딩 완료');
            } catch (loadError) {
                console.log('❌ FFmpeg 로드 실패:', loadError.message);
                throw new Error(`FFmpeg 로딩 실패: ${loadError.message}`);
            }
        } else {
            console.log('⚠️ FFmpeg.load() 메서드가 없습니다. 자동 초기화 가정.');
        }
        
        updateTranscriptionProgress(48, '🎵 FFmpeg.wasm 인코딩 중...', 'WAV → MP3 고품질 변환');
        
        // WAV 파일 생성
        const wavBlob = createWavBlob(audioData, sampleRate);
        const wavBuffer = await wavBlob.arrayBuffer();
        
        // FFmpeg에 파일 쓰기
        ffmpeg.FS('writeFile', 'input.wav', new Uint8Array(wavBuffer));
        
        // MP3로 변환 (고품질 설정)
        await ffmpeg.run(
            '-i', 'input.wav',
            '-acodec', 'libmp3lame',
            '-b:a', '128k',
            '-ar', sampleRate.toString(),
            'output.mp3'
        );
        
        // 결과 파일 읽기
        const mp3Data = ffmpeg.FS('readFile', 'output.mp3');
        const mp3Blob = new Blob([mp3Data.buffer], { type: 'audio/mp3' });
        
        // 임시 파일 정리
        ffmpeg.FS('unlink', 'input.wav');
        ffmpeg.FS('unlink', 'output.mp3');
        
        updateTranscriptionProgress(52, '🎵 FFmpeg.wasm 완료', '고품질 MP3 압축 성공');
        console.log('✅ FFmpeg.wasm 압축 성공');
        
        return mp3Blob;
        
    } catch (error) {
        console.error('❌ FFmpeg.wasm 실패:', error);
        console.log('📋 오류 상세:', error.message);
        updateTranscriptionProgress(42, '⚠️ FFmpeg.wasm 실패', `${error.message} - MediaRecorder로 폴백`);
        
        // 폴백: MediaRecorder 사용
        console.log('🔄 MediaRecorder 폴백 시작...');
        return await compressWithMediaRecorder(audioData, sampleRate);
    }
}

// 방법 3: Web Workers (백그라운드 처리)
async function compressWithWebWorkers(audioData, sampleRate) {
    console.log('🎵 Web Workers 압축 방식 시작...');
    updateTranscriptionProgress(42, '🎵 백그라운드 압축 중...', 'Web Workers로 UI 블로킹 없이 처리');
    
    return new Promise((resolve, reject) => {
        try {
            // Web Worker 생성 (인라인)
            const workerCode = `
                // Worker에서 실행될 압축 코드
                self.onmessage = function(e) {
                    const { audioData, sampleRate } = e.data;
                    
                    try {
                        // 간단한 압축 알고리즘 (예: 다운샘플링)
                        const targetSampleRate = Math.min(sampleRate, 22050);
                        const ratio = sampleRate / targetSampleRate;
                        const compressedLength = Math.floor(audioData.length / ratio);
                        const compressedData = new Float32Array(compressedLength);
                        
                        // 리샘플링
                        for (let i = 0; i < compressedLength; i++) {
                            const originalIndex = i * ratio;
                            const index = Math.floor(originalIndex);
                            compressedData[i] = audioData[index] || 0;
                        }
                        
                        // WAV 형식으로 인코딩
                        const wavBuffer = createWavInWorker(compressedData, targetSampleRate);
                        
                        self.postMessage({
                            success: true,
                            data: wavBuffer,
                            originalSize: audioData.length * 2,
                            compressedSize: wavBuffer.byteLength
                        });
                        
                    } catch (error) {
                        self.postMessage({
                            success: false,
                            error: error.message
                        });
                    }
                };
                
                function createWavInWorker(audioData, sampleRate) {
                    const length = audioData.length;
                    const arrayBuffer = new ArrayBuffer(44 + length * 2);
                    const view = new DataView(arrayBuffer);
                    
                    // WAV 헤더
                    const writeString = (offset, string) => {
                        for (let i = 0; i < string.length; i++) {
                            view.setUint8(offset + i, string.charCodeAt(i));
                        }
                    };
                    
                    writeString(0, 'RIFF');
                    view.setUint32(4, 36 + length * 2, true);
                    writeString(8, 'WAVE');
                    writeString(12, 'fmt ');
                    view.setUint32(16, 16, true);
                    view.setUint16(20, 1, true);
                    view.setUint16(22, 1, true);
                    view.setUint32(24, sampleRate, true);
                    view.setUint32(28, sampleRate * 2, true);
                    view.setUint16(32, 2, true);
                    view.setUint16(34, 16, true);
                    writeString(36, 'data');
                    view.setUint32(40, length * 2, true);
                    
                    // 오디오 데이터
                    let offset = 44;
                    for (let i = 0; i < length; i++) {
                        const sample = Math.max(-1, Math.min(1, audioData[i]));
                        view.setInt16(offset, sample * 0x7FFF, true);
                        offset += 2;
                    }
                    
                    return arrayBuffer;
                }
            `;
            
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const worker = new Worker(URL.createObjectURL(blob));
            
            // 진행률 업데이트
            updateTranscriptionProgress(45, '🎵 Worker 처리 중...', '백그라운드에서 압축 진행');
            
            worker.onmessage = function(e) {
                const { success, data, error, originalSize, compressedSize } = e.data;
                
                if (success) {
                    const compressedBlob = new Blob([data], { type: 'audio/wav' });
                    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
                    
                    updateTranscriptionProgress(52, '🎵 Worker 완료', `${compressionRatio}% 압축 성공`);
                    console.log(`✅ Web Workers 압축 성공: ${compressionRatio}% 감소`);
                    
                    worker.terminate();
                    URL.revokeObjectURL(blob);
                    resolve(compressedBlob);
                } else {
                    console.error('❌ Web Workers 압축 실패:', error);
                    updateTranscriptionProgress(42, '⚠️ Worker 실패', 'MediaRecorder로 폴백');
                    
                    worker.terminate();
                    URL.revokeObjectURL(blob);
                    
                    // 폴백: MediaRecorder 사용
                    compressWithMediaRecorder(audioData, sampleRate).then(resolve).catch(reject);
                }
            };
            
            worker.onerror = function(error) {
                console.error('❌ Web Worker 오류:', error);
                worker.terminate();
                URL.revokeObjectURL(blob);
                
                // 폴백: MediaRecorder 사용
                compressWithMediaRecorder(audioData, sampleRate).then(resolve).catch(reject);
            };
            
            // Worker에 데이터 전송
            worker.postMessage({ audioData, sampleRate });
            
        } catch (error) {
            console.error('❌ Web Workers 초기화 실패:', error);
            // 폴백: MediaRecorder 사용
            compressWithMediaRecorder(audioData, sampleRate).then(resolve).catch(reject);
        }
    });
}

// MediaRecorder를 사용한 MP3 인코딩 (진행률 표시)
async function encodeToMp3UsingMediaRecorder(audioBuffer, audioContext) {
    return new Promise((resolve, reject) => {
        try {
            console.log('🎵 MediaRecorder 인코딩 시작...');
            updateTranscriptionProgress(45, '🎵 MP3 인코딩 중...', 'MediaRecorder API로 압축 중');
            
            // 1. AudioBuffer를 재생 가능한 소스로 변환
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            
            // 2. MediaStreamDestination 생성
            const destination = audioContext.createMediaStreamDestination();
            source.connect(destination);
            
            // 3. MediaRecorder로 MP3 인코딩
            const mediaRecorder = new MediaRecorder(destination.stream, {
                mimeType: 'audio/webm;codecs=opus' // 브라우저 호환성을 위해 WebM/Opus 사용
            });
            
            const chunks = [];
            let recordingStartTime = Date.now();
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                    
                    // 진행률 업데이트 (45% ~ 55%)
                    const elapsed = Date.now() - recordingStartTime;
                    const estimatedTotal = audioBuffer.duration * 1000; // 오디오 길이(ms)
                    const progress = Math.min(10, (elapsed / estimatedTotal) * 10); // 최대 10% 증가
                    updateTranscriptionProgress(45 + progress, '🎵 MP3 인코딩 중...', 
                        `${(elapsed / 1000).toFixed(1)}초 / ${audioBuffer.duration.toFixed(1)}초 처리됨`);
                }
            };
            
            mediaRecorder.onstop = () => {
                updateTranscriptionProgress(55, '🎵 MP3 인코딩 완료', '압축된 오디오 파일 생성 완료');
                const compressedBlob = new Blob(chunks, { type: 'audio/webm' });
                console.log(`🎵 MediaRecorder 인코딩 완료: ${(compressedBlob.size / 1024).toFixed(0)}KB`);
                resolve(compressedBlob);
            };
            
            mediaRecorder.onerror = (error) => {
                console.error('❌ MediaRecorder 오류:', error);
                reject(error);
            };
            
            // 4. 녹음 시작 및 오디오 재생
            mediaRecorder.start(100); // 100ms마다 데이터 수집
            source.start();
            
            // 5. 오디오 재생 완료 후 녹음 중지
            source.onended = () => {
                setTimeout(() => {
                    mediaRecorder.stop();
                }, 100); // 약간의 여유 시간
            };
            
        } catch (error) {
            console.error('❌ MediaRecorder 설정 오류:', error);
            reject(error);
        }
    });
}

// 스마트 오디오 분할 시스템 (압축 최소화, 정확도 최우선)
async function splitAudioBlob(audioBlob, duration) {
    const sizeMB = audioBlob.size / (1024 * 1024);
    
    // Google STT: 9.5MB 안전 제한, OpenAI: 20MB
    const googleSafeLimit = 9.5 * 1024 * 1024; // 9.5MB (최적 크기)
    const openaiLimit = 20 * 1024 * 1024; // 20MB
    
    console.log(`📊 스마트 분할 분석: ${sizeMB.toFixed(2)}MB, ${duration.toFixed(1)}초`);
    
    // 분할이 필요한지 확인
    if (audioBlob.size <= googleSafeLimit) {
        console.log(`✅ 분할 불필요: Google STT 최적 크기 (${sizeMB.toFixed(2)}MB ≤ 9.5MB)`);
        return [{ blob: audioBlob, index: 0, totalChunks: 1 }];
    }
    
    // 수학적 분할 계산: 오디오 최대크기 / X = < 9.5MB
    // 따라서 X = Math.ceil(오디오 최대크기 / 9.5MB)
    const optimalChunks = Math.ceil(audioBlob.size / googleSafeLimit);
    const chunkSizeMB = sizeMB / optimalChunks;
    const chunkDuration = duration / optimalChunks;
    
    console.log(`🧮 수학적 분할 계산:`);
    console.log(`   📊 X = Math.ceil(${sizeMB.toFixed(2)}MB / 9.5MB) = ${optimalChunks}개`);
    console.log(`   📏 각 조각: ${chunkSizeMB.toFixed(2)}MB, ${chunkDuration.toFixed(1)}초`);
    console.log(`   ✅ Google STT 호환: ${chunkSizeMB <= 9.5 ? '완벽' : '재계산 필요'}`);
    
    // 안전성 재확인 (혹시 계산 오차가 있을 경우)
    if (chunkSizeMB > 9.5) {
        const safeChunks = optimalChunks + 1;
        const safeSizeMB = sizeMB / safeChunks;
        console.log(`⚠️ 안전 마진 추가: ${optimalChunks}개 → ${safeChunks}개 (각 ${safeSizeMB.toFixed(2)}MB)`);
        return await createAudioChunks(audioBlob, safeChunks, duration);
    }
    
    return await createAudioChunks(audioBlob, optimalChunks, duration);
}

// 시간 기반 안전한 오디오 분할 (오디오 데이터 손상 방지)
async function createAudioChunks(audioBlob, chunkCount, totalDuration) {
    console.log(`🔄 시간 기반 안전한 분할 시작: ${chunkCount}개 조각`);
    
    if (chunkCount === 1) {
        return [{ blob: audioBlob, index: 0, totalChunks: 1 }];
    }
    
    try {
        // 1. Web Audio API를 사용한 시간 기반 분할 (오디오 데이터 보존)
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const sampleRate = audioBuffer.sampleRate;
        const totalSamples = audioBuffer.length;
        const samplesPerChunk = Math.floor(totalSamples / chunkCount);
        
        console.log(`📊 시간 기반 분할 준비: ${totalSamples}샘플 → ${chunkCount}개 조각 (각 ${samplesPerChunk}샘플)`);
        console.log(`   🎵 샘플레이트: ${sampleRate}Hz`);
        console.log(`   ⏱️ 총 시간: ${totalDuration.toFixed(1)}초`);
        
        const chunks = [];
        
        for (let i = 0; i < chunkCount; i++) {
            // 2. 샘플 단위로 정확한 분할
            const startSample = i * samplesPerChunk;
            const endSample = (i === chunkCount - 1) ? totalSamples : (i + 1) * samplesPerChunk;
            const chunkSamples = endSample - startSample;
            
            // 3. 해당 샘플 범위의 오디오 데이터 추출
            const chunkBuffer = audioContext.createBuffer(1, chunkSamples, sampleRate);
            const chunkData = chunkBuffer.getChannelData(0);
            const originalData = audioBuffer.getChannelData(0);
            
            for (let j = 0; j < chunkSamples; j++) {
                chunkData[j] = originalData[startSample + j];
            }
            
            // 4. WAV 형식으로 변환
            const chunkBlob = createWavBlob(chunkData, sampleRate);
            
            // 5. 시간 메타데이터 계산
            const startTime = (startSample / sampleRate);
            const endTime = (endSample / sampleRate);
            
            chunks.push({
                blob: chunkBlob,
                index: i,
                totalChunks: chunkCount,
                startTime: startTime,
                endTime: endTime,
                actualSize: chunkBlob.size
            });
            
            const sizeMB = (chunkBlob.size / 1024 / 1024).toFixed(2);
            const duration = (endTime - startTime).toFixed(1);
            console.log(`✅ 조각 ${i + 1}: ${sizeMB}MB, ${startTime.toFixed(1)}s-${endTime.toFixed(1)}s (${duration}초)`);
        }
        
        // 6. 분할 결과 검증
        const totalOriginalMB = (audioBlob.size / 1024 / 1024).toFixed(2);
        const totalChunksMB = chunks.reduce((sum, chunk) => sum + chunk.actualSize, 0) / 1024 / 1024;
        const sizeIncrease = ((totalChunksMB / parseFloat(totalOriginalMB) - 1) * 100).toFixed(1);
        
        console.log(`📦 시간 기반 분할 완료:`);
        console.log(`   📊 원본: ${totalOriginalMB}MB → 조각들: ${totalChunksMB.toFixed(2)}MB`);
        console.log(`   📈 크기 변화: ${sizeIncrease}% (${sizeIncrease < 10 ? '✅ 최소 오버헤드' : '⚠️ WAV 변환 오버헤드'})`);
        console.log(`   ✅ Google STT 호환: ${chunks.every(c => c.actualSize <= 9.5 * 1024 * 1024) ? '모든 조각 통과' : '일부 조각 초과'}`);
        console.log(`   🔧 오디오 무결성: ✅ 샘플 경계 기준 분할로 데이터 손상 방지`);
        
        return chunks;
        
    } catch (error) {
        console.error('❌ 시간 기반 분할 실패:', error);
        console.log('🔄 단일 파일로 폴백...');
        return [{ blob: audioBlob, index: 0, totalChunks: 1 }];
    }
}

// OpenAI Whisper API 호출 (타임스탬프 지원)
async function transcribeWithOpenAI(audioBlob, chunkStartTime = 0) {
    console.log('🎤 OpenAI Whisper 호출 시작', {
        blobSize: audioBlob.size,
        blobType: audioBlob.type,
        chunkStartTime: chunkStartTime
    });
    
    const apiKey = await getApiKey('gpt');
    console.log('🔑 API 키 상태:', apiKey ? '존재함' : '없음');
    
    if (!apiKey) {
        throw new Error('OpenAI API 키가 필요합니다.\n\n⚙️ 설정: 화면 하단 ⚙️ 버튼 클릭');
    }

    try {
        updatePlaceholder('🤖 OpenAI Whisper로 음성 인식 중...');
        
        // DOM 요소 안전하게 가져오기
        const sourceLangElement = document.getElementById('sourceLang');
        const languageCode = sourceLangElement ? sourceLangElement.value : 'ko-KR';
        const language = languageCode.split('-')[0]; // 'ko-KR' → 'ko'
        
        console.log(`🌐 OpenAI Whisper 언어 설정: ${language} (${languageCode})`);
        
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.wav');
        formData.append('model', 'whisper-1');
        formData.append('language', language);
        formData.append('response_format', 'verbose_json');
        formData.append('timestamp_granularities[]', 'segment');
        
        // VAD (Voice Activity Detection) 추가 - 무음 구간 필터링
        formData.append('prompt', '한국어 음성입니다. 무음 구간은 무시하고 실제 음성만 인식해주세요.');

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
            } else if (response.status === 413) {
                throw new Error('📦 파일 크기가 너무 큽니다 (최대 25MB)\n\n💡 해결방법:\n1. 더 짧은 영상 사용\n2. 영상 압축 후 재시도\n3. Google STT 사용 고려');
            } else {
                throw new Error(`OpenAI API 오류 (${response.status}): ${errorData.error?.message || response.statusText}`);
            }
        }

        const data = await response.json();
        console.log('📝 OpenAI Whisper 응답 데이터:', data);
        
        // 타임스탬프가 있는 경우 세그먼트별로 처리
        if (data.segments && data.segments.length > 0) {
            const segmentsWithTimestamp = data.segments.map(segment => {
                // segment 구조 확인
                if (!segment || typeof segment !== 'object') {
                    console.warn('⚠️ 잘못된 segment 구조:', segment);
                    return null;
                }
                
                const text = segment.text ? segment.text.trim() : '';
                
                // 무의미한 텍스트 필터링 (바이트 분할로 인한 손상된 오디오)
                if (text.length <= 2 && /^[으어어어ㅇㅇㅇ\s]+$/.test(text)) {
                    console.log(`⚠️ 무의미한 세그먼트 제거: "${text}" (${segment.start}s-${segment.end}s)`);
                    return null;
                }
                
                return {
                    text: text,
                    start: Math.round((segment.start || 0) + chunkStartTime),
                    end: Math.round((segment.end || 0) + chunkStartTime)
                };
            }).filter(seg => seg !== null && seg.text); // null이거나 빈 텍스트 제거
            
            console.log(`✅ OpenAI Whisper 타임스탬프 추출: ${segmentsWithTimestamp.length}개 세그먼트`);
            return { segments: segmentsWithTimestamp, fullText: data.text?.trim() || '' };
        } else {
            // 타임스탬프가 없는 경우 기본 텍스트만 반환
            console.log('ℹ️ OpenAI Whisper 응답에 segments가 없음, 텍스트만 반환');
            return { segments: [], fullText: data.text?.trim() || '(인식된 텍스트 없음)' };
        }
        
    } catch (error) {
        console.error('OpenAI 음성 인식 오류:', error);
        throw error;
    }
}

// Google Cloud Speech-to-Text API 호출 (10MB 제한 완전 해결, 타임스탬프 지원)
async function transcribeWithGoogle(audioBlob, chunkStartTime = 0) {
    const apiKey = await getApiKey('gemini');
    if (!apiKey) {
        throw new Error('Google Gemini API 키가 필요합니다.\n\n⚙️ 설정: 화면 하단 ⚙️ 버튼 클릭');
    }

    try {
        updatePlaceholder('🤖 Google STT로 음성 인식 중...');
        
        // DOM 요소 안전하게 가져오기
        const sourceLangElement = document.getElementById('sourceLang');
        const languageCode = sourceLangElement ? sourceLangElement.value : 'ko-KR';
        
        console.log(`🌐 Google STT 언어 설정: ${languageCode}`);
        
        // 스마트 분할된 오디오 조각 처리 (추가 압축 불필요)
        const sizeMB = audioBlob.size / (1024 * 1024);
        console.log(`📊 Google STT 입력 조각 크기: ${sizeMB.toFixed(2)}MB`);
        
        // 스마트 분할로 이미 9.5MB 이하로 조정됨
        if (sizeMB > 9.5) {
            throw new Error(`스마트 분할 오류: 조각이 여전히 큽니다 (${sizeMB.toFixed(2)}MB).\n\n💡 해결방법:\n1. OpenAI Whisper 사용\n2. 더 작은 조각으로 재분할\n3. 압축 수준 조정`);
        }
        
        console.log(`✅ Google STT 최적 크기: ${sizeMB.toFixed(2)}MB ≤ 9.5MB (추가 압축 불필요)`);
        
        // WebM/Opus → WAV 변환 (Google STT 호환성)
        let processedBlob = audioBlob;
        let sampleRate = 16000;
        
        // MediaRecorder로 생성된 WebM을 WAV로 변환
        if (audioBlob.type.includes('webm') || audioBlob.type.includes('opus')) {
            console.log('🔄 WebM/Opus → WAV 변환 중...');
            updatePlaceholder('🔄 Google STT 호환 형식으로 변환 중...');
            
            try {
                // Web Audio API로 디코딩 후 WAV로 재인코딩
                const arrayBuffer = await audioBlob.arrayBuffer();
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                
                const channelData = audioBuffer.getChannelData(0);
                sampleRate = Math.min(audioBuffer.sampleRate, 16000); // 최대 16kHz
                
                // 16kHz로 리샘플링 (Google STT 최적화)
                const resampledData = resampleAudio(channelData, audioBuffer.sampleRate, sampleRate);
                processedBlob = createWavBlob(resampledData, sampleRate);
                
                console.log(`✅ WAV 변환 완료: ${sampleRate}Hz, ${(processedBlob.size / 1024).toFixed(0)}KB`);
            } catch (conversionError) {
                console.warn('⚠️ WAV 변환 실패, 원본 사용:', conversionError.message);
                // 변환 실패 시 원본 사용
            }
        }
        
        // Base64 인코딩
        updatePlaceholder('📤 Google STT로 전송 중...');
        const base64Audio = await blobToBase64(processedBlob);
        const base64SizeMB = (base64Audio.length * 3 / 4 / 1024 / 1024).toFixed(2);
        console.log(`📤 Google STT 전송: ${base64SizeMB}MB, ${sampleRate}Hz, ${processedBlob.type}`);
        
        // Base64 크기 최종 검증
        if (base64Audio.length * 3 / 4 > 9 * 1024 * 1024) { // 9MB 절대 한계
            throw new Error(`Base64 인코딩 후 크기 초과 (${base64SizeMB}MB).\n\n💡 해결방법:\n1. OpenAI Whisper 사용 (더 큰 파일 지원)\n2. 영상을 30초 이하로 자르기\n3. 더 낮은 품질로 영상 재업로드`);
        }
        
        // 오디오 형식에 따른 인코딩 자동 선택
        let encoding = 'LINEAR16'; // 기본값 (WAV용)
        
        if (processedBlob.type.includes('mp3')) {
            encoding = 'MP3';
        } else if (processedBlob.type.includes('webm') || processedBlob.type.includes('opus')) {
            encoding = 'WEBM_OPUS';
        } else if (processedBlob.type.includes('wav')) {
            encoding = 'LINEAR16';
        }
        
        console.log(`🔧 오디오 형식 감지: ${processedBlob.type} → ${encoding} 인코딩 사용`);
        
        // Google STT API 요청 (형식별 최적화, 타임스탬프 지원)
        const requestBody = {
            config: {
                encoding: encoding,
                sampleRateHertz: sampleRate,
                languageCode: languageCode,
                enableAutomaticPunctuation: true,
                model: 'latest_short',
                audioChannelCount: 1,
                enableSeparateRecognitionPerChannel: false,
                maxAlternatives: 1,
                enableWordTimeOffsets: true
            },
            audio: { content: base64Audio }
        };
        
        console.log('📤 Google STT 요청 설정:', {
            encoding: requestBody.config.encoding,
            sampleRate: requestBody.config.sampleRateHertz,
            language: requestBody.config.languageCode,
            audioSize: base64SizeMB + 'MB',
            audioType: processedBlob.type
        });
        
        const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            if (response.status === 400 && errorData.error?.message?.includes('payload size exceeds')) {
                throw new Error(`Google STT 크기 제한 초과 (실제: ${base64SizeMB}MB).\n\n💡 해결방법:\n1. OpenAI Whisper 사용 (25MB까지 지원)\n2. 영상을 더 짧게 자르기 (15초 이하)\n3. 영상 품질을 더 낮춰서 재업로드`);
            } else if (response.status === 400) {
                throw new Error(`Google STT 요청 오류: ${errorData.error?.message || '알 수 없는 오류'}\n\n💡 해결방법:\n1. OpenAI Whisper 사용\n2. 다른 영상 파일 시도\n3. 영상에 명확한 음성이 있는지 확인`);
            } else if (response.status === 401) {
                throw new Error('Google API 키가 유효하지 않습니다.\n\n⚙️ 설정에서 올바른 Gemini API 키를 입력해주세요.');
            } else {
                throw new Error(`Google STT API 오류 (${response.status}): ${errorData.error?.message || response.statusText}`);
            }
        }

        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const segments = [];
            let fullText = '';
            
            data.results.forEach(result => {
                if (result.alternatives && result.alternatives[0]) {
                    const alternative = result.alternatives[0];
                    fullText += alternative.transcript + ' ';
                    
                    // 단어별 타임스탬프가 있는 경우 처리
                    if (alternative.words && alternative.words.length > 0) {
                        const words = alternative.words;
                        const startTime = Math.round(parseFloat(words[0].startTime?.seconds || 0) + chunkStartTime);
                        const endTime = Math.round(parseFloat(words[words.length - 1].endTime?.seconds || 0) + chunkStartTime);
                        
                        segments.push({
                            text: alternative.transcript.trim(),
                            start: startTime,
                            end: endTime
                        });
                    }
                }
            });
            
            fullText = fullText.trim();
            
            if (fullText) {
                console.log(`✅ Google STT 성공: ${fullText.length}자 인식, ${segments.length}개 세그먼트 (${sampleRate}Hz)`);
                return { segments: segments, fullText: fullText };
            } else {
                console.warn('⚠️ Google STT에서 텍스트를 인식하지 못했습니다.');
                return { segments: [], fullText: '(인식된 텍스트 없음)' };
            }
        } else {
            console.warn('⚠️ Google STT 응답에 결과가 없습니다.');
            return { segments: [], fullText: '(인식된 텍스트 없음)' };
        }
        
    } catch (error) {
        // 통합 에러 처리 시스템 사용
        if (window.errorHandler) {
            const processedError = window.errorHandler.handleError({
                type: 'api',
                message: error.message,
                originalError: error,
                context: { 
                    function: 'transcribeWithGoogle',
                    audioSize: audioBlob.size,
                    chunkStartTime
                },
                severity: 'high'
            });
            throw new Error(processedError.userMessage);
        } else {
            console.error('❌ Google STT 오류:', error);
            throw error;
        }
    }
}

// Google STT용 동적 오디오 압축 함수
async function compressAudioForGoogle(audioBlob, targetSampleRate = 8000) {
    try {
        console.log(`🗜️ Google STT 압축 시작: 목표 ${targetSampleRate}Hz`);
        
        // 원본 오디오 데이터 읽기
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        console.log(`📊 압축 전: ${audioBuffer.sampleRate}Hz → ${targetSampleRate}Hz`);
        
        // 지정된 샘플링 레이트로 재샘플링
        const channelData = audioBuffer.getChannelData(0);
        const resampledData = resampleAudio(channelData, audioBuffer.sampleRate, targetSampleRate);
        
        // 압축된 WAV 생성
        const compressedBlob = createWavBlob(resampledData, targetSampleRate);
        
        const originalSizeMB = (audioBlob.size / 1024 / 1024).toFixed(2);
        const compressedSizeMB = (compressedBlob.size / 1024 / 1024).toFixed(2);
        const compressionRatio = ((1 - compressedBlob.size / audioBlob.size) * 100).toFixed(1);
        
        console.log(`🗜️ Google STT 압축 완료: ${originalSizeMB}MB → ${compressedSizeMB}MB (${compressionRatio}% 감소)`);
        
        return compressedBlob;
        
    } catch (error) {
        console.error('❌ Google STT 압축 실패:', error);
        throw new Error(`Google STT 압축 실패: ${error.message}\n\n💡 해결방법:\n1. OpenAI Whisper 사용\n2. 더 짧은 영상 시도`);
    }
}

// Blob을 Base64로 변환
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// 타임스탬프 포맷팅 함수
function formatTimestamp(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.round((seconds - Math.floor(seconds)) * 100);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
}

/**
 * 타임스탬프가 있는 자막 세그먼트를 UI에 추가하고 전역 상태에 저장합니다.
 * @param {Array<object>} segments - 자막 세그먼트 배열. 각 객체는 start, end, text 속성을 가집니다.
 * @param {string} source - 자막 출처 (예: 'OpenAI Whisper')
 */
function addSubtitleEntryWithTimestamp(segments, source) {
    if (!segments || segments.length === 0) {
        console.warn('⚠️ 타임스탬프 자막 세그먼트가 비어있습니다.');
        return;
    }

    // 1. 전역 상태(state)에 자막 데이터 저장
    //    구조: [{ start: 0.0, end: 3.5, text: "안녕하세요" }, ...]
    state.subtitles = segments.map(seg => ({
        start: parseFloat(seg.start),
        end: parseFloat(seg.end),
        text: seg.text.trim()
    }));
    
    console.log(`✅ 전역 상태에 자막 저장 완료: ${state.subtitles.length}개 세그먼트`);
    // workLogManager.addWorkLog('transcription', '자막 상태 저장', { count: state.subtitles.length, source });


    // 2. UI 업데이트 (기존 로직)
    const subtitleResultsContainer = document.getElementById('subtitleResultsContainer');
    if (!subtitleResultsContainer) {
        console.error('❌ 자막 결과 컨테이너(#subtitleResultsContainer)를 찾을 수 없습니다.');
        return;
    }
    
    // 플레이스홀더 제거
    const placeholder = subtitleResultsContainer.querySelector('.subtitle-placeholder-results');
    if (placeholder) {
        placeholder.remove();
    }
    
    // 새로운 자막 엔트리 생성
    const resultEntry = document.createElement('div');
    resultEntry.className = 'subtitle-result-entry timestamped'; // 타임스탬프 스타일 추가

    const totalSentences = segments.reduce((acc, seg) => acc + countSentences(seg.text), 0);
    const totalLength = segments.reduce((acc, seg) => acc + seg.text.length, 0);
    
    let contentHTML = `
        <div class="subtitle-source">
            <span>${source}</span>
            <div class="subtitle-actions">
                <button class="icon-btn copy-btn" title="자막 복사"><i class="fas fa-copy"></i></button>
                <button class="icon-btn save-btn" title="자막 파일(.srt)로 저장"><i class="fas fa-save"></i></button>
                <button class="icon-btn delete-btn" title="이 결과 삭제"><i class="fas fa-trash"></i></button>
            </div>
        </div>
        <div class="subtitle-text">
    `;

    segments.forEach(segment => {
        const start = formatTimestamp(segment.start);
        const end = formatTimestamp(segment.end);
        contentHTML += `
            <div class="subtitle-segment" data-start="${segment.start}" data-end="${segment.end}">
                <span class="timestamp">[${start} - ${end}]</span>
                <span class="text">${segment.text.trim()}</span>
            </div>
        `;
    });

    contentHTML += `
        </div>
        <div class="subtitle-meta">
            <span>추출 시간: ${new Date().toLocaleString()}</span>
            <span>길이: ${totalLength}자 • ${segments.length}개 세그먼트 • ${totalSentences}개 문장</span>
        </div>
    `;

    resultEntry.innerHTML = contentHTML;

    // 최신 결과를 맨 위에 추가
    subtitleResultsContainer.insertBefore(resultEntry, subtitleResultsContainer.firstChild);
    
    // 스크롤을 맨 위로 이동
    subtitleResultsContainer.scrollTop = 0;

    console.log(`✅ 타임스탬프 자막 UI 업데이트 완료`);

    // 이벤트 리스너 추가 (이벤트 위임 사용)
    resultEntry.querySelector('.copy-btn').addEventListener('click', () => copySubtitles(segments));
    resultEntry.querySelector('.save-btn').addEventListener('click', () => saveSubtitlesAsSrt(segments, source));
    resultEntry.querySelector('.delete-btn').addEventListener('click', () => resultEntry.remove());

    // 자막 생성 완료 이벤트 호출
    onSubtitleGenerated(segments.map(s => s.text).join('\n'));
}

function copySubtitles(segments) {
    const textToCopy = segments.map(seg => `[${formatTimestamp(seg.start)} - ${formatTimestamp(seg.end)}] ${seg.text.trim()}`).join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
        alert('✅ 자막이 클립보드에 복사되었습니다.');
    }, (err) => {
        console.error('클립보드 복사 실패:', err);
        alert('❌ 클립보드 복사에 실패했습니다.');
    });
}

function saveSubtitlesAsSrt(segments, source) {
    let srtContent = '';
    segments.forEach((seg, index) => {
        const start = new Date(seg.start * 1000).toISOString().substr(11, 12).replace('.', ',');
        const end = new Date(seg.end * 1000).toISOString().substr(11, 12).replace('.', ',');
        srtContent += `${index + 1}\n${start} --> ${end}\n${seg.text.trim()}\n\n`;
    });

    const blob = new Blob([srtContent], { type: 'text/srt;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `${state.uploadedFile?.name || 'subtitles'}_${source}.srt`;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

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

// 🧪 더미 자막 생성 함수 (개발용)
function generateDummySubtitle() {
    const dummyTexts = [
        // 한국어 더미 자막들
        "안녕하세요! 오늘은 정말 좋은 날씨네요. 이 영상을 시청해주셔서 진심으로 감사합니다. 오늘 준비한 내용이 여러분에게 도움이 되었으면 좋겠어요. 혹시 궁금한 점이 있으시면 언제든지 댓글로 남겨주세요. 다음 영상에서 더 재미있는 내용으로 찾아뵙겠습니다.",
        
        "여러분, 반갑습니다. 저는 오늘 특별한 이야기를 들려드리려고 합니다. 이 이야기는 제가 직접 경험한 것으로, 많은 분들에게 영감을 줄 수 있을 거라고 생각해요. 삶이란 정말 예측할 수 없는 것 같아요. 하지만 그렇기 때문에 더욱 소중하고 의미있는 것 같습니다.",
        
        "기술의 발전은 정말 놀라워요. 불과 몇 년 전만 해도 상상할 수 없었던 일들이 지금은 당연한 것처럼 여겨지고 있어요. 인공지능, 가상현실, 블록체인 등 새로운 기술들이 우리의 삶을 완전히 바꿔놓고 있습니다. 이런 변화의 시대에 우리는 어떻게 적응해야 할까요?",
        
        // 영어 더미 자막들
        "Hello everyone! Welcome back to my channel. Today I'm going to share something really exciting with you. This has been a project I've been working on for months, and I'm finally ready to reveal it. I hope you'll find this as fascinating as I do. Please don't forget to like and subscribe if you enjoy this content!",
        
        "Technology is advancing at an incredible pace. What seemed impossible just a few years ago is now becoming reality. Artificial intelligence, machine learning, and automation are transforming every aspect of our lives. We're living in truly revolutionary times, and it's both exciting and challenging.",
        
        "The importance of education cannot be overstated in today's rapidly changing world. We need to constantly learn and adapt to new technologies and ways of thinking. Lifelong learning is no longer just an option; it's a necessity for success in the modern world. What skills do you think will be most important in the future?",
        
        // 긴 형태의 더미 자막
        "오늘 이야기할 주제는 정말 흥미로운 것입니다. 많은 분들이 궁금해하셨던 내용이기도 하고요. 제가 이 분야에서 10년 넘게 일하면서 느낀 점들을 솔직하게 말씀드리려고 합니다. 처음에는 정말 어려웠어요. 실패도 많이 했고, 포기하고 싶은 순간들도 있었습니다. 하지만 꾸준히 노력하다 보니 조금씩 결과가 나타나기 시작했어요. 지금 돌이켜보면 그 모든 과정이 소중한 경험이었다고 생각합니다."
    ];
    
    const sources = ['OpenAI Whisper', 'Google STT', '개발 테스트'];
    
    // 랜덤하게 더미 텍스트와 소스 선택
    const randomText = dummyTexts[Math.floor(Math.random() * dummyTexts.length)];
    const randomSource = sources[Math.floor(Math.random() * sources.length)];
    
    console.log('🧪 더미 자막 생성:', randomSource);
    
    // 실제 자막 추출과 동일한 방식으로 표시
    addSubtitleEntry(randomText, `${randomSource} (개발용)`);
}

// 🔄 리팩토링: TranscriptionUtils 사용으로 대폭 간소화된 메인 함수
async function startSimpleTranscription() {
    console.log('🎙️ 자막 추출 시작 - 초기화 확인');
    
    // state 변수 확인 및 생성
    const appState = window.state || window.programContext?.state || {
        uploadedFile: null,
        videoPreview: null
    };
    
    // 파일 업로드 먼저 체크
    if (!appState.uploadedFile) {
        console.warn('⚠️ 영상 파일이 업로드되지 않았습니다.');
        alert('📹 먼저 영상 파일을 업로드해주세요.\n\n📂 영상 파일을 드래그하거나 "새 영상 불러오기" 버튼을 클릭하세요.');
        return;
    }
    
    // DOM 요소 초기화 확인
    initializeDOMElements();
    
    // 버튼 비활성화 (중복 클릭 방지)
    if (startTranscriptionBtn) {
        startTranscriptionBtn.disabled = true;
        startTranscriptionBtn.textContent = '자막 추출 중...';
    }
    
    try {
        // state 변수 확인 및 생성
        const appState = window.state || window.programContext?.state || {
            uploadedFile: null,
            videoPreview: null
        };
        
        console.log('📊 현재 상태:', {
            hasState: !!appState,
            hasFile: !!appState.uploadedFile,
            hasTranscriptionUtils: !!window.transcriptionUtils,
            fileName: appState.uploadedFile?.name || 'None'
        });
        
        // 파일 업로드 재확인
        if (!appState.uploadedFile) {
            throw new Error('영상 파일이 업로드되지 않았습니다.');
        }
        
        // 🔄 기존 방식 직접 사용 (두 번 클릭 문제 해결)
        console.log('✅ 바로 자막 추출 실행');
        await startSimpleTranscriptionLegacy();
    } catch (error) {
        console.error('❌ 자막 추출 실패:', error);
        
        // 에러 처리 개선
        let errorMessage = error.message || '알 수 없는 오류가 발생했습니다.';
        
        if (error.message && error.message.includes('uploadedFile')) {
            errorMessage = '📹 먼저 영상 파일을 업로드해주세요.';
        } else if (error.message && error.message.includes('state')) {
            errorMessage = '📊 애플리케이션 상태를 확인할 수 없습니다. 페이지를 새로고침해주세요.';
        }
        
        if (window.uiUtils) {
            window.uiUtils.showError(`자막 추출 실패: ${errorMessage}`);
        } else {
            alert(`자막 추출 실패: ${errorMessage}`);
        }
        
        // 프로그레스바 숨기기
        hideTranscriptionProgress();
    } finally {
        // 버튼 복원
        if (startTranscriptionBtn) {
            startTranscriptionBtn.disabled = false;
            startTranscriptionBtn.textContent = '자막 추출 시작';
        }
    }
}

// 🔄 리팩토링: 기존 방식 백업 (호환성 유지)
async function startSimpleTranscriptionLegacy() {
    // state 변수 안전하게 접근
    const appState = window.state || window.programContext?.state || {
        uploadedFile: null,
        videoPreview: null
    };
    
    if (!appState.uploadedFile) {
        alert('📹 먼저 영상 파일을 업로드해주세요.');
        return;
    }

    const selectedModelElement = modelSelector.querySelector('input[name="stt-model"]:checked');
    if (!selectedModelElement) {
        alert('🤖 음성 인식 모델을 선택해주세요.');
        return;
    }

    const selectedModel = selectedModelElement.value;
    
    startTranscriptionBtn.disabled = true;
    
    // 기존 자막 결과 모두 삭제
    const subtitleResultsContainer = document.querySelector('.subtitle-results-container');
    if (subtitleResultsContainer) {
        subtitleResultsContainer.innerHTML = `
            <div class="subtitle-placeholder-results">
                <div class="placeholder-icon">📝</div>
                <p>자막 추출 중...</p>
                <span>잠시만 기다려주세요</span>
            </div>
        `;
    }
    
    // 기존 플레이스홀더도 초기화
    if (subtitleContainer) {
        subtitleContainer.innerHTML = '';
    }
    
    // 프로그레스바 초기화 및 표시
    resetTranscriptionProgress();
    
    try {
        // 선택된 언어 확인
        const sourceLangElement = document.getElementById('sourceLang');
        const selectedLanguage = sourceLangElement ? sourceLangElement.value : 'ko-KR';
        console.log(`🎙️ 간단 자막 추출 시작: ${selectedModel} 모델, 언어: ${selectedLanguage}`);
        updateTranscriptionProgress(10, '🎙️ 자막 추출 시작', `${selectedModel} 모델 (${selectedLanguage})로 처리 중`);
        
        // 1. 오디오 추출
        updateTranscriptionProgress(20, '🎵 오디오 추출 중...', '영상에서 음성 데이터 추출');
        const audioChunks = await extractAudioWithWebAPI(appState.uploadedFile);
        
        // 2. 스마트 분할 기반 음성 인식
        updateTranscriptionProgress(70, '🎯 음성 인식 시작', `${audioChunks.length}개 조각 처리 예정`);
        const transcriptionEngine = selectedModel === 'google' ? transcribeWithGoogle : transcribeWithOpenAI;
        
        const results = [];
        const allSegments = [];
        
        for (let i = 0; i < audioChunks.length; i++) {
            try {
                const chunk = audioChunks[i];
                const chunkInfo = chunk.blob ? chunk : { blob: chunk, index: i, totalChunks: audioChunks.length };
                
                // 진행률 계산: 70% + (조각 진행률 * 25%)
                const chunkProgress = 70 + ((i / audioChunks.length) * 25);
                updateTranscriptionProgress(chunkProgress, `🎯 음성 인식 중... (${i + 1}/${audioChunks.length})`, 
                    `조각 ${i + 1}: ${(chunkInfo.blob.size / 1024 / 1024).toFixed(2)}MB 처리 중`);
                
                updatePlaceholder(`🎯 스마트 분할 음성 인식 중... (${i + 1}/${audioChunks.length})`);
                console.log(`🔄 조각 ${i + 1}/${audioChunks.length} 처리 중... (${(chunkInfo.blob.size / 1024 / 1024).toFixed(2)}MB)`);
                
                // 조각의 시작 시간 계산
                const chunkStartTime = chunkInfo.startTime || 0;
                const result = await transcriptionEngine(chunkInfo.blob, chunkStartTime);
                
                if (result && typeof result === 'object') {
                    // 타임스탬프가 있는 경우
                    results.push(result.fullText);
                    if (result.segments && result.segments.length > 0) {
                        allSegments.push(...result.segments);
                    }
                    console.log(`✅ 조각 ${i + 1} 완료: ${result.fullText.substring(0, 50)}... (${result.segments?.length || 0}개 세그먼트)`);
                } else {
                    // 기존 텍스트만 있는 경우
                    const text = result || '';
                    results.push(text);
                    console.log(`✅ 조각 ${i + 1} 완료: ${text.substring(0, 50)}...`);
                }
            } catch (chunkError) {
                console.warn(`⚠️ 조각 ${i + 1} 실패:`, chunkError.message);
                results.push('(처리 실패)');
            }
        }

        const fullTranscript = results
            .filter(text => text && !text.includes('처리 실패'))
            .join(' ');

        if (fullTranscript.trim()) {
            updateTranscriptionProgress(100, '✅ 자막 추출 완료!', `${fullTranscript.length}자 인식 성공`);
            
            // 타임스탬프가 있는 경우 세그먼트별로 표시, 없으면 전체 텍스트 표시
            if (allSegments.length > 0) {
                addSubtitleEntryWithTimestamp(allSegments, selectedModel === 'google' ? 'Google STT' : 'OpenAI Whisper');
                console.log(`🎉 타임스탬프 자막 추출 성공: ${fullTranscript.length}자, ${allSegments.length}개 세그먼트`);
            } else {
                addSubtitleEntry(fullTranscript, selectedModel === 'google' ? 'Google STT' : 'OpenAI Whisper');
                console.log(`🎉 자막 추출 성공: ${fullTranscript.length}자`);
            }
            
            updatePlaceholder('✅ 자막 추출 완료!');
            
            // 3초 후 프로그레스바 숨기기
            setTimeout(() => {
                hideTranscriptionProgress();
            }, 3000);
        } else {
            updateTranscriptionProgress(100, '⚠️ 음성 인식 실패', '인식된 텍스트가 없습니다');
            updatePlaceholder('⚠️ 인식된 음성이 없습니다.');
            
            // 5초 후 프로그레스바 숨기기
            setTimeout(() => {
                hideTranscriptionProgress();
            }, 5000);
        }
        
    } catch (error) {
        // 통합 에러 처리 시스템 사용
        if (window.errorHandler) {
            window.errorHandler.handleError({
                type: 'transcription',
                message: error.message,
                originalError: error,
                context: { 
                    function: 'startSimpleTranscriptionLegacy',
                    fileSize: appState.uploadedFile?.size,
                    fileName: appState.uploadedFile?.name
                },
                severity: 'high'
            });
        } else {
            // 폴백: 기존 에러 처리
            console.error('❌ 자막 추출 실패:', error);
            updateTranscriptionProgress(0, '❌ 자막 추출 실패', error.message);
            updatePlaceholder(`❌ ${error.message}`);
            
            // 5초 후 프로그레스바 숨기기
            setTimeout(() => {
                hideTranscriptionProgress();
            }, 5000);
        }
    } finally {
        startTranscriptionBtn.disabled = false;
    }
}

// 메모리 및 이벤트 관리 유틸리티 import
import eventManager from './utils/event-manager.js';
import memoryManager from './utils/memory-manager.js';

// 전역 함수 노출 (TranscriptionUtils에서 접근 가능하도록)
window.transcribeWithOpenAI = transcribeWithOpenAI;
window.transcribeWithGoogle = transcribeWithGoogle;

// 이벤트 리스너 설정 (강화된 버전)
export function setupSimpleTranscriptionEventListeners() {
    console.log('🎙️ 간단 자막 추출 시스템 초기화');
    
    // DOM 요소 초기화 (재시도 로직 포함)
    const setupWithRetry = (attempt = 1, maxAttempts = 3) => {
        const result = initializeDOMElements();
        
        if (startTranscriptionBtn) {
            // 메모리 안전한 이벤트 리스너 등록
            eventManager.addEventListener(startTranscriptionBtn, 'click', startSimpleTranscription);
            console.log('✅ 간단 자막 추출 이벤트 리스너 설정 완료');
            return true;
        } else {
            if (attempt < maxAttempts) {
                console.warn(`⚠️ 자막 추출 버튼을 찾을 수 없습니다 (시도 ${attempt}/${maxAttempts}). 1초 후 재시도...`);
                setTimeout(() => {
                    setupWithRetry(attempt + 1, maxAttempts);
                }, 1000);
            } else {
                console.error('❌ 자막 추출 버튼을 찾을 수 없습니다. HTML 구조를 확인해주세요.');
            }
            return false;
        }
    };
    
    // 첫 번째 시도
    if (!setupWithRetry()) {
        // DOM이 완전히 로드되지 않았을 수 있으므로 DOMContentLoaded 이벤트 대기
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setupWithRetry();
            });
        }
    }
    
    // �� 더미 자막 생성 버튼 이벤트 리스너
    const generateDummyBtn = document.getElementById('generateDummySubtitleBtn');
    if (generateDummyBtn) {
        eventManager.addEventListener(generateDummyBtn, 'click', function() {
            console.log('🧪 더미 자막 생성 버튼 클릭됨');
            generateDummySubtitle();
        });
        console.log('✅ 더미 자막 생성 이벤트 리스너 설정 완료');
    }

    // 🔄 리팩토링: AudioUtils와 MemoryManager 사용
    memoryManager.registerCleanupTask(async () => {
        // 🔄 리팩토링: AudioUtils 정리 사용 (안전한 호출)
        if (window.audioUtils && typeof window.audioUtils.cleanup === 'function') {
            try {
                await window.audioUtils.cleanup();
                console.log('✅ AudioUtils 정리 완료');
            } catch (cleanupError) {
                console.warn('⚠️ AudioUtils 정리 실패:', cleanupError.message);
            }
        } else {
            console.log('ℹ️ AudioUtils cleanup 함수를 찾을 수 없음 - 수동 정리');
            // 수동 정리
            if (window.currentAudioContext && window.currentAudioContext.state !== 'closed') {
                try {
                    await window.currentAudioContext.close();
                    console.log('✅ AudioContext 수동 정리 완료');
                } catch (error) {
                    console.warn('⚠️ AudioContext 수동 정리 실패:', error.message);
                }
            }
            window.currentAudioContext = null;
        }
        
        // FFmpeg Worker 정리
        if (window.currentFFmpegWorker) {
            memoryManager.cleanupWorker(window.currentFFmpegWorker);
            window.currentFFmpegWorker = null;
        }
    }, '🔄 리팩토링된 자막 추출 시스템 정리');
} 