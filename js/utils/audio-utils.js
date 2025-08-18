/**
 * 🎵 AudioUtils - 오디오 처리 유틸리티 클래스
 * 
 * 중복 코드 제거를 위한 오디오 관련 공통 기능 모음
 * - AudioContext 관리
 * - 오디오 디코딩
 * - 오디오 압축
 * - 메모리 관리
 */

class AudioUtils {
    constructor() {
        this.currentAudioContext = null;
    }

    /**
     * AudioContext 생성 (싱글톤 패턴)
     * @returns {AudioContext}
     */
    getAudioContext() {
        if (!this.currentAudioContext || this.currentAudioContext.state === 'closed') {
            this.currentAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            window.currentAudioContext = this.currentAudioContext; // 전역 참조 저장
            console.log('🎵 새로운 AudioContext 생성');
        }
        return this.currentAudioContext;
    }

    /**
     * 오디오 파일을 AudioBuffer로 디코딩
     * @param {ArrayBuffer} arrayBuffer 
     * @returns {Promise<AudioBuffer>}
     */
    async decodeAudioData(arrayBuffer) {
        const audioContext = this.getAudioContext();
        try {
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            console.log(`✅ 오디오 디코딩 성공: ${audioBuffer.duration.toFixed(1)}초, ${audioBuffer.sampleRate}Hz`);
            return audioBuffer;
        } catch (error) {
            console.error('❌ 오디오 디코딩 실패:', error);
            throw new Error(`오디오 디코딩 실패: ${error.message}`);
        }
    }

    /**
     * 오디오 데이터를 리샘플링
     * @param {Float32Array} channelData 
     * @param {number} originalSampleRate 
     * @param {number} targetSampleRate 
     * @returns {Float32Array}
     */
    resampleAudio(channelData, originalSampleRate, targetSampleRate) {
        if (originalSampleRate === targetSampleRate) {
            return channelData;
        }

        const ratio = originalSampleRate / targetSampleRate;
        const newLength = Math.round(channelData.length / ratio);
        const result = new Float32Array(newLength);

        for (let i = 0; i < newLength; i++) {
            const sourceIndex = i * ratio;
            const index = Math.floor(sourceIndex);
            const fraction = sourceIndex - index;

            if (index + 1 < channelData.length) {
                result[i] = channelData[index] * (1 - fraction) + channelData[index + 1] * fraction;
            } else {
                result[i] = channelData[index];
            }
        }

        console.log(`🔄 리샘플링: ${originalSampleRate}Hz → ${targetSampleRate}Hz (${channelData.length} → ${newLength} 샘플)`);
        return result;
    }

    /**
     * Float32Array를 16비트 WAV 포맷으로 변환
     * @param {Float32Array} audioData 
     * @param {number} sampleRate 
     * @returns {ArrayBuffer}
     */
    encodeWAV(audioData, sampleRate) {
        const length = audioData.length;
        const buffer = new ArrayBuffer(44 + length * 2);
        const view = new DataView(buffer);

        // WAV 헤더 작성
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * 2, true);

        // 오디오 데이터 변환 (Float32 → Int16)
        let offset = 44;
        for (let i = 0; i < length; i++) {
            const sample = Math.max(-1, Math.min(1, audioData[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }

        return buffer;
    }

    /**
     * AudioBuffer를 MediaRecorder로 MP3 압축
     * @param {AudioBuffer} audioBuffer 
     * @returns {Promise<Blob>}
     */
    async encodeToMp3UsingMediaRecorder(audioBuffer) {
        const audioContext = this.getAudioContext();
        
        return new Promise((resolve, reject) => {
            try {
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                
                const destination = audioContext.createMediaStreamDestination();
                source.connect(destination);
                
                const mediaRecorder = new MediaRecorder(destination.stream, {
                    mimeType: 'audio/webm;codecs=opus'
                });
                
                const chunks = [];
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        chunks.push(event.data);
                    }
                };
                
                mediaRecorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'audio/webm' });
                    resolve(blob);
                };
                
                mediaRecorder.onerror = (error) => {
                    reject(new Error(`MediaRecorder 오류: ${error.message}`));
                };
                
                mediaRecorder.start();
                source.start();
                
                setTimeout(() => {
                    mediaRecorder.stop();
                    source.stop();
                }, audioBuffer.duration * 1000 + 100);
                
            } catch (error) {
                reject(new Error(`MP3 압축 실패: ${error.message}`));
            }
        });
    }

    /**
     * 압축 수준 결정 (Google STT 최적화)
     * @param {number} fileSizeMB 
     * @param {number} durationMinutes 
     * @param {number} sampleRate 
     * @returns {Object}
     */
    determineCompressionLevel(fileSizeMB, durationMinutes, sampleRate) {
        if (fileSizeMB <= 5) {
            return {
                targetSampleRate: Math.min(sampleRate, 22050),
                compressionLevel: '경량 압축',
                quality: '고품질 유지'
            };
        } else if (fileSizeMB <= 15) {
            return {
                targetSampleRate: 16000,
                compressionLevel: '표준 압축',
                quality: '균형 최적화'
            };
        } else if (fileSizeMB <= 30) {
            return {
                targetSampleRate: 16000,
                compressionLevel: '강력 압축',
                quality: '크기 우선'
            };
        } else {
            return {
                targetSampleRate: 8000,
                compressionLevel: '최대 압축',
                quality: '크기 최우선'
            };
        }
    }

    /**
     * 오디오 데이터를 바이트 단위로 분할
     * @param {ArrayBuffer} audioBuffer 
     * @param {number} maxChunkSize 
     * @returns {ArrayBuffer[]}
     */
    splitAudioByBytes(audioBuffer, maxChunkSize = 9 * 1024 * 1024) {
        const chunks = [];
        const totalSize = audioBuffer.byteLength;
        
        if (totalSize <= maxChunkSize) {
            return [audioBuffer];
        }
        
        for (let offset = 0; offset < totalSize; offset += maxChunkSize) {
            const chunkSize = Math.min(maxChunkSize, totalSize - offset);
            const chunk = audioBuffer.slice(offset, offset + chunkSize);
            chunks.push(chunk);
        }
        
        console.log(`🔄 바이트 분할: ${totalSize}바이트 → ${chunks.length}개 조각`);
        return chunks;
    }

    /**
     * AudioContext 정리
     */
    async cleanup() {
        if (this.currentAudioContext && this.currentAudioContext.state !== 'closed') {
            await this.currentAudioContext.close();
            console.log('🎵 AudioContext 정리 완료');
        }
        this.currentAudioContext = null;
        window.currentAudioContext = null;
    }

    /**
     * 파일 크기를 MB 단위로 포맷
     * @param {number} bytes 
     * @returns {string}
     */
    formatFileSize(bytes) {
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)}MB`;
    }

    /**
     * 압축률 계산
     * @param {number} originalSize 
     * @param {number} compressedSize 
     * @returns {string}
     */
    calculateCompressionRatio(originalSize, compressedSize) {
        const ratio = ((originalSize - compressedSize) / originalSize * 100);
        return `${ratio.toFixed(1)}%`;
    }
}

// 싱글톤 인스턴스 생성
const audioUtils = new AudioUtils();

// ES6 모듈과 전역 스코프 모두 지원
if (typeof module !== 'undefined' && module.exports) {
    module.exports = audioUtils;
} else {
    window.audioUtils = audioUtils;
}

// ES6 모듈 export 추가
export default audioUtils; 