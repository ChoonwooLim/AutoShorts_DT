import { state } from '../state.js';
import { processVideoToShorts } from '../modules/shorts-processing-real.js';

/**
 * 비율 문자열을 숫자 배열로 변환
 */
function parseAspectRatio(aspectRatio) {
    const [width, height] = aspectRatio.split(':').map(Number);
    return { width, height };
}

/**
 * Updates the disabled state of all process buttons
 * based on whether a file and a platform are selected.
 */
export function updateProcessButtonState() {
    const processBtn = document.getElementById('processBtn');
    const processShortsBtn = document.getElementById('processShortsBtn');
    const processGeneralBtn = document.getElementById('processGeneralBtn');
    
    const platformCards = document.querySelectorAll('.platform-card');
    const platformsSelected = Array.from(platformCards).some(card => card.classList.contains('selected'));
    
    // 모든 버튼 상태 업데이트
    const shouldEnable = !(!state.uploadedFile || !platformsSelected);
    
    if (processBtn) processBtn.disabled = !shouldEnable;
    if (processShortsBtn) processShortsBtn.disabled = !shouldEnable;
    if (processGeneralBtn) processGeneralBtn.disabled = !shouldEnable;
}

/**
 * 영상 처리를 실행하는 공통 함수
 */
async function executeVideoProcessing(button, videoType, aspectRatio) {
    if (button.disabled) return;
    
    // 버튼 상태 변경
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '🔄 처리 중...';
    
    try {
        // 비율 정보 파싱
        const aspectConfig = parseAspectRatio(aspectRatio);
        
        // 실제 영상 제작 시작 (비율 정보 포함)
        await processVideoToShorts({
            videoType: videoType,
            aspectRatio: aspectConfig,
            aspectRatioString: aspectRatio
        });
        
        // 성공 시 버튼 텍스트 변경
        button.textContent = '✅ 처리 완료';
        button.style.backgroundColor = '#4caf50';
        
        // 3초 후 원래 상태로 복원
        setTimeout(() => {
            button.textContent = originalText;
            button.style.backgroundColor = '';
            updateProcessButtonState();
        }, 3000);
        
    } catch (error) {
        console.error(`${videoType} 처리 실패:`, error);
        
        // 에러 시 사용자에게 알림
        alert(`${videoType} 제작 실패: ${error.message}`);
        
        // 버튼 상태 복원
        button.textContent = originalText;
        button.disabled = false;
    }
}

/**
 * Sets up event listeners for the processing-related UI elements,
 * like platform selection cards and process buttons.
 */
export function setupProcessingEventListeners() {
    const platformCards = document.querySelectorAll('.platform-card');
    const processBtn = document.getElementById('processBtn');
    const processShortsBtn = document.getElementById('processShortsBtn');
    const processGeneralBtn = document.getElementById('processGeneralBtn');
    const shortsAspectRatio = document.getElementById('shortsAspectRatio');
    const generalAspectRatio = document.getElementById('generalAspectRatio');
    
    // Add event listeners to each platform card
    platformCards.forEach(card => {
        card.addEventListener('click', () => {
            card.classList.toggle('selected');
            updateProcessButtonState(); // Update the button state whenever a card is clicked
        });
    });

    // 기존 processBtn (호환성을 위해 유지)
    if (processBtn) {
        processBtn.addEventListener('click', async () => {
            const defaultAspectRatio = '9:16'; // 기본값
            await executeVideoProcessing(processBtn, '숏츠영상', defaultAspectRatio);
        });
    }

    // 숏츠영상 제작 버튼
    if (processShortsBtn && shortsAspectRatio) {
        processShortsBtn.addEventListener('click', async () => {
            const aspectRatio = shortsAspectRatio.value;
            await executeVideoProcessing(processShortsBtn, '숏츠영상', aspectRatio);
        });
    }

    // 일반영상 제작 버튼
    if (processGeneralBtn && generalAspectRatio) {
        processGeneralBtn.addEventListener('click', async () => {
            const aspectRatio = generalAspectRatio.value;
            await executeVideoProcessing(processGeneralBtn, '일반영상', aspectRatio);
        });
    }

    // 비율 변경 시 상태 표시 업데이트 (선택사항)
    if (shortsAspectRatio) {
        shortsAspectRatio.addEventListener('change', () => {
            console.log('숏츠 비율 변경:', shortsAspectRatio.value);
        });
    }

    if (generalAspectRatio) {
        generalAspectRatio.addEventListener('change', () => {
            console.log('일반영상 비율 변경:', generalAspectRatio.value);
        });
    }
}
