import { state } from './state.js';
import { callAI, aiModels, getApiKey } from './api.js';

class SubtitleEditorModal {
	constructor() {
		this.modal = null;
		this.currentSegments = [];
		this.activeTab = 'segments';
		this.modelKey = 'gpt';
		this.subModel = 'GPT-4o Mini';
		this.targetLanguage = 'ko';
	}

	init() {
		if (this.modal) return;
		const modalHtml = `
		<div id="subtitleEditorModal" class="option-modal" style="display:none;">
			<div class="modal-content" style="max-width: 900px; width: 90vw;">
				<div class="modal-header">
					<h3>🛠️ 자막 편집/번역</h3>
					<button class="modal-close" data-modal="subtitleEditorModal">&times;</button>
				</div>
				<div class="modal-body">
					<div class="editor-toolbar" style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
						<select id="subtitleEditorModel" class="modal-setting-input" style="min-width:160px;"></select>
						<select id="subtitleEditorTargetLang" class="modal-setting-input" style="min-width:120px;">
							<option value="ko">한국어</option>
							<option value="en">영어</option>
							<option value="ja">일본어</option>
							<option value="zh">중국어</option>
							<option value="es">스페인어</option>
						</select>
						<button id="subtitleTranslateBtn" class="modal-btn">🌐 번역</button>
						<button id="subtitleSaveSrtBtn" class="modal-btn">💾 SRT</button>
						<button id="subtitleSaveVttBtn" class="modal-btn">💾 VTT</button>
						<button id="subtitleSaveTxtBtn" class="modal-btn">💾 TXT</button>
						<button id="subtitleApplyBtn" class="modal-btn primary" style="margin-left:auto;">적용</button>
					</div>
					<div class="editor-tabs" style="display:flex; gap:8px; margin-bottom:8px;">
						<button data-tab="segments" class="tab-btn active">세그먼트</button>
						<button data-tab="raw" class="tab-btn">원본 텍스트</button>
					</div>
					<div class="editor-panels">
						<div id="segmentsPanel" class="panel active" style="display:grid; grid-template-columns: 120px 120px 1fr; gap:6px; align-items:center;"></div>
						<div id="rawPanel" class="panel" style="display:none;">
							<textarea id="rawSubtitleTextarea" style="width:100%; height:300px;"></textarea>
						</div>
					</div>
				</div>
				<div class="modal-footer">
					<button class="modal-btn secondary" data-modal="subtitleEditorModal">닫기</button>
				</div>
			</div>
		</div>`;
		document.body.insertAdjacentHTML('beforeend', modalHtml);

		this.modal = document.getElementById('subtitleEditorModal');
		this.bindEvents();
		this.populateModels();
	}

	bindEvents() {
		document.querySelectorAll('[data-modal="subtitleEditorModal"]').forEach(btn => {
			btn.addEventListener('click', () => this.close());
		});
		const tabs = this.modal.querySelectorAll('.tab-btn');
		tabs.forEach(btn => btn.addEventListener('click', () => this.switchTab(btn.dataset.tab)));
		this.modal.querySelector('#subtitleTranslateBtn').addEventListener('click', () => this.translate());
		this.modal.querySelector('#subtitleSaveSrtBtn').addEventListener('click', () => this.download('srt'));
		this.modal.querySelector('#subtitleSaveVttBtn').addEventListener('click', () => this.download('vtt'));
		this.modal.querySelector('#subtitleSaveTxtBtn').addEventListener('click', () => this.download('txt'));
		this.modal.querySelector('#subtitleApplyBtn').addEventListener('click', () => this.applyToState());
		this.modal.querySelector('#subtitleEditorTargetLang').addEventListener('change', (e) => this.targetLanguage = e.target.value);
		this.modal.querySelector('#subtitleEditorModel').addEventListener('change', (e) => this.subModel = e.target.value);

		// 지연 로딩/전역 미정의 상황 대비 이벤트 훅
		document.addEventListener('openSubtitleEditorRequested', () => {
			try { this.open(); } catch (e) { console.warn(e); }
		});
	}

	populateModels() {
		const select = this.modal.querySelector('#subtitleEditorModel');
		select.innerHTML = '';
		const modelData = aiModels[this.modelKey];
		(modelData?.subModels || []).forEach(name => {
			const opt = document.createElement('option');
			opt.value = name;
			opt.textContent = name;
			if (name === this.subModel) opt.selected = true;
			select.appendChild(opt);
		});
	}

	open(segments = null) {
		this.init();
		this.currentSegments = Array.isArray(segments) && segments.length ? segments : (state.subtitles || []);
		this.renderSegments();
		this.renderRaw();
		this.modal.style.display = 'block';
	}

	close() {
		if (this.modal) this.modal.style.display = 'none';
	}

	switchTab(tab) {
		this.activeTab = tab;
		const segmentsPanel = this.modal.querySelector('#segmentsPanel');
		const rawPanel = this.modal.querySelector('#rawPanel');
		this.modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
		this.modal.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
		if (tab === 'segments') {
			segmentsPanel.style.display = 'grid';
			rawPanel.style.display = 'none';
		} else {
			segmentsPanel.style.display = 'none';
			rawPanel.style.display = 'block';
		}
	}

	renderSegments() {
		const panel = this.modal.querySelector('#segmentsPanel');
		panel.innerHTML = '';
		const toTime = (t) => {
			const s = Math.max(0, Math.floor(Number(t) || 0));
			const hh = String(Math.floor(s / 3600)).padStart(2, '0');
			const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
			const ss = String(s % 60).padStart(2, '0');
			return `${hh}:${mm}:${ss}`;
		};
		this.currentSegments.forEach((seg, idx) => {
			const startInput = document.createElement('input');
			startInput.type = 'text';
			startInput.value = toTime(seg.start);
			startInput.dataset.idx = idx;
			startInput.style.width = '110px';
			const endInput = document.createElement('input');
			endInput.type = 'text';
			endInput.value = toTime(seg.end);
			endInput.dataset.idx = idx;
			endInput.style.width = '110px';
			const textInput = document.createElement('textarea');
			textInput.value = (seg.text || '').trim();
			textInput.rows = 2;
			textInput.dataset.idx = idx;
			textInput.style.width = '100%';
			panel.appendChild(startInput);
			panel.appendChild(endInput);
			panel.appendChild(textInput);
		});
	}

	renderRaw() {
		const ta = this.modal.querySelector('#rawSubtitleTextarea');
		const lines = this.currentSegments.map(s => `[${this.formatMMSS(s.start)} - ${this.formatMMSS(s.end)}] ${s.text?.trim() || ''}`);
		ta.value = lines.join('\n');
	}

	captureEdits() {
		// sync edits from UI back to this.currentSegments
		const panel = this.modal.querySelector('#segmentsPanel');
		const inputs = Array.from(panel.querySelectorAll('input, textarea'));
		const byIdx = {};
		inputs.forEach(el => {
			const idx = Number(el.dataset.idx);
			byIdx[idx] = byIdx[idx] || { start: null, end: null, text: null };
			if (el.tagName === 'TEXTAREA') {
				byIdx[idx].text = el.value;
			} else {
				const secs = this.parseHHMMSS(el.value);
				// order: start, end, text per row
				const base = idx * 3;
				if (el === panel.children[base + 0]) byIdx[idx].start = secs;
				if (el === panel.children[base + 1]) byIdx[idx].end = secs;
			}
		});
		this.currentSegments = this.currentSegments.map((seg, idx) => ({
			start: byIdx[idx]?.start ?? seg.start,
			end: byIdx[idx]?.end ?? seg.end,
			text: (byIdx[idx]?.text ?? seg.text || '').trim()
		}));
	}

	async translate() {
		try {
			this.captureEdits();
			const apiKey = await getApiKey(this.modelKey);
			if (!apiKey) {
				alert('번역을 위해 OpenAI/GPT API 키가 필요합니다. 설정에서 키를 입력해주세요.');
				return;
			}
			const prompt = `다음 자막 세그먼트를 타임스탬프는 유지하고 텍스트만 ${this.targetLanguage}로 자연스럽게 번역하세요. 출력은 JSON 배열로 주고, 각 객체는 {start,end,text} (초 단위, 정수) 형태로 주세요.\n\n` +
				this.currentSegments.map(s => `${Math.round(s.start)}\t${Math.round(s.end)}\t${(s.text||'').trim()}`).join('\n');
			const system = '당신은 전문 영상 자막 번역가입니다. 불필요한 의성어/군더더기를 제거하고 의미를 명확하게 전달하세요.';
			const result = await callAI(this.modelKey, this.subModel, system, prompt);
			let parsed;
			try { parsed = JSON.parse(result); } catch { parsed = null; }
			if (!Array.isArray(parsed)) {
				alert('번역 결과 파싱에 실패했습니다. 다시 시도해주세요.');
				return;
			}
			// sanitize
			this.currentSegments = parsed.map(o => ({
				start: Math.max(0, Number(o.start)||0),
				end: Math.max(0, Number(o.end)||0),
				text: String(o.text||'').trim()
			}));
			this.renderSegments();
			this.renderRaw();
		} catch (e) {
			console.error(e);
			alert('번역 중 오류가 발생했습니다: ' + (e.message||e));
		}
	}

	applyToState() {
		this.captureEdits();
		// 간단 검증: end >= start, 공백 제거
		this.currentSegments = this.currentSegments.map(s => ({
			start: Math.max(0, Math.round(Number(s.start)||0)),
			end: Math.max(Math.round(Number(s.start)||0), Math.round(Number(s.end)||0)),
			text: String(s.text||'').trim()
		}));
		state.subtitles = [...this.currentSegments];
		// 화면에도 즉시 반영: 기존 렌더 함수가 있으면 호출
		if (window.addSubtitleEntryWithTimestamp) {
			const container = document.getElementById('subtitleResultsContainer');
			if (container) container.innerHTML = '';
			window.addSubtitleEntryWithTimestamp(state.subtitles, '수정된 자막');
		}
		this.close();
	}

	download(format) {
		this.captureEdits();
		const content = this.generateContent(format, this.currentSegments);
		const mime = format === 'txt' ? 'text/plain' : (format === 'vtt' ? 'text/vtt' : 'text/srt');
		const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `subtitle.${format}`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	generateContent(format, segments) {
		const toSrt = (sec) => {
			const ms = Math.floor((sec - Math.floor(sec)) * 1000);
			const s = Math.floor(sec);
			const hh = String(Math.floor(s / 3600)).padStart(2, '0');
			const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
			const ss = String(s % 60).padStart(2, '0');
			return `${hh}:${mm}:${ss},${String(ms).padStart(3, '0')}`;
		};
		const toVtt = (sec) => {
			const s = Math.floor(sec);
			const ms = String(Math.floor((sec - Math.floor(sec)) * 1000)).padStart(3, '0');
			const hh = String(Math.floor(s / 3600)).padStart(2, '0');
			const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
			const ss = String(s % 60).padStart(2, '0');
			return `${hh}:${mm}:${ss}.${ms}`;
		};
		if (format === 'txt') {
			return segments.map(s => `[${this.formatMMSS(s.start)} - ${this.formatMMSS(s.end)}] ${s.text}` ).join('\n');
		} else if (format === 'vtt') {
			let out = 'WEBVTT\n\n';
			segments.forEach(s => {
				out += `${toVtt(s.start)} --> ${toVtt(s.end)}\n${s.text}\n\n`;
			});
			return out;
		} else { // srt
			let out = '';
			segments.forEach((s, i) => {
				out += `${i+1}\n${toSrt(s.start)} --> ${toSrt(s.end)}\n${s.text}\n\n`;
			});
			return out;
		}
	}

	parseHHMMSS(str) {
		if (!str) return 0;
		const parts = str.split(':').map(n => parseInt(n, 10) || 0);
		while (parts.length < 3) parts.unshift(0);
		const [hh, mm, ss] = parts;
		return hh*3600 + mm*60 + ss;
	}

	formatMMSS(sec) {
		const s = Math.max(0, Math.floor(Number(sec)||0));
		const mm = String(Math.floor(s/60)).padStart(2, '0');
		const ss = String(s%60).padStart(2, '0');
		return `${mm}:${ss}`;
	}
}

const subtitleEditorModal = new SubtitleEditorModal();
subtitleEditorModal.init();

// 수동 버튼 연결 (우측 결과 영역의 편집 버튼)
document.addEventListener('DOMContentLoaded', () => {
	const openBtn = document.getElementById('openSubtitleEditorBtn');
	if (openBtn) openBtn.addEventListener('click', () => subtitleEditorModal.open());
});

// 전역 노출
window.subtitleEditorModal = subtitleEditorModal;

export default subtitleEditorModal;


