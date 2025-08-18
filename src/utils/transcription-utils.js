/**
 * 🎙️ TranscriptionUtils - 자막 추출 관련 유틸리티 클래스
 * 
 * 중복 코드 제거 및 함수 모듈화를 위한 자막 추출 관련 공통 기능 모음
 * - 자막 추출 워크플로우 관리
 * - 검증 및 초기화
 * - 결과 처리
 * - 오류 처리
 */

class TranscriptionUtils {
    constructor() {
        this.isProcessing = false;
        this.currentProgress = 0;
    }

    /**
     * 자막 추출 시작 전 검증
     * @param {Object} state 애플리케이션 상태
     * @param {HTMLElement} modelSelector 모델 선택 요소
     * @returns {Object} 검증 결과
     */
    validateTranscriptionStart(state, modelSelector) {
        // 파일 업로드 확인
        if (!state.uploadedFile) {
            return {
                isValid: false,
                error: '📹 먼저 영상 파일을 업로드해주세요.'
            };
        }

        // 모델 선택 확인
        const selectedModelElement = modelSelector.querySelector('input[name="stt-model"]:checked');
        if (!selectedModelElement) {
            return {
                isValid: false,
                error: '🤖 음성 인식 모델을 선택해주세요.'
            };
        }

        const selectedModel = selectedModelElement.value;
        const selectedLanguage = document.getElementById('sourceLang').value;

        return {
            isValid: true,
            selectedModel,
            selectedLanguage
        };
    }

    /**
     * UI 초기화 (자막 결과 영역 클리어)
     */
    initializeUI() {
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
        const subtitleContainer = document.getElementById('subtitleContainer');
        if (subtitleContainer) {
            subtitleContainer.innerHTML = '';
        }
    }

    /**
     * 진행률 업데이트 및 로깅
     * @param {number} progress 진행률 (0-100)
     * @param {string} message 메인 메시지
     * @param {string} detail 상세 메시지
     */
    updateProgress(progress, message, detail = '') {
        this.currentProgress = progress;
        
        // UIUtils 사용
        if (window.uiUtils) {
            window.uiUtils.showProgress(progress, message, progress >= 100);
        }
        
        // 기존 함수 호환성 유지
        if (typeof updateTranscriptionProgress === 'function') {
            updateTranscriptionProgress(progress, message, detail);
        }
        
        console.log(`📊 진행률: ${progress}% - ${message}${detail ? ` (${detail})` : ''}`);
    }

    /**
     * 오디오 조각들을 순차적으로 처리
     * @param {Array} audioChunks 오디오 조각 배열
     * @param {Function} transcriptionEngine 음성 인식 엔진
     * @returns {Object} 처리 결과
     */
    async processAudioChunks(audioChunks, transcriptionEngine) {
        const results = [];
        const allSegments = [];
        
        this.updateProgress(70, '🎯 음성 인식 시작', `${audioChunks.length}개 조각 처리 예정`);
        
        for (let i = 0; i < audioChunks.length; i++) {
            try {
                const chunk = audioChunks[i];
                const chunkInfo = chunk.blob ? chunk : { 
                    blob: chunk, 
                    index: i, 
                    totalChunks: audioChunks.length 
                };
                
                // 진행률 계산: 70% + (조각 진행률 * 25%)
                const chunkProgress = 70 + ((i / audioChunks.length) * 25);
                const chunkSizeMB = (chunkInfo.blob.size / 1024 / 1024).toFixed(2);
                
                this.updateProgress(
                    chunkProgress, 
                    `🎯 음성 인식 중... (${i + 1}/${audioChunks.length})`, 
                    `조각 ${i + 1}: ${chunkSizeMB}MB 처리 중`
                );
                
                // UIUtils 플레이스홀더 업데이트
                if (window.uiUtils) {
                    window.uiUtils.updatePlaceholder(`🎯 스마트 분할 음성 인식 중... (${i + 1}/${audioChunks.length})`);
                }
                
                console.log(`🔄 조각 ${i + 1}/${audioChunks.length} 처리 중... (${chunkSizeMB}MB)`);
                
                // 조각의 시작 시간 계산
                const chunkStartTime = chunkInfo.startTime || 0;
                const result = await transcriptionEngine(chunkInfo.blob, chunkStartTime);
                
                // 결과 처리
                this.processChunkResult(result, results, allSegments, i + 1);
                
            } catch (chunkError) {
                // 통합 에러 처리 시스템 사용
                if (window.errorHandler) {
                    window.errorHandler.handleError({
                        type: 'transcription',
                        message: chunkError.message,
                        originalError: chunkError,
                        context: { 
                            function: 'processAudioChunks',
                            chunkIndex: i + 1,
                            totalChunks: audioChunks.length
                        },
                        severity: 'medium'
                    });
                } else {
                    console.warn(`⚠️ 조각 ${i + 1} 실패:`, chunkError.message);
                }
                results.push('(처리 실패)');
            }
        }
        
        return { results, allSegments };
    }

    /**
     * AI를 사용하여 자막을 요약하고 대화창에 표시합니다.
     * @param {string} transcript - 요약할 전체 자막 텍스트
     */
    async summarizeAndDisplay(transcript) {
        if (!transcript || transcript.length < 50) { // 너무 짧은 텍스트는 요약하지 않음
            console.log('ℹ️ 텍스트가 너무 짧아 요약하지 않습니다.');
            return;
        }

        console.log(`🤖 AI 자막 요약 시작... (텍스트 길이: ${transcript.length}자)`);

        try {
            // 현재 선택된 AI 모델 가져오기 (ui-chat.js의 DOM 참조)
            const mainModelSelect = document.getElementById('main-model-select');
            const subModelSelect = document.getElementById('sub-model-select');

            if (!mainModelSelect || !subModelSelect) {
                console.warn('⚠️ AI 모델 선택기를 찾을 수 없어 요약을 건너뜁니다.');
                return;
            }

            const modelKey = mainModelSelect.value;
            const subModel = subModelSelect.value;

            const systemPrompt = `You are a professional AI assistant specializing in video content. Your task is to read the entire provided transcript from a video and create a concise, high-quality summary in Korean. The summary should be 3-5 sentences and capture the main topics and flow of the entire video from beginning to end. Do not omit key information.`;
            const userMessage = `Here is the full transcript. Please provide a summary in Korean.\n\n---\nTRANSCRIPT START\n---\n\n${transcript}\n\n---\nTRANSCRIPT END\n---`;

            // api.js의 callAI 함수 직접 호출
            if (window.callAI) {
                const summary = await window.callAI(modelKey, subModel, systemPrompt, userMessage);
                
                // ui-chat.js의 함수를 사용하여 대화창에 표시
                if (window.addSystemMessageToChat) {
                    window.addSystemMessageToChat(summary, '자막 요약');
                    console.log('✅ AI 요약 완료 및 대화창에 표시');
                } else {
                    console.warn('⚠️ addSystemMessageToChat 함수를 찾을 수 없습니다.');
                }
            } else {
                console.warn('⚠️ callAI 함수를 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('❌ 자막 요약 중 오류 발생:', error);
            if (window.addSystemMessageToChat) {
                window.addSystemMessageToChat(`자막 요약에 실패했습니다: ${error.message}`, '오류');
            }
        }
    }

    /**
     * 개별 조각 결과 처리
     * @param {Object|string} result 음성 인식 결과
     * @param {Array} results 전체 결과 배열
     * @param {Array} allSegments 전체 세그먼트 배열
     * @param {number} chunkIndex 조각 인덱스
     */
    processChunkResult(result, results, allSegments, chunkIndex) {
        if (result && typeof result === 'object') {
            // 타임스탬프가 있는 경우
            results.push(result.fullText);
            if (result.segments && result.segments.length > 0) {
                allSegments.push(...result.segments);
            }
            console.log(`✅ 조각 ${chunkIndex} 완료: ${result.fullText.substring(0, 50)}... (${result.segments?.length || 0}개 세그먼트)`);
        } else {
            // 기존 텍스트만 있는 경우
            const text = result || '';
            results.push(text);
            console.log(`✅ 조각 ${chunkIndex} 완료: ${text.substring(0, 50)}...`);
        }
    }

    /**
     * 최종 결과 처리 및 표시
     * @param {Array} results 결과 배열
     * @param {Array} allSegments 세그먼트 배열
     * @param {string} selectedModel 선택된 모델
     */
    processFinalResults(results, allSegments, selectedModel) {
        const fullTranscript = results
            .filter(text => text && !text.includes('처리 실패'))
            .join(' ');

        if (fullTranscript.trim()) {
            this.updateProgress(100, '✅ 자막 추출 완료!', `${fullTranscript.length}자 인식 성공`);
            
            const sourceName = selectedModel === 'google' ? 'Google STT' : 'OpenAI Whisper';
            
            // 타임스탬프가 있는 경우 세그먼트별로 표시, 없으면 전체 텍스트 표시
            if (allSegments.length > 0) {
                if (typeof addSubtitleEntryWithTimestamp === 'function') {
                    addSubtitleEntryWithTimestamp(allSegments, sourceName);
                }
                console.log(`🎉 타임스탬프 자막 추출 성공: ${fullTranscript.length}자, ${allSegments.length}개 세그먼트`);
            } else {
                if (typeof addSubtitleEntry === 'function') {
                    addSubtitleEntry(fullTranscript, sourceName);
                }
                console.log(`🎉 자막 추출 성공: ${fullTranscript.length}자`);
            }
            
            // AI 요약 기능 호출
            this.summarizeAndDisplay(fullTranscript);
            
            // UIUtils 플레이스홀더 업데이트
            if (window.uiUtils) {
                window.uiUtils.updatePlaceholder('✅ 자막 추출 완료!');
                window.uiUtils.showSuccess('자막 추출 완료!');
            }
            
            // 3초 후 프로그레스바 숨기기
            setTimeout(() => {
                if (typeof hideTranscriptionProgress === 'function') {
                    hideTranscriptionProgress();
                }
            }, 3000);
            
            return true; // 성공
        } else {
            this.updateProgress(100, '⚠️ 음성 인식 실패', '인식된 텍스트가 없습니다');
            
            if (window.uiUtils) {
                window.uiUtils.updatePlaceholder('⚠️ 인식된 음성이 없습니다.');
                window.uiUtils.showWarning('인식된 음성이 없습니다.');
            }
            
            // 5초 후 프로그레스바 숨기기
            setTimeout(() => {
                if (typeof hideTranscriptionProgress === 'function') {
                    hideTranscriptionProgress();
                }
            }, 5000);
            
            return false; // 실패
        }
    }

    /**
     * 오류 처리
     * @param {Error} error 발생한 오류
     */
    handleError(error) {
        // 통합 에러 처리 시스템 사용
        if (window.errorHandler) {
            window.errorHandler.handleError({
                type: 'transcription',
                message: error.message,
                originalError: error,
                context: { 
                    function: 'TranscriptionUtils.executeWorkflow',
                    class: 'TranscriptionUtils'
                },
                severity: 'high'
            });
        } else {
            // 폴백: 기존 에러 처리
            console.error('❌ 자막 추출 실패:', error);
            
            this.updateProgress(0, '❌ 자막 추출 실패', error.message);
            
            if (window.uiUtils) {
                window.uiUtils.showError('자막 추출 실패', error.message);
            } else if (typeof updatePlaceholder === 'function') {
                updatePlaceholder(`❌ ${error.message}`);
            }
            
            // 5초 후 프로그레스바 숨기기
            setTimeout(() => {
                if (typeof hideTranscriptionProgress === 'function') {
                    hideTranscriptionProgress();
                }
            }, 5000);
        }
    }

    /**
     * 처리 상태 설정
     * @param {boolean} isProcessing 처리 중 여부
     */
    setProcessingState(isProcessing) {
        this.isProcessing = isProcessing;
        
        // 버튼 상태 업데이트
        const startBtn = document.getElementById('startTranscriptionBtn');
        if (startBtn) {
            startBtn.disabled = isProcessing;
        }
    }

    /**
     * 음성 인식 엔진 선택
     * @param {string} selectedModel 선택된 모델 ('google' 또는 'openai')
     * @returns {Function} 음성 인식 함수
     */
    getTranscriptionEngine(selectedModel) {
        if (selectedModel === 'google') {
            // Google STT 엔진 확인
            if (typeof transcribeWithGoogle === 'function') {
                return transcribeWithGoogle;
            } else if (window.transcribeWithGoogle) {
                return window.transcribeWithGoogle;
            }
            console.warn('❌ Google STT 엔진을 찾을 수 없습니다.');
            return null;
        } else {
            // OpenAI Whisper 엔진 확인
            if (typeof transcribeWithOpenAI === 'function') {
                return transcribeWithOpenAI;
            } else if (window.transcribeWithOpenAI) {
                return window.transcribeWithOpenAI;
            }
            console.warn('❌ OpenAI Whisper 엔진을 찾을 수 없습니다.');
            return null;
        }
    }

    /**
     * 진행률 리셋
     */
    resetProgress() {
        this.currentProgress = 0;
        if (typeof resetTranscriptionProgress === 'function') {
            resetTranscriptionProgress();
        }
    }

    /**
     * 디버그 정보 로깅
     * @param {string} message 메시지
     * @param {any} data 추가 데이터
     */
    debugLog(message, data = null) {
        if (window.uiUtils) {
            window.uiUtils.debugLog(message, data);
        } else {
            console.log(`🐛 ${message}`, data || '');
        }
    }

    /**
     * 전체 워크플로우 실행
     * @param {Object} params 실행 파라미터
     * @returns {Promise<boolean>} 성공 여부
     */
    async executeWorkflow({ state, modelSelector, extractAudioFn }) {
        try {
            this.setProcessingState(true);
            
            // 1. 검증
            const validation = this.validateTranscriptionStart(state, modelSelector);
            if (!validation.isValid) {
                alert(validation.error);
                return false;
            }
            
            const { selectedModel, selectedLanguage } = validation;
            
            // 2. UI 초기화
            this.initializeUI();
            this.resetProgress();
            
            // 3. 시작 로깅
            console.log(`🎙️ 간단 자막 추출 시작: ${selectedModel} 모델, 언어: ${selectedLanguage}`);
            this.updateProgress(10, '🎙️ 자막 추출 시작', `${selectedModel} 모델 (${selectedLanguage})로 처리 중`);
            
            // 4. 오디오 추출
            this.updateProgress(20, '🎵 오디오 추출 중...', '영상에서 음성 데이터 추출');
            const audioChunks = await extractAudioFn(state.uploadedFile);
            
            // 5. 음성 인식 엔진 선택
            const transcriptionEngine = this.getTranscriptionEngine(selectedModel);
            if (!transcriptionEngine) {
                throw new Error(`${selectedModel} 음성 인식 엔진을 찾을 수 없습니다.`);
            }
            
            // 6. 오디오 조각 처리
            const { results, allSegments } = await this.processAudioChunks(audioChunks, transcriptionEngine);
            
            // 7. 최종 결과 처리
            return this.processFinalResults(results, allSegments, selectedModel);
            
        } catch (error) {
            this.handleError(error);
            return false;
        } finally {
            this.setProcessingState(false);
        }
    }
}

// 싱글톤 인스턴스 생성
const transcriptionUtils = new TranscriptionUtils();

// ES6 모듈과 전역 스코프 모두 지원
if (typeof module !== 'undefined' && module.exports) {
    module.exports = transcriptionUtils;
} else {
    window.transcriptionUtils = transcriptionUtils;
}
