// js/video-splitter.js
// 대용량 파일을 메인 스레드에서 직접 처리하는 FFmpeg 분할 로직

import { state } from './state.js';
import { get as getDB, set as setDB } from './utils/db-utils.js';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg = null;
let outputFolderHandle = null;
let progressContainer = null;

// --- 프로그레스 바 UI 관리 (이전과 동일) ---
function createProgressBar() {
    if (document.getElementById('splitProgressContainer')) return;
    const container = document.createElement('div');
    container.id = 'splitProgressContainer';
    container.className = 'progress-container';
    container.style.display = 'none';
    container.style.marginTop = '10px';
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    const fill = document.createElement('div');
    fill.id = 'splitProgressFill';
    fill.className = 'progress-fill';
    const text = document.createElement('span');
    text.id = 'splitProgressText';
    text.className = 'progress-text';
    bar.appendChild(fill);
    bar.appendChild(text);
    container.appendChild(bar);
    const splitButton = document.getElementById('splitButton');
    splitButton?.parentElement.insertAdjacentElement('afterend', container);
    progressContainer = container;
}

function updateProgressBar(text, fillPercentage) {
    const fill = document.getElementById('splitProgressFill');
    const textElem = document.getElementById('splitProgressText');
    if (fill && textElem) {
        textElem.textContent = text;
        fill.style.width = `${fillPercentage}%`;
    }
}

function showProgressBar() {
    if (!progressContainer) createProgressBar();
    progressContainer.style.display = 'block';
    updateProgressBar('분할 작업 준비 중...', 0);
}

function hideProgressBar() {
    if (progressContainer) {
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 2000);
    }
}

// --- FFmpeg 핵심 로직 ---

/**
 * FFmpeg 인스턴스를 초기화하고 로드합니다.
 */
async function loadFFmpeg() {
    if (ffmpeg && ffmpeg.loaded) return;
    ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg Log]', message);
    });
    ffmpeg.on('progress', ({ ratio }) => {
        const progress = Math.max(0, Math.min(100, ratio * 100));
        updateProgressBar(`분할 진행 중... ${progress.toFixed(1)}%`, progress);
    });
    await ffmpeg.load();
}

/**
 * hh:mm:ss 형식으로 시간을 변환합니다.
 */
function formatDuration(seconds) {
    return new Date(seconds * 1000).toISOString().substr(11, 8);
}


/**
 * 영상 분할을 시작하는 메인 함수입니다.
 */
export async function splitVideo(splitDurationMinutes) {
    const videoElement = document.getElementById('videoPreview');
    if (!state.uploadedFile || !videoElement || videoElement.readyState < 1) {
        alert("분할할 영상을 먼저 업로드하고, 영상이 로드될 때까지 기다려주세요.");
        return;
    }

    try {
        showProgressBar();
        await loadFFmpeg();
        updateProgressBar('FFmpeg 로드 완료. 폴더 선택 대기 중...', 0);

        // 1. IndexedDB에서 저장된 폴더 핸들을 가져옵니다.
        outputFolderHandle = await getDB('outputDir');
        if (!outputFolderHandle) {
            outputFolderHandle = await window.showDirectoryPicker();
            await setDB('outputDir', outputFolderHandle);
        }
        
        const permission = await outputFolderHandle.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
            await outputFolderHandle.requestPermission({ mode: 'readwrite' });
        }
        console.log(`📁 Output folder: ${outputFolderHandle.name}`);

        // 2. 대용량 파일 처리를 위해 fetchFile을 사용합니다.
        const originalFile = state.uploadedFile;
        const inputFileName = `input.${originalFile.name.split('.').pop()}`;
        updateProgressBar('영상 파일 등록 중...', 0);
        await ffmpeg.writeFile(inputFileName, await fetchFile(originalFile));

        // 3. 분할 작업 실행
        const duration = videoElement.duration;
        const splitDurationSeconds = splitDurationMinutes * 60;
        const numSegments = Math.ceil(duration / splitDurationSeconds);
        
        for (let i = 0; i < numSegments; i++) {
            const startTime = i * splitDurationSeconds;
            const outputFileName = `part_${i + 1}.mp4`;
            const finalOutputName = `part_${i + 1}_${originalFile.name}`;

            const overallProgressText = `[${i + 1}/${numSegments}] 조각 처리 중...`;
            updateProgressBar(overallProgressText, 0);

            await ffmpeg.exec([
                '-i', inputFileName,
                '-ss', formatDuration(startTime),
                '-t', formatDuration(splitDurationSeconds),
                '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac',
                outputFileName
            ]);

            const data = await ffmpeg.readFile(outputFileName);
            
            const fileHandle = await outputFolderHandle.getFileHandle(finalOutputName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(data);
            await writable.close();
            
            console.log(`✅ Saved ${finalOutputName}`);
            await ffmpeg.deleteFile(outputFileName);
        }

        await ffmpeg.deleteFile(inputFileName);
        updateProgressBar(`[${numSegments}/${numSegments}] 모든 작업 완료!`, 100);
        alert(`✅ 영상 분할 완료! 총 ${numSegments}개의 파일이 저장되었습니다.`);

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('User cancelled folder selection.');
        } else {
            console.error('Error in splitVideo process:', error);
            alert(`오류가 발생했습니다: ${error.message}`);
        }
    } finally {
        hideProgressBar();
    }
} 