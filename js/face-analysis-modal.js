const MODEL_URL = './models';

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

async function loadFaceApiModels() {
    if (state.faceApiModelsLoaded) return;

    try {
        // 라이브러리 로드 대기
        await waitForLibraries();
        
        // TensorFlow.js 백엔드 초기화 (2.x 버전)
        if (typeof tf !== 'undefined') {
            await tf.ready();
            console.log('🔧 TensorFlow.js 백엔드 초기화 완료');
            console.log('🔧 사용 중인 백엔드:', tf.getBackend());
        }

    domElements.analysisProgress.style.display = 'block';
    domElements.faceProgressText.textContent = '얼굴 분석 AI 모델을 로딩 중입니다...';
    domElements.faceProgressFill.style.width = '0%';

        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        domElements.faceProgressFill.style.width = '20%';
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        domElements.faceProgressFill.style.width = '40%';
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        domElements.faceProgressFill.style.width = '60%';
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        domElements.faceProgressFill.style.width = '80%';
        await faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL);
        domElements.faceProgressFill.style.width = '100%';

        state.faceApiModelsLoaded = true;
        console.log('FaceAPI 모델 로딩 성공');
        domElements.faceProgressText.textContent = 'AI 모델 로딩 완료! 분석을 시작할 수 있습니다.';
    } catch (error) {
        console.error('FaceAPI 모델 로딩 실패:', error);
        domElements.faceProgressText.textContent = '오류: AI 모델 로딩에 실패했습니다. 인터넷 연결을 확인해주세요.';
        domElements.analysisProgress.style.display = 'none';
        throw error;
    }
}

async function startFaceAnalysis() {
    if (state.faceAnalysisInProgress) {
        alert('이미 얼굴 분석이 진행 중입니다.');
        return;
    }

    state.faceAnalysisInProgress = true;
    domElements.analyzeFacesBtn.disabled = true;
    domElements.analyzeFacesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 분석 중...';
    domElements.faceResults.innerHTML = '';

    try {
        await loadFaceApiModels();

        domElements.faceProgressText.textContent = '영상에서 프레임을 추출하고 있습니다...';
        const frames = await extractFrames(state.videoPlayer);

        const allDetections = await detectAllFaces(frames);

        domElements.faceProgressText.textContent = '동일 인물을 그룹화하고 있습니다...';
        const actors = groupFaces(allDetections);

        domElements.faceProgressText.textContent = `분석 완료! ${actors.length}명의 인물을 찾았습니다.`;
        displayActors(actors);

    } catch (error) {
        console.error('얼굴 분석 중 오류 발생:', error);
        domElements.faceProgressText.textContent = '오류가 발생하여 분석을 중단했습니다.';
    } finally {
        state.faceAnalysisInProgress = false;
        domElements.analyzeFacesBtn.disabled = false;
        domElements.analyzeFacesBtn.innerHTML = '🔍 얼굴 분석 시작';
        setTimeout(() => { domElements.analysisProgress.style.display = 'none'; }, 2000);
    }
}

async function extractFrames(video, maxFrames = 20) {
    const frames = [];
    const duration = video.duration;
    if (duration <= 0) return [];
    
    const interval = duration / maxFrames;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const tempVideo = document.createElement('video');
    tempVideo.src = video.src;
    tempVideo.muted = true;
    await new Promise(res => tempVideo.onloadedmetadata = res);
    
    canvas.width = tempVideo.videoWidth;
    canvas.height = tempVideo.videoHeight;

    for (let i = 0; i < maxFrames; i++) {
        const time = i * interval;
        tempVideo.currentTime = time;
        await new Promise(res => setTimeout(() => tempVideo.onseeked = res, 50));
        
        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        frames.push({ time, imageDataUrl });

        domElements.faceProgressFill.style.width = `${(i + 1) / maxFrames * 25}%`;
    }
    return frames;
}

async function detectAllFaces(frames) {
    let allDetections = [];
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const img = await faceapi.fetchImage(frame.imageDataUrl);
        
        const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptors()
            .withFaceExpressions()
            .withAgeAndGender();

        detections.forEach(d => {
            allDetections.push({ ...d, time: frame.time });
        });

        domElements.faceProgressText.textContent = `${i + 1}/${frames.length} 프레임 분석 중...`;
        const progress = 25 + ((i + 1) / frames.length * 50);
        domElements.faceProgressFill.style.width = `${progress}%`;
    }
    return allDetections;
}

function groupFaces(detections, distanceThreshold = 0.5) {
    if (detections.length === 0) return [];
    
    const labeledDescriptors = detections.map((d, i) => new faceapi.LabeledFaceDescriptors(`person_${i}`, [d.descriptor]));
    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, distanceThreshold);

    return detections.reduce((actors, det) => {
        const bestMatch = faceMatcher.findBestMatch(det.descriptor);
        const label = bestMatch.label;
        
        let actor = actors.find(a => a.id === label);
        if (!actor) {
            actor = { 
                id: label, 
                name: `배우 ${actors.length + 1}`,
                detections: [] 
            };
            actors.push(actor);
        }
        actor.detections.push(det);
        return actors;
    }, []);
}

function displayActors(actors) {
    domElements.faceResults.innerHTML = '';
    actors.sort((a, b) => b.detections.length - a.detections.length);

    actors.forEach((actor, index) => {
        actor.name = `배우 ${index + 1}`; // Re-assign name after sorting
        const bestShot = actor.detections.reduce((a, b) => a.detection.score > b.detection.score ? a : b);
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const { x, y, width, height } = bestShot.detection.box;
        canvas.width = width;
        canvas.height = height;
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
        };
        img.src = bestShot.alignedRect.image.src; // This is a bit of a hack
        
        const card = document.createElement('div');
        card.className = 'face-card';

        const avgAge = Math.round(actor.detections.reduce((sum, d) => sum + d.age, 0) / actor.detections.length);
        const expressions = actor.detections.map(d => Object.keys(d.expressions).reduce((a, b) => d.expressions[a] > d.expressions[b] ? a : b));
        const mostCommonExpression = expressions.sort((a,b) => expressions.filter(v => v===a).length - expressions.filter(v => v===b).length).pop();

        const firstAppearance = new Date(actor.detections[0].time * 1000).toISOString().substr(14, 5);

        card.innerHTML = `
            <img src="${img.src}" alt="${actor.name}" style="width:100%; height: auto; border-radius: 8px;">
            <h4>${actor.name}</h4>
            <div class="face-info">
                <div>등장 횟수: ${actor.detections.length}회</div>
                <div>추정 나이: ~${avgAge}세</div>
                <div>주요 표정: ${mostCommonExpression}</div>
                <div>첫 등장: ${firstAppearance}</div>
            </div>
        `;
        domElements.faceResults.appendChild(card);
    });
} 