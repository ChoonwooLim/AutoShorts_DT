// js/face-analyzer-new.js
// "세계 최고"를 지향하는 전문가용 얼굴 분석 엔진

import { state, workLogManager } from './state.js';
// 💡 `face-analysis.js`에서 라이브러리 로딩 함수를 가져옵니다.
import { ensureLibrariesLoaded } from './face-analysis.js';

function getModelBasePath() {
    try {
        const hostname = window.location.hostname;
        const port = window.location.port;
        if (hostname === 'localhost' && port === '5173') return '/models';
        if (hostname === 'localhost' && port === '3000') return '/AutoShortsWeb/public/models';
        if (hostname === 'twinverse.org' || hostname === 'www.twinverse.org') return '/AutoShortsWeb/models';
        return '/models';
    } catch (e) {
        return '/models';
    }
}
const MODEL_URL = getModelBasePath();
let modelsLoaded = false;
let isAnalyzing = false;

// 외부에서 호출할 수 있는 초기화 함수
export function initializeFaceAnalyzer() {
    console.log('🎭 Face analyzer V2 system initializing...');
    
    requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
            try {
                initializeUIElements();
                await loadModels();
                console.log('✅ Face analyzer V2 system initialized successfully');
            } catch (error) {
                console.error('❌ Failed to initialize face analyzer V2 system:', error);
            }
        });
    });
}

// --- UI Elements ---
let videoEl;
let progressContainer;
let progressText;
let progressBarFill;
let resultsContainer;
let analyzeBtn;
let mergeBtn; 
let mergeControls;

let currentActors = [];

function initializeUIElements() {
    videoEl = document.getElementById('videoPreview');
    progressContainer = document.getElementById('faceAnalysisProgressContainer'); 
    progressText = document.getElementById('faceAnalysisProgressText');
    progressBarFill = document.getElementById('faceAnalysisProgressBar');
    resultsContainer = document.getElementById('faceAnalysisResults');
    analyzeBtn = document.getElementById('analyzeFacesBtnV2'); 
    mergeBtn = document.getElementById('mergeBtn');
    mergeControls = document.getElementById('mergeControls');
    
    if (!progressContainer || !progressText || !progressBarFill || !resultsContainer) {
        console.error("Face Analyzer V2의 필수 UI 요소를 찾을 수 없습니다.");
        throw new Error("UI 초기화 실패");
    }

    console.log('🎭 Face analyzer V2 UI elements initialized');
}

function updateState(newState) {
    Object.assign(state.v2FaceAnalysis, newState);
    console.log('Face analysis state updated:', state.v2FaceAnalysis);
}

/**
 * 전문가 분석에 필요한 모든 AI 모델을 로드합니다.
 */
async function loadModels() {
    if (modelsLoaded) return true;
    
    // 💡 `faceapi.js` 라이브러리가 로드될 때까지 기다립니다.
    await ensureLibrariesLoaded();

    if (!progressText || !progressContainer) {
        console.error("loadModels: UI 요소가 준비되지 않았습니다.");
        return false;
    }

    const progressPayload = {
        progressText: '전문가용 분석 모델 로딩 중...',
        progress: 0
    };
    updateState(progressPayload);
    progressText.textContent = progressPayload.progressText;
    progressContainer.style.display = 'block';

    try {
        console.log('⏳ V2(전문가) 모델 로딩 시작...');
        // 💡 이제 'faceapi'는 항상 정의되어 있습니다.
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        modelsLoaded = true;
        progressText.textContent = '전문가 모델 로드 완료.';
        setTimeout(() => { progressContainer.style.display = 'none'; }, 2000);
        console.log('✅ V2(전문가) 모델 로딩 완료.');
        return true;
    } catch (error) {
        console.error('❌ V2(전문가) 모델 로딩 실패:', error);
        progressText.textContent = '오류: 모델 로딩 실패';
        updateState({ status: 'error', error: '모델 로딩에 실패했습니다.' });
        alert('얼굴 분석 모델 로딩에 실패했습니다. 인터넷 연결을 확인해주세요.');
        return false;
    }
}

// (displayResults, handleMerge, startAnalysis 함수들은 변경 없음)
function displayResults(actors, duration) {
    resultsContainer.innerHTML = '';
    currentActors = actors; 

    updateState({ actors: actors, status: 'completed', progress: 100 });
    
    if (actors.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align: center; color: #888;">영상에서 인물을 찾지 못했습니다.</p>';
        if (mergeControls) mergeControls.style.display = 'none';
        return;
    }

    if (mergeControls) mergeControls.style.display = 'block';
    if (mergeBtn) mergeBtn.disabled = true;

    actors.sort((a, b) => b.totalAppearances - a.totalAppearances);

    actors.forEach((actor, index) => {
        const emotions = Object.entries(actor.emotionSummary)
            .sort(([, a], [, b]) => b - a)
            .map(([emotion, count]) => `${emotion}(${count})`)
            .join(', ');

        const timelineMarkers = actor.appearances.map(time =>
            `<div class="timeline-marker" style="left: ${(time / duration) * 100}%;" data-time="${time}"></div>`
        ).join('');

        const actorCard = document.createElement('div');
        actorCard.className = 'face-card professional';
        actorCard.dataset.actorId = actor.id;
        actorCard.innerHTML = `
            <div class="face-card-selection">
                <input type="checkbox" class="actor-checkbox" data-actor-id="${actor.id}">
            </div>
            <img src="${actor.image}" alt="${actor.label}" class="face-card-img">
            <div class="face-card-content">
                <div class="face-card-header">
                    <div class="face-card-title">
                        <h4>${actor.label}</h4>
                        <p>추정: ${actor.gender}, 약 ${Math.round(actor.avgAge)}세</p>
                    </div>
                </div>
                <div class="face-card-body">
                    <p><strong>총 등장 횟수:</strong> ${actor.totalAppearances}회</p>
                    <p><strong>주요 감정:</strong> ${emotions || '분석 정보 없음'}</p>
                    <p><strong>등장 타임라인:</strong></p>
                    <div class="timeline-container">${timelineMarkers}</div>
                </div>
            </div>
        `;
        resultsContainer.appendChild(actorCard);
    });

    resultsContainer.querySelectorAll('.timeline-marker').forEach(marker => {
        marker.addEventListener('click', (e) => {
            const time = parseFloat(e.target.dataset.time);
            if (videoEl) {
                videoEl.currentTime = time;
                videoEl.play(); 
                setTimeout(() => videoEl.pause(), 500);
            }
        });
    });

    resultsContainer.querySelectorAll('.actor-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const selectedCount = resultsContainer.querySelectorAll('.actor-checkbox:checked').length;
            if (mergeBtn) mergeBtn.disabled = selectedCount < 2;

            const card = checkbox.closest('.face-card');
            if (checkbox.checked) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    });
}

function handleMerge() {
    const selectedCheckboxes = resultsContainer.querySelectorAll('.actor-checkbox:checked');
    if (selectedCheckboxes.length < 2) {
        alert('병합하려면 두 명 이상의 인물을 선택해야 합니다.');
        return;
    }

    const selectedActorIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.actorId);
    
    const actorsToMerge = currentActors.filter(actor => selectedActorIds.includes(actor.id));
    const remainingActors = currentActors.filter(actor => !selectedActorIds.includes(actor.id));

    const mergedDetections = actorsToMerge.flatMap(actor => actor.detections);
    
    const bestDetection = mergedDetections.reduce((best, current) => 
        current.detection.box.area > best.detection.box.area ? current : best
    );

    const faceCanvas = document.createElement('canvas');
    videoEl.currentTime = bestDetection.timestamp;
    videoEl.onseeked = () => { 
        const { x, y, width, height } = bestDetection.detection.box;
        const widthScale = 1.5, heightScale = 2.0;
        const newWidth = width * widthScale, newHeight = height * heightScale;
        let newX = x - (newWidth - width) / 2, newY = y - (newHeight - height) / 3;
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        const finalWidth = Math.min(newWidth, videoEl.videoWidth - newX);
        const finalHeight = Math.min(newHeight, videoEl.videoHeight - newY);
        faceCanvas.width = finalWidth;
        faceCanvas.height = finalHeight;
        faceCanvas.getContext('2d', { willReadFrequently: true }).drawImage(videoEl, newX, newY, finalWidth, finalHeight, 0, 0, finalWidth, finalHeight);

        const gender = mergedDetections.map(d => d.gender).sort((a,b) => mergedDetections.filter(v => v.gender===a).length - mergedDetections.filter(v => v.gender===b).length).pop();
        const avgAge = mergedDetections.reduce((sum, d) => sum + d.age, 0) / mergedDetections.length;
        const emotionSummary = {};
        mergedDetections.forEach(d => {
            const topEmotion = Object.keys(d.expressions).reduce((a, b) => d.expressions[a] > d.expressions[b] ? a : b);
            emotionSummary[topEmotion] = (emotionSummary[topEmotion] || 0) + 1;
        });

        const mergedActor = {
            id: `actor-${Date.now()}-${Math.random()}`,
            label: actorsToMerge[0].label,
            image: faceCanvas.toDataURL(),
            gender: gender === 'male' ? '남성' : '여성',
            avgAge: avgAge,
            emotionSummary: emotionSummary,
            totalAppearances: mergedDetections.length,
            appearances: mergedDetections.map(d => d.timestamp).sort((a,b) => a - b),
            detections: mergedDetections
        };

        const newActorList = [mergedActor, ...remainingActors];
        displayResults(newActorList, videoEl.duration);
        
        workLogManager.addWorkLog('face-analysis', `인물 병합: ${actorsToMerge.map(a => a.label).join(', ')} -> ${mergedActor.label}`);
    };
}

export async function startAnalysis() {
    if (isAnalyzing) {
        alert('분석이 이미 진행 중입니다.');
        return;
    }
    isAnalyzing = true;
    
    updateState({ status: 'analyzing', progress: 0, progressText: '분석 준비 중...', actors: [], error: null });

    initializeUIElements();

    // 분석 시작 시 컨테이너 표시
    const v2Container = document.getElementById('faceAnalysisV2Container');
    if (v2Container) v2Container.style.display = 'block';

    if (mergeBtn) mergeBtn.addEventListener('click', handleMerge);

    resultsContainer.innerHTML = '<p style="text-align: center; color: #888;">전문가 분석을 시작합니다. 정확도를 위해 시간이 오래 소요될 수 있습니다...</p>';
    if (analyzeBtn) {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = '분석 중...';
    }
    progressBarFill.style.width = '0%';
    progressContainer.style.display = 'block';

    if (!state.uploadedFile || !videoEl.src) {
        alert('먼저 동영상 파일을 업로드해주세요.');
        updateState({ status: 'error', error: '동영상 파일이 없습니다.'});
        isAnalyzing = false;
        if (analyzeBtn) analyzeBtn.disabled = false;
        if (analyzeBtn) analyzeBtn.textContent = '얼굴 분석 (V2)';
        if (mergeControls) mergeControls.style.display = 'none';
        return;
    }

    if (!await loadModels()) {
        updateState({ status: 'idle' });
        isAnalyzing = false;
        if (analyzeBtn) analyzeBtn.disabled = false;
        if (analyzeBtn) analyzeBtn.textContent = '얼굴 분석 (V2)';
        progressContainer.style.display = 'none';
        if (mergeControls) mergeControls.style.display = 'none';
        return;
    }

    await new Promise(resolve => {
        if (videoEl.readyState >= 2) return resolve();
        videoEl.onloadeddata = () => resolve();
    });
    videoEl.pause();
    videoEl.currentTime = 0;

    const SAMPLING_RATE_FPS = 2;
    const interval = 1 / SAMPLING_RATE_FPS;
    const allDetections = [];

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    tempCanvas.width = videoEl.videoWidth;
    tempCanvas.height = videoEl.videoHeight;

    for (let time = 0; time < videoEl.duration; time += interval) {
        videoEl.currentTime = time;
        await new Promise(resolve => { videoEl.onseeked = () => resolve(); });

        tempCtx.drawImage(videoEl, 0, 0, tempCanvas.width, tempCanvas.height);

        const detections = await faceapi
            .detectAllFaces(tempCanvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks()
            .withFaceExpressions()
            .withAgeAndGender()
            .withFaceDescriptors();

        detections.forEach(d => {
            d.timestamp = time;
            allDetections.push(d);
        });

        const progress = (time / videoEl.duration) * 100;
        const progressTextContent = `정밀 분석 중... (${Math.round(progress)}%)`;
        
        progressBarFill.style.width = `${progress}%`;
        progressBarFill.parentElement.setAttribute('aria-valuenow', progress.toFixed(0));
        progressText.textContent = progressTextContent;
        updateState({ progress: progress, progressText: progressTextContent });
    }

    if (allDetections.length === 0) {
        displayResults([], videoEl.duration);
        updateState({ status: 'completed' });
        isAnalyzing = false;
        if (analyzeBtn) analyzeBtn.disabled = false;
        if (analyzeBtn) analyzeBtn.textContent = '얼굴 분석 (V2)';
        progressContainer.style.display = 'none';
        return;
    }

    const clusteringProgressText = '탐지된 얼굴 그룹화 시작...';
    progressText.textContent = clusteringProgressText;
    updateState({ progressText: clusteringProgressText });

    const actors = [];
    const DISTANCE_THRESHOLD = 0.5;

    progressBarFill.style.width = '0%';
    const totalDetections = allDetections.length;

    for (const [index, detection] of allDetections.entries()) {
        let bestMatch = null;
        let minDistance = 1;

        const progress = ((index + 1) / totalDetections) * 100;
        const progressTextContent = `얼굴 그룹화 진행 중... (${index + 1}/${totalDetections})`;
        progressBarFill.style.width = `${progress}%`;
        progressBarFill.parentElement.setAttribute('aria-valuenow', progress.toFixed(0));
        progressText.textContent = progressTextContent;
        updateState({ progress: progress, progressText: progressTextContent });

        for (let i = 0; i < actors.length; i++) {
            const dist = faceapi.euclideanDistance(detection.descriptor, actors[i].avgDescriptor);
            if (dist < minDistance) {
                minDistance = dist;
                bestMatch = actors[i];
            }
        }

        if (bestMatch && minDistance < DISTANCE_THRESHOLD) {
            bestMatch.detections.push(detection);
            const newDescriptors = bestMatch.detections.map(d => d.descriptor);
            const avgDescriptor = new Float32Array(newDescriptors[0].length);
            for (let i = 0; i < avgDescriptor.length; i++) {
                avgDescriptor[i] = newDescriptors.reduce((sum, desc) => sum + desc[i], 0) / newDescriptors.length;
            }
            bestMatch.avgDescriptor = avgDescriptor;
        } else {
            actors.push({
                id: `actor-${Date.now()}-${Math.random()}`,
                label: `인물 #${actors.length + 1}`,
                detections: [detection],
                avgDescriptor: detection.descriptor,
            });
        }
    }

    const aggregationProgressText = '최종 데이터 집계 시작...';
    progressText.textContent = aggregationProgressText;
    updateState({ progressText: aggregationProgressText });

    const finalActors = [];

    progressBarFill.style.width = '0%';
    const totalActors = actors.length;

    for (const [index, actor] of actors.entries()) {
        const progress = ((index + 1) / totalActors) * 100;
        const progressTextContent = `인물별 Best Shot 선정 및 정보 정리 중... (${index + 1}/${totalActors}명)`;
        progressBarFill.style.width = `${progress}%`;
        progressBarFill.parentElement.setAttribute('aria-valuenow', progress.toFixed(0));
        progressText.textContent = progressTextContent;
        updateState({ progress: progress, progressText: progressTextContent });

        const bestDetection = actor.detections.reduce((best, current) =>
            current.detection.box.area > best.detection.box.area ? current : best
        );

        videoEl.currentTime = bestDetection.timestamp;
        await new Promise(resolve => { videoEl.onseeked = () => resolve(); });

        const faceCanvas = document.createElement('canvas');
        const { x, y, width, height } = bestDetection.detection.box;

        const widthScale = 1.5;
        const heightScale = 2.0;
        const newWidth = width * widthScale;
        const newHeight = height * heightScale;

        let newX = x - (newWidth - width) / 2;
        let newY = y - (newHeight - height) / 3;

        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        const finalWidth = Math.min(newWidth, videoEl.videoWidth - newX);
        const finalHeight = Math.min(newHeight, videoEl.videoHeight - newY);

        faceCanvas.width = finalWidth;
        faceCanvas.height = finalHeight;
        faceCanvas.getContext('2d', { willReadFrequently: true }).drawImage(videoEl, newX, newY, finalWidth, finalHeight, 0, 0, finalWidth, finalHeight);

        const gender = actor.detections.map(d => d.gender).sort((a,b) => actor.detections.filter(v => v.gender===a).length - actor.detections.filter(v => v.gender===b).length).pop();
        const avgAge = actor.detections.reduce((sum, d) => sum + d.age, 0) / actor.detections.length;

        const emotionSummary = {};
        actor.detections.forEach(d => {
            const topEmotion = Object.keys(d.expressions).reduce((a, b) => d.expressions[a] > d.expressions[b] ? a : b);
            emotionSummary[topEmotion] = (emotionSummary[topEmotion] || 0) + 1;
        });

        finalActors.push({
            id: actor.id,
            label: actor.label,
            image: faceCanvas.toDataURL(),
            gender: gender === 'male' ? '남성' : '여성',
            avgAge: avgAge,
            emotionSummary: emotionSummary,
            totalAppearances: actor.detections.length,
            appearances: actor.detections.map(d => d.timestamp).sort((a,b) => a - b),
            detections: actor.detections
        });
    }

    displayResults(finalActors, videoEl.duration);
    workLogManager.addWorkLog('face-analysis', `V2 얼굴 분석 완료: ${finalActors.length}명 식별`);
    isAnalyzing = false;
    if (analyzeBtn) {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = '얼굴 분석 (V2)';
    }
    progressContainer.style.display = 'none';

    console.log('✅ V2(전문가) 얼굴 분석 완료.');
}
