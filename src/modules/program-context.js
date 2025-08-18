// js/program-context.js
// 프로그램의 현재 상태와 컨텍스트를 수집하고 동영상 분석 기능을 제공하는 모듈

import * as DOM from '../dom-elements.js';
import { state } from '../state.js';

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

    // V2 얼굴 분석 데이터 추가
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
            }))
        };
    }

    return context;
}

/**
 * 동영상에서 1초당 1프레임씩, 최대 60프레임까지 균등하게 추출하여 이미지 데이터로 변환
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

    // 1초당 1프레임, 최대 60개로 제한
    const framesToExtractCount = Math.min(Math.floor(duration), 60);

    if (framesToExtractCount === 0) {
        console.warn('영상이 너무 짧아 프레임을 추출할 수 없습니다.');
        return [];
    }
    
    console.log(`🎬 프레임 추출 계획: ${duration.toFixed(1)}초 영상에서 ${framesToExtractCount}개 프레임 추출`);

    const frames = [];
    const interval = duration / framesToExtractCount;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
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
                
                setTimeout(() => {
                    video.removeEventListener('seeked', handleSeeked);
                    video.removeEventListener('error', handleError);
                    reject(new Error('프레임 추출 시간 초과'));
                }, 5000);
            });
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            
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
    
    console.log(`✅ 최종 추출된 프레임: ${frames.length}개`);
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
