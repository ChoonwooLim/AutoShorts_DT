const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class AudioChunker {
  constructor(ffmpegPath, options = {}) {
    this.ffmpegPath = ffmpegPath;
    this.maxChunkSize = options.maxChunkSize || 20 * 1024 * 1024; // 20MB
    this.overlapSeconds = options.overlapSeconds || 10; // 10초 오버랩
    this.tempDir = options.tempDir || require('os').tmpdir();
  }

  /**
   * 오디오 파일을 청크로 분할
   * @param {string} inputPath - 입력 오디오 파일 경로
   * @returns {Promise<Array>} 청크 정보 배열
   */
  async chunkAudio(inputPath) {
    console.log(`📊 오디오 청킹 시작: ${inputPath}`);
    
    // 1. 파일 크기와 길이 확인
    const stats = fs.statSync(inputPath);
    const duration = await this.getAudioDuration(inputPath);
    
    if (stats.size <= this.maxChunkSize) {
      console.log('✅ 청킹 불필요 - 파일이 충분히 작음');
      return [{
        path: inputPath,
        startTime: 0,
        endTime: duration,
        duration: duration,
        size: stats.size
      }];
    }

    // 2. 최적 청크 개수 계산
    const chunkCount = Math.ceil(stats.size / this.maxChunkSize);
    const chunkDuration = duration / chunkCount;
    
    // 3. 무음 구간 감지 (자연스러운 분할 지점)
    const silencePoints = await this.detectSilencePoints(inputPath);
    
    // 4. 청크 생성
    const chunks = [];
    for (let i = 0; i < chunkCount; i++) {
      const startTime = i * chunkDuration - (i > 0 ? this.overlapSeconds : 0);
      const endTime = Math.min((i + 1) * chunkDuration, duration);
      
      // 무음 구간에 가장 가까운 지점으로 조정
      const adjustedStart = this.findNearestSilence(startTime, silencePoints);
      const adjustedEnd = this.findNearestSilence(endTime, silencePoints);
      
      const chunkPath = path.join(this.tempDir, `chunk_${i}_${Date.now()}.opus`);
      
      await this.extractChunk(
        inputPath,
        chunkPath,
        adjustedStart,
        adjustedEnd - adjustedStart
      );
      
      chunks.push({
        path: chunkPath,
        startTime: adjustedStart,
        endTime: adjustedEnd,
        duration: adjustedEnd - adjustedStart,
        size: fs.statSync(chunkPath).size,
        index: i,
        hasOverlap: i > 0
      });
      
      console.log(`✅ 청크 ${i + 1}/${chunkCount} 생성 완료`);
    }
    
    return chunks;
  }

  /**
   * 오디오 길이 가져오기
   */
  async getAudioDuration(inputPath) {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn(this.ffmpegPath.replace('ffmpeg', 'ffprobe'), [
        '-i', inputPath,
        '-show_entries', 'format=duration',
        '-v', 'quiet',
        '-of', 'csv=p=0'
      ]);
      
      let duration = '';
      ffprobe.stdout.on('data', (data) => {
        duration += data.toString();
      });
      
      ffprobe.on('close', (code) => {
        if (code === 0) {
          resolve(parseFloat(duration));
        } else {
          reject(new Error('Failed to get duration'));
        }
      });
    });
  }

  /**
   * 무음 구간 감지
   */
  async detectSilencePoints(inputPath) {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(this.ffmpegPath, [
        '-i', inputPath,
        '-af', 'silencedetect=noise=-30dB:d=0.5',
        '-f', 'null',
        '-'
      ]);
      
      const silencePoints = [];
      let stderr = '';
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
        
        // 무음 구간 파싱
        const silenceStart = stderr.match(/silence_start: ([\d.]+)/g);
        const silenceEnd = stderr.match(/silence_end: ([\d.]+)/g);
        
        if (silenceStart) {
          silenceStart.forEach(match => {
            const time = parseFloat(match.replace('silence_start: ', ''));
            silencePoints.push({ type: 'start', time });
          });
        }
        
        if (silenceEnd) {
          silenceEnd.forEach(match => {
            const time = parseFloat(match.replace('silence_end: ', ''));
            silencePoints.push({ type: 'end', time });
          });
        }
      });
      
      ffmpeg.on('close', () => {
        resolve(silencePoints);
      });
    });
  }

  /**
   * 가장 가까운 무음 지점 찾기
   */
  findNearestSilence(targetTime, silencePoints) {
    if (silencePoints.length === 0) return targetTime;
    
    let nearest = targetTime;
    let minDiff = Infinity;
    
    silencePoints.forEach(point => {
      const diff = Math.abs(point.time - targetTime);
      if (diff < minDiff && diff < 2) { // 2초 이내의 무음만 고려
        minDiff = diff;
        nearest = point.time;
      }
    });
    
    return nearest;
  }

  /**
   * 청크 추출
   */
  async extractChunk(inputPath, outputPath, startTime, duration) {
    return new Promise((resolve, reject) => {
      const args = [
        '-ss', startTime.toString(),
        '-t', duration.toString(),
        '-i', inputPath,
        '-af', 'afftdn=nf=-25,highpass=f=300,lowpass=f=3000',
        '-acodec', 'libopus',
        '-b:a', '24k',
        '-ar', '16000',
        '-ac', '1',
        '-application', 'voip',
        outputPath
      ];
      
      const ffmpeg = spawn(this.ffmpegPath, args);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Chunk extraction failed with code ${code}`));
        }
      });
    });
  }

  /**
   * 전사 결과 병합 (오버랩 제거)
   */
  mergeTranscriptions(results) {
    const merged = {
      text: '',
      segments: []
    };
    
    let lastText = '';
    
    results.forEach((result, index) => {
      if (index === 0) {
        // 첫 번째 청크는 그대로 사용
        merged.text = result.text;
        merged.segments = result.segments;
        lastText = result.text.slice(-100); // 마지막 100자 저장
      } else {
        // 오버랩 부분 찾기
        const overlapIndex = result.text.indexOf(lastText);
        
        if (overlapIndex > -1 && overlapIndex < 200) {
          // 오버랩 제거
          const newText = result.text.substring(overlapIndex + lastText.length);
          merged.text += newText;
          
          // 세그먼트 타임스탬프 조정
          const adjustedSegments = result.segments.map(seg => ({
            ...seg,
            start: seg.start + result.startTime,
            end: seg.end + result.startTime
          }));
          
          merged.segments.push(...adjustedSegments);
        } else {
          // 오버랩을 찾지 못한 경우 그냥 연결
          merged.text += ' ' + result.text;
          merged.segments.push(...result.segments);
        }
        
        lastText = result.text.slice(-100);
      }
    });
    
    return merged;
  }

  /**
   * 임시 파일 정리
   */
  cleanupChunks(chunks) {
    chunks.forEach(chunk => {
      if (fs.existsSync(chunk.path)) {
        fs.unlinkSync(chunk.path);
        console.log(`🗑️ 청크 정리: ${chunk.path}`);
      }
    });
  }
}

module.exports = AudioChunker;