import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg;
let isLoading = false;

let logCount = 0;
const MAX_LOGS = 50;

// 환경별 FFmpeg 코어 경로 설정
const getCoreUrlBase = () => {
    const hostname = self.location.hostname;
    const port = self.location.port;
    
    console.log(`🌍 FFmpeg 워커 환경: ${hostname}:${port}`);
    
    if (hostname === 'localhost' && port === '3000') {
        // 메인 서버에서 실행될 때
        const path = `${self.location.origin}/AutoShortsWeb/ffmpeg/`;
        console.log(`🔗 로컬 Express 서버 FFmpeg 경로: ${path}`);
        return path;
    } else if (hostname === 'localhost' && port === '5173') {
        // Vite 개발 서버에서 실행될 때
        const path = `${self.location.origin}/ffmpeg/`;
        console.log(`🔗 Vite 개발 서버 FFmpeg 경로: ${path}`);
        return path;
    } else if (hostname === 'twinverse.org' || hostname === 'www.twinverse.org') {
        // 프로덕션 환경
        const path = `${self.location.origin}/AutoShortsWeb/ffmpeg/`;
        console.log(`🔗 프로덕션 환경 FFmpeg 경로: ${path}`);
        return path;
    } else {
        // 기본값
        const path = `${self.location.origin}/ffmpeg/`;
        console.log(`🔗 기본 FFmpeg 경로: ${path}`);
        return path;
    }
};

const CORE_URL_BASE = getCoreUrlBase();

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
                
                ffmpeg.on('log', ({ message }) => {
                    logCount++;
                    if (logCount <= MAX_LOGS) {
                        self.postMessage({ id, type: 'log', data: `[${logCount}] ${message}` });
                    } else if (logCount === MAX_LOGS + 1) {
                        self.postMessage({ id, type: 'log', data: '... (로그 출력 제한됨)' });
                    }
                });
                
                const coreURL = `${CORE_URL_BASE}ffmpeg-core.js`;
                console.log(`🔗 FFmpeg 코어 로딩 경로: ${coreURL}`);

                try {
                    await ffmpeg.load({
                        coreURL: coreURL,
                        wasmURL: `${CORE_URL_BASE}ffmpeg-core.wasm`,
                        workerURL: `${CORE_URL_BASE}ffmpeg-core.worker.js`
                    });
                    
                    isLoading = false;
                    console.log(`✅ FFmpeg 로딩 완료 (ID: ${id})`);
                } catch (loadError) {
                    console.error(`❌ FFmpeg 로딩 실패 (ID: ${id}):`, loadError);
                    
                    // 프로덕션에서 실패 시 대체 경로 시도
                    if (self.location.hostname === 'twinverse.org' || self.location.hostname === 'www.twinverse.org') {
                        console.log('🔄 프로덕션 대체 FFmpeg 경로 시도...');
                        const fallbackBase = `${self.location.origin}/ffmpeg/`;
                        const fallbackCoreURL = `${fallbackBase}ffmpeg-core.js`;
                        console.log(`🔗 대체 FFmpeg 코어 경로: ${fallbackCoreURL}`);
                        
                        try {
                            await ffmpeg.load({
                                coreURL: fallbackCoreURL,
                                wasmURL: `${fallbackBase}ffmpeg-core.wasm`,
                                workerURL: `${fallbackBase}ffmpeg-core.worker.js`
                            });
                            
                            isLoading = false;
                            console.log(`✅ FFmpeg 대체 경로 로딩 완료 (ID: ${id})`);
                        } catch (fallbackError) {
                            console.error(`❌ FFmpeg 대체 경로도 실패 (ID: ${id}):`, fallbackError);
                            throw new Error(`FFmpeg 로딩 실패: ${loadError.message}, 대체 경로도 실패: ${fallbackError.message}`);
                        }
                    } else {
                        throw loadError;
                    }
                }
            }
            self.postMessage({ id, type: 'load_done', data: 'success' });
            
        } else if (type === 'extract_audio') {
            if (!ffmpeg || !ffmpeg.loaded) {
                throw new Error('FFmpeg가 로드되지 않았습니다.');
            }
            
            const { file } = payload;
            console.log(`🎵 오디오 추출 시작: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
            
            const inputFileName = `input_${Date.now()}.${file.name.split('.').pop()}`;
            await ffmpeg.writeFile(inputFileName, await fetchFile(file));
            console.log(`📁 입력 파일 준비: ${inputFileName}`);

            // MP3로 변환하여 용량 축소 - 60초 단위로 분할
            const segmentTime = 60;
            const outputPattern = `chunk_%03d.mp3`;
            
            await ffmpeg.exec([
                '-i', inputFileName,
                '-f', 'segment',
                '-segment_time', segmentTime.toString(),
                '-vn',
                '-acodec', 'libmp3lame',
                '-b:a', '32k',  // 32kbps로 더 압축
                '-ar', '16000',
                '-ac', '1',
                '-compression_level', '9',  // 최대 압축
                '-avoid_negative_ts', 'make_zero',
                outputPattern
            ]);
            
            console.log(`🔍 생성된 파일 목록 확인 중...`);

            const audioChunks = [];
            const files = await ffmpeg.listDir('.');
            
            for (const f of files) {
                if (f.name.startsWith('chunk_') && f.name.endsWith('.mp3')) {
                    console.log(`📦 MP3 조각 발견: ${f.name} (${(f.size / 1024).toFixed(1)}KB)`);
                    const data = await ffmpeg.readFile(f.name);
                    audioChunks.push({ name: f.name, data: data.buffer });
                    
                    await ffmpeg.deleteFile(f.name);
                }
            }
            
            await ffmpeg.deleteFile(inputFileName);
            
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
