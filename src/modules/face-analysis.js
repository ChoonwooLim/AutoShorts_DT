import * as DOM from '../dom-elements.js';
import { state } from '../state.js';

const MODEL_URL = './models';

let modelsLoaded = false;
let isAnalyzing = false;
let shouldStop = false;

// TensorFlow.js와 Face-api.js가 로드될 때까지 기다리는 함수
async function waitForLibraries() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50; // 5초 대기
        
        const checkLibraries = () => {
            attempts++;
            
            if (typeof tf !== 'undefined' && typeof faceapi !== 'undefined') {
                console.log('✅ TensorFlow.js와 Face-api.js 로드 완료');
                resolve();
            } else if (attempts >= maxAttempts) {
                reject(new Error('TensorFlow.js 또는 Face-api.js 로드 실패'));
            } else {
                setTimeout(checkLibraries, 100);
            }
        };
        
        checkLibraries();
    });
}

// 외부에서 호출할 수 있는 초기화 함수
export async function initializeFaceAnalysis() {
    try {
        console.log('🎭 Face analysis system initializing...');
        
        // 모델 로드
        await loadModels();
        
        console.log('✅ Face analysis system initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize face analysis system:', error);
        return false;
    }
}

export async function loadModels() {
    if (modelsLoaded) return;
    
    try {
        // 라이브러리 로드 대기
        await waitForLibraries();
        
        // TensorFlow.js 백엔드 초기화 (2.x 버전)
        if (typeof tf !== 'undefined') {
            await tf.setBackend('webgl');
            await tf.ready();
            console.log('🔧 TensorFlow.js 백엔드 초기화 완료');
            console.log('🔧 사용 중인 백엔드:', tf.getBackend());
        }
        
        // Face-api.js 모델 로드
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
            faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
        ]);
        
        modelsLoaded = true;
        console.log("✅ FaceAPI 모델 로딩 완료");
    } catch (error) {
        console.error("❌ FaceAPI 모델 로딩 실패:", error);
        throw error;
    }
}

// 🔄 리팩토링: UIUtils 사용으로 통합된 진행률 함수
function updateProgressBar(progress, text) {
    console.log(`🎯 updateProgressBar 호출: progress=${progress}, text="${text}"`);
    console.log(`🎯 DOM 요소 상태:`, {
        faceProgressFill: !!DOM.faceProgressFill,
        faceProgressText: !!DOM.faceProgressText,
        analysisProgress: !!DOM.analysisProgress
    });
    
    // 새로운 UIUtils 사용
    if (window.uiUtils) {
        window.uiUtils.updateProgressBar(progress, text);
    }
    
    // 기존 호환성 유지
    if (DOM.faceProgressFill) {
    DOM.faceProgressFill.style.width = `${progress * 100}%`;
    }
    if (DOM.faceProgressText) {
    DOM.faceProgressText.textContent = text || `${Math.round(progress * 100)}%`;
    }
}

// Add event listener for face data generation
function onFaceDataGenerated(faceData) {
    console.log('Face data generated:', faceData);
    // Call AI model for analysis
    analyzeFaceDataWithAI(faceData);
}

// Example function to analyze face data with AI
function analyzeFaceDataWithAI(faceData) {
    // Simple AI analysis logic
    console.log('Analyzing face data with AI:', faceData);
    // Example: Count faces
    const faceCount = faceData.length;
    console.log('Number of faces:', faceCount);
}

function displayActorResults(actors) {
    const actorList = DOM.faceResults;
    actorList.innerHTML = '';

    if (actors.length === 0) {
        actorList.innerHTML = '<p style="text-align: center;">분석된 배우 정보가 없습니다.</p>';
        return;
    }

    actors.forEach(actor => {
        const card = document.createElement('div');
        card.className = 'face-card';
        card.innerHTML = `
            <div class="face-image-container" style="background-image: url('${actor.representativeImg}')"></div>
            <div class="face-info">
                <h4>${actor.label}</h4>
                <p><strong>신뢰도:</strong> ${actor.confidence}%</p>
                <p><strong>등장 횟수:</strong> ${actor.appearances}회</p>
                <p><strong>첫 등장:</strong> ${actor.firstAppearance}</p>
                <p><strong>역할:</strong> ${actor.role}</p>
                <p><strong>나이:</strong> 약 ${actor.age}세</p>
                <p><strong>성별:</strong> ${actor.gender}</p>
                <p><strong>주요 표정:</strong> ${actor.mainExpression}</p>
            </div>
            <div class="face-actions">
                <button class="btn-edit">수정</button>
                <button class="btn-upload">이미지 업로드</button>
                <button class="btn-delete">삭제</button>
            </div>
        `;
        actorList.appendChild(card);
    });
    onFaceDataGenerated(actors);
}

function generateActorInfo(groups) {
    return groups.map((group, index) => {
        const bestDetection = group.detections.sort((a, b) => b.detection.box.area - a.detection.box.area)[0];
        const appearances = group.detections.length;
        const firstAppearance = group.detections.sort((a, b) => a.timestamp - b.timestamp)[0].timestamp;
        
        const age = Math.round(group.detections.reduce((sum, d) => sum + d.age, 0) / appearances);
        
        const gender = group.detections.reduce((acc, d) => {
            acc[d.gender] = (acc[d.gender] || 0) + 1;
            return acc;
        }, {});
        const mainGender = Object.keys(gender).reduce((a, b) => gender[a] > gender[b] ? a : b);

        const expressions = group.detections.reduce((acc, d) => {
            const mainExpression = Object.keys(d.expressions).reduce((a, b) => d.expressions[a] > d.expressions[b] ? a : b);
            acc[mainExpression] = (acc[mainExpression] || 0) + 1;
            return acc;
        }, {});
        const mainExpression = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);

        return {
            id: `actor_${index + 1}`,
            label: `배우 ${index + 1}`,
            representativeImg: bestDetection.canvas.toDataURL(),
            confidence: Math.round(bestDetection.detection.score * 100),
            appearances: appearances,
            firstAppearance: new Date(firstAppearance * 1000).toISOString().substr(11, 8),
            role: '주연', // Placeholder
            age: age,
            gender: mainGender === 'male' ? '남성' : '여성',
            mainExpression: mainExpression
        };
    });
}

function groupByFace(allDetections) {
    const groups = [];
    const distanceThreshold = 0.5; 

    allDetections.forEach(detection => {
        let foundGroup = false;
        for (const group of groups) {
            const representative = group.detections[0];
            const distance = faceapi.euclideanDistance(detection.descriptor, representative.descriptor);
            
            if (distance < distanceThreshold) {
                group.detections.push(detection);
                foundGroup = true;
                break;
            }
        }

        if (!foundGroup) {
            groups.push({ detections: [detection] });
        }
    });
    return groups;
}

// 분석 중지 함수
export function stopFaceAnalysis() {
    console.log('🛑 얼굴 분석 중지 요청');
    shouldStop = true;
    
    // UI 복원
    if (DOM.analyzeFacesBtn) {
        DOM.analyzeFacesBtn.disabled = false;
        DOM.analyzeFacesBtn.textContent = "얼굴 분석 시작";
        DOM.analyzeFacesBtn.style.backgroundColor = '';
    }
    
    if (DOM.analysisProgress) {
        DOM.analysisProgress.style.display = 'none';
    }
    
    isAnalyzing = false;
    console.log('✅ 얼굴 분석 중지 완료');
}

export async function analyzeFaces(videoElement) {
    // 이미 분석 중인지 확인
    if (isAnalyzing) {
        console.log('⚠️ 이미 얼굴 분석이 진행 중입니다.');
        return;
    }
    
    isAnalyzing = true;
    shouldStop = false;
    
    try {
        // 라이브러리와 모델이 로드되었는지 확인
        await waitForLibraries();
    if (!modelsLoaded) {
            await loadModels();
        }
    } catch (error) {
        console.error("❌ 얼굴 분석 초기화 실패:", error);
        alert("얼굴 분석을 위한 라이브러리 로드에 실패했습니다. 페이지를 새로고침해주세요.");
        isAnalyzing = false;
        return;
    }

    console.log('🎯 analyzeFaces 시작 - UI 업데이트');
    
    if (DOM.analyzeFacesBtn) {
        DOM.analyzeFacesBtn.disabled = false; // 중지 버튼으로 클릭 가능하게
        DOM.analyzeFacesBtn.textContent = "분석 중지";
        DOM.analyzeFacesBtn.style.backgroundColor = '#ff4444';
        console.log('✅ 얼굴 분석 버튼 상태 업데이트 완료 (중지 모드)');
    } else {
        console.error('❌ analyzeFacesBtn DOM 요소를 찾을 수 없습니다');
    }
    
    if (DOM.analysisProgress) {
    DOM.analysisProgress.style.display = 'block';
        console.log('✅ 분석 진행바 표시');
    } else {
        console.error('❌ analysisProgress DOM 요소를 찾을 수 없습니다');
    }
    
    if (DOM.faceResults) {
    DOM.faceResults.innerHTML = '';
        console.log('✅ 결과 영역 초기화');
    } else {
        console.error('❌ faceResults DOM 요소를 찾을 수 없습니다');
    }
    
    console.log('🎯 updateProgressBar 호출 시작');
    updateProgressBar(0, '분석 준비 중...');

    console.log('🎯 얼굴 분석 설정 시작');
    const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
    const videoDuration = videoElement.duration;
    const sampleCount = Math.min(30, Math.floor(videoDuration));
    const allDetections = [];

    console.log(`📊 분석 설정:`, {
        videoDuration: videoDuration,
        sampleCount: sampleCount,
        videoWidth: videoElement.videoWidth,
        videoHeight: videoElement.videoHeight
    });

    const tempCanvas = document.createElement('canvas');
    console.log('✅ 임시 캔버스 생성 완료');

    console.log('🎯 비디오 프레임 분석 루프 시작');
    for (let i = 0; i < sampleCount; i++) {
        // 중지 요청 확인
        if (shouldStop) {
            console.log('🛑 분석 중지 요청으로 루프 종료');
            return;
        }
        
        console.log(`🎬 프레임 ${i+1}/${sampleCount} 처리 시작`);
        const currentTime = (i / (sampleCount - 1)) * videoDuration;
        console.log(`⏱️ 현재 시간: ${currentTime.toFixed(2)}초`);
        
        videoElement.currentTime = currentTime;
        await new Promise(resolve => {
            const onSeeked = () => {
                console.log(`✅ 비디오 시크 완료: ${currentTime.toFixed(2)}초`);
                resolve();
            };
            videoElement.addEventListener('seeked', onSeeked, { once: true });
        });

        tempCanvas.width = videoElement.videoWidth;
        tempCanvas.height = videoElement.videoHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(videoElement, 0, 0);

        let detections;
        try {
            // 단순한 얼굴 감지부터 시작
            detections = await faceapi.detectAllFaces(tempCanvas, options);
            console.log(`✅ 프레임 ${i+1}: ${detections.length}개 얼굴 감지됨`);
            
            // 추가 정보가 필요한 경우에만 단계적으로 추가
            if (detections.length > 0) {
                try {
                    detections = await faceapi.detectAllFaces(tempCanvas, options)
            .withFaceLandmarks()
            .withFaceDescriptors();
                    console.log(`✅ 프레임 ${i+1}: 얼굴 특징점 추출 완료`);
                } catch (landmarkError) {
                    console.warn(`⚠️ 프레임 ${i+1} 특징점 추출 실패, 기본 감지만 사용:`, landmarkError);
                    // 기본 감지 결과만 사용
                }
            }
        } catch (error) {
            console.warn(`⚠️ 프레임 ${i+1} 얼굴 감지 실패:`, error);
            continue; // 이 프레임은 건너뛰고 다음 프레임으로
        }
        
        for (const d of detections) {
            const faceCanvas = document.createElement('canvas');
            const faceCtx = faceCanvas.getContext('2d');
            const { x, y, width, height } = d.detection.box;
            faceCanvas.width = width;
            faceCanvas.height = height;
            faceCtx.drawImage(tempCanvas, x, y, width, height, 0, 0, width, height);

            allDetections.push({ ...d, canvas: faceCanvas, timestamp: currentTime });
        }
        
        updateProgressBar((i + 1) / sampleCount, `영상 분석 중... (${i+1}/${sampleCount})`);
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    // 중지 요청 확인
    if (shouldStop) {
        console.log('🛑 분석 중지 요청으로 종료');
        return;
    }

    if (allDetections.length === 0) {
        updateProgressBar(1, '영상에서 얼굴을 찾지 못했습니다.');
        DOM.analyzeFacesBtn.disabled = false;
        DOM.analyzeFacesBtn.textContent = "얼굴 분석 시작";
        DOM.analyzeFacesBtn.style.backgroundColor = '';
        DOM.faceResults.innerHTML = '<p style="text-align: center;">영상에서 얼굴을 찾지 못했습니다.</p>';
        
        // 프로그래스바 숨기기 (3초 후)
        setTimeout(() => {
            DOM.analysisProgress.style.display = 'none';
        }, 3000);
        
        isAnalyzing = false;
        return;
    }

    updateProgressBar(1, '얼굴 그룹화 중...');
    await new Promise(resolve => setTimeout(resolve, 10));

    // 중지 요청 확인
    if (shouldStop) {
        console.log('🛑 분석 중지 요청으로 종료');
        return;
    }

    const faceGroups = groupByFace(allDetections);
    const actors = generateActorInfo(faceGroups);
    displayActorResults(actors);

    updateProgressBar(1, `분석 완료! 총 ${actors.length}명의 배우를 찾았습니다.`);
    DOM.analyzeFacesBtn.disabled = false;
    DOM.analyzeFacesBtn.textContent = "얼굴 분석 시작";
    DOM.analyzeFacesBtn.style.backgroundColor = '';
    
    // 프로그래스바 숨기기 (3초 후)
    setTimeout(() => {
        DOM.analysisProgress.style.display = 'none';
    }, 3000);
    
    isAnalyzing = false;
}

// 외부에서 호출할 수 있는 진입점 함수
export async function startFaceAnalysis() {
    try {
        console.log('🎭 startFaceAnalysis 함수 시작');
        console.log('📊 현재 state:', {
            hasState: !!state,
            hasUploadedFile: !!state?.uploadedFile,
            fileName: state?.uploadedFile?.name
        });
        
        // 모델 로드 확인
        if (!modelsLoaded) {
            console.log('🎭 Face-api.js 모델 로드 중...');
            await loadModels();
        }
        
        // 비디오 엘리먼트 가져오기
        const videoElement = DOM.videoPreview;
        console.log('🎬 비디오 엘리먼트 상태:', {
            element: !!videoElement,
            src: videoElement?.src,
            duration: videoElement?.duration,
            readyState: videoElement?.readyState
        });
        
        if (!videoElement || !videoElement.src) {
            alert('분석할 영상이 없습니다. 먼저 영상을 업로드해주세요.');
            return;
        }
        
        // 비디오가 준비될 때까지 기다리기
        if (videoElement.readyState < 2) {
            console.log('🎬 비디오 메타데이터 로딩 대기 중...');
            await new Promise((resolve) => {
                const onLoadedData = () => {
                    videoElement.removeEventListener('loadeddata', onLoadedData);
                    resolve();
                };
                videoElement.addEventListener('loadeddata', onLoadedData);
                
                // 타임아웃 설정 (10초)
                setTimeout(() => {
                    videoElement.removeEventListener('loadeddata', onLoadedData);
                    resolve();
                }, 10000);
            });
        }
        
        console.log('🎭 얼굴 분석 시작...');
        await analyzeFaces(videoElement);
        
    } catch (error) {
        console.error('❌ 얼굴 분석 중 오류:', error);
        alert('얼굴 분석 중 오류가 발생했습니다.');
        
        // UI 복원
        if (DOM.analyzeFacesBtn) {
            DOM.analyzeFacesBtn.disabled = false;
            DOM.analyzeFacesBtn.textContent = "얼굴 분석 시작";
            DOM.analyzeFacesBtn.style.backgroundColor = '';
        }
        if (DOM.analysisProgress) {
            DOM.analysisProgress.style.display = 'none';
        }
        
        isAnalyzing = false;
        shouldStop = false;
    }
}