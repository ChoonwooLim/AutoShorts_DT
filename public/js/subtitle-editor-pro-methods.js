// SubtitleEditorPro 클래스의 메서드들 확장
(function() {
    const SubtitleEditorPro = window.SubtitleEditorPro;
    if (!SubtitleEditorPro) return;

    // 이벤트 리스너 설정
    SubtitleEditorPro.prototype.attachEventListeners = function() {
        // 자막 추출 완료 이벤트 리스너
        window.addEventListener('subtitleExtracted', (event) => {
            console.log('🎬 SubtitleEditorPro: 자막 추출 완료 이벤트 수신', event.detail);
            
            if (event.detail) {
                let segments = [];
                
                // 이미 정규화된 segments 사용
                if (event.detail.segments && Array.isArray(event.detail.segments)) {
                    segments = event.detail.segments.map(s => ({
                        start: Math.max(0, Number(s.start) || 0),
                        end: Math.max(0, Number(s.end) || 0),
                        text: String(s.text || '').trim(),
                        speaker: s.speaker || ''
                    }));
                } else if (event.detail.fullResult) {
                    // 구버전 호환성 유지
                    const result = event.detail.fullResult;
                    if (result.segments && Array.isArray(result.segments)) {
                        segments = result.segments.map(s => ({
                            start: Math.max(0, Number(s.start) || 0),
                            end: Math.max(0, Number(s.end) || 0),
                            text: String(s.text || '').trim(),
                            speaker: s.speaker || ''
                        }));
                    }
                } else if (event.detail.text) {
                    // 텍스트만 있는 경우
                    segments = [{
                        start: 0,
                        end: 60,
                        text: event.detail.text,
                        speaker: ''
                    }];
                }
                
                if (segments.length > 0) {
                    console.log('🎬 전문 자막 편집기 자동 열기:', segments.length, '개 세그먼트');
                    setTimeout(() => {
                        this.open(segments);
                    }, 2500); // 모달이 닫힌 후 열기
                }
            }
        });
        
        // 모달 닫기
        document.querySelector('#subtitleEditorProModal .close-btn').addEventListener('click', () => this.close());
        
        // 최소화 버튼
        const minimizeBtn = document.querySelector('#subtitleEditorProModal .minimize-btn');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => this.minimize());
        }
        
        // 최대화 버튼
        const maximizeBtn = document.querySelector('#subtitleEditorProModal .maximize-btn');
        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', () => this.toggleMaximize());
        }
        
        // 드래그 기능 추가
        this.setupDragAndResize();
        
        // 툴바 버튼들
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        document.getElementById('cutBtn').addEventListener('click', () => this.cut());
        document.getElementById('copyBtn').addEventListener('click', () => this.copy());
        document.getElementById('pasteBtn').addEventListener('click', () => this.paste());
        document.getElementById('deleteBtn').addEventListener('click', () => this.deleteSelected());
        document.getElementById('mergeBtn').addEventListener('click', () => this.mergeSubtitles());
        document.getElementById('splitBtn').addEventListener('click', () => this.splitSubtitle());
        document.getElementById('syncBtn').addEventListener('click', () => this.openSyncDialog());
        document.getElementById('speakerBtn').addEventListener('click', () => this.setSpeaker());
        document.getElementById('translateBtn').addEventListener('click', () => this.openTranslateDialog());
        document.getElementById('spellCheckBtn').addEventListener('click', () => this.spellCheck());
        document.getElementById('findReplaceBtn').addEventListener('click', () => this.openFindReplace());
        document.getElementById('exportBtn').addEventListener('click', () => this.export());
        document.getElementById('importBtn').addEventListener('click', () => this.import());
        
        // 비디오 컨트롤
        document.getElementById('playPauseBtn').addEventListener('click', () => this.togglePlayPause());
        document.getElementById('skipBackBtn').addEventListener('click', () => this.skipBack());
        document.getElementById('skipForwardBtn').addEventListener('click', () => this.skipForward());
        document.getElementById('videoSeeker').addEventListener('input', (e) => this.seekVideo(e.target.value));
        
        // 일괄 작업
        document.getElementById('applyTimeAdjustBtn').addEventListener('click', () => this.applyTimeAdjust());
        document.getElementById('applyBatchSpeakerBtn').addEventListener('click', () => this.applyBatchSpeaker());
        document.getElementById('autoSyncBtn').addEventListener('click', () => this.autoSync());
        document.getElementById('removeSilenceBtn').addEventListener('click', () => this.removeSilence());
        
        // 검색 및 필터
        document.getElementById('searchBtn').addEventListener('click', () => this.searchSubtitles());
        document.getElementById('searchInput').addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.searchSubtitles();
        });
        document.getElementById('speakerFilter').addEventListener('change', () => this.filterBySpeaker());
        document.getElementById('selectAllBtn').addEventListener('click', () => this.selectAll());
        document.getElementById('deselectAllBtn').addEventListener('click', () => this.deselectAll());
        document.getElementById('selectAllCheckbox').addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));
        
        // 프로젝트 저장 및 적용
        document.getElementById('saveProjectBtn').addEventListener('click', () => this.saveProject());
        document.getElementById('applyChangesBtn').addEventListener('click', () => this.applyChanges());
        
        // 번역 모달
        document.getElementById('cancelTranslateBtn').addEventListener('click', () => this.closeTranslateDialog());
        document.getElementById('startTranslateBtn').addEventListener('click', () => this.startTranslation());
        
        // 찾기/바꾸기 모달
        document.getElementById('findNextBtn').addEventListener('click', () => this.findNext());
        document.getElementById('replaceOneBtn').addEventListener('click', () => this.replaceOne());
        document.getElementById('replaceAllBtn').addEventListener('click', () => this.replaceAll());
        document.getElementById('closeFindReplaceBtn').addEventListener('click', () => this.closeFindReplace());
        
        // 키보드 단축키
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    };

    // 모달 열기
    SubtitleEditorPro.prototype.open = function(subtitles) {
        // 기존 자막 표시창은 이미 제거됨
        
        // 자막 데이터 설정
        this.subtitles = subtitles || [];
        this.originalSubtitles = JSON.parse(JSON.stringify(this.subtitles));
        
        // 비디오 설정
        this.setupVideo();
        
        // 테이블 렌더링
        this.renderSubtitleTable();
        
        // 화자 필터 업데이트
        this.updateSpeakerFilter();
        
        // 상태 업데이트
        this.updateStatus();
        
        // 모달 표시
        const modal = document.getElementById('subtitleEditorProModal');
        modal.classList.add('active');
        
        // 자동으로 첫 번째 자막으로 이동
        if (this.subtitles.length > 0) {
            this.highlightSubtitle(0);
        }
    };

    // 모달 닫기
    SubtitleEditorPro.prototype.close = function() {
        const modal = document.getElementById('subtitleEditorProModal');
        modal.classList.remove('active');
        
        // 비디오 정지
        if (this.videoElement) {
            this.videoElement.pause();
        }
    };
    
    // 최소화
    SubtitleEditorPro.prototype.minimize = function() {
        const modal = document.getElementById('subtitleEditorProModal');
        modal.style.display = 'none';
        
        // 최소화 상태 표시 (나중에 복원용)
        this.isMinimized = true;
    };
    
    // 최대화 토글
    SubtitleEditorPro.prototype.toggleMaximize = function() {
        const modal = document.getElementById('subtitleEditorProModal');
        const content = modal.querySelector('.subtitle-editor-content');
        
        if (modal.classList.contains('maximized')) {
            // 원래 크기로 복원
            modal.classList.remove('maximized');
            content.style.width = '';
            content.style.height = '';
            content.style.maxWidth = '';
            content.style.maxHeight = '';
        } else {
            // 전체 화면으로 최대화
            modal.classList.add('maximized');
            content.style.width = '100vw';
            content.style.height = '100vh';
            content.style.maxWidth = '100vw';
            content.style.maxHeight = '100vh';
        }
    };

    // 비디오 설정
    SubtitleEditorPro.prototype.setupVideo = function() {
        const video = document.getElementById('previewVideo');
        const sourceVideo = document.getElementById('videoPreview');
        
        if (sourceVideo && sourceVideo.src) {
            video.src = sourceVideo.src;
            this.videoElement = video;
            
            // 비디오 이벤트 리스너
            video.addEventListener('timeupdate', () => this.onVideoTimeUpdate());
            video.addEventListener('loadedmetadata', () => this.onVideoLoaded());
        }
    };

    // 자막 테이블 렌더링
    SubtitleEditorPro.prototype.renderSubtitleTable = function() {
        const tbody = document.getElementById('subtitleTableBody');
        tbody.innerHTML = '';
        
        this.subtitles.forEach((subtitle, index) => {
            const row = document.createElement('tr');
            row.dataset.index = index;
            
            // 선택된 상태 확인
            if (this.selectedSubtitles.has(index)) {
                row.classList.add('selected');
            }
            
            row.innerHTML = `
                <td><input type="checkbox" class="subtitle-checkbox" data-index="${index}" ${this.selectedSubtitles.has(index) ? 'checked' : ''}></td>
                <td>${index + 1}</td>
                <td><input type="text" class="time-input start-time" value="${this.formatTime(subtitle.start)}" data-index="${index}"></td>
                <td><input type="text" class="time-input end-time" value="${this.formatTime(subtitle.end)}" data-index="${index}"></td>
                <td><input type="text" class="speaker-input" value="${subtitle.speaker || ''}" data-index="${index}" placeholder="화자"></td>
                <td><textarea class="subtitle-text-input original-text" data-index="${index}">${subtitle.text || ''}</textarea></td>
                <td><textarea class="subtitle-text-input translated-text" data-index="${index}">${subtitle.translatedText || ''}</textarea></td>
                <td class="action-buttons-cell">
                    <button class="action-btn" onclick="subtitleEditorPro.playSegment(${index})" title="재생">▶</button>
                    <button class="action-btn" onclick="subtitleEditorPro.jumpToTime(${subtitle.start})" title="이동">⏩</button>
                    <button class="action-btn" onclick="subtitleEditorPro.deleteSubtitle(${index})" title="삭제">🗑</button>
                </td>
            `;
            
            tbody.appendChild(row);
            
            // 이벤트 리스너 추가
            this.attachRowEventListeners(row, index);
        });
    };

    // 행 이벤트 리스너 설정
    SubtitleEditorPro.prototype.attachRowEventListeners = function(row, index) {
        // 체크박스
        const checkbox = row.querySelector('.subtitle-checkbox');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.selectedSubtitles.add(index);
                row.classList.add('selected');
            } else {
                this.selectedSubtitles.delete(index);
                row.classList.remove('selected');
            }
            this.updateStatus();
        });
        
        // 시간 입력
        row.querySelector('.start-time').addEventListener('change', (e) => {
            this.subtitles[index].start = this.parseTime(e.target.value);
        });
        
        row.querySelector('.end-time').addEventListener('change', (e) => {
            this.subtitles[index].end = this.parseTime(e.target.value);
        });
        
        // 화자 입력
        row.querySelector('.speaker-input').addEventListener('change', (e) => {
            this.subtitles[index].speaker = e.target.value;
            this.updateSpeakerFilter();
        });
        
        // 텍스트 입력
        row.querySelector('.original-text').addEventListener('change', (e) => {
            this.subtitles[index].text = e.target.value;
        });
        
        row.querySelector('.translated-text').addEventListener('change', (e) => {
            this.subtitles[index].translatedText = e.target.value;
        });
    };

    // 시간 포맷팅
    SubtitleEditorPro.prototype.formatTime = function(seconds) {
        if (typeof seconds !== 'number') return '00:00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    };

    // 시간 파싱
    SubtitleEditorPro.prototype.parseTime = function(timeStr) {
        const parts = timeStr.split(':');
        if (parts.length !== 3) return 0;
        
        const h = parseInt(parts[0]) || 0;
        const m = parseInt(parts[1]) || 0;
        const secParts = parts[2].split('.');
        const s = parseInt(secParts[0]) || 0;
        const ms = parseInt(secParts[1]) || 0;
        
        return h * 3600 + m * 60 + s + ms / 1000;
    };

    // 비디오 시간 업데이트
    SubtitleEditorPro.prototype.onVideoTimeUpdate = function() {
        const currentTime = this.videoElement.currentTime;
        
        // 현재 시간 표시
        document.getElementById('currentTime').textContent = this.formatTime(currentTime).substring(3, 8);
        
        // 시커 업데이트
        const seeker = document.getElementById('videoSeeker');
        seeker.value = (currentTime / this.videoElement.duration) * 100;
        
        // 현재 자막 하이라이트
        const currentSubtitleIndex = this.subtitles.findIndex(s => 
            currentTime >= s.start && currentTime <= s.end
        );
        
        if (currentSubtitleIndex !== -1) {
            this.highlightSubtitle(currentSubtitleIndex);
            this.showSubtitleOverlay(this.subtitles[currentSubtitleIndex]);
        } else {
            this.hideSubtitleOverlay();
        }
        
        // 파형 커서 업데이트
        this.updateWaveformCursor(currentTime);
    };

    // 비디오 로드 완료
    SubtitleEditorPro.prototype.onVideoLoaded = function() {
        const duration = this.videoElement.duration;
        document.getElementById('totalTime').textContent = this.formatTime(duration).substring(3, 8);
        
        // 파형 그리기 (간단한 더미 파형)
        this.drawWaveform();
    };

    // 자막 하이라이트
    SubtitleEditorPro.prototype.highlightSubtitle = function(index) {
        // 기존 하이라이트 제거
        document.querySelectorAll('.subtitle-table tr.active').forEach(row => {
            row.classList.remove('active');
        });
        
        // 새 하이라이트 추가
        const row = document.querySelector(`.subtitle-table tr[data-index="${index}"]`);
        if (row) {
            row.classList.add('active');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        this.currentSubtitleIndex = index;
    };

    // 자막 오버레이 표시
    SubtitleEditorPro.prototype.showSubtitleOverlay = function(subtitle) {
        const overlay = document.getElementById('subtitleOverlay');
        overlay.textContent = subtitle.text;
        overlay.style.display = 'block';
    };

    // 자막 오버레이 숨기기
    SubtitleEditorPro.prototype.hideSubtitleOverlay = function() {
        const overlay = document.getElementById('subtitleOverlay');
        overlay.style.display = 'none';
    };

    // 재생/일시정지 토글
    SubtitleEditorPro.prototype.togglePlayPause = function() {
        if (!this.videoElement) return;
        
        const btn = document.getElementById('playPauseBtn');
        if (this.videoElement.paused) {
            this.videoElement.play();
            btn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            this.videoElement.pause();
            btn.innerHTML = '<i class="fas fa-play"></i>';
        }
    };

    // 뒤로 건너뛰기
    SubtitleEditorPro.prototype.skipBack = function() {
        if (!this.videoElement) return;
        this.videoElement.currentTime = Math.max(0, this.videoElement.currentTime - 5);
    };

    // 앞으로 건너뛰기
    SubtitleEditorPro.prototype.skipForward = function() {
        if (!this.videoElement) return;
        this.videoElement.currentTime = Math.min(this.videoElement.duration, this.videoElement.currentTime + 5);
    };

    // 비디오 시커
    SubtitleEditorPro.prototype.seekVideo = function(value) {
        if (!this.videoElement) return;
        this.videoElement.currentTime = (value / 100) * this.videoElement.duration;
    };

    // 세그먼트 재생
    SubtitleEditorPro.prototype.playSegment = function(index) {
        if (!this.videoElement || !this.subtitles[index]) return;
        
        const subtitle = this.subtitles[index];
        this.videoElement.currentTime = subtitle.start;
        this.videoElement.play();
        
        // 종료 시점에 일시정지
        setTimeout(() => {
            if (this.videoElement.currentTime >= subtitle.end) {
                this.videoElement.pause();
            }
        }, (subtitle.end - subtitle.start) * 1000);
    };

    // 특정 시간으로 이동
    SubtitleEditorPro.prototype.jumpToTime = function(time) {
        if (!this.videoElement) return;
        this.videoElement.currentTime = time;
    };

    // 자막 삭제
    SubtitleEditorPro.prototype.deleteSubtitle = function(index) {
        if (confirm('이 자막을 삭제하시겠습니까?')) {
            this.subtitles.splice(index, 1);
            this.renderSubtitleTable();
            this.updateStatus();
        }
    };

    // 선택된 자막 삭제
    SubtitleEditorPro.prototype.deleteSelected = function() {
        if (this.selectedSubtitles.size === 0) {
            alert('삭제할 자막을 선택해주세요.');
            return;
        }
        
        if (confirm(`선택된 ${this.selectedSubtitles.size}개의 자막을 삭제하시겠습니까?`)) {
            // 인덱스를 역순으로 정렬하여 삭제 (인덱스 변경 방지)
            const indices = Array.from(this.selectedSubtitles).sort((a, b) => b - a);
            indices.forEach(index => {
                this.subtitles.splice(index, 1);
            });
            
            this.selectedSubtitles.clear();
            this.renderSubtitleTable();
            this.updateStatus();
        }
    };

    // 자막 병합
    SubtitleEditorPro.prototype.mergeSubtitles = function() {
        if (this.selectedSubtitles.size < 2) {
            alert('병합할 자막을 2개 이상 선택해주세요.');
            return;
        }
        
        const indices = Array.from(this.selectedSubtitles).sort((a, b) => a - b);
        const firstIndex = indices[0];
        const lastIndex = indices[indices.length - 1];
        
        // 병합된 자막 생성
        const mergedSubtitle = {
            start: this.subtitles[firstIndex].start,
            end: this.subtitles[lastIndex].end,
            text: indices.map(i => this.subtitles[i].text).join(' '),
            speaker: this.subtitles[firstIndex].speaker
        };
        
        // 기존 자막 삭제 (역순으로)
        indices.reverse().forEach(index => {
            this.subtitles.splice(index, 1);
        });
        
        // 병합된 자막 삽입
        this.subtitles.splice(firstIndex, 0, mergedSubtitle);
        
        this.selectedSubtitles.clear();
        this.renderSubtitleTable();
        this.updateStatus();
    };

    // 자막 분할
    SubtitleEditorPro.prototype.splitSubtitle = function() {
        if (this.selectedSubtitles.size !== 1) {
            alert('분할할 자막을 하나만 선택해주세요.');
            return;
        }
        
        const index = Array.from(this.selectedSubtitles)[0];
        const subtitle = this.subtitles[index];
        
        const splitPoint = prompt('분할 지점의 텍스트를 입력하세요:', '');
        if (!splitPoint) return;
        
        const splitIndex = subtitle.text.indexOf(splitPoint);
        if (splitIndex === -1) {
            alert('텍스트를 찾을 수 없습니다.');
            return;
        }
        
        const duration = subtitle.end - subtitle.start;
        const splitTime = subtitle.start + (duration * (splitIndex / subtitle.text.length));
        
        // 두 개의 자막으로 분할
        const subtitle1 = {
            ...subtitle,
            end: splitTime,
            text: subtitle.text.substring(0, splitIndex).trim()
        };
        
        const subtitle2 = {
            ...subtitle,
            start: splitTime,
            text: subtitle.text.substring(splitIndex).trim()
        };
        
        // 기존 자막 대체
        this.subtitles.splice(index, 1, subtitle1, subtitle2);
        
        this.selectedSubtitles.clear();
        this.renderSubtitleTable();
        this.updateStatus();
    };

    // 상태 업데이트
    SubtitleEditorPro.prototype.updateStatus = function() {
        document.getElementById('totalSubtitles').textContent = this.subtitles.length;
        document.getElementById('selectedCount').textContent = this.selectedSubtitles.size;
        
        // 총 시간 계산
        if (this.subtitles.length > 0) {
            const lastSubtitle = this.subtitles[this.subtitles.length - 1];
            document.getElementById('totalDuration').textContent = this.formatTime(lastSubtitle.end);
        }
    };

    // 화자 필터 업데이트
    SubtitleEditorPro.prototype.updateSpeakerFilter = function() {
        const speakers = new Set();
        this.subtitles.forEach(s => {
            if (s.speaker) speakers.add(s.speaker);
        });
        
        const select = document.getElementById('speakerFilter');
        const currentValue = select.value;
        select.innerHTML = '<option value="">모든 화자</option>';
        
        speakers.forEach(speaker => {
            const option = document.createElement('option');
            option.value = speaker;
            option.textContent = speaker;
            select.appendChild(option);
        });
        
        select.value = currentValue;
    };

    // 설정 로드
    SubtitleEditorPro.prototype.loadSettings = function() {
        // localStorage에서 설정 로드
        const settings = localStorage.getItem('subtitleEditorSettings');
        if (settings) {
            const parsed = JSON.parse(settings);
            this.currentLanguage = parsed.currentLanguage || 'ko';
            this.targetLanguage = parsed.targetLanguage || 'en';
        }
    };

    // 설정 저장
    SubtitleEditorPro.prototype.saveSettings = function() {
        const settings = {
            currentLanguage: this.currentLanguage,
            targetLanguage: this.targetLanguage
        };
        localStorage.setItem('subtitleEditorSettings', JSON.stringify(settings));
    };

    // 키보드 단축키 처리
    SubtitleEditorPro.prototype.handleKeyboard = function(e) {
        if (!document.getElementById('subtitleEditorProModal').classList.contains('active')) return;
        
        // Ctrl/Cmd 단축키
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'z': e.preventDefault(); this.undo(); break;
                case 'y': e.preventDefault(); this.redo(); break;
                case 'x': e.preventDefault(); this.cut(); break;
                case 'c': e.preventDefault(); this.copy(); break;
                case 'v': e.preventDefault(); this.paste(); break;
                case 'a': e.preventDefault(); this.selectAll(); break;
                case 's': e.preventDefault(); this.saveProject(); break;
                case 'f': e.preventDefault(); this.openFindReplace(); break;
            }
        }
        
        // 스페이스바로 재생/일시정지
        if (e.key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            this.togglePlayPause();
        }
    };

    // 간단한 파형 그리기 (더미)
    SubtitleEditorPro.prototype.drawWaveform = function() {
        const canvas = document.getElementById('waveformCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        ctx.fillStyle = '#667eea';
        ctx.strokeStyle = '#667eea';
        
        // 랜덤 파형 그리기
        const bars = 200;
        const barWidth = canvas.width / bars;
        
        for (let i = 0; i < bars; i++) {
            const height = Math.random() * canvas.height * 0.8;
            const y = (canvas.height - height) / 2;
            
            ctx.fillRect(i * barWidth, y, barWidth - 1, height);
        }
    };

    // 파형 커서 업데이트
    SubtitleEditorPro.prototype.updateWaveformCursor = function(currentTime) {
        if (!this.videoElement) return;
        
        const cursor = document.querySelector('.waveform-cursor');
        const container = document.getElementById('waveformContainer');
        if (!cursor || !container) return;
        
        const progress = currentTime / this.videoElement.duration;
        cursor.style.left = `${progress * 100}%`;
    };

    // 전체 선택
    SubtitleEditorPro.prototype.selectAll = function() {
        this.subtitles.forEach((_, index) => {
            this.selectedSubtitles.add(index);
        });
        this.renderSubtitleTable();
        this.updateStatus();
    };

    // 선택 해제
    SubtitleEditorPro.prototype.deselectAll = function() {
        this.selectedSubtitles.clear();
        this.renderSubtitleTable();
        this.updateStatus();
    };

    // 전체 선택 토글
    SubtitleEditorPro.prototype.toggleSelectAll = function(checked) {
        if (checked) {
            this.selectAll();
        } else {
            this.deselectAll();
        }
    };

    // 변경사항 적용
    SubtitleEditorPro.prototype.applyChanges = function() {
        // 메인 페이지로 자막 데이터 전달
        const event = new CustomEvent('subtitleUpdated', {
            detail: {
                subtitles: this.subtitles
            }
        });
        window.dispatchEvent(event);
        
        // 상태 메시지 표시
        document.getElementById('statusMessage').textContent = '변경사항이 적용되었습니다.';
        
        // 원본 업데이트
        this.originalSubtitles = JSON.parse(JSON.stringify(this.subtitles));
    };

    // 더미 메서드들 (실제 구현 필요)
    SubtitleEditorPro.prototype.undo = function() { console.log('Undo'); };
    SubtitleEditorPro.prototype.redo = function() { console.log('Redo'); };
    SubtitleEditorPro.prototype.cut = function() { console.log('Cut'); };
    SubtitleEditorPro.prototype.copy = function() { console.log('Copy'); };
    SubtitleEditorPro.prototype.paste = function() { console.log('Paste'); };
    SubtitleEditorPro.prototype.setSpeaker = function() { console.log('Set Speaker'); };
    SubtitleEditorPro.prototype.spellCheck = function() { console.log('Spell Check'); };
    SubtitleEditorPro.prototype.autoSync = function() { console.log('Auto Sync'); };
    SubtitleEditorPro.prototype.removeSilence = function() { console.log('Remove Silence'); };
    SubtitleEditorPro.prototype.searchSubtitles = function() { console.log('Search'); };
    SubtitleEditorPro.prototype.filterBySpeaker = function() { console.log('Filter by Speaker'); };
    SubtitleEditorPro.prototype.applyTimeAdjust = function() { console.log('Apply Time Adjust'); };
    SubtitleEditorPro.prototype.applyBatchSpeaker = function() { console.log('Apply Batch Speaker'); };
    SubtitleEditorPro.prototype.saveProject = function() { console.log('Save Project'); };
    SubtitleEditorPro.prototype.openSyncDialog = function() { console.log('Open Sync Dialog'); };
    SubtitleEditorPro.prototype.openTranslateDialog = function() { 
        document.getElementById('translateSettingsModal').style.display = 'block';
    };
    SubtitleEditorPro.prototype.closeTranslateDialog = function() {
        document.getElementById('translateSettingsModal').style.display = 'none';
    };
    SubtitleEditorPro.prototype.startTranslation = function() { console.log('Start Translation'); };
    SubtitleEditorPro.prototype.openFindReplace = function() {
        document.getElementById('findReplaceModal').style.display = 'block';
    };
    SubtitleEditorPro.prototype.closeFindReplace = function() {
        document.getElementById('findReplaceModal').style.display = 'none';
    };
    SubtitleEditorPro.prototype.findNext = function() { console.log('Find Next'); };
    SubtitleEditorPro.prototype.replaceOne = function() { console.log('Replace One'); };
    SubtitleEditorPro.prototype.replaceAll = function() { console.log('Replace All'); };
    
    // 드래그 및 리사이즈 기능
    SubtitleEditorPro.prototype.setupDragAndResize = function() {
        const modal = document.getElementById('subtitleEditorProModal');
        const content = modal.querySelector('.subtitle-editor-content');
        const header = modal.querySelector('.subtitle-editor-header');
        
        let isDragging = false;
        let isResizing = false;
        let dragStartX, dragStartY, initialLeft, initialTop;
        let resizeStartX, resizeStartY, initialWidth, initialHeight;
        
        // 헤더 드래그 기능
        header.addEventListener('mousedown', (e) => {
            // 버튼 클릭은 드래그하지 않음
            if (e.target.closest('.header-actions')) return;
            
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            
            const rect = content.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            
            header.style.cursor = 'grabbing';
        });
        
        // 리사이즈 핸들 생성 및 이벤트
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        resizeHandle.style.cssText = `
            position: absolute;
            bottom: 0;
            right: 0;
            width: 20px;
            height: 20px;
            cursor: se-resize;
            background: linear-gradient(-45deg, transparent 30%, #667eea 30%, #667eea 60%, transparent 60%);
            z-index: 1003;
        `;
        content.appendChild(resizeHandle);
        
        resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            isResizing = true;
            resizeStartX = e.clientX;
            resizeStartY = e.clientY;
            
            const rect = content.getBoundingClientRect();
            initialWidth = rect.width;
            initialHeight = rect.height;
        });
        
        // 마우스 이동 이벤트
        document.addEventListener('mousemove', (e) => {
            if (isDragging && !modal.classList.contains('maximized')) {
                const deltaX = e.clientX - dragStartX;
                const deltaY = e.clientY - dragStartY;
                
                const newLeft = initialLeft + deltaX;
                const newTop = initialTop + deltaY;
                
                // 화면 경계 체크
                const maxLeft = window.innerWidth - content.offsetWidth;
                const maxTop = window.innerHeight - content.offsetHeight;
                
                content.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
                content.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
                content.style.right = 'auto';
                content.style.bottom = 'auto';
            }
            
            if (isResizing && !modal.classList.contains('maximized')) {
                const deltaX = e.clientX - resizeStartX;
                const deltaY = e.clientY - resizeStartY;
                
                const newWidth = Math.max(800, initialWidth + deltaX);
                const newHeight = Math.max(600, initialHeight + deltaY);
                
                // 화면 경계 체크
                const rect = content.getBoundingClientRect();
                const maxWidth = window.innerWidth - rect.left;
                const maxHeight = window.innerHeight - rect.top;
                
                content.style.width = Math.min(newWidth, maxWidth) + 'px';
                content.style.height = Math.min(newHeight, maxHeight) + 'px';
            }
        });
        
        // 마우스 업 이벤트
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                header.style.cursor = 'move';
            }
            
            if (isResizing) {
                isResizing = false;
            }
        });
        
        // 더블클릭으로 최대화/복원
        header.addEventListener('dblclick', (e) => {
            if (!e.target.closest('.header-actions')) {
                this.toggleMaximize();
            }
        });
    };
    
    // 최소화 기능
    SubtitleEditorPro.prototype.minimize = function() {
        const modal = document.getElementById('subtitleEditorProModal');
        const content = modal.querySelector('.subtitle-editor-content');
        
        if (modal.classList.contains('minimized')) {
            // 복원
            modal.classList.remove('minimized');
            content.style.display = 'flex';
        } else {
            // 최소화
            modal.classList.add('minimized');
            content.style.display = 'none';
        }
    };
    
    // 최대화/복원 기능
    SubtitleEditorPro.prototype.toggleMaximize = function() {
        const modal = document.getElementById('subtitleEditorProModal');
        const content = modal.querySelector('.subtitle-editor-content');
        const maximizeBtn = modal.querySelector('.maximize-btn');
        
        if (modal.classList.contains('maximized')) {
            // 복원
            modal.classList.remove('maximized');
            maximizeBtn.textContent = '□';
            maximizeBtn.title = '최대화';
            
            // 이전 위치와 크기로 복원
            if (this.lastPosition) {
                content.style.left = this.lastPosition.left;
                content.style.top = this.lastPosition.top;
                content.style.width = this.lastPosition.width;
                content.style.height = this.lastPosition.height;
            }
        } else {
            // 현재 위치와 크기 저장
            const rect = content.getBoundingClientRect();
            this.lastPosition = {
                left: content.style.left || (rect.left + 'px'),
                top: content.style.top || (rect.top + 'px'),
                width: content.style.width || (rect.width + 'px'),
                height: content.style.height || (rect.height + 'px')
            };
            
            // 최대화
            modal.classList.add('maximized');
            maximizeBtn.textContent = '◱';
            maximizeBtn.title = '복원';
        }
    };
    
    // 전역 인스턴스 생성
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.subtitleEditorPro = new SubtitleEditorPro();
            // attachEventListeners 호출
            if (window.subtitleEditorPro.attachEventListeners) {
                window.subtitleEditorPro.attachEventListeners();
            }
            console.log('✅ SubtitleEditorPro 초기화 완료');
        });
    } else {
        // 이미 로드된 경우
        window.subtitleEditorPro = new SubtitleEditorPro();
        // attachEventListeners 호출
        if (window.subtitleEditorPro.attachEventListeners) {
            window.subtitleEditorPro.attachEventListeners();
        }
        console.log('✅ SubtitleEditorPro 초기화 완료 (즉시)');
    }
})();