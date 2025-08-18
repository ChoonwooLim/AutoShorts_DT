// js/ui-file.js
// 영상 파일 업로드, 비디오 미리보기, 관련 컨트롤의 모든 이벤트 리스너를 관리합니다.

import * as DOM from '../dom-elements.js';
import { state } from '../state.js';

let eventListenersSetup = false;

// --- Helper Functions ---

/**
 * 시간을 mm:ss 형식으로 변환합니다.
 * @param {number} seconds - 변환할 시간(초)
 * @returns {string} 포맷된 시간 문자열
 */
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

/**
 * 비디오 플레이어의 현재 시간과 전체 길이를 업데이트합니다.
 */
function updateVideoTimeDisplay() {
    if (!DOM.videoPreview) return;
    DOM.currentTime.textContent = formatTime(DOM.videoPreview.currentTime);
    DOM.totalTime.textContent = formatTime(DOM.videoPreview.duration);
}

/**
 * 비디오 진행 상태 바를 업데이트합니다.
 */
function updateVideoProgressBar() {
    if (!DOM.videoPreview || !DOM.videoProgressFill) return;
    const progress = (DOM.videoPreview.currentTime / DOM.videoPreview.duration) * 100;
    DOM.videoProgressFill.style.width = `${progress}%`;
}

/**
 * 비디오 관련 컨트롤 버튼들의 활성화/비활성화 상태를 업데이트합니다.
 * @param {boolean} enabled - 활성화 여부
 */
function updateVideoControls(enabled) {
    const controls = [
        DOM.playBtn, DOM.pauseBtn, DOM.stopBtn, DOM.rewindBtn,
        DOM.fastForwardBtn, DOM.skipToStartBtn, DOM.skipToEndBtn,
        DOM.playbackSpeedSelect, DOM.videoProgressBar
    ];
    controls.forEach(control => {
        if (control) control.disabled = !enabled;
    });
}

/**
 * 파일이 업로드되었을 때 UI 상태를 업데이트합니다.
 * @param {File} file - 업로드된 파일 객체
 */
function showUploadedFile(file) {
    if (file) {
        DOM.fileName.textContent = `파일명: ${file.name}`;
        DOM.fileSize.textContent = `파일 크기: ${(file.size / 1024 / 1024).toFixed(2)} MB`;
        DOM.fileInfo.style.display = 'block';
        DOM.uploadContainer.style.display = 'none';
        DOM.videoPreviewSection.style.display = 'flex';
    } else {
        DOM.fileInfo.style.display = 'none';
        DOM.uploadContainer.style.display = 'flex';
        DOM.videoPreviewSection.style.display = 'none';
    }
}

/**
 * 사용자가 파일을 선택했을 때 처리하는 메인 함수입니다. (파일 읽기 로직 제거)
 * @param {File} file - 선택된 파일 객체
 */
function handleFileSelect(file) {
    if (!file || !file.type.startsWith('video/')) {
        alert('비디오 파일을 선택해주세요.');
        return;
    }

    // UI 업데이트 및 state에 File 객체 저장
    showUploadedFile(file);
    updateVideoControls(true);
    state.uploadedFile = file; // 실제 데이터가 아닌, File 객체 참조만 저장
    state.uploadedFileData = null; // 이전 데이터가 있다면 초기화

    console.log(`✅ File selected: ${file.name}`);

    // 비디오 미리보기를 위해 URL 생성
    if (DOM.videoPreview.src) {
        URL.revokeObjectURL(DOM.videoPreview.src);
    }
    DOM.videoPreview.src = URL.createObjectURL(file);
    DOM.videoPreview.load();
}

// --- Main Event Listener Setup ---

/**
 * 파일과 관련된 모든 DOM 요소에 이벤트 리스너를 설정합니다.
 * 이 함수는 애플리케이션 초기화 시 한 번만 호출됩니다.
 */
export function setupFileEventListeners() {
    if (eventListenersSetup) return;
    console.log('📝 파일 관련 이벤트 리스너 설정');

    const splitButton = document.getElementById('splitButton');

    // --- 초기 UI 상태 설정 ---
    updateVideoControls(false);
    showUploadedFile(null);
    if (splitButton) splitButton.disabled = true;

    // --- 이벤트 리스너 등록 ---

    // 1. "영상 불러오기" 버튼 클릭
    if (DOM.loadNewVideoButton) {
        DOM.loadNewVideoButton.addEventListener('click', () => {
            DOM.fileInput.click();
        });
    }

    // 2. 파일 업로드 영역 클릭
    if (DOM.uploadContainer) {
        DOM.uploadContainer.addEventListener('click', () => {
            DOM.fileInput.click();
        });
    }

    // 3. 파일이 실제로 선택되었을 때 (async 함수 호출을 안전하게 래핑)
    if (DOM.fileInput) {
        DOM.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFileSelect(file);
            }
        });
    }

    // 4. 드래그 앤 드롭 (async 함수 호출을 안전하게 래핑)
    if (DOM.uploadContainer) {
        DOM.uploadContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            DOM.uploadContainer.classList.add('dragover');
        });
        DOM.uploadContainer.addEventListener('dragleave', (e) => {
            e.preventDefault();
            DOM.uploadContainer.classList.remove('dragover');
        });
        DOM.uploadContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            DOM.uploadContainer.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) {
                handleFileSelect(file);
            }
        });
    }

    // 5. 비디오 플레이어 이벤트
    if (DOM.videoPreview) {
        // 비디오 메타데이터 로드 완료 시
        DOM.videoPreview.addEventListener('loadedmetadata', () => {
            console.log('✅ 비디오 메타데이터 로드 완료');
            updateVideoTimeDisplay();
            if (splitButton) splitButton.disabled = false;
        });

        // 재생 시간 변경 시
        DOM.videoPreview.addEventListener('timeupdate', () => {
            updateVideoTimeDisplay();
            updateVideoProgressBar();
        });

        // 재생이 끝났을 때
        DOM.videoPreview.addEventListener('ended', () => {
            if (DOM.playBtn) DOM.playBtn.style.display = 'inline-block';
            if (DOM.pauseBtn) DOM.pauseBtn.style.display = 'none';
        });

        // 재생 시작 시
        DOM.videoPreview.addEventListener('play', () => {
            if (DOM.playBtn) DOM.playBtn.style.display = 'none';
            if (DOM.pauseBtn) DOM.pauseBtn.style.display = 'inline-block';
        });

        // 일시 정지 시
        DOM.videoPreview.addEventListener('pause', () => {
            if (DOM.playBtn) DOM.playBtn.style.display = 'inline-block';
            if (DOM.pauseBtn) DOM.pauseBtn.style.display = 'none';
        });
    }

    // 6. 비디오 컨트롤 버튼
    if (DOM.playBtn) DOM.playBtn.addEventListener('click', () => DOM.videoPreview.play());
    if (DOM.pauseBtn) DOM.pauseBtn.addEventListener('click', () => DOM.videoPreview.pause());
    if (DOM.stopBtn) {
        DOM.stopBtn.addEventListener('click', () => {
            DOM.videoPreview.pause();
            DOM.videoPreview.currentTime = 0;
        });
    }
    if (DOM.rewindBtn) DOM.rewindBtn.addEventListener('click', () => { DOM.videoPreview.currentTime -= 5; });
    if (DOM.fastForwardBtn) DOM.fastForwardBtn.addEventListener('click', () => { DOM.videoPreview.currentTime += 5; });
    if (DOM.skipToStartBtn) DOM.skipToStartBtn.addEventListener('click', () => { DOM.videoPreview.currentTime = 0; });
    if (DOM.skipToEndBtn) DOM.skipToEndBtn.addEventListener('click', () => { DOM.videoPreview.currentTime = DOM.videoPreview.duration; });
    if (DOM.playbackSpeedSelect) {
        DOM.playbackSpeedSelect.addEventListener('change', (e) => {
            DOM.videoPreview.playbackRate = parseFloat(e.target.value);
        });
    }

    // 7. 프로그레스 바 클릭
    if (DOM.videoProgressBar) {
        DOM.videoProgressBar.addEventListener('click', (e) => {
            if (!DOM.videoPreview.duration) return;
            const rect = DOM.videoProgressBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            DOM.videoPreview.currentTime = (clickX / rect.width) * DOM.videoPreview.duration;
        });
    }

    eventListenersSetup = true;
    console.log('✅ 파일 관련 이벤트 리스너 설정 완료');
}
