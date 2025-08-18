// js/project-manager.js
import { state } from './state.js';
import { showUploadedFile, updateVideoControls } from './ui-file.js';
import { addSubtitleEntryWithTimestamp } from './simple-transcription.js';

// DOM 관련 코드는 더 이상 필요 없으므로 삭제합니다.

/**
 * 현재 애플리케이션 상태를 객체로 수집합니다.
 * @returns {object} 저장할 프로젝트 데이터
 */
function gatherProjectData() {
    // state 객체에서 핵심 데이터를 복사
    const projectData = {
        videoFile: state.videoFile ? {
            name: state.videoFile.name,
            path: state.videoFile.path, // Electron 환경에서는 path가 중요합니다.
            lastModified: state.videoFile.lastModified,
            size: state.videoFile.size,
            type: state.videoFile.type
        } : null,
        subtitles: state.subtitles || [],
        selectedPlatforms: state.selectedPlatforms || [],
        selectedLLM: state.selectedLLM || 'Claude 3.5 Sonnet',
        // 추가적으로 저장하고 싶은 다른 상태 값들...
    };
    console.log('📦 프로젝트 데이터 수집:', projectData);
    return projectData;
}

/**
 * 불러온 데이터로 애플리케이션 상태를 복원합니다.
 *
 * @param {object} data - 파일에서 불러온 프로젝트 데이터
 */
async function restoreProjectState(data) {
    console.log('🔄 프로젝트 상태 복원 시작:', data);

    // 0. 모든 UI 초기화 (새 프로젝트를 여는 것과 유사)
    // 이 부분은 애플리케이션의 '새로 만들기' 로직에 따라 달라질 수 있습니다.
    // 여기서는 간단하게 자막 컨테이너만 비웁니다.
    const subtitleResultsContainer = document.getElementById('subtitleResultsContainer');
    if (subtitleResultsContainer) {
        subtitleResultsContainer.innerHTML = ''; 
    }
    // 필요하다면 다른 UI 요소들도 초기화...

    // 1. 상태 객체 업데이트
    state.videoFile = data.videoFile || null;
    state.subtitles = data.subtitles || [];
    state.selectedPlatforms = data.selectedPlatforms || [];
    state.selectedLLM = data.selectedLLM || 'Claude 3.5 Sonnet';

    // 2. 비디오 UI 복원
    if (state.videoFile && state.videoFile.path) {
        showUploadedFile(state.videoFile);

        try {
            console.log(`📹 비디오 파일 로딩 시도: ${state.videoFile.path}`);
            // Electron main 프로세스를 통해 파일 읽기
            const result = await window.electronAPI.readFile(state.videoFile.path);
            
            if (result.success) {
                // Buffer(Uint8Array)를 Blob으로 변환
                const blob = new Blob([result.data], { type: state.videoFile.type || 'video/mp4' });
                const videoURL = URL.createObjectURL(blob);
                
                const videoPreview = document.getElementById('videoPreview');
                videoPreview.src = videoURL;
                videoPreview.style.display = 'block';

                // 비디오 컨트롤 활성화
                updateVideoControls(true);
                console.log('✅ 비디오 미리보기 로드 성공.');
            } else {
                console.error('❌ 비디오 파일 불러오기 실패:', result.error);
                alert(`프로젝트에 연결된 비디오 파일을 불러오는 데 실패했습니다.\n경로: ${state.videoFile.path}\n오류: ${result.error}`);
            }
        } catch (e) {
            console.error('💥 비디오 파일 로딩 중 예외 발생:', e);
            alert(`비디오 파일을 로드하는 중 심각한 오류가 발생했습니다: ${e.message}`);
        }
    }


    // 3. 자막 UI 복원
    if (state.subtitles && state.subtitles.length > 0) {
        addSubtitleEntryWithTimestamp(state.subtitles, "불러온 프로젝트");
    }
    
    // TODO: 플랫폼 선택, LLM 선택 등 다른 UI들도 복원하는 코드 추가

    console.log('✅ 프로젝트 상태 복원 완료.');
    alert('프로젝트를 성공적으로 불러왔습니다.');
}


/**
 * 프로젝트 저장 로직
 */
export async function saveProject() {
    try {
        const projectData = gatherProjectData();
        if (!projectData.videoFile) {
            alert('저장할 영상 파일이 없습니다. 먼저 파일을 업로드해주세요.');
            return;
        }

        const result = await window.electronAPI.saveProject(projectData);

        if (result.success) {
            console.log(`✅ 프로젝트 저장 성공: ${result.path}`);
            alert(`프로젝트가 다음 위치에 저장되었습니다:\n${result.path}`);
        } else if (result.reason !== 'cancelled') {
            console.error('❌ 프로젝트 저장 실패:', result.error);
            alert(`프로젝트 저장에 실패했습니다: ${result.error}`);
        }
    } catch (error) {
        console.error('💥 프로젝트 저장 중 예외 발생:', error);
        alert(`오류가 발생하여 프로젝트를 저장할 수 없습니다.`);
    }
}

/**
 * 프로젝트 불러오기 로직
 */
export async function loadProject() {
    try {
        const result = await window.electronAPI.loadProject();

        if (result.success) {
            console.log(`✅ 프로젝트 불러오기 성공: ${result.path}`);
            await restoreProjectState(result.data);
        } else if (result.reason !== 'cancelled') {
            console.error('❌ 프로젝트 불러오기 실패:', result.error);
            alert(`프로젝트를 불러오는 데 실패했습니다: ${result.error}`);
        }
    } catch (error) {
        console.error('💥 프로젝트 불러오기 중 예외 발생:', error);
        alert(`오류가 발생하여 프로젝트를 불러올 수 없습니다.`);
    }
}

// 더 이상 버튼 이벤트 리스너를 설정할 필요가 없으므로 이 함수는 삭제합니다. 