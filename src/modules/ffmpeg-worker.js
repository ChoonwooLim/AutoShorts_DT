import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg;
let isLoading = false;

// 로그 제한을 위한 변수
let logCount = 0;
const MAX_LOGS = 50;

self.onmessage = async ({ data }) => {
    const { id, type, data: payload } = data;
    
    console.log(`🔧 FFmpeg 워커 요청: ${type} (ID: ${id})`);
    
    try {
        if (type === 'load') {
            if (isLoading) {
                console.log(`⏳ FFmpeg 이미 로딩 중 (ID: ${id})`);
                return;
            }
            
            if (!ffmpeg) {
                isLoading = true;
                console.log(`🚀 FFmpeg 초기화 시작 (ID: ${id})`);
                
                ffmpeg = new FFmpeg();
                
                // 로그 제한으로 무한 출력 방지
                ffmpeg.on('log', ({ message }) => {
                    logCount++;
                    if (logCount <= MAX_LOGS) {
                        self.postMessage({ id, type: 'log', data: `[${logCount}] ${message}` });
                    } else if (logCount === MAX_LOGS + 1) {
                        self.postMessage({ id, type: 'log', data: '... (로그 출력 제한됨)' });
                    }
                });
                
                // 기본 경로로 로드 (자동 감지)
                await ffmpeg.load();
                
                isLoading = false;
                console.log(`✅ FFmpeg 로딩 완료 (ID: ${id})`);
            }
            self.postMessage({ id, type: 'load_done', data: 'success' });
            
        } else if (type === 'extract_audio') {
            if (!ffmpeg) {
                throw new Error('FFmpeg가 로드되지 않았습니다.');
            }
            
            const { file } = payload;
            console.log(`🎵 오디오 추출 시작: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
            
            // 파일 쓰기
            const inputFileName = `input_${Date.now()}.${file.name.split('.').pop()}`;
            await ffmpeg.writeFile(inputFileName, await fetchFile(file));
            console.log(`📁 입력 파일 준비: ${inputFileName}`);

            // 더 안정적인 설정으로 오디오 추출
            const segmentTime = 30; // 30초로 더 작게 분할
            const outputPattern = `chunk_%03d.flac`;
            
            // FFmpeg 명령어 실행
            await ffmpeg.exec([
                '-i', inputFileName,
                '-f', 'segment',
                '-segment_time', segmentTime.toString(),
                '-vn', // 비디오 스트림 제거
                '-acodec', 'flac', // FLAC 코덱
                '-ar', '16000', // 16kHz 샘플링
                '-ac', '1', // 모노 채널
                '-avoid_negative_ts', 'make_zero', // 타임스탬프 문제 해결
                outputPattern
            ]);
            
            console.log(`🔍 생성된 파일 목록 확인 중...`);

            // 생성된 오디오 조각들 수집
            const audioChunks = [];
            const files = await ffmpeg.listDir('.');
            
            for (const f of files) {
                if (f.name.startsWith('chunk_') && f.name.endsWith('.flac')) {
                    console.log(`📦 조각 발견: ${f.name}`);
                    const data = await ffmpeg.readFile(f.name);
                    audioChunks.push({ name: f.name, data: data.buffer });
                    
                    // 메모리 정리
                    await ffmpeg.deleteFile(f.name);
                }
            }
            
            // 입력 파일도 정리
            await ffmpeg.deleteFile(inputFileName);
            
            // 순서대로 정렬
            audioChunks.sort((a, b) => a.name.localeCompare(b.name));
            console.log(`✅ 오디오 추출 완료: ${audioChunks.length}개 조각`);

            const buffers = audioChunks.map(chunk => chunk.data);
            self.postMessage({ 
                id, 
                type: 'extract_audio_done', 
                data: { buffers, count: buffers.length } 
            }, buffers);
        }
    } catch (error) {
        console.error(`❌ FFmpeg 워커 오류 (ID: ${id}):`, error);
        isLoading = false;
        self.postMessage({ id, type: 'error', data: error.message });
    }
};