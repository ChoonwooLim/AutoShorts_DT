// video-splitter.js

import { state } from '../state.js';
import { saveVideoSegment, getVideoSegments } from '../utils/db-utils.js';

// 상태 객체에 분할된 세그먼트 배열 초기화
state.videoSegments = [];

/**
 * 사용자 정의 구간을 분할하고 저장합니다.
 * @param {number} startTime - 시작 시간 (초)
 * @param {number} endTime - 종료 시간 (초)
 */
export async function splitAndSaveCustomSegment(startTime, endTime) {
    if (startTime >= endTime) {
        alert('시작 시간은 종료 시간보다 빨라야 합니다.');
        return;
    }

    if (!state.uploadedFile) {
        alert('먼저 동영상을 업로드해주세요.');
        return;
    }

    const videoElement = document.getElementById('videoPreview');
    if (!videoElement || !videoElement.duration) {
        alert('동영상 정보를 가져올 수 없습니다.');
        return;
    }
    
    const duration = videoElement.duration;
    if (endTime > duration) {
        alert(`종료 시간은 동영상 길이(${Math.floor(duration)}초)를 초과할 수 없습니다.`);
        return;
    }

    const newSegment = {
        id: `segment-${Date.now()}`,
        startTime,
        endTime,
        // 이 예제에서는 실제 비디오 데이터를 저장하지 않고, 시간 정보만 관리합니다.
        // 실제 구현에서는 이 구간의 비디오 데이터를 Blob으로 추출하거나 FFMPEG을 사용할 수 있습니다.
        videoUrl: URL.createObjectURL(state.uploadedFile) + `#t=${startTime},${endTime}`
    };

    try {
        await saveVideoSegment(newSegment);
        state.videoSegments.push(newSegment);
        console.log('구간 저장 완료:', newSegment);
        // UI 업데이트 로직 호출 (예: renderSegments)
        renderVideoSegments();
    } catch (error) {
        console.error('구간 저장 실패:', error);
        alert('구간 저장에 실패했습니다. IndexedDB가 활성화되어 있는지 확인해주세요.');
    }
}

/**
 * 저장된 비디오 세그먼트를 화면에 렌더링합니다.
 */
export async function renderVideoSegments() {
    const segmentsContainer = document.getElementById('custom-segments-list');
    if (!segmentsContainer) return;

    segmentsContainer.innerHTML = ''; // 기존 목록 초기화

    try {
        const segments = await getVideoSegments();
        state.videoSegments = segments; // 상태 업데이트

        if (segments.length === 0) {
            segmentsContainer.innerHTML = '<p>저장된 영상 구간이 없습니다.</p>';
            return;
        }

        segments.forEach(segment => {
            const segmentElement = document.createElement('div');
            segmentElement.className = 'segment-item';
            segmentElement.innerHTML = `
                <span>구간: ${segment.startTime.toFixed(2)}s - ${segment.endTime.toFixed(2)}s</span>
                <video src="${segment.videoUrl}" width="160" height="90" controls></video>
                <button data-id="${segment.id}" class="delete-segment-btn">삭제</button>
            `;
            segmentsContainer.appendChild(segmentElement);
        });

        // 삭제 버튼에 이벤트 리스너 추가
        document.querySelectorAll('.delete-segment-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                const segmentId = event.target.dataset.id;
                // IndexedDB에서 삭제 로직 추가 필요
                // await deleteVideoSegment(segmentId);
                renderVideoSegments(); // 목록 새로고침
            });
        });

    } catch (error) {
        console.error('구간 렌더링 실패:', error);
        segmentsContainer.innerHTML = '<p>구간을 불러오는 중 오류가 발생했습니다.</p>';
    }
}

/**
 * 비디오를 일정한 길이의 여러 세그먼트로 자동 분할합니다.
 * @param {number} segmentDuration - 각 세그먼트의 길이 (초)
 */
export function splitVideo(segmentDuration = 10) {
    const videoElement = document.getElementById('videoPreview');
    if (!videoElement || !videoElement.duration) {
        alert('동영상 정보를 가져올 수 없습니다.');
        return [];
    }
    
    const totalDuration = videoElement.duration;
    const segments = [];
    
    for (let i = 0; i < totalDuration; i += segmentDuration) {
        const startTime = i;
        const endTime = Math.min(i + segmentDuration, totalDuration);
        
        if (endTime - startTime > 1) { // 너무 짧은 마지막 구간은 제외
            segments.push({ startTime, endTime });
        }
    }
    
    console.log(`${segments.length}개의 구간으로 분할되었습니다.`, segments);
    // 여기서 분할된 세그먼트를 UI에 표시하거나 추가 처리를 할 수 있습니다.
    return segments;
}

// 초기 로드 시 저장된 세그먼트 렌더링
// document.addEventListener('DOMContentLoaded', renderVideoSegments);
