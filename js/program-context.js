// js/program-context.js
// 프로그램의 현재 상태와 컨텍스트를 수집하고 동영상 분석 기능을 제공하는 모듈

import * as DOM from './dom-elements.js';
import { state } from './state.js';

/**
 * 프로그램의 현재 상태를 모두 수집하여 AI에게 제공할 컨텍스트 생성
 */
export function collectProgramContext() {
    const context = {
        // 업로드된 파일 정보
        uploadedFile: null,
        videoInfo: null,
        
        // 추출된 데이터
        subtitles: null,
        faceResults: null,

        // 선택된 플랫폼
        selectedPlatform: null,
        
        // 처리 설정
        settings: {
            shortsLength: null,
            shortsCount: null,
            playbackSpeed: null,
            faceAnalysis: false,
            autoSave: false,
            fileNaming: null,
            customName: null
        },
        
        // AI 모델 설정
        aiModel: {
            mainModel: null,
            subModel: null,
            hasApiKey: false
        },
        
        // 처리 상태
        processingStatus: {
            isProcessing: false,
            hasResults: false,
            completedShorts: 0
        },
        
        // 얼굴 분석 상태
        faceAnalysis: {
            isEnabled: false,
            isAnalyzing: false,
            hasResults: false
        }
    };
    
    // 업로드된 파일 정보 수집
    if (state.uploadedFile) {
        context.uploadedFile = {
            name: state.uploadedFile.name,
            size: formatFileSize(state.uploadedFile.size),
            type: state.uploadedFile.type,
            lastModified: new Date(state.uploadedFile.lastModified).toLocaleString()
        };
        
        // 동영상 정보 수집
        if (DOM.videoPreview && DOM.videoPreview.src) {
            context.videoInfo = {
                duration: DOM.videoPreview.duration ? `${Math.floor(DOM.videoPreview.duration)}초` : '로딩 중',
                currentTime: DOM.videoPreview.currentTime ? `${Math.floor(DOM.videoPreview.currentTime)}초` : '0초',
                width: DOM.videoPreview.videoWidth || '알 수 없음',
                height: DOM.videoPreview.videoHeight || '알 수 없음',
                playbackRate: DOM.videoPreview.playbackRate || 1,
                paused: DOM.videoPreview.paused
            };
        }
    }
    
    // 선택된 플랫폼 확인
    const selectedPlatformCard = document.querySelector('.platform-card.selected');
    if (selectedPlatformCard) {
        context.selectedPlatform = {
            name: selectedPlatformCard.textContent.trim(),
            platform: selectedPlatformCard.dataset.platform
        };
    }
    
    // 처리 설정 수집
    if (DOM.shortsLength) context.settings.shortsLength = DOM.shortsLength.value + '초';
    if (DOM.shortsCount) context.settings.shortsCount = DOM.shortsCount.value + '개';
    if (DOM.playbackSpeedSelect) context.settings.playbackSpeed = DOM.playbackSpeedSelect.value + 'x';
    if (DOM.faceAnalysisCheckbox) context.settings.faceAnalysis = DOM.faceAnalysisCheckbox.checked;
    if (DOM.autoSave) context.settings.autoSave = DOM.autoSave.checked;
    if (DOM.fileNaming) context.settings.fileNaming = DOM.fileNaming.value;
    if (DOM.customName) context.settings.customName = DOM.customName.value;
    
    // AI 모델 설정 수집
    if (DOM.mainModelSelect) {
        context.aiModel.mainModel = DOM.mainModelSelect.options[DOM.mainModelSelect.selectedIndex]?.text;
    }
    if (DOM.subModelSelect) {
        context.aiModel.subModel = DOM.subModelSelect.value;
    }
    
    // 처리 상태 확인
    const processButtons = [
        DOM.processBtn,
        document.getElementById('processShortsBtn'),
        document.getElementById('processGeneralBtn')
    ].filter(btn => btn); // null/undefined 제거
    
    if (processButtons.length > 0) {
        context.processingStatus.isProcessing = processButtons.some(btn => 
            btn.disabled && btn.textContent.includes('처리')
        );
    }
    
    // 결과 확인
    if (DOM.shortsTrack && DOM.shortsTrack.children.length > 0) {
        context.processingStatus.hasResults = true;
        context.processingStatus.completedShorts = DOM.shortsTrack.children.length;
    }
    
    // 얼굴 분석 상태 확인
    if (DOM.faceAnalysisCheckbox) {
        context.faceAnalysis.isEnabled = DOM.faceAnalysisCheckbox.checked;
    }
    if (DOM.analysisProgress) {
        context.faceAnalysis.isAnalyzing = DOM.analysisProgress.style.display !== 'none';
    }
    if (DOM.faceResults && DOM.faceResults.children.length > 0) {
        context.faceAnalysis.hasResults = true;
    }
    
    // 자막 및 얼굴 데이터 추가 (state에서 직접 가져오기)
    if (state.subtitles && state.subtitles.length > 0) {
        // 자막이 너무 길 수 있으므로 일부만 요약해서 제공
        context.subtitles = state.subtitles.slice(0, 10).map(s => `[${s.start.toFixed(1)}초] ${s.text}`).join('\n');
        if (state.subtitles.length > 10) {
            context.subtitles += '\n... 등';
        }
    }

    if (state.faceResults && state.faceResults.length > 0) {
        context.faceResults = {
            count: state.faceResults.length,
            // 얼굴 ID 목록을 요약해서 제공
            identities: [...new Set(state.faceResults.map(f => f.faceId))].slice(0, 5).join(', ') + (state.faceResults.length > 5 ? ' 등' : '')
        };
    }

    // V2 얼굴 분석 데이터 추가 (상세 정보 포함)
    if (state.v2FaceAnalysis && state.v2FaceAnalysis.status === 'completed' && state.v2FaceAnalysis.actors.length > 0) {
        context.v2FaceAnalysis = {
            status: '완료',
            actors: state.v2FaceAnalysis.actors.map(actor => ({
                id: actor.id,
                label: actor.label,
                gender: actor.gender,
                avgAge: Math.round(actor.avgAge),
                totalAppearances: actor.totalAppearances,
                appearances: actor.appearances, // AI가 동선 파악에 활용할 수 있도록 타임라인 정보 포함
                timeRanges: actor.timeRanges || [], // 출현 구간 (시작-끝 시간)
                frameNumbers: actor.frameNumbers || [], // 프레임 번호 정보
                mergedFrom: actor.mergedFrom || [], // 병합된 인물 정보
            }))
        };
    }
    
    // face-analysis.js의 detectedActors 데이터도 추가 (더 상세한 정보)
    if (typeof window !== 'undefined' && window.detectedActors && window.detectedActors.size > 0) {
        context.detectedActors = {
            count: window.detectedActors.size,
            actors: Array.from(window.detectedActors.values()).map(actor => ({
                id: actor.id,
                label: actor.label,
                totalAppearances: actor.totalAppearances,
                appearances: actor.appearances,
                timeRanges: actor.timeRanges || [],
                frameNumbers: actor.frameNumbers || [],
                mergedFrom: actor.mergedFrom || [],
                gender: actor.genders && actor.genders.length > 0 ? 
                    (actor.genders.filter(g => g === 'male').length > actor.genders.length / 2 ? '남성' : '여성') : '미상',
                avgAge: actor.ages && actor.ages.length > 0 ? 
                    Math.round(actor.ages.reduce((a, b) => a + b, 0) / actor.ages.length) : 0
            }))
        };
    }

    return context;
}

/**
 * 동영상에서 균등하게 최고 품질 프레임을 추출하여 이미지 데이터로 변환
 * 모든 모델에서 60프레임 기본 제공으로 최대한 정밀한 분석 지원
 * Gemini: 768x576 해상도, 0.85 품질로 최고 품질 분석
 * GPT: 512x384 해상도, 0.7 품질로 토큰 제한 내 최고 품질
 * 기타: 640x480 해상도, 0.75 품질로 고품질 분석
 */
export async function extractVideoFrames() {
    if (!DOM.videoPreview || !DOM.videoPreview.src || !state.uploadedFile) {
        throw new Error('분석할 동영상이 없습니다. 먼저 동영상을 업로드해주세요.');
    }
    
    const video = DOM.videoPreview;
    const duration = video.duration;
    
    if (!duration || duration === 0) {
        throw new Error('동영상 길이를 확인할 수 없습니다. 동영상이 완전히 로드되었는지 확인해주세요.');
    }

    // 🎯 품질 우선 동영상 분석: 모든 모델에서 최고 품질 제공
    const aiModel = getCurrentAIModel(); // 현재 선택된 AI 모델 확인
    let maxFrames;
    
    if (aiModel && aiModel.toLowerCase().includes('gpt')) {
        // GPT 계열: 60프레임으로 최고 품질 (TPM 초과 시 Gemini 권장)
        maxFrames = 60;
        console.log('🤖 GPT 모델 감지: 60프레임으로 최고 품질 설정 (TPM 제한 주의)');
    } else if (aiModel && aiModel.toLowerCase().includes('gemini')) {
        // Gemini: 60프레임 최고 품질
        maxFrames = 60;
        console.log('🤖 Gemini 모델 감지: 60프레임으로 최고 품질 설정');
    } else if (aiModel && aiModel.toLowerCase().includes('claude')) {
        // Claude: 60프레임으로 최고 품질
        maxFrames = 60;
        console.log('🤖 Claude 모델 감지: 60프레임으로 최고 품질 설정');
    } else {
        // 기타 모델: 60프레임으로 최고 품질
        maxFrames = 60;
        console.log('🤖 기타 모델: 60프레임으로 최고 품질 설정');
    }
    
    const framesToExtractCount = Math.min(Math.floor(duration), maxFrames);

    if (framesToExtractCount === 0) {
        console.warn('영상이 너무 짧아 프레임을 추출할 수 없습니다.');
        return [];
    }
    
    console.log(`🎬 고품질 프레임 추출: ${duration.toFixed(1)}초 영상에서 ${framesToExtractCount}개 프레임 추출 (품질 우선)`);

    const frames = [];
    const interval = duration / framesToExtractCount;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // 🚨 품질 우선: AI 모델별 이미지 크기 조정 (최고 품질)
    let maxWidth, maxHeight;
    if (aiModel && aiModel.toLowerCase().includes('gpt')) {
        // GPT: 토큰 제한 고려한 최적 크기
        maxWidth = 512;
        maxHeight = 384;
        console.log('🖼️ GPT 모델: 이미지 크기 512x384로 설정 (토큰 제한 고려)');
    } else if (aiModel && aiModel.toLowerCase().includes('gemini')) {
        // Gemini: 최고 품질을 위한 큰 크기
        maxWidth = 768;
        maxHeight = 576;
        console.log('🖼️ Gemini 모델: 이미지 크기 768x576로 최고 품질 설정');
    } else {
        // 기타: 높은 품질을 위한 크기
        maxWidth = 640;
        maxHeight = 480;
        console.log('🖼️ 기타 모델: 이미지 크기 640x480로 고품질 설정');
    }
    
    // 원본 비율 유지하면서 최대 크기 제한
    const originalWidth = video.videoWidth || 640;
    const originalHeight = video.videoHeight || 480;
    const aspectRatio = originalWidth / originalHeight;
    
    if (originalWidth > maxWidth) {
        canvas.width = maxWidth;
        canvas.height = Math.round(maxWidth / aspectRatio);
    } else if (originalHeight > maxHeight) {
        canvas.height = maxHeight;
        canvas.width = Math.round(maxHeight * aspectRatio);
    } else {
        canvas.width = originalWidth;
        canvas.height = originalHeight;
    }
    
    for (let i = 0; i < framesToExtractCount; i++) {
        // 각 구간의 중간 지점에서 프레임을 추출하여 대표성 확보
        const time = interval * i + (interval / 2);
        
        try {
            await new Promise((resolve, reject) => {
                const handleSeeked = () => {
                    video.removeEventListener('seeked', handleSeeked);
                    resolve();
                };
                
                const handleError = () => {
                    video.removeEventListener('error', handleError);
                    reject(new Error('동영상 프레임 추출 중 오류가 발생했습니다.'));
                };
                
                video.addEventListener('seeked', handleSeeked, { once: true });
                video.addEventListener('error', handleError, { once: true });
                
                video.currentTime = time;
                
                // 품질 유지 최적화: 타임아웃 단축으로 응답성 개선
                setTimeout(() => {
                    video.removeEventListener('seeked', handleSeeked);
                    video.removeEventListener('error', handleError);
                    reject(new Error('프레임 추출 시간 초과'));
                }, 2000); // 5초 → 2초로 단축하여 무한 대기 방지
            });
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // 🚨 품질 우선: AI 모델별 이미지 품질 조정 (최고 품질)
            let imageQuality;
            if (aiModel && aiModel.toLowerCase().includes('gpt')) {
                imageQuality = 0.7; // GPT: 높은 품질 (토큰 제한 고려)
            } else if (aiModel && aiModel.toLowerCase().includes('gemini')) {
                imageQuality = 0.85; // Gemini: 최고 품질
            } else {
                imageQuality = 0.75; // 기타: 높은 품질
            }
            
            const dataUrl = canvas.toDataURL('image/jpeg', imageQuality);
            
            frames.push({
                time: Math.floor(time),
                dataUrl: dataUrl,
                name: `frame_${Math.floor(time)}s.jpg`,
                size: Math.floor(dataUrl.length * 0.75)
            });
            
        } catch (error) {
            console.warn(`프레임 ${i + 1}/${framesToExtractCount} 추출 실패 (${time.toFixed(1)}초):`, error);
        }
    }
    
    if (frames.length === 0) {
        throw new Error('동영상 프레임을 추출할 수 없습니다. 동영상 파일이 유효한지 확인해주세요.');
    }
    
    console.log(`✅ 고품질 프레임 추출 완료: ${frames.length}개 (최고 품질 설정으로 정밀 분석 지원)`);
    return frames;
}

/**
 * 프로그램 컨텍스트를 AI가 이해할 수 있는 텍스트로 변환
 */
export function formatContextForAI(context) {
    let contextText = '📊 **AutoShorts 프로그램 현재 상황**\n\n';
    
    // 업로드된 파일 정보
    if (context.uploadedFile) {
        contextText += `🎬 **업로드된 동영상:**\n`;
        contextText += `- 파일명: ${context.uploadedFile.name}\n`;
        contextText += `- 크기: ${context.uploadedFile.size}\n`;
        contextText += `- 업로드 시간: ${context.uploadedFile.lastModified}\n\n`;
        
        if (context.videoInfo) {
            contextText += `📹 **동영상 정보:**\n`;
            contextText += `- 길이: ${context.videoInfo.duration}\n`;
            contextText += `- 현재 재생 위치: ${context.videoInfo.currentTime}\n`;
            contextText += `- 해상도: ${context.videoInfo.width} x ${context.videoInfo.height}\n`;
            contextText += `- 재생 속도: ${context.videoInfo.playbackRate}x\n`;
            contextText += `- 상태: ${context.videoInfo.paused ? '일시정지' : '재생 중'}\n\n`;
        }
    } else {
        contextText += `⚠️ **동영상 없음:** 아직 동영상이 업로드되지 않았습니다.\n\n`;
    }

    // 추출된 데이터 정보
    if (context.subtitles) {
        contextText += `📜 **추출된 자막 내용 (일부):**\n${context.subtitles}\n\n`;
    }
    if (context.faceResults) {
        contextText += `👥 **얼굴 분석 결과:**\n`;
        contextText += `- 인식된 인물 수: ${context.faceResults.count}명\n`;
        contextText += `- 주요 인물 ID: ${context.faceResults.identities}\n\n`;
    }
    
    // V2 얼굴 분석 결과
    if (context.v2FaceAnalysis) {
        contextText += `🎭 **V2 얼굴 분석 결과 (전문가 모드):**\n`;
        contextText += `- **상태:** ${context.v2FaceAnalysis.status}\n`;
        contextText += `- **식별된 주요 인물:**\n`;
        context.v2FaceAnalysis.actors.forEach(actor => {
            contextText += `  - **${actor.label}**: 추정 ${actor.gender}, 약 ${actor.avgAge}세. 총 ${actor.totalAppearances}회 등장.\n`;
        });
        contextText += `\n`;
        contextText += `💡 **AI 활용 Tip:** "인물 #1의 동선을 알려줘" 또는 "2번 인물이 주로 어떤 행동을 해?" 와 같이 질문하여 특정 인물의 행동을 분석할 수 있습니다.\n\n`;
    }
    
    // detectedActors 얼굴 분석 결과 (상세 정보)
    if (context.detectedActors) {
        contextText += `👥 **배우 얼굴 갤러리 분석 결과:**\n`;
        contextText += `- **총 식별된 인물 수:** ${context.detectedActors.count}명\n\n`;
        
        context.detectedActors.actors.forEach((actor, index) => {
            contextText += `**${index + 1}. ${actor.label}**\n`;
            contextText += `   - 성별: ${actor.gender}\n`;
            contextText += `   - 추정 나이: ${actor.avgAge}세\n`;
            contextText += `   - 총 등장 횟수: ${actor.totalAppearances}회\n`;
            
            if (actor.timeRanges && actor.timeRanges.length > 0) {
                contextText += `   - 주요 출현 구간: `;
                const ranges = actor.timeRanges.slice(0, 3).map(range => 
                    `${range.start.toFixed(1)}s-${range.end.toFixed(1)}s`
                ).join(', ');
                contextText += ranges;
                if (actor.timeRanges.length > 3) {
                    contextText += ` 외 ${actor.timeRanges.length - 3}개 구간`;
                }
                contextText += `\n`;
            }
            
            if (actor.frameNumbers && actor.frameNumbers.length > 0) {
                const sampleFrames = actor.frameNumbers.slice(0, 5).join(', ');
                contextText += `   - 등장 프레임 (일부): ${sampleFrames}`;
                if (actor.frameNumbers.length > 5) {
                    contextText += ` 외 ${actor.frameNumbers.length - 5}개`;
                }
                contextText += `\n`;
            }
            
            if (actor.mergedFrom && actor.mergedFrom.length > 0) {
                contextText += `   - 🔄 **중요 - 동일인물 병합 정보:**\n`;
                contextText += `     * ${actor.label}는 영상 분석 과정에서 조명, 각도, 표정 변화로 인해\n`;
                contextText += `       다음 이름들로 각각 인식되었으나, 실제로는 **모두 같은 한 사람**입니다:\n`;
                contextText += `       ${actor.mergedFrom.map(m => m.label).join(', ')}\n`;
                contextText += `     * 따라서 ${actor.label} = ${actor.mergedFrom.map(m => m.label).join(' = ')} (동일인물)\n`;
            }
            
            contextText += `\n`;
        });
        
        contextText += `⚠️ **AI 분석 시 필수 주의사항:**\n`;
        contextText += `- 병합된 인물들은 **절대로 여러 명이 아닙니다**\n`;
        contextText += `- 각 병합 인물은 **오직 한 사람**이며, 단지 분석 과정에서 여러 이름으로 인식되었을 뿐입니다\n`;
        contextText += `- 예: "James Johnson (James Smith 포함)"이라면 → James Johnson = James Smith = **동일한 한 사람**\n`;
        contextText += `- 분석 시에는 병합된 모든 이름을 하나의 인물로 취급해야 합니다\n\n`;
    }
    
    // 최근 작업 로그에서 인물 병합 정보 추가
    if (state.workLogs && state.workLogs.length > 0) {
        const recentMergeLogs = state.workLogs
            .filter(log => log.type === '인물 병합' || log.description.includes('병합'))
            .slice(-5) // 최근 5개만
            .reverse(); // 최신 순으로 정렬
            
        if (recentMergeLogs.length > 0) {
            contextText += `📋 **최근 인물 병합 작업 로그:**\n`;
            recentMergeLogs.forEach(log => {
                contextText += `- ${log.date} ${log.time}: ${log.description}\n`;
            });
            contextText += `\n💡 **병합 로그 해석 방법:**\n`;
            contextText += `- "A, B → C로 병합"은 A와 B가 실제로는 C라는 한 사람이라는 의미\n`;
            contextText += `- 영상 분석 과정에서 조명, 각도, 표정 변화로 같은 사람이 다른 사람으로 오인식된 것\n`;
            contextText += `- 사용자가 수동으로 동일인물임을 확인하고 병합한 결과입니다\n\n`;
        }
    }
    
    // 선택된 플랫폼
    if (context.selectedPlatform) {
        contextText += `🌐 **선택된 플랫폼:** ${context.selectedPlatform.name}\n\n`;
    } else {
        contextText += `⚠️ **플랫폼 미선택:** 아직 플랫폼이 선택되지 않았습니다.\n\n`;
    }
    
    // 처리 설정
    contextText += `⚙️ **처리 설정:**\n`;
    contextText += `- 숏츠 길이: ${context.settings.shortsLength || '미설정'}\n`;
    contextText += `- 숏츠 개수: ${context.settings.shortsCount || '미설정'}\n`;
    contextText += `- 재생 속도: ${context.settings.playbackSpeed || '미설정'}\n`;
    contextText += `- 얼굴 분석: ${context.settings.faceAnalysis ? '활성화' : '비활성화'}\n`;
    contextText += `- 자동 저장: ${context.settings.autoSave ? '활성화' : '비활성화'}\n`;
    if (context.settings.customName) {
        contextText += `- 사용자 정의 이름: ${context.settings.customName}\n`;
    }
    contextText += '\n';
    
    // AI 모델 정보
    contextText += `🤖 **AI 설정:**\n`;
    contextText += `- 메인 모델: ${context.aiModel.mainModel || '미선택'}\n`;
    contextText += `- 서브 모델: ${context.aiModel.subModel || '미선택'}\n\n`;
    
    // 처리 상태
    contextText += `🔄 **처리 상태:**\n`;
    if (context.processingStatus.isProcessing) {
        contextText += `- 현재 영상 처리 중...\n`;
    } else if (context.processingStatus.hasResults) {
        contextText += `- 완료된 숏츠: ${context.processingStatus.completedShorts}개\n`;
    } else {
        contextText += `- 대기 중 (처리 시작 전)\n`;
    }
    contextText += '\n';
    
    // 얼굴 분석 상태
    if (context.faceAnalysis.isEnabled) {
        contextText += `👥 **얼굴 분석 상태:**\n`;
        if (context.faceAnalysis.isAnalyzing) {
            contextText += `- 현재 얼굴 분석 중...\n`;
        } else if (context.faceAnalysis.hasResults) {
            contextText += `- 얼굴 분석 완료\n`;
        } else {
            contextText += `- 얼굴 분석 대기 중\n`;
        }
        contextText += '\n';
    }
    
    contextText += `---\n위는 현재 AutoShorts 프로그램의 전체 상황입니다. 이 정보를 바탕으로 사용자의 질문에 정확하고 도움이 되는 답변을 제공해주세요.`;
    
    return contextText;
}

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 현재 선택된 AI 모델을 확인합니다 (TPM 제한 고려용)
 * @returns {string} 현재 AI 모델 이름
 */
function getCurrentAIModel() {
    try {
        // UI에서 선택된 모델 확인
        const modelSelect = document.getElementById('aiModelSelect');
        const subModelSelect = document.getElementById('aiSubModelSelect');
        
        if (modelSelect && modelSelect.value) {
            const mainModel = modelSelect.value;
            const subModel = subModelSelect ? subModelSelect.value : '';
            
            console.log(`🔍 현재 선택된 AI 모델: ${mainModel} ${subModel}`);
            return `${mainModel} ${subModel}`.trim();
        }
        
        // 기본값 반환
        console.log('⚠️ AI 모델 선택 정보를 찾을 수 없음, 기본값 사용');
        return 'unknown';
        
    } catch (error) {
        console.error('❌ AI 모델 확인 중 오류:', error);
        return 'unknown';
    }
}

/**
 * 동영상 분석 설정 상태를 확인하는 디버깅 도구
 */
window.checkVideoAnalysisSettings = function() {
    const aiModel = getCurrentAIModel();
    console.log(`
🎬 동영상 분석 설정 확인 (품질 우선 설정)

🤖 현재 AI 모델: ${aiModel}

🏆 최고 품질 분석 설정:
${aiModel.toLowerCase().includes('gpt') ? `
🔥 GPT 모델 - 최고 품질 (토큰 제한 고려)
• 프레임 수: 60개 (최대 정밀도)
• 이미지 크기: 512x384 (토큰 제한 내 최적)
• 이미지 품질: 0.7 (고품질)
• max_tokens: 1000 (이미지) / 2000 (텍스트)
⚠️ TPM 제한 주의: 429 오류 발생 시 Gemini 권장
` : aiModel.toLowerCase().includes('gemini') ? `
✅ Gemini 모델 - 최고 품질 (권장)
• 프레임 수: 60개 (최대 정밀도)
• 이미지 크기: 768x576 (최고 해상도)
• 이미지 품질: 0.85 (최고 품질)
• TPM 제한 없음 (Google)
` : aiModel.toLowerCase().includes('claude') ? `
🔥 Claude 모델 - 최고 품질
• 프레임 수: 60개 (최대 정밀도)
• 이미지 크기: 640x480 (고해상도)
• 이미지 품질: 0.75 (고품질)
• max_tokens: 1000 (이미지) / 2000 (텍스트)
` : `
🔥 기타 모델 - 최고 품질
• 프레임 수: 60개 (최대 정밀도)
• 이미지 크기: 640x480 (고해상도)
• 이미지 품질: 0.75 (고품질)
• max_tokens: 2000
`}

🎯 품질 우선 방식:
• 모든 영상: 60프레임 고정 → 최대 정밀 분석
• 높은 해상도: 세밀한 디테일 캡처
• 높은 품질: 압축 아티팩트 최소화
• 전체 맥락: 전체 영상 내용 파악

⚠️ 품질 우선의 한계:
• 60개 고해상도 이미지로 인한 처리 시간 증가
• Gemini API 요청 크기 증가
• 네트워크 전송 시간 증가

💡 품질 유지 최적화 제안:
• 프레임 추출 병렬 처리 (현재 순차 처리)
• 이미지 압축 알고리즘 개선 (WebP 등)  
• ✅ 프레임 추출 타임아웃 최적화 (5초 → 2초 개선됨)
• 불필요한 지연 제거

⚡ 이미 적용된 최적화:
• 프레임 추출 타임아웃 단축 (5초 → 2초)
• Canvas 컨텍스트 성능 최적화
• 메모리 사용 최적화

💡 사용법:
• checkVideoAnalysisSettings() - 현재 설정 확인
• 동영상 분석 시 자동으로 60프레임 추출 (품질 우선)
    `);
    
    return {
        model: aiModel,
        qualityFirst: true, // 품질 우선 설정
        maxFrames: 60,
        imageSize: aiModel.toLowerCase().includes('gpt') ? '512x384' : aiModel.toLowerCase().includes('gemini') ? '768x576' : '640x480',
        imageQuality: aiModel.toLowerCase().includes('gpt') ? 0.7 : aiModel.toLowerCase().includes('gemini') ? 0.85 : 0.75,
        optimizationPotential: '품질 유지하며 처리 최적화 가능'
    };
}; 