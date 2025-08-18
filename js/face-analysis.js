// Face-api.js 모델 로딩 및 얼굴 분석 관련 로직

// --- 상태 관리 ---
let modelsLoaded = false;

// 환경별 모델 경로 계산
function getModelBasePath() {
    try {
        const hostname = window.location.hostname;
        const port = window.location.port;
        if (hostname === 'localhost' && port === '5173') {
            // Vite 개발 서버: viteStaticCopy가 /models로 제공
            return '/models';
        } else if (hostname === 'localhost' && port === '3000') {
            // 로컬 Express 서버: 리포지토리 구조 기준
            return '/AutoShortsWeb/public/models';
        } else if (hostname === 'twinverse.org' || hostname === 'www.twinverse.org') {
            // 프로덕션(GitHub Pages): dist 루트에 models 복사됨
            return '/AutoShortsWeb/models';
        }
        return '/models';
    } catch (e) {
        return '/models';
    }
}

const MODEL_URL = getModelBasePath();
let labeledFaceDescriptors = [];
let detectedActors = new Map();

// 전역 접근을 위해 window 객체에 할당
window.detectedActors = detectedActors;

// --- 유틸리티 함수 ---

// 이름 생성을 위한 데이터 (미국식)
const surnames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"];
const maleGivenNames = ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles"];
const femaleGivenNames = ["Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen"];

/**
 * 배우의 시간 범위를 업데이트합니다 (연속된 출현을 범위로 그룹화)
 * @param {Object} actor - 배우 객체
 * @param {number} currentTime - 현재 시간
 */
function updateTimeRanges(actor, currentTime) {
    const threshold = 2.0; // 2초 이내의 간격은 연속된 출현으로 간주
    
    if (actor.timeRanges.length === 0) {
        // 첫 번째 출현
        actor.timeRanges.push({ start: currentTime, end: currentTime });
    } else {
        const lastRange = actor.timeRanges[actor.timeRanges.length - 1];
        
        if (currentTime - lastRange.end <= threshold) {
            // 연속된 출현으로 간주하여 기존 범위 확장
            lastRange.end = currentTime;
        } else {
            // 새로운 출현 범위 시작
            actor.timeRanges.push({ start: currentTime, end: currentTime });
        }
    }
}

/**
 * 성별에 맞는 중복되지 않는 랜덤 이름을 생성합니다.
 * @param {Set<string>} existingNames - 이미 사용된 이름들의 Set
 * @param {string} gender - 'male' 또는 'female'
 * @returns {string} 새로 생성된 이름
 */
function generateRandomName(existingNames, gender = 'neutral') {
    let attempts = 0;
    const nameList = gender === 'male' ? maleGivenNames : femaleGivenNames;

    while (attempts < 50) { // 무한 루프 방지
        const surname = surnames[Math.floor(Math.random() * surnames.length)];
        const givenName = nameList[Math.floor(Math.random() * nameList.length)];
        const name = `${givenName} ${surname}`;
        if (!existingNames.has(name)) {
            existingNames.add(name);
            return name;
        }
        attempts++;
    }
    // 50번 시도 후에도 고유한 이름을 찾지 못하면 숫자 접미사 추가
    const fallbackName = `${gender === 'male' ? 'Person' : 'Person'} #${existingNames.size + 1}`;
    existingNames.add(fallbackName);
    return fallbackName;
}

/**
 * 필요한 라이브러리가 로드되었는지 확인하고, 로드되지 않았다면 동적으로 로드합니다.
 */
export async function ensureLibrariesLoaded() {
    if (typeof faceapi !== 'undefined') {
        console.log('✅ face-api.js 라이브러리가 이미 로드되었습니다.');
        return true;
    }
    
    if (window.isFaceApiLoading) {
        console.log('⏳ face-api.js가 이미 로딩 중입니다. 완료될 때까지 기다립니다.');
        await new Promise((resolve, reject) => {
            const loadingTimeout = 30000; // 30초 타임아웃
            let timeoutId;

            const checkInterval = setInterval(() => {
                if (typeof faceapi !== 'undefined') {
                    clearInterval(checkInterval);
                    clearTimeout(timeoutId);
                    resolve();
                }
            }, 100);

            timeoutId = setTimeout(() => {
                clearInterval(checkInterval);
                console.error('❌ face-api.js 로딩 대기 시간 초과.');
                reject(new Error('face-api.js loading check timed out.'));
            }, loadingTimeout);
        });
        return true;
    }

    window.isFaceApiLoading = true;
    console.log('⏳ face-api.js를 동적으로 로드합니다...');
    
    // 환경별 라이브러리 경로 설정
    const getLibraryPath = () => {
        const hostname = window.location.hostname;
        const port = window.location.port;
        const isElectron = !!(window.env && window.env.isElectron);
        
        console.log(`🌍 현재 환경: ${hostname}:${port} (electron=${isElectron})`);
        
        // Vite 개발 서버 또는 Electron 개발 환경에서는 Vite의 public 매핑을 사용
        if ((hostname === 'localhost' && port === '5173') || isElectron) {
            const path = '/js/vendor/face-api.js';
            console.log(`🔗 개발/Electron 경로: ${path}`);
            return path;
        }
        
        // GitHub Pages(프로덕션 웹)
        if (hostname === 'twinverse.org' || hostname === 'www.twinverse.org') {
            const path = '/AutoShortsWeb/js/vendor/face-api.js';
            console.log(`🔗 프로덕션 웹 경로: ${path}`);
            return path;
        }
        
        // 기본값: 배포된 정적 서버 루트
        const path = '/js/vendor/face-api.js';
        console.log(`🔗 기본 경로: ${path}`);
        return path;
    };
    
    try {
        const libraryPath = getLibraryPath();
        console.log(`⏳ face-api.js 로딩 시작: ${libraryPath}`);
        
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = libraryPath;
            script.async = true;
            script.onload = () => {
                window.isFaceApiLoaded = true;
                window.isFaceApiLoading = false;
                console.log('✅ face-api.js 동적 로드 성공.');
                resolve();
            };
            script.onerror = (err) => {
                window.isFaceApiLoaded = false;
                window.isFaceApiLoading = false;
                console.error('❌ face-api.js 로딩 실패:', err);
                console.error('❌ 실패한 경로:', libraryPath);
                
                // 프로덕션에서 실패 시 대체 경로 시도
                if (window.location.hostname === 'twinverse.org' || window.location.hostname === 'www.twinverse.org') {
                    console.log('🔄 프로덕션 대체 경로 시도...');
                    const fallbackPath = '/AutoShortsWeb/js/vendor/face-api.js';
                    const fallbackScript = document.createElement('script');
                    fallbackScript.src = fallbackPath;
                    fallbackScript.async = true;
                    fallbackScript.onload = () => {
                        window.isFaceApiLoaded = true;
                        window.isFaceApiLoading = false;
                        console.log('✅ face-api.js 대체 경로 로딩 성공.');
                        resolve();
                    };
                    fallbackScript.onerror = (fallbackErr) => {
                        console.error('❌ 대체 경로도 실패:', fallbackErr);
                        reject(new Error(`얼굴 분석 라이브러리 로딩 실패: ${libraryPath}, ${fallbackPath}`));
                    };
                    document.body.appendChild(fallbackScript);
                } else {
                    reject(new Error('얼굴 분석 라이브러리(face-api.js)를 로드할 수 없습니다.'));
                }
            };
            document.body.appendChild(script);
        });
        return true;
    } catch (error) {
        console.error('❌ face-api.js 동적 로드 실패:', error);
        throw new Error('얼굴 분석 라이브러리(face-api.js)를 로드할 수 없습니다.');
    }
}

/**
 * 분석 결과를 카드 형태로 화면에 표시하고 병합 기능을 활성화합니다.
 * @param {Array} actors - 분석된 배우 정보 배열
 */
export function displayFaceAnalysisResults(actors) {
    const resultsContainer = document.getElementById('faceResults');
    if (!resultsContainer) {
        console.error('결과를 표시할 faceResults 요소를 찾을 수 없습니다.');
        return;
    }

    resultsContainer.innerHTML = '';
    
    if (actors.length === 0) {
        resultsContainer.innerHTML = '<p class="no-results-message">영상에서 인물을 찾지 못했습니다.</p>';
        return;
    }

    actors.forEach(actor => {
        const card = document.createElement('div');
        card.className = 'face-card professional'; // 전문가용 카드 스타일 적용
        card.dataset.actorId = actor.id;

        // 1. 이미지 표시 영역
        const imgDiv = document.createElement('div');
        imgDiv.className = 'face-card-img';
        imgDiv.style.backgroundImage = `url('${actor.image}')`;

        // 2. 콘텐츠 표시 영역
        const contentDiv = document.createElement('div');
        contentDiv.className = 'face-card-content';

        // 2-1. 헤더 (인물 ID)
        const headerDiv = document.createElement('div');
        headerDiv.className = 'face-card-header';
        
        // 체크박스 추가 (병합 선택용)
        const selectionDiv = document.createElement('div');
        selectionDiv.className = 'face-card-selection';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'actor-checkbox';
        checkbox.dataset.actorId = actor.id;
        checkbox.id = `checkbox-${actor.id}`;
        
        const checkboxLabel = document.createElement('label');
        checkboxLabel.htmlFor = `checkbox-${actor.id}`;
        checkboxLabel.textContent = '선택';
        checkboxLabel.className = 'checkbox-label';
        
        selectionDiv.appendChild(checkbox);
        selectionDiv.appendChild(checkboxLabel);
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'face-card-title';
        const h4 = document.createElement('h4');
        h4.textContent = actor.label;
        
        // 평균 나이와 성별 계산
        const avgAge = actor.ages.reduce((a, b) => a + b, 0) / actor.ages.length;
        const mainGender = actor.genders.filter(g => g === 'male').length > actor.genders.length / 2 ? '남성' : '여성';

        const pId = document.createElement('p');
        pId.textContent = `${mainGender}, 추정 나이: ${Math.round(avgAge)}세`;

        titleDiv.appendChild(h4);
        titleDiv.appendChild(pId);
        headerDiv.appendChild(selectionDiv);
        headerDiv.appendChild(titleDiv);
        
        // 2-2. 본문 (상세 정보)
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'face-card-body';
        
        // 출연 횟수
        const pAppearances = document.createElement('p');
        pAppearances.innerHTML = `<strong>등장 횟수:</strong> ${actor.totalAppearances}회`;
        bodyDiv.appendChild(pAppearances);
        
        // 시간 범위 정보 (새로 추가)
        if (actor.timeRanges && actor.timeRanges.length > 0) {
            const rangesContainer = document.createElement('div');
            rangesContainer.className = 'time-ranges-container';
            rangesContainer.innerHTML = '<strong>출현 구간:</strong> ';
            
            const rangesList = actor.timeRanges.slice(0, 5).map(range => {
                const start = range.start.toFixed(1);
                const end = range.end.toFixed(1);
                const startFrame = Math.floor(range.start * 30);
                const endFrame = Math.floor(range.end * 30);
                return `${start}s-${end}s (프레임 ${startFrame}-${endFrame})`;
            }).join(', ');
            
            rangesContainer.innerHTML += rangesList;
            if (actor.timeRanges.length > 5) {
                rangesContainer.innerHTML += ` ... (${actor.timeRanges.length - 5}개 구간 더)`;
            }
            bodyDiv.appendChild(rangesContainer);
        }
        
        // 출연 시간 타임라인
        const timelineContainer = document.createElement('div');
        timelineContainer.className = 'timeline-container';
        timelineContainer.innerHTML = '<strong>주요 등장 시간:</strong>';
        actor.appearances.slice(0, 10).forEach(time => { // 최대 10개까지만 표시
            const marker = document.createElement('span');
            marker.className = 'timeline-marker';
            marker.textContent = new Date(time * 1000).toISOString().substr(14, 5);
            marker.title = `${time.toFixed(1)}초 (프레임 ${Math.floor(time * 30)})`;
            timelineContainer.appendChild(marker);
        });
        if (actor.appearances.length > 10) {
            const more = document.createElement('span');
            more.textContent = `... (${actor.appearances.length - 10}개 더보기)`;
            more.className = 'timeline-more';
            timelineContainer.appendChild(more);
        }
        bodyDiv.appendChild(timelineContainer);
        
        // 병합 정보 표시 (새로 추가)
        if (actor.mergedFrom && actor.mergedFrom.length > 0) {
            const mergedContainer = document.createElement('div');
            mergedContainer.className = 'merged-info-container';
            mergedContainer.innerHTML = '<strong>병합된 인물:</strong> ';
            const mergedNames = actor.mergedFrom.map(m => m.label).join(', ');
            mergedContainer.innerHTML += `${mergedNames} (총 ${actor.mergedFrom.length + 1}명이 동일인물)`;
            bodyDiv.appendChild(mergedContainer);
        }
        
        contentDiv.appendChild(headerDiv);
        contentDiv.appendChild(bodyDiv);

        card.appendChild(imgDiv);
        card.appendChild(contentDiv);

        resultsContainer.appendChild(card);
    });

    // 병합 컨트롤 표시
    const controlsContainer = document.getElementById('faceAnalysisControls');
    const mainControlsContainer = document.getElementById('faceGalleryMergeControls');
    
    if (actors.length > 1) {
        if (controlsContainer) {
            controlsContainer.style.display = 'block';
        }
        if (mainControlsContainer) {
            mainControlsContainer.style.display = 'block';
        }
    }

    // 체크박스 이벤트 리스너 추가
    resultsContainer.querySelectorAll('.actor-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', updateMergeButtonState);
    });
}

/**
 * 병합 버튼 상태를 업데이트합니다.
 */
function updateMergeButtonState() {
    const mergeBtn = document.getElementById('mergeFacesBtn');
    const mergeBtnMain = document.getElementById('mergeFacesMainBtn');
    const counter = document.getElementById('selectionCounter');
    const counterMain = document.getElementById('selectionCounterMain');
    const selectedCheckboxes = document.querySelectorAll('.actor-checkbox:checked');
    
    const count = selectedCheckboxes.length;
    const isDisabled = count < 2;
    
    // 두 개의 카운터 모두 업데이트
    if (counter) counter.textContent = `${count}명 선택됨`;
    if (counterMain) counterMain.textContent = `${count}명 선택됨`;
    
    // 두 개의 버튼 모두 상태 업데이트
    if (mergeBtn) mergeBtn.disabled = isDisabled;
    if (mergeBtnMain) mergeBtnMain.disabled = isDisabled;
}


/**
 * 선택된 인물을 병합합니다.
 */
async function mergeSelectedFaces() {
    const selectedCheckboxes = document.querySelectorAll('.actor-checkbox:checked');
    if (selectedCheckboxes.length < 2) {
        alert('병합하려면 2명 이상의 인물을 선택해야 합니다.');
        return;
    }

    // 첫 번째 선택된 인물을 기준으로 병합
    const targetActorId = selectedCheckboxes[0].dataset.actorId;
    const targetActor = detectedActors.get(targetActorId);
    
    const sourceActorIds = Array.from(selectedCheckboxes).slice(1).map(cb => cb.dataset.actorId);
    
    console.log(`병합 시도: '${targetActor.label}' 기준으로 ${sourceActorIds.length}명 병합`);

    let sourceDescriptors = [];

    // 소스 인물들의 데이터를 타겟에 병합
    for (const sourceId of sourceActorIds) {
        const sourceActor = detectedActors.get(sourceId);
        if (sourceActor) {
            targetActor.appearances.push(...sourceActor.appearances);
            targetActor.totalAppearances += sourceActor.totalAppearances;
            
            // 새로운 데이터 병합
            if (sourceActor.genders) targetActor.genders.push(...sourceActor.genders);
            if (sourceActor.ages) targetActor.ages.push(...sourceActor.ages);
            if (sourceActor.timeRanges) targetActor.timeRanges.push(...sourceActor.timeRanges);
            if (sourceActor.frameNumbers) targetActor.frameNumbers.push(...sourceActor.frameNumbers);
            
            // 병합된 인물 정보 기록
            targetActor.mergedFrom.push({
                id: sourceId,
                label: sourceActor.label,
                mergedAt: new Date().toISOString()
            });
            
            // AI 재학습을 위해 소스 인물의 얼굴 디스크립터 수집
            const sourceLabeledDescriptor = labeledFaceDescriptors.find(d => d.label === sourceId);
            if(sourceLabeledDescriptor) {
                sourceDescriptors.push(...sourceLabeledDescriptor.descriptors);
            }

            // 전역 데이터에서 소스 인물 삭제
            detectedActors.delete(sourceId);
            labeledFaceDescriptors = labeledFaceDescriptors.filter(d => d.label !== sourceId);
        }
    }

    // 타겟 인물의 정보 업데이트 (정렬 등)
    targetActor.appearances.sort((a, b) => a - b);
    if (targetActor.frameNumbers) targetActor.frameNumbers.sort((a, b) => a - b);
    
    // 시간 범위 재계산 (병합된 데이터를 기반으로)
    if (targetActor.timeRanges) {
        targetActor.timeRanges.sort((a, b) => a.start - b.start);
        // 겹치는 범위들을 병합
        const mergedRanges = [];
        for (const range of targetActor.timeRanges) {
            if (mergedRanges.length === 0) {
                mergedRanges.push(range);
            } else {
                const lastRange = mergedRanges[mergedRanges.length - 1];
                if (range.start <= lastRange.end + 2.0) { // 2초 이내 간격은 병합
                    lastRange.end = Math.max(lastRange.end, range.end);
                } else {
                    mergedRanges.push(range);
                }
            }
        }
        targetActor.timeRanges = mergedRanges;
    }
    
    // AI 재학습: 캡슐화를 존중하여 LabeledFaceDescriptors 인스턴스를 새로 생성하고 교체
    const targetIndex = labeledFaceDescriptors.findIndex(d => d.label === targetActorId);
    if (targetIndex !== -1) {
        const existingDescriptors = labeledFaceDescriptors[targetIndex].descriptors;
        const newDescriptors = existingDescriptors.concat(sourceDescriptors);
        const newLabeledDescriptor = new faceapi.LabeledFaceDescriptors(targetActorId, newDescriptors);

        labeledFaceDescriptors[targetIndex] = newLabeledDescriptor;
        console.log(`🧠 AI 모델 업데이트: '${targetActor.label}'에 ${sourceDescriptors.length}개의 얼굴 데이터를 추가하여 총 ${newDescriptors.length}개의 데이터로 재학습`);
    } else {
        // 만약 타겟 디스크립터가 없다면 새로 생성 (이 경우는 드묾)
        labeledFaceDescriptors.push(new faceapi.LabeledFaceDescriptors(targetActorId, sourceDescriptors));
        console.log(`✨ AI 모델 신규 생성: '${targetActor.label}'에 ${sourceDescriptors.length}개의 얼굴 데이터로 생성`);
    }


    // 작업 로그 기록 (AI가 병합 정보를 인지할 수 있도록)
    if (window.workLogManager && window.workLogManager.addWorkLog) {
        const mergedLabels = sourceActorIds.map(id => {
            const sourceActor = detectedActors.get(id) || { label: id };
            return sourceActor.label;
        }).join(', ');
        
        const timeRangesSummary = targetActor.timeRanges ? 
            targetActor.timeRanges.map(r => `${r.start.toFixed(1)}s-${r.end.toFixed(1)}s`).join(', ') : 
            '시간 정보 없음';
            
        window.workLogManager.addWorkLog('인물 병합', 
            `${mergedLabels} → ${targetActor.label}로 병합 완료. ` +
            `총 출현 횟수: ${targetActor.totalAppearances}회, ` +
            `출현 시간대: ${timeRangesSummary}. ` +
            `이들은 모두 동일인물입니다.`
        );
    }

    // UI 다시 그리기
    displayFaceAnalysisResults(Array.from(detectedActors.values()));
    updateMergeButtonState(); // 버튼 상태 초기화

    alert(`'${targetActor.label}'(으)로 ${sourceActorIds.length}명이 성공적으로 병합되었습니다. AI가 업데이트되었습니다.`);
}


/**
 * 필요한 AI 모델들을 로드합니다.
 */
async function loadModels() {
    if (modelsLoaded) return;
    
    await ensureLibrariesLoaded();

    try {
        console.log('⏳ 모델 로딩 중...');
        console.log('⏳ FaceAPI 기본 모델 로딩 시작...');
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL) // 성별 분석 모델 추가
        ]);
        modelsLoaded = true;
        console.log('✅ FaceAPI 기본 모델 로딩 완료.');
    } catch (error) {
        console.error('❌ FaceAPI 기본 모델 로딩 실패:', error);
        alert('얼굴 분석 모델 로딩에 실패했습니다. 인터넷 연결을 확인해주세요.');
        throw error;
    }
}

/**
 * 비디오에서 얼굴을 분석하여 정보를 추출합니다.
 */
export async function analyzeFaces(videoElement) {
    if (!modelsLoaded) {
        console.log('모델이 로드되지 않았으므로 먼저 로드를 시도합니다.');
        await loadModels();
    }
    
    // 분석 시작 시 데이터 초기화
    labeledFaceDescriptors = [];
    detectedActors.clear();
    const existingNames = new Set(); // 이름 중복 방지를 위한 Set

    console.log('🎭 얼굴 분석 시작...');

    const canvas = faceapi.createCanvasFromMedia(videoElement);
    const displaySize = { width: videoElement.videoWidth, height: videoElement.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);
    
    try {
        const detectionOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

        const totalDuration = videoElement.duration;
        const interval = 1;

        for (let currentTime = 0; currentTime < totalDuration; currentTime += interval) {
            videoElement.currentTime = currentTime;
            
            await new Promise(resolve => {
                videoElement.onseeked = () => resolve();
            });

            const detections = await faceapi.detectAllFaces(videoElement, detectionOptions)
                .withFaceLandmarks()
                .withFaceDescriptors()
                .withAgeAndGender(); // 나이 및 성별 분석 추가

            const progress = Math.round((currentTime / totalDuration) * 100);
            console.log(`🎭 분석 진행률: ${progress}%`);

            for (const detection of detections) {
                let bestMatch = { label: 'unknown', distance: 1.0 };

                if (labeledFaceDescriptors.length > 0) {
                    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.5);
                    bestMatch = faceMatcher.findBestMatch(detection.descriptor);
                }
                
                let actorId = bestMatch.label;

                if (actorId === 'unknown') {
                    actorId = generateRandomName(existingNames, detection.gender); // 성별에 맞는 이름 생성
                    labeledFaceDescriptors.push(new faceapi.LabeledFaceDescriptors(actorId, [detection.descriptor]));
                }

                if (!detectedActors.has(actorId)) {
                    const { x, y, width, height } = detection.detection.box;
                    
                    const padding = height * 0.5;
                    const captureX = Math.max(0, x - padding / 2);
                    const captureY = Math.max(0, y - padding);
                    const captureWidth = width + padding;
                    const captureHeight = height + padding * 1.5;

                    const faceCanvas = document.createElement('canvas');
                    faceCanvas.width = 128;
                    faceCanvas.height = 128;
                    const ctx = faceCanvas.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(videoElement, captureX, captureY, captureWidth, captureHeight, 0, 0, 128, 128);
                    
                    detectedActors.set(actorId, {
                        id: actorId,
                        label: actorId,
                        image: faceCanvas.toDataURL(),
                        appearances: [],
                        totalAppearances: 0,
                        genders: [],
                        ages: [],
                        timeRanges: [], // 시작점-끝점 범위 저장
                        frameNumbers: [], // 프레임 번호 저장
                        mergedFrom: [] // 병합된 인물들의 ID 저장
                    });
                }

                const actor = detectedActors.get(actorId);
                actor.appearances.push(currentTime);
                actor.totalAppearances++;
                actor.genders.push(detection.gender);
                actor.ages.push(detection.age);
                
                // 프레임 번호 계산 (30fps 기준)
                const frameNumber = Math.floor(currentTime * 30);
                actor.frameNumbers.push(frameNumber);
                
                // 시간 범위 업데이트 (연속된 출현을 범위로 그룹화)
                updateTimeRanges(actor, currentTime);
            }
        }

        console.log(`✅ 얼굴 분석 완료: ${detectedActors.size}명 발견`);
        console.log('✅ 얼굴 분석 완료.');
        return Array.from(detectedActors.values());
    } finally {
        // 메모리 누수 방지를 위해 사용된 캔버스 요소를 정리합니다.
        if (canvas && canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
            console.log('🖼️ 분석용 임시 캔버스가 성공적으로 제거되었습니다.');
        }
    }
}


/**
 * 얼굴 분석 시스템을 초기화합니다.
 */
export async function initializeFaceAnalysis() {
    console.log('🎭 Face analysis system initializing...');
    try {
        const videoElement = document.getElementById('videoPreview');
        const mergeBtn = document.getElementById('mergeFacesBtn');
        const mergeBtnMain = document.getElementById('mergeFacesMainBtn');
        
        console.log('🔍 DOM 요소 확인:', {
            videoElement: !!videoElement,
            mergeBtn: !!mergeBtn,
            mergeBtnMain: !!mergeBtnMain
        });

        videoElement.addEventListener('loadedmetadata', async () => {
            console.log('📹 비디오 메타데이터 로드됨. 얼굴 분석 모델 로딩 시작.');
            await loadModels();
        }, { once: true });

        // 기존 얼굴 분석 버튼 기능은 다른 곳에서 호출됩니다.
        
        if(mergeBtn) {
            mergeBtn.addEventListener('click', mergeSelectedFaces);
        }
        
        if(mergeBtnMain) {
            mergeBtnMain.addEventListener('click', mergeSelectedFaces);
            console.log('✅ 메인 병합 버튼 이벤트 리스너 설정 완료');
        }

        // 전역에서 테스트할 수 있도록 함수 노출
        window.testFaceAnalysis = {
            videoElement,
            mergeBtn,
            mergeBtnMain,
            modelsLoaded: () => modelsLoaded,
            clickMerge: () => mergeBtnMain?.click()
        };
        
        console.log('✅ Face analysis system initialized successfully.');
    } catch (error) {
        console.error('❌ Failed to initialize face analysis system:', error);
    }
}
