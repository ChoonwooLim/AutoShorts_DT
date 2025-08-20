// SubtitleEditorPro 내보내기 기능 확장
(function() {
    const SubtitleEditorPro = window.SubtitleEditorPro;
    if (!SubtitleEditorPro) return;

    // 내보내기 메인 함수
    SubtitleEditorPro.prototype.export = function() {
        const format = document.getElementById('exportFormat').value;
        let content = '';
        let filename = '';
        let mimeType = 'text/plain';
        
        switch (format) {
            case 'srt':
                content = this.exportToSRT();
                filename = 'subtitles.srt';
                break;
            case 'vtt':
                content = this.exportToVTT();
                filename = 'subtitles.vtt';
                mimeType = 'text/vtt';
                break;
            case 'ass':
                content = this.exportToASS();
                filename = 'subtitles.ass';
                break;
            case 'txt':
                content = this.exportToTXT();
                filename = 'subtitles.txt';
                break;
            case 'json':
                content = this.exportToJSON();
                filename = 'subtitles.json';
                mimeType = 'application/json';
                break;
            case 'csv':
                content = this.exportToCSV();
                filename = 'subtitles.csv';
                mimeType = 'text/csv';
                break;
        }
        
        // 다운로드
        this.downloadFile(content, filename, mimeType);
        
        // 상태 메시지
        document.getElementById('statusMessage').textContent = `${format.toUpperCase()} 형식으로 내보내기 완료`;
    };

    // SRT 형식으로 내보내기
    SubtitleEditorPro.prototype.exportToSRT = function() {
        let srt = '';
        
        this.subtitles.forEach((subtitle, index) => {
            srt += `${index + 1}\n`;
            srt += `${this.formatSRTTime(subtitle.start)} --> ${this.formatSRTTime(subtitle.end)}\n`;
            srt += `${subtitle.text}\n`;
            if (subtitle.translatedText) {
                srt += `${subtitle.translatedText}\n`;
            }
            srt += '\n';
        });
        
        return srt;
    };

    // WebVTT 형식으로 내보내기
    SubtitleEditorPro.prototype.exportToVTT = function() {
        let vtt = 'WEBVTT\n\n';
        
        this.subtitles.forEach((subtitle, index) => {
            vtt += `${index + 1}\n`;
            vtt += `${this.formatVTTTime(subtitle.start)} --> ${this.formatVTTTime(subtitle.end)}`;
            if (subtitle.speaker) {
                vtt += ` <v ${subtitle.speaker}>`;
            }
            vtt += '\n';
            vtt += `${subtitle.text}\n`;
            if (subtitle.translatedText) {
                vtt += `${subtitle.translatedText}\n`;
            }
            vtt += '\n';
        });
        
        return vtt;
    };

    // ASS/SSA 형식으로 내보내기
    SubtitleEditorPro.prototype.exportToASS = function() {
        let ass = '[Script Info]\n';
        ass += 'Title: Subtitle\n';
        ass += 'ScriptType: v4.00+\n';
        ass += 'Collisions: Normal\n';
        ass += 'PlayDepth: 0\n\n';
        
        ass += '[V4+ Styles]\n';
        ass += 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n';
        ass += 'Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1\n\n';
        
        ass += '[Events]\n';
        ass += 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
        
        this.subtitles.forEach(subtitle => {
            const start = this.formatASSTime(subtitle.start);
            const end = this.formatASSTime(subtitle.end);
            const speaker = subtitle.speaker || '';
            const text = subtitle.text.replace(/\n/g, '\\N');
            
            ass += `Dialogue: 0,${start},${end},Default,${speaker},0,0,0,,${text}\n`;
            
            if (subtitle.translatedText) {
                const translatedText = subtitle.translatedText.replace(/\n/g, '\\N');
                ass += `Dialogue: 0,${start},${end},Default,${speaker},0,0,0,,${translatedText}\n`;
            }
        });
        
        return ass;
    };

    // 텍스트 형식으로 내보내기
    SubtitleEditorPro.prototype.exportToTXT = function() {
        let txt = '';
        
        this.subtitles.forEach((subtitle, index) => {
            const timeRange = `[${this.formatTime(subtitle.start).substring(3, 8)} - ${this.formatTime(subtitle.end).substring(3, 8)}]`;
            
            if (subtitle.speaker) {
                txt += `${subtitle.speaker}: `;
            }
            
            txt += `${timeRange} ${subtitle.text}\n`;
            
            if (subtitle.translatedText) {
                txt += `  → ${subtitle.translatedText}\n`;
            }
            
            txt += '\n';
        });
        
        return txt;
    };

    // JSON 형식으로 내보내기
    SubtitleEditorPro.prototype.exportToJSON = function() {
        const data = {
            version: '1.0',
            created: new Date().toISOString(),
            language: this.currentLanguage,
            targetLanguage: this.targetLanguage,
            subtitles: this.subtitles.map(subtitle => ({
                start: subtitle.start,
                end: subtitle.end,
                text: subtitle.text,
                translatedText: subtitle.translatedText || '',
                speaker: subtitle.speaker || '',
                confidence: subtitle.confidence || 1.0
            }))
        };
        
        return JSON.stringify(data, null, 2);
    };

    // CSV 형식으로 내보내기
    SubtitleEditorPro.prototype.exportToCSV = function() {
        let csv = 'Index,Start Time,End Time,Duration,Speaker,Original Text,Translated Text\n';
        
        this.subtitles.forEach((subtitle, index) => {
            const startTime = this.formatTime(subtitle.start);
            const endTime = this.formatTime(subtitle.end);
            const duration = (subtitle.end - subtitle.start).toFixed(2);
            const speaker = subtitle.speaker || '';
            const text = this.escapeCSV(subtitle.text);
            const translatedText = this.escapeCSV(subtitle.translatedText || '');
            
            csv += `${index + 1},"${startTime}","${endTime}","${duration}","${speaker}","${text}","${translatedText}"\n`;
        });
        
        return csv;
    };

    // 가져오기 메인 함수
    SubtitleEditorPro.prototype.import = function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.srt,.vtt,.ass,.ssa,.txt,.json,.csv';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const content = await this.readFile(file);
            const extension = file.name.split('.').pop().toLowerCase();
            
            try {
                let subtitles = [];
                
                switch (extension) {
                    case 'srt':
                        subtitles = this.parseSRT(content);
                        break;
                    case 'vtt':
                        subtitles = this.parseVTT(content);
                        break;
                    case 'ass':
                    case 'ssa':
                        subtitles = this.parseASS(content);
                        break;
                    case 'json':
                        subtitles = this.parseJSON(content);
                        break;
                    case 'csv':
                        subtitles = this.parseCSV(content);
                        break;
                    case 'txt':
                        subtitles = this.parseTXT(content);
                        break;
                    default:
                        throw new Error('지원하지 않는 파일 형식입니다.');
                }
                
                // 자막 데이터 업데이트
                this.subtitles = subtitles;
                this.renderSubtitleTable();
                this.updateStatus();
                
                document.getElementById('statusMessage').textContent = `${file.name} 파일을 성공적으로 가져왔습니다.`;
                
            } catch (error) {
                console.error('Import error:', error);
                alert(`파일 가져오기 실패: ${error.message}`);
            }
        };
        
        input.click();
    };

    // SRT 파싱
    SubtitleEditorPro.prototype.parseSRT = function(content) {
        const subtitles = [];
        const blocks = content.trim().split(/\n\s*\n/);
        
        blocks.forEach(block => {
            const lines = block.trim().split('\n');
            if (lines.length < 3) return;
            
            const timeLine = lines[1];
            const match = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
            
            if (match) {
                const start = this.parseSRTTime(match[1]);
                const end = this.parseSRTTime(match[2]);
                const text = lines.slice(2).join('\n');
                
                subtitles.push({
                    start,
                    end,
                    text,
                    speaker: '',
                    translatedText: ''
                });
            }
        });
        
        return subtitles;
    };

    // VTT 파싱
    SubtitleEditorPro.prototype.parseVTT = function(content) {
        const subtitles = [];
        const blocks = content.replace('WEBVTT', '').trim().split(/\n\s*\n/);
        
        blocks.forEach(block => {
            const lines = block.trim().split('\n');
            if (lines.length < 2) return;
            
            let timeLine = lines[0];
            if (lines.length > 2 && !timeLine.includes('-->')) {
                timeLine = lines[1];
            }
            
            const match = timeLine.match(/(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/);
            
            if (match) {
                const start = this.parseVTTTime(match[1]);
                const end = this.parseVTTTime(match[2]);
                
                let textLines = lines.slice(1);
                if (lines.length > 2 && !lines[0].includes('-->')) {
                    textLines = lines.slice(2);
                }
                
                let text = textLines.join('\n');
                let speaker = '';
                
                // 화자 정보 추출
                const speakerMatch = text.match(/<v\s+([^>]+)>/);
                if (speakerMatch) {
                    speaker = speakerMatch[1];
                    text = text.replace(/<v\s+[^>]+>/, '');
                }
                
                subtitles.push({
                    start,
                    end,
                    text: text.trim(),
                    speaker,
                    translatedText: ''
                });
            }
        });
        
        return subtitles;
    };

    // ASS 파싱
    SubtitleEditorPro.prototype.parseASS = function(content) {
        const subtitles = [];
        const lines = content.split('\n');
        let inEvents = false;
        
        lines.forEach(line => {
            if (line.startsWith('[Events]')) {
                inEvents = true;
                return;
            }
            
            if (!inEvents || !line.startsWith('Dialogue:')) return;
            
            const parts = line.split(',');
            if (parts.length < 10) return;
            
            const start = this.parseASSTime(parts[1]);
            const end = this.parseASSTime(parts[2]);
            const speaker = parts[4] || '';
            const text = parts.slice(9).join(',').replace(/\\N/g, '\n');
            
            subtitles.push({
                start,
                end,
                text,
                speaker,
                translatedText: ''
            });
        });
        
        return subtitles;
    };

    // JSON 파싱
    SubtitleEditorPro.prototype.parseJSON = function(content) {
        const data = JSON.parse(content);
        
        if (data.subtitles && Array.isArray(data.subtitles)) {
            return data.subtitles.map(s => ({
                start: s.start || 0,
                end: s.end || 0,
                text: s.text || '',
                speaker: s.speaker || '',
                translatedText: s.translatedText || ''
            }));
        }
        
        // 배열 형식
        if (Array.isArray(data)) {
            return data.map(s => ({
                start: s.start || 0,
                end: s.end || 0,
                text: s.text || '',
                speaker: s.speaker || '',
                translatedText: s.translatedText || ''
            }));
        }
        
        throw new Error('잘못된 JSON 형식입니다.');
    };

    // CSV 파싱
    SubtitleEditorPro.prototype.parseCSV = function(content) {
        const subtitles = [];
        const lines = content.split('\n');
        const headers = lines[0].toLowerCase().split(',');
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = this.parseCSVLine(line);
            const subtitle = {
                start: 0,
                end: 0,
                text: '',
                speaker: '',
                translatedText: ''
            };
            
            headers.forEach((header, index) => {
                const value = values[index] || '';
                
                if (header.includes('start')) {
                    subtitle.start = this.parseTimeString(value);
                } else if (header.includes('end')) {
                    subtitle.end = this.parseTimeString(value);
                } else if (header.includes('text') || header.includes('original')) {
                    subtitle.text = value;
                } else if (header.includes('translated')) {
                    subtitle.translatedText = value;
                } else if (header.includes('speaker')) {
                    subtitle.speaker = value;
                }
            });
            
            if (subtitle.text) {
                subtitles.push(subtitle);
            }
        }
        
        return subtitles;
    };

    // TXT 파싱 (간단한 형식)
    SubtitleEditorPro.prototype.parseTXT = function(content) {
        const subtitles = [];
        const lines = content.split('\n');
        let currentSubtitle = null;
        
        lines.forEach(line => {
            const timeMatch = line.match(/\[(\d{2}:\d{2}:\d{2})\s*-\s*(\d{2}:\d{2}:\d{2})\]/);
            
            if (timeMatch) {
                if (currentSubtitle) {
                    subtitles.push(currentSubtitle);
                }
                
                currentSubtitle = {
                    start: this.parseTimeString(timeMatch[1]),
                    end: this.parseTimeString(timeMatch[2]),
                    text: line.replace(timeMatch[0], '').trim(),
                    speaker: '',
                    translatedText: ''
                };
                
                // 화자 추출
                const speakerMatch = currentSubtitle.text.match(/^([^:]+):\s*/);
                if (speakerMatch) {
                    currentSubtitle.speaker = speakerMatch[1];
                    currentSubtitle.text = currentSubtitle.text.replace(speakerMatch[0], '');
                }
            } else if (line.trim().startsWith('→') && currentSubtitle) {
                currentSubtitle.translatedText = line.replace('→', '').trim();
            }
        });
        
        if (currentSubtitle) {
            subtitles.push(currentSubtitle);
        }
        
        return subtitles;
    };

    // 시간 포맷팅 헬퍼 함수들
    SubtitleEditorPro.prototype.formatSRTTime = function(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    };

    SubtitleEditorPro.prototype.formatVTTTime = function(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    };

    SubtitleEditorPro.prototype.formatASSTime = function(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const cs = Math.floor((seconds % 1) * 100);
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
    };

    SubtitleEditorPro.prototype.parseSRTTime = function(timeStr) {
        const parts = timeStr.split(':');
        const h = parseInt(parts[0]) || 0;
        const m = parseInt(parts[1]) || 0;
        const secParts = parts[2].split(',');
        const s = parseInt(secParts[0]) || 0;
        const ms = parseInt(secParts[1]) || 0;
        return h * 3600 + m * 60 + s + ms / 1000;
    };

    SubtitleEditorPro.prototype.parseVTTTime = function(timeStr) {
        return this.parseSRTTime(timeStr.replace('.', ','));
    };

    SubtitleEditorPro.prototype.parseASSTime = function(timeStr) {
        const parts = timeStr.split(':');
        const h = parseInt(parts[0]) || 0;
        const m = parseInt(parts[1]) || 0;
        const secParts = parts[2].split('.');
        const s = parseInt(secParts[0]) || 0;
        const cs = parseInt(secParts[1]) || 0;
        return h * 3600 + m * 60 + s + cs / 100;
    };

    SubtitleEditorPro.prototype.parseTimeString = function(timeStr) {
        if (!timeStr) return 0;
        
        // HH:MM:SS.mmm or HH:MM:SS,mmm
        if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            if (parts.length === 3) {
                const h = parseInt(parts[0]) || 0;
                const m = parseInt(parts[1]) || 0;
                const secParts = parts[2].replace(',', '.').split('.');
                const s = parseInt(secParts[0]) || 0;
                const ms = parseInt((secParts[1] || '0').padEnd(3, '0').substring(0, 3)) || 0;
                return h * 3600 + m * 60 + s + ms / 1000;
            } else if (parts.length === 2) {
                const m = parseInt(parts[0]) || 0;
                const s = parseFloat(parts[1]) || 0;
                return m * 60 + s;
            }
        }
        
        // 숫자만 있는 경우 (초 단위)
        return parseFloat(timeStr) || 0;
    };

    // CSV 헬퍼 함수들
    SubtitleEditorPro.prototype.escapeCSV = function(text) {
        if (!text) return '';
        return text.replace(/"/g, '""').replace(/\n/g, ' ');
    };

    SubtitleEditorPro.prototype.parseCSVLine = function(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        values.push(current.trim());
        return values;
    };

    // 파일 읽기
    SubtitleEditorPro.prototype.readFile = function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file, 'UTF-8');
        });
    };

    // 파일 다운로드
    SubtitleEditorPro.prototype.downloadFile = function(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };
})();