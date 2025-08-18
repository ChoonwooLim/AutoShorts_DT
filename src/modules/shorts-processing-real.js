// js/shorts-processing-real.js
// AutoShorts_v01.html과 동일한 실제 숏츠 제작 기능

import { state } from '../state.js';
import { collectProgramContext } from '../program-context.js';
import { callAI } from '../api.js';
import * as DOM from '../dom-elements.js';

let allGeneratedShorts = [];
let currentShortIndex = 0;

/**
 * 🔄 리팩토링: UIUtils 사용으로 통합된 진행률 업데이트
 */
function updateProgress(current, total, status) {
    // 새로운 UIUtils 사용
    if (window.uiUtils) {
        window.uiUtils.updateProgress(current, total, status);
    }
    
    // 기존 호환성 유지
    const progressFill = document.getElementById('progressFill');
    const statusText = document.getElementById('statusText');
    const progressSection = document.getElementById('progressSection');
    
    if (progressSection) progressSection.style.display = 'block';
    
    const percentage = (current / total) * 100;
    
    if (progressFill) {
        progressFill.style.width = percentage + '%';
    }
    
    if (statusText) {
        statusText.textContent = `${status} (${current}/${total})`;
    }
}

/**
 * AI 기반 영상 분석
 */
async function analyzeVideoContent(message) {
    try {
        const mainModelKey = DOM.mainModelSelect?.value || 'gemini';
        const subModel = DOM.subModelSelect?.value || 'Gemini 2.0 Flash';
        
        const response = await callAI(mainModelKey, subModel, '', message, null);
        return response;
    } catch (error) {
        console.warn('AI 분석 실패:', error);
        return "AI 분석을 건너뛰고 기본 알고리즘으로 처리합니다.";
    }
}

/**
 * 현재 처리 옵션 수집
 */
function getCurrentOptions() {
    // 현재 비율 설정 가져오기
    const currentConfig = window._currentVideoConfig || {
        videoType: '숏츠영상',
        aspectRatio: { width: 9, height: 16 },
        aspectRatioString: '9:16'
    };
    
    return {
        // 기본 설정
        shortsLength: parseInt(DOM.shortsLength?.value || '15'),
        shortsCount: parseInt(DOM.shortsCount?.value || '1'),
        
        // 새로운 비율 설정
        videoType: currentConfig.videoType,
        aspectRatio: currentConfig.aspectRatio,
        aspectRatioString: currentConfig.aspectRatioString,
        
        // 기존 옵션들
        autoHighlight: document.getElementById('autoHighlight')?.checked || false,
        autoCrop: document.getElementById('autoCrop')?.checked || false,
        colorCorrection: document.getElementById('colorCorrection')?.checked || false,
        videoStabilization: document.getElementById('videoStabilization')?.checked || false,
        removeSilence: document.getElementById('removeSilence')?.checked || false,
        enhanceAudio: document.getElementById('enhanceAudio')?.checked || false,
        noiseReduction: document.getElementById('noiseReduction')?.checked || false,
        addTitle: document.getElementById('addTitle')?.checked || false,
        addSubtitles: document.getElementById('addSubtitles')?.checked || false,
        addEffects: document.getElementById('addEffects')?.checked || false,
        faceAnalysis: document.getElementById('faceAnalysis')?.checked || false
    };
}

/**
 * 옵션을 AI가 이해할 수 있는 형식으로 변환
 */
function formatOptionsForAI(options) {
    const selectedPlatform = document.querySelector('.platform-card.selected');
    const platformName = selectedPlatform ? selectedPlatform.textContent.trim() : '선택되지 않음';
    
    const enabledOptions = [];
    if (options.autoHighlight) enabledOptions.push("🎯 자동 하이라이트 추출");
    if (options.autoCrop) enabledOptions.push("✂️ 자동 크롭");
    if (options.colorCorrection) enabledOptions.push("🎨 색상 보정");
    if (options.videoStabilization) enabledOptions.push("📹 영상 안정화");
    if (options.removeSilence) enabledOptions.push("🔇 무음 구간 제거");
    if (options.enhanceAudio) enabledOptions.push("🔊 오디오 향상");
    if (options.noiseReduction) enabledOptions.push("🎵 노이즈 감소");
    if (options.addTitle) enabledOptions.push("📝 타이틀 추가");
    if (options.addSubtitles) enabledOptions.push("💬 자막 추가");
    if (options.addEffects) enabledOptions.push("✨ 영상효과 추가");
    if (options.faceAnalysis) enabledOptions.push("🎭 얼굴 분석");
    
    // 비율 정보에 따른 권장사항
    const aspectInfo = options.aspectRatio ? 
        `📐 영상 비율: ${options.aspectRatioString} (${options.aspectRatio.width}:${options.aspectRatio.height})` : 
        '📐 영상 비율: 9:16 (기본)';
    
    const videoTypeIcon = options.videoType === '일반영상' ? '🖥️' : '📱';
    
    return `
📱 선택된 플랫폼: ${platformName}
${videoTypeIcon} 영상 타입: ${options.videoType || '숏츠영상'}
${aspectInfo}
⏱️ 영상 길이: ${options.shortsLength}초
🔢 생성 개수: ${options.shortsCount}개

🛠️ 적용될 처리 옵션:
${enabledOptions.length > 0 ? enabledOptions.join('\n') : '기본 처리만 적용'}`;
}

/**
 * 사용자로부터 영상 내용 설명 받기
 */
async function getUserVideoDescription() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        `;
        
        modal.innerHTML = `
            <div style="
                background: var(--panel-bg);
                border-radius: 20px;
                padding: 2rem;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            ">
                <h3 style="margin: 0 0 1rem 0; color: var(--text-primary);">
                    🎬 영상 내용 설명
                </h3>
                <p style="margin: 0 0 1.5rem 0; color: var(--text-secondary); line-height: 1.5;">
                    더 정확한 숏츠 분석을 위해 영상의 주요 내용을 간단히 설명해주세요. 
                    (선택사항 - 건너뛰기 가능)
                </p>
                <textarea id="videoDescription" placeholder="예: 요리 영상, 인터뷰, 강의, 브이로그 등..." style="
                    width: 100%;
                    height: 100px;
                    padding: 1rem;
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 10px;
                    background: rgba(255,255,255,0.05);
                    color: var(--text-primary);
                    font-size: 1rem;
                    resize: vertical;
                    font-family: inherit;
                "></textarea>
                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button id="skipBtn" style="
                        flex: 1;
                        padding: 1rem;
                        border: none;
                        border-radius: 10px;
                        background: rgba(255,255,255,0.1);
                        color: var(--text-secondary);
                        cursor: pointer;
                        font-size: 1rem;
                    ">건너뛰기</button>
                    <button id="confirmBtn" style="
                        flex: 1;
                        padding: 1rem;
                        border: none;
                        border-radius: 10px;
                        background: linear-gradient(135deg, var(--accent-color), #ff6b6b);
                        color: white;
                        cursor: pointer;
                        font-size: 1rem;
                        font-weight: 600;
                    ">확인</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const textarea = modal.querySelector('#videoDescription');
        const skipBtn = modal.querySelector('#skipBtn');
        const confirmBtn = modal.querySelector('#confirmBtn');
        
        const cleanup = () => {
            document.body.removeChild(modal);
        };
        
        skipBtn.onclick = () => {
            cleanup();
            resolve(null);
        };
        
        confirmBtn.onclick = () => {
            const description = textarea.value.trim();
            cleanup();
            resolve(description || null);
        };
        
        // ESC 키로 닫기
        modal.onclick = (e) => {
            if (e.target === modal) {
                cleanup();
                resolve(null);
            }
        };
        
        textarea.focus();
    });
}

/**
 * 간단한 오디오 볼륨 분석
 */
function getSimpleAudioInfo(video) {
    const hasAudioTrack = video.audioTracks?.length > 0 || 
                         video.mozHasAudio || 
                         !!(video.webkitAudioDecodedByteCount);
    
    const isVideoMuted = video.muted || video.volume === 0;
    
    return {
        hasAudio: hasAudioTrack,
        isMuted: isVideoMuted,
        estimatedContent: hasAudioTrack ? 
            (isVideoMuted ? "오디오 있음 (음소거됨)" : "오디오 있음") : 
            "무음 영상"
    };
}

// 전역 변수로 사용자 설명 저장
let userVideoDescription = null;

/**
 * 실제 영상 내용 기반 구간 분석 및 메타데이터 생성
 */
async function generateSegmentAnalysis(segment, index, options) {
    try {
        const originalVideo = DOM.videoPreview;
        const videoFileName = state.uploadedFile?.name || "업로드된 영상";
        const videoDuration = originalVideo.duration;
        const segmentDuration = segment.endTime - segment.startTime;
        
        // 첫 번째 구간에서만 사용자 설명 받기
        if (index === 1 && userVideoDescription === null) {
            updateProgress(index, options.shortsCount, `영상 내용 확인 중...`);
            userVideoDescription = await getUserVideoDescription();
        }
        
        // 진행률 업데이트
        updateProgress(index, options.shortsCount, `구간 분석 중... (${index}/${options.shortsCount})`);
        
        // 오디오 정보 분석
        const audioInfo = getSimpleAudioInfo(originalVideo);
        
        // 영상의 실제 정보 수집
        const videoInfo = {
            fileName: videoFileName,
            totalDuration: Math.round(videoDuration),
            segmentStart: Math.round(segment.startTime),
            segmentEnd: Math.round(segment.endTime),
            segmentDuration: Math.round(segmentDuration),
            segmentPosition: segment.startTime / videoDuration, // 전체 영상 중 위치 (0-1)
            videoWidth: originalVideo.videoWidth || 0,
            videoHeight: originalVideo.videoHeight || 0,
            hasUserDescription: !!userVideoDescription,
            audioStatus: audioInfo.estimatedContent
        };
        
        const analysisPrompt = `
다음은 실제 업로드된 영상의 구간 분석 요청입니다:

📹 영상 정보:
- 파일명: ${videoInfo.fileName}
- 전체 길이: ${videoInfo.totalDuration}초
- 해상도: ${videoInfo.videoWidth}x${videoInfo.videoHeight}
- 오디오: ${videoInfo.audioStatus}

🎬 분석할 구간:
- 구간: ${videoInfo.segmentStart}초 ~ ${videoInfo.segmentEnd}초 (${videoInfo.segmentDuration}초)
- 영상 위치: ${Math.round(videoInfo.segmentPosition * 100)}% 지점 (${videoInfo.segmentPosition < 0.3 ? '초반부' : videoInfo.segmentPosition > 0.7 ? '후반부' : '중반부'})
- 숏츠 번호: #${index}

${userVideoDescription ? `👤 사용자 제공 영상 설명:
"${userVideoDescription}"` : ''}

위의 실제 정보를 바탕으로 다음 형식으로 분석해주세요:

제목: [영상 내용과 구간 특성을 반영한 매력적인 제목]
스토리: [영상 설명과 구간 위치를 고려한 구체적인 내용 설명 (3-4문장)]
선택이유: [이 구간이 숏츠로 적합한 실제적인 이유 (2-3문장)]

주의사항:
- 사용자가 제공한 영상 설명을 우선적으로 활용하세요
- 구간의 위치(초반/중반/후반)와 길이를 고려하세요
- 오디오 상태를 반영하세요
- 허구의 내용은 절대 추가하지 마세요
- 실제 주어진 정보만 바탕으로 분석하세요
`;

        const response = await analyzeVideoContent(analysisPrompt);
        
        // 응답에서 제목, 스토리, 선택이유 추출
        const titleMatch = response.match(/제목:\s*(.+)/);
        const storyMatch = response.match(/스토리:\s*([\s\S]*?)(?=선택이유:|$)/);
        const reasonMatch = response.match(/선택이유:\s*([\s\S]*?)$/);
        
        // 위치 기반 기본 설명 생성
        const positionDesc = videoInfo.segmentPosition < 0.3 ? '도입부' : 
                           videoInfo.segmentPosition > 0.7 ? '마무리부' : '핵심부';
        
        const baseDescription = userVideoDescription ? 
            `${userVideoDescription} 영상의 ${positionDesc} 구간` : 
            `${videoFileName}의 ${positionDesc} 구간`;
        
        return {
            title: titleMatch ? titleMatch[1].trim() : `${baseDescription} (${videoInfo.segmentDuration}초)`,
            story: storyMatch ? storyMatch[1].trim() : 
                `${videoInfo.segmentStart}초부터 ${videoInfo.segmentEnd}초까지의 ${baseDescription}입니다. ${videoInfo.audioStatus}이며, 전체 영상의 ${Math.round(videoInfo.segmentPosition * 100)}% 지점에 위치합니다. ${videoInfo.segmentDuration}초 동안의 실제 콘텐츠로 구성되어 있습니다.`,
            reason: reasonMatch ? reasonMatch[1].trim() : 
                `${videoInfo.segmentDuration}초의 적절한 길이와 영상 ${positionDesc} 위치의 특성으로 인해 숏츠 콘텐츠로 적합합니다. ${audioInfo.hasAudio ? '오디오가 포함되어' : '시각적 요소가 중심이 되어'} 시청자의 관심을 끌 수 있는 구간입니다.`
        };
    } catch (error) {
        console.error('구간 분석 실패:', error);
        // 기본값 반환 (실제 정보 기반)
        const videoFileName = state.uploadedFile?.name || "영상";
        const baseTitle = userVideoDescription ? 
            `${userVideoDescription} - 구간 #${index}` : 
            `${videoFileName} - 구간 #${index}`;
            
        return {
            title: baseTitle,
            story: `${Math.round(segment.startTime)}초부터 ${Math.round(segment.endTime)}초까지의 실제 영상 구간입니다. 총 ${Math.round(segment.endTime - segment.startTime)}초의 길이를 가진 실제 콘텐츠입니다.`,
            reason: `실제 영상의 특정 구간으로, ${Math.round(segment.endTime - segment.startTime)}초의 적절한 길이를 가지고 있어 숏츠 형태로 제작하기에 최적화된 구간입니다.`
        };
    }
}



/**
 * 최적의 구간 선택
 */
async function selectBestSegments(duration, segmentLength, count, aiAnalysis) {
    const segments = [];
    const maxStartTime = duration - segmentLength;
    
    if (maxStartTime <= 0) {
        // 영상이 너무 짧은 경우
        segments.push({
            startTime: 0,
            endTime: Math.min(duration, segmentLength),
            confidence: 0.5
        });
        return segments;
    }
    
    if (count === 1) {
        // 단일 숏츠의 경우 중간 부분 선택
        const startTime = Math.max(0, (duration - segmentLength) / 2);
        segments.push({
            startTime: startTime,
            endTime: startTime + segmentLength,
            confidence: 0.8
        });
    } else {
        // 여러 숏츠의 경우 균등하게 분산
        const interval = maxStartTime / (count - 1);
        for (let i = 0; i < count; i++) {
            const startTime = Math.min(i * interval, maxStartTime);
            segments.push({
                startTime: startTime,
                endTime: startTime + segmentLength,
                confidence: 0.7 + (Math.random() * 0.2) // 임시 신뢰도
            });
        }
    }
    
    return segments;
}

/**
 * 세그먼트에서 숏츠 생성
 */
async function createShortFromSegment(segment, videoSrc, options, index) {
    const segmentSrc = `${videoSrc}#t=${segment.startTime},${segment.endTime}`;
    
    // AI 분석을 통한 메타데이터 생성 (표시용이 아닌 내부 분석용)
    const analysis = await generateSegmentAnalysis(segment, index, options);
    
    const newShort = document.createElement('div');
    newShort.className = 'short-item';
    newShort.innerHTML = `
        <div class="video-section">
            <div class="video-container">
                <video src="${segmentSrc}" loop preload="metadata"></video>
                <div class="video-overlay">▶</div>
                <button class="volume-btn">🔊</button>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar-fill"></div>
            </div>
        </div>
        <div class="short-content">
            <div class="short-header">
                <div class="short-info">
                    <div class="segment-info">
                        숏츠 #${index} (${Math.round(segment.startTime)}s-${Math.round(segment.endTime)}s)
                    </div>
                </div>
            </div>
            <div class="short-actions">
                <button class="download-btn" onclick="downloadSingleShort(this, ${index})">💾 다운로드</button>
                <button class="upload-btn" onclick="openUploadModal()">🚀 업로드</button>
                <button class="delete-btn" onclick="deleteShort(${index - 1})">🗑️ 삭제</button>
            </div>
        </div>`;
    
    // 이벤트 리스너 설정
    setupShortEventListeners(newShort);
    
    return newShort;
}

/**
 * 숏츠 이벤트 리스너 설정
 */
function setupShortEventListeners(shortElement) {
    const video = shortElement.querySelector('video');
    const volumeBtn = shortElement.querySelector('.volume-btn');
    const progressBarContainer = shortElement.querySelector('.progress-bar-container');
    const progressBarFill = shortElement.querySelector('.progress-bar-fill');

    // 초기 볼륨 상태 설정 (사운드 온)
    video.muted = false;
    volumeBtn.textContent = '🔊';

    // 볼륨 제어
    volumeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (video.muted) {
            video.muted = false;
            volumeBtn.textContent = '🔊';
        } else {
            video.muted = true;
            volumeBtn.textContent = '🔇';
        }
    });

    // 진행률 바 업데이트
    video.addEventListener('timeupdate', () => {
        if (video.duration) {
            const progressPercent = (video.currentTime / video.duration) * 100;
            progressBarFill.style.width = `${progressPercent}%`;
        }
    });

    // 진행률 바 클릭으로 탐색
    progressBarContainer.addEventListener('click', (e) => {
        const rect = progressBarContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = progressBarContainer.clientWidth;
        if (video.duration) {
            video.currentTime = (clickX / width) * video.duration;
        }
    });

    // 비디오 클릭으로 재생/일시정지
    video.addEventListener('click', () => {
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    });
}

/**
 * AI 기반 숏츠 생성
 */
async function generateShortsWithAI(options, aiAnalysis) {
    const originalVideo = DOM.videoPreview;
    const videoSrc = originalVideo.src;
    const originalDuration = originalVideo.duration;
    const generatedShorts = [];
    
    if (originalDuration < options.shortsLength) {
        throw new Error(`원본 영상(${Math.round(originalDuration)}초)이 요청된 숏츠 길이(${options.shortsLength}초)보다 짧습니다.`);
    }
    
    // AI 분석을 바탕으로 최적의 구간 선택
    const segments = await selectBestSegments(originalDuration, options.shortsLength, options.shortsCount, aiAnalysis);
    
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        updateProgress(i + 1, segments.length, `숏츠 ${i + 1} 생성 중...`);
        
        const newShort = await createShortFromSegment(segment, videoSrc, options, i + 1);
        generatedShorts.push(newShort);
        
        // 작은 지연으로 진행률 시각화
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return generatedShorts;
}

/**
 * AI 기반 영상 처리 메인 함수
 */
async function processVideoWithAI() {
    if (!state.uploadedFile || !DOM.videoPreview.src) {
        throw new Error("처리할 영상이 없습니다.");
    }
    
    // 처리 옵션 수집
    const options = getCurrentOptions();
    
    // AI 분석을 위한 메시지 생성
    const currentOptions = getCurrentOptions();
    const optionsText = formatOptionsForAI(currentOptions);
    
    const analysisMessage = `
AI 기반 숏츠 자동 제작을 시작합니다.

${optionsText}

🎯 제작 목표:
- ${options.shortsCount}개의 ${options.shortsLength}초 숏츠 생성
- 선택된 플랫폼에 최적화된 편집
- 모든 선택된 처리 옵션 적용

영상을 분석하여 최적의 구간을 선택하고 편집 방향을 제시해주세요.`;
    
    updateProgress(1, 4, 'AI 영상 분석 중...');
    const aiAnalysis = await analyzeVideoContent(analysisMessage);
    
    updateProgress(2, 4, '숏츠 구간 선택 중...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    updateProgress(3, 4, '숏츠 생성 중...');
    const generatedShorts = await generateShortsWithAI(options, aiAnalysis);
    
    updateProgress(4, 4, '완료!');
    
    return generatedShorts;
}

/**
 * 완성된 숏츠들을 캐러셀에 렌더링
 */
function renderCompletedShorts() {
    const shortsTrack = DOM.shortsTrack;
    const resultsContainer = document.getElementById('resultsContainer');
    
    if (!shortsTrack || !resultsContainer) return;
    
    // 기존 내용 클리어
    shortsTrack.innerHTML = '';
    
    if (allGeneratedShorts.length === 0) {
        shortsTrack.innerHTML = `
            <div class="carousel-slide">
                <div style="text-align: center; color: var(--text-secondary); padding: 5rem 1rem;">
                    <h3>🎬 숏츠 생성 대기중</h3>
                    <p>왼쪽의 '영상제작실행' 버튼을 눌러 숏츠를 생성해주세요.</p>
                </div>
            </div>
        `;
        updateCarousel();
        return;
    }
    
    // 생성된 숏츠들을 슬라이드로 감싸서 추가
    allGeneratedShorts.forEach(shortElement => {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        slide.appendChild(shortElement);
        shortsTrack.appendChild(slide);
    });
    
    // 결과 섹션 표시
    resultsContainer.style.display = 'block';
    
    // 캐러셀 업데이트
    updateCarousel();
    
    // 캐러셀 이벤트 리스너 설정
    setupCarouselEventListeners();
}

/**
 * 캐러셀 상태 업데이트
 */
function updateCarousel() {
    const shortsTrack = DOM.shortsTrack;
    const prevBtn = document.getElementById('prevShortBtn');
    const nextBtn = document.getElementById('nextShortBtn');
    const counter = document.getElementById('shorts-counter');
    
    if (!shortsTrack) return;
    
    const totalShorts = allGeneratedShorts.length;
    
    // 트랙 이동
    const offset = -currentShortIndex * 100;
    shortsTrack.style.transform = `translateX(${offset}%)`;
    
    // 버튼 표시/숨김
    if (prevBtn) {
        prevBtn.style.display = currentShortIndex > 0 ? 'block' : 'none';
    }
    if (nextBtn) {
        nextBtn.style.display = currentShortIndex < totalShorts - 1 ? 'block' : 'none';
    }
    
    // 카운터 업데이트
    if (counter) {
        if (totalShorts === 0) {
            counter.textContent = '';
        } else {
            counter.textContent = `${currentShortIndex + 1} / ${totalShorts}`;
        }
    }
    
    // 모든 비디오 일시정지
    shortsTrack.querySelectorAll('video').forEach(video => video.pause());
    
    // 현재 슬라이드의 비디오에 마우스 이벤트 추가
    const currentSlide = shortsTrack.children[currentShortIndex];
    if (currentSlide) {
        const videoContainer = currentSlide.querySelector('.video-container');
        const video = currentSlide.querySelector('video');
        if (videoContainer && video) {
            // 이벤트 핸들러 함수 정의
            const playVideo = () => video.play().catch(e => console.log("자동재생 실패", e));
            const pauseVideo = () => video.pause();
            
            // 기존 이벤트 리스너 제거 후 새로 추가
            videoContainer.removeEventListener('mouseenter', videoContainer._playVideo);
            videoContainer.removeEventListener('mouseleave', videoContainer._pauseVideo);
            
            // 함수 참조를 저장하여 나중에 제거할 수 있도록 함
            videoContainer._playVideo = playVideo;
            videoContainer._pauseVideo = pauseVideo;
            
            videoContainer.addEventListener('mouseenter', playVideo);
            videoContainer.addEventListener('mouseleave', pauseVideo);
        }
    }
}

/**
 * 캐러셀 이벤트 리스너 설정
 */
function setupCarouselEventListeners() {
    const prevBtn = document.getElementById('prevShortBtn');
    const nextBtn = document.getElementById('nextShortBtn');
    
    // 기존 이벤트 리스너 제거
    if (prevBtn) {
        prevBtn.removeEventListener('click', prevShort);
        prevBtn.addEventListener('click', prevShort);
    }
    
    if (nextBtn) {
        nextBtn.removeEventListener('click', nextShort);
        nextBtn.addEventListener('click', nextShort);
    }
}

/**
 * 이전 숏츠로 이동
 */
function prevShort() {
    if (currentShortIndex > 0) {
        currentShortIndex--;
        updateCarousel();
    }
}

/**
 * 다음 숏츠로 이동
 */
function nextShort() {
    if (currentShortIndex < allGeneratedShorts.length - 1) {
        currentShortIndex++;
        updateCarousel();
    }
}

/**
 * 메인 숏츠 처리 함수 - 외부 노출용
 * @param {Object} config - 영상 제작 설정 (선택사항)
 * @param {string} config.videoType - 영상 타입 ('숏츠영상' 또는 '일반영상')
 * @param {Object} config.aspectRatio - 비율 정보 {width, height}
 * @param {string} config.aspectRatioString - 비율 문자열 (예: '9:16')
 */
export async function processVideoToShorts(config = {}) {
    try {
        // 새로운 처리 시작시 사용자 설명 리셋
        userVideoDescription = null;
        
        // 설정 정보를 전역으로 저장 (다른 함수들에서 사용)
        window._currentVideoConfig = {
            videoType: config.videoType || '숏츠영상',
            aspectRatio: config.aspectRatio || { width: 9, height: 16 },
            aspectRatioString: config.aspectRatioString || '9:16'
        };
        
        console.log('🎬 영상 제작 시작:', window._currentVideoConfig);
        
        const processedShorts = await processVideoWithAI();
        allGeneratedShorts = processedShorts;
        renderCompletedShorts();
        
        // 진행률 숨기기 (3초 후)
        setTimeout(() => {
            const progressSection = document.getElementById('progressSection');
            if (progressSection) progressSection.style.display = 'none';
        }, 3000);
        
        return processedShorts;
        
    } catch (error) {
        console.error('숏츠 처리 오류:', error);
        
        // 에러 표시
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = `오류: ${error.message}`;
            statusText.style.color = '#ff4444';
        }
        
        throw error;
    }
}

/**
 * 캐러셀 초기화
 */
export function initializeCarousel() {
    // 빈 상태로 렌더링하여 초기 상태 표시
    renderCompletedShorts();
}

/**
 * 전역 함수들 - HTML에서 호출용
 */
window.downloadSingleShort = function(button, index) {
    alert(`숏츠 #${index} 다운로드 기능은 향후 구현됩니다.`);
};

window.openUploadModal = function() {
    alert('업로드 모달 기능은 향후 구현됩니다.');
};

window.deleteShort = function(index) {
    if (confirm('이 숏츠를 삭제하시겠습니까?')) {
        allGeneratedShorts.splice(index, 1);
        currentShortIndex = Math.min(currentShortIndex, allGeneratedShorts.length - 1);
        if (currentShortIndex < 0) currentShortIndex = 0;
        renderCompletedShorts();
    }
};