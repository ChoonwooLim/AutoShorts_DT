import { state } from './state.js';
import { promptCategories } from './prompts.js';
import { setMemoryLimit, getMemoryLimit, clearAllCache } from './memory-manager.js';

/**
 * 옵션 모달 관리 시스템
 * 5개 카테고리별 버튼과 모달을 관리합니다.
 */

// 옵션 데이터 관리
const optionData = {
    video: {
        autoHighlight: true,
        highlightCount: 3,
        selectedPrompts: [],
        aspectRatioAdjust: true,
        cropType: 'auto',
        manualCropFormat: '9:16',
        manualCropWidth: 1080,
        manualCropHeight: 1920,
        colorCorrection: true,
        videoStabilization: false,
        brightness: 0,
        contrast: 0,
        saturation: 0
    },
    audio: {
        removeSilence: true,
        enhanceAudio: true,
        noiseReduction: true
    },
    features: {
        addTitle: false,
        addSubtitles: false,
        addEffects: false
    },
    face: {
        faceAnalysisEnable: true,
        faceTracking: false,
        expressionAnalysis: false,
        multiplePersons: false
    },
    shorts: {
        shortsLength: 60,
        shortsCount: 1
    }
};

/**
 * 모달 관리 클래스
 */
class OptionsModalManager {
    constructor() {
        this.initializeEventListeners();
        this.updateAllCounters();
        // this.syncWithHiddenInputs(); // 오류를 유발하는 불필요한 함수 호출 삭제
    }

    /**
     * 이벤트 리스너 초기화
     */
    initializeEventListeners() {
        // 옵션 버튼 클릭 이벤트
        document.querySelectorAll('.option-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;
                this.openModal(category);
            });
        });

        // 모달 닫기 이벤트
        document.querySelectorAll('.modal-close, .modal-btn.secondary').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.option-modal');
                if (modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // 모달 배경 클릭으로 닫기
        document.querySelectorAll('.option-modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
        
        // 모달 콘텐츠 클릭 시 이벤트 전파 중단 (창 크기 조절 시 닫힘 방지)
        document.querySelectorAll('.modal-content').forEach(content => {
            content.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
        });

        // 파일명 형식 변경 이벤트 (이 부분은 setupModalEventListeners로 이동 가능)
        const fileNamingSelect = document.getElementById('modal-fileNaming');
        if (fileNamingSelect) {
            fileNamingSelect.addEventListener('change', (e) => {
                const customContainer = document.getElementById('modal-customNameContainer');
                if (customContainer) {
                    customContainer.style.display = e.target.value === 'custom' ? 'block' : 'none';
                }
            });
        }

        // 영상 분할 옵션 UI 이벤트
        const videoSplitCheckbox = document.getElementById('modal-videoSplit');
        const splitDurationSetting = document.getElementById('splitDurationSetting');
        const startVideoSplitBtn = document.getElementById('startVideoSplitBtn');

        if (videoSplitCheckbox && splitDurationSetting) {
            videoSplitCheckbox.addEventListener('change', (e) => {
                splitDurationSetting.style.display = e.target.checked ? 'block' : 'none';
            });
        }

        if (startVideoSplitBtn) {
            startVideoSplitBtn.addEventListener('click', async () => {
                const splitDurationInput = document.getElementById('modal-splitDuration');
                
                // 체크박스 확인 로직 삭제
                const splitDuration = parseInt(splitDurationInput.value, 10);
                if (isNaN(splitDuration) || splitDuration <= 0) {
                    alert('유효한 분할 시간(분)을 입력해주세요.');
                    return;
                }
                
                try {
                    const { splitVideo } = await import('./video-splitter.js');
                    this.closeModal('videoProcessingModal');
                    await splitVideo(splitDuration);
                    
                } catch (error) {
                    console.error('❌ 영상 분할 모듈 로드 또는 실행 실패:', error);
                    alert('영상 분할 기능을 실행하는 데 실패했습니다.');
                }
            });
        }

        // 폴더 선택 버튼 (웹 표준 API 사용)
        const folderBtn = document.getElementById('modal-selectFolderBtn');
        if (folderBtn) {
            folderBtn.addEventListener('click', async () => {
                try {
                    const handle = await window.showDirectoryPicker();
                    state.outputFolderHandle = handle;
                    document.getElementById('modal-outputFolder').value = handle.name;
                    console.log(`📁 저장 폴더 선택됨: ${handle.name}`);
                    this.closeModal('storageManagementModal'); // 클래스 메서드 호출
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('폴더 선택 오류:', err);
                        alert('폴더를 선택하는 데 실패했습니다. 브라우저 권한을 확인해주세요.');
                    } else {
                        console.log('사용자가 폴더 선택을 취소했습니다.');
                    }
                }
            });
        }

        // 색상 보정 체크박스 이벤트
        const colorCorrectionCheckbox = document.getElementById('modal-colorCorrection');
        if (colorCorrectionCheckbox) {
            colorCorrectionCheckbox.addEventListener('change', (e) => {
                document.getElementById('manualColorSettingsContainer').style.display = e.target.checked ? 'block' : 'none';
            });
        }

        // 색상 조절 슬라이더 이벤트
        ['brightness', 'contrast', 'saturation'].forEach(type => {
            const slider = document.getElementById(`modal-${type}`);
            const valueSpan = document.getElementById(`${type}-value`);
            if (slider && valueSpan) {
                slider.addEventListener('input', (e) => {
                    valueSpan.textContent = e.target.value;
                });
            }
        });

        // 영상 비율 조정 관련 이벤트
        const aspectRatioCheckbox = document.getElementById('modal-aspectRatioAdjust');
        if (aspectRatioCheckbox) {
            aspectRatioCheckbox.addEventListener('change', (e) => {
                document.getElementById('cropOptionsContainer').style.display = e.target.checked ? 'block' : 'none';
            });
        }

        document.querySelectorAll('input[name="crop-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isManual = e.target.value === 'manual';
                document.getElementById('manualCropFormatContainer').style.display = isManual ? 'block' : 'none';
            });
        });

        // 수동 크롭 포맷 선택 이벤트
        const manualCropFormatSelect = document.getElementById('manualCropFormatSelect');
        if (manualCropFormatSelect) {
            manualCropFormatSelect.addEventListener('change', (e) => {
                const isCustom = e.target.value === 'custom';
                document.getElementById('customCropSizeContainer').style.display = isCustom ? 'block' : 'none';
            });
        }

        // 프롬프트 선택 모달 열기 버튼
        const openPromptBtn = document.getElementById('openPromptModalBtn');
        if (openPromptBtn) {
            openPromptBtn.addEventListener('click', () => {
                this.openPromptSelectionModal();
            });
        }

        // 프롬프트 모달 내 이벤트 위임
        const promptContainer = document.getElementById('promptListContainer');
        if (promptContainer) {
            promptContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('prompt-item')) {
                    this.togglePromptSelection(e.target);
                }
            });
        }
        
        // 프롬프트 검색 이벤트
        const promptSearchInput = document.getElementById('promptSearchInput');
        if(promptSearchInput) {
            promptSearchInput.addEventListener('input', (e) => this.filterPrompts(e.target.value));
        }

        // 프롬프트 선택 완료 버튼
        const confirmPromptBtn = document.getElementById('confirmPromptSelectionBtn');
        if(confirmPromptBtn) {
            confirmPromptBtn.addEventListener('click', () => this.confirmPromptSelection());
        }

        // 만들 영상 개수 변경 시
        const highlightCountInput = document.getElementById('highlight-count');
        if(highlightCountInput) {
            highlightCountInput.addEventListener('change', (e) => this.updatePromptMaxCount(e.target.value));
        }

        // 성능 및 캐시 모달 관련 이벤트
        const memorySlider = document.getElementById('memoryLimitSlider');
        const memoryValue = document.getElementById('memoryLimitValue');
        if (memorySlider && memoryValue) {
            memorySlider.addEventListener('input', (e) => {
                memoryValue.textContent = `${e.target.value} MB`;
            });
        }

        const clearCacheBtn = document.getElementById('clearCacheBtn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', clearAllCache);
        }
        
        // 성능 모달 적용 버튼 이벤트 리스너
        const applyPerformanceBtn = document.querySelector('#performanceCacheModal .modal-btn.primary');
        if (applyPerformanceBtn) {
            applyPerformanceBtn.addEventListener('click', applyPerformanceCacheOptions);
        }
    }

    /**
     * 모달 열기
     */
    openModal(category) {
        const modalId = this.getCategoryModalId(category);
        const modal = document.getElementById(modalId);
        
        if (modal) {
            // 프롬프트 모달은 자체적으로 내용을 채우므로, 일반 데이터 동기화 로직을 건너뛴다.
            if (category === 'prompt') {
                // 아무것도 하지 않음
            } else if (category === 'storage') {
                // 저장 관리 모달일 경우 state에서 직접 값을 가져와 UI에 반영
                const { outputFolderHandle, storageSettings } = state;
                document.getElementById('modal-outputFolder').value = outputFolderHandle?.name || '';
                document.getElementById('modal-autoSave').checked = storageSettings.autoSave;
                document.getElementById('modal-fileNaming').value = storageSettings.fileNaming;
                document.getElementById('modal-customName').value = storageSettings.customName;
                document.getElementById('modal-customNameContainer').style.display = 
                    storageSettings.fileNaming === 'custom' ? 'block' : 'none';
            } else if (category === 'performance') {
                const currentLimit = getMemoryLimit();
                document.getElementById('memoryLimitSlider').value = currentLimit;
                document.getElementById('memoryLimitValue').textContent = `${currentLimit} MB`;
            } else {
                // 다른 모달은 기존 방식대로 데이터 동기화
                this.syncModalWithData(category);
            }

            modal.style.display = 'block';
            setTimeout(() => { modal.style.opacity = '1'; }, 10);
        }
    }

    /**
     * 모달 닫기
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * 카테고리별 모달 ID 반환
     */
    getCategoryModalId(category) {
        const modalIds = {
            video: 'videoProcessingModal',
            audio: 'audioProcessingModal',
            features: 'additionalFeaturesModal',
            face: 'faceAnalysisModal',
            shorts: 'shortsSettingsModal',
            storage: 'storageManagementModal',
            performance: 'performanceCacheModal', // 추가
            prompt: 'promptSelectionModal' // 프롬프트 모달 ID 추가
        };
        return modalIds[category];
    }

    /**
     * 데이터를 모달에 동기화
     */
    syncModalWithData(category) {
        const data = optionData[category];
        
        if (category === 'video') {
            document.getElementById('modal-autoHighlight').checked = data.autoHighlight;
            
            // 영상 비율 조정 UI 동기화
            const aspectRatioChecked = data.aspectRatioAdjust;
            document.getElementById('modal-aspectRatioAdjust').checked = aspectRatioChecked;
            document.getElementById('cropOptionsContainer').style.display = aspectRatioChecked ? 'block' : 'none';
            
            document.getElementById(`crop-${data.cropType}`).checked = true;
            document.getElementById('manualCropFormatContainer').style.display = data.cropType === 'manual' ? 'block' : 'none';
            
            const cropFormat = data.manualCropFormat;
            document.getElementById('manualCropFormatSelect').value = cropFormat;
            document.getElementById('customCropSizeContainer').style.display = cropFormat === 'custom' ? 'block' : 'none';
            document.getElementById('manualCropWidth').value = data.manualCropWidth;
            document.getElementById('manualCropHeight').value = data.manualCropHeight;

            // 색상 보정 UI 동기화
            document.getElementById('modal-colorCorrection').checked = data.colorCorrection;
            
            // 수동 조절 UI 동기화
            document.getElementById('manualColorSettingsContainer').style.display = data.colorCorrection ? 'block' : 'none';
            ['brightness', 'contrast', 'saturation'].forEach(type => {
                const slider = document.getElementById(`modal-${type}`);
                const valueSpan = document.getElementById(`${type}-value`);
                if(slider && valueSpan) {
                    slider.value = data[type];
                    valueSpan.textContent = data[type];
                }
            });

            document.getElementById('modal-videoStabilization').checked = data.videoStabilization;
            document.getElementById('highlight-count').value = data.highlightCount;
            this.updateSelectedPromptsDisplay();
        } else if (category === 'audio') {
            document.getElementById('modal-removeSilence').checked = data.removeSilence;
            document.getElementById('modal-enhanceAudio').checked = data.enhanceAudio;
            document.getElementById('modal-noiseReduction').checked = data.noiseReduction;
        } else if (category === 'features') {
            document.getElementById('modal-addTitle').checked = data.addTitle;
            document.getElementById('modal-addSubtitles').checked = data.addSubtitles;
            document.getElementById('modal-addEffects').checked = data.addEffects;
        } else if (category === 'face') {
            document.getElementById('modal-faceAnalysisEnable').checked = data.faceAnalysisEnable;
            document.getElementById('modal-faceTracking').checked = data.faceTracking;
            document.getElementById('modal-expressionAnalysis').checked = data.expressionAnalysis;
            document.getElementById('modal-multiplePersons').checked = data.multiplePersons;
        } else if (category === 'shorts') {
            document.getElementById('modal-shortsLength').value = data.shortsLength;
            document.getElementById('modal-shortsCountNum').value = data.shortsCount;
        } else if (category === 'storage') {
            document.getElementById('modal-outputFolder').value = data.outputFolder;
            document.getElementById('modal-autoSave').checked = data.autoSave;
            document.getElementById('modal-fileNaming').value = data.fileNaming;
            document.getElementById('modal-customName').value = data.customName;
            
            // 커스텀 이름 컨테이너 표시/숨김
            const customContainer = document.getElementById('modal-customNameContainer');
            if (customContainer) {
                customContainer.style.display = data.fileNaming === 'custom' ? 'block' : 'none';
            }
        }
    }

    /**
     * 모달에서 데이터로 동기화
     */
    syncDataWithModal(category) {
        const data = optionData[category];
        
        if (category === 'video') {
            data.autoHighlight = document.getElementById('modal-autoHighlight').checked;
            
            // 영상 비율 조정 값 저장
            data.aspectRatioAdjust = document.getElementById('modal-aspectRatioAdjust').checked;
            data.cropType = document.querySelector('input[name="crop-type"]:checked').value;
            data.manualCropFormat = document.getElementById('manualCropFormatSelect').value;
            data.manualCropWidth = parseInt(document.getElementById('manualCropWidth').value, 10) || 1080;
            data.manualCropHeight = parseInt(document.getElementById('manualCropHeight').value, 10) || 1920;
            
            // 색상 보정 값 저장
            data.colorCorrection = document.getElementById('modal-colorCorrection').checked;
            data.brightness = parseInt(document.getElementById('modal-brightness').value, 10);
            data.contrast = parseInt(document.getElementById('modal-contrast').value, 10);
            data.saturation = parseInt(document.getElementById('modal-saturation').value, 10);
            
            data.videoStabilization = document.getElementById('modal-videoStabilization').checked;
            data.highlightCount = parseInt(document.getElementById('highlight-count').value, 10);
            // selectedPrompts는 confirmPromptSelection에서 이미 저장됨
        } else if (category === 'audio') {
            data.removeSilence = document.getElementById('modal-removeSilence').checked;
            data.enhanceAudio = document.getElementById('modal-enhanceAudio').checked;
            data.noiseReduction = document.getElementById('modal-noiseReduction').checked;
        } else if (category === 'features') {
            data.addTitle = document.getElementById('modal-addTitle').checked;
            data.addSubtitles = document.getElementById('modal-addSubtitles').checked;
            data.addEffects = document.getElementById('modal-addEffects').checked;
        } else if (category === 'face') {
            data.faceAnalysisEnable = document.getElementById('modal-faceAnalysisEnable').checked;
            data.faceTracking = document.getElementById('modal-faceTracking').checked;
            data.expressionAnalysis = document.getElementById('modal-expressionAnalysis').checked;
            data.multiplePersons = document.getElementById('modal-multiplePersons').checked;
        } else if (category === 'shorts') {
            data.shortsLength = parseInt(document.getElementById('modal-shortsLength').value);
            data.shortsCount = parseInt(document.getElementById('modal-shortsCountNum').value);
        } else if (category === 'storage') {
            data.outputFolder = document.getElementById('modal-outputFolder').value;
            data.autoSave = document.getElementById('modal-autoSave').checked;
            data.fileNaming = document.getElementById('modal-fileNaming').value;
            data.customName = document.getElementById('modal-customName').value;
        }
    }

    /**
     * 숨겨진 입력 요소와 동기화
     */
    // syncWithHiddenInputs() { ... }

    /**
     * 카운터 업데이트
     */
    updateCounter(category) {
        const data = optionData[category];
        let count = '';

        if (category === 'video') {
            const checkedCount = Object.values(data).filter(v => v).length;
            count = `${checkedCount}개 선택됨`;
        } else if (category === 'audio') {
            const checkedCount = Object.values(data).filter(v => v).length;
            count = `${checkedCount}개 선택됨`;
        } else if (category === 'features') {
            const checkedCount = Object.values(data).filter(v => v).length;
            count = `${checkedCount}개 선택됨`;
        } else if (category === 'face') {
            const checkedCount = Object.values(data).filter(v => v).length;
            if (checkedCount > 0) {
                count = '활성화됨';
            } else {
                count = '비활성화';
            }
        } else if (category === 'shorts') {
            count = `${data.shortsLength}초, ${data.shortsCount}개`;
        } else if (category === 'storage') {
            // optionData.storage 대신 중앙 state를 사용하도록 수정
            if (state.outputFolderHandle) {
                count = '설정 완료';
            } else {
                count = '설정 필요';
            }
        }

        // 카운터 업데이트 - ID 매핑 수정
        const counterIdMap = {
            video: 'videoCount',
            audio: 'audioCount', 
            features: 'featuresCount',
            face: 'faceCount',
            shorts: 'shortsCount',
            storage: 'storageCount'
        };
        
        const counterId = counterIdMap[category];
        const counterElement = document.getElementById(counterId);
        if (counterElement) {
            counterElement.textContent = count;
        }
    }

    /**
     * 모든 카운터 업데이트
     */
    updateAllCounters() {
        ['video', 'audio', 'features', 'face', 'shorts', 'storage'].forEach(category => {
            this.updateCounter(category);
        });
    }

    /**
     * 옵션 적용 (카테고리별)
     */
    applyOptions(category) {
        if (category === 'storage') {
            // UI 요소에서 새로운 설정값 읽어와 state에 저장
            state.storageSettings.autoSave = document.getElementById('modal-autoSave').checked;
            state.storageSettings.fileNaming = document.getElementById('modal-fileNaming').value;
            state.storageSettings.customName = document.getElementById('modal-customName').value;
            console.log('💾 저장 관리 설정 적용됨:', state.storageSettings);
            alert('저장 설정이 적용되었습니다.');
        } else {
            // 다른 카테고리는 기존 방식대로 데이터 동기화
            this.syncDataWithModal(category);
            this.syncWithHiddenInputs();
        }
        
        this.updateCounter(category);
        
        // 얼굴분석 특별 처리 - 갤러리 컨테이너 표시/숨김
        if (category === 'face') {
            const faceGalleryContainer = document.getElementById('faceGalleryContainer');
            if (faceGalleryContainer) {
                if (optionData.face.faceAnalysisEnable) {
                    faceGalleryContainer.style.display = 'block';
                    console.log('🎭 얼굴 분석 갤러리가 활성화되었습니다.');
                } else {
                    faceGalleryContainer.style.display = 'none';
                    console.log('🎭 얼굴 분석 갤러리가 비활성화되었습니다.');
                }
            }
        }
        
        const modalId = this.getCategoryModalId(category);
        this.closeModal(modalId);
        
        if (category !== 'storage') {
            console.log(`✅ ${category} 옵션이 적용되었습니다:`, optionData[category]);
        }
    }

    openPromptSelectionModal() {
        this.populatePromptList();
        this.updatePromptMaxCount(document.getElementById('highlight-count').value);
        this.openModal('prompt'); // 'promptSelectionModal' (ID) 대싱 'prompt' (카테고리) 전달
    }

    populatePromptList() {
        const container = document.getElementById('promptListContainer');
        container.innerHTML = ''; // 기존 목록 초기화

        for (const [category, prompts] of Object.entries(promptCategories)) {
            const categoryEl = document.createElement('div');
            categoryEl.className = 'prompt-category';
            categoryEl.innerHTML = `<h4>${category}</h4>`;

            const promptGrid = document.createElement('div');
            promptGrid.className = 'prompt-grid';

            prompts.forEach(prompt => {
                const promptEl = document.createElement('div');
                promptEl.className = 'prompt-item';
                promptEl.textContent = prompt;
                promptEl.dataset.prompt = prompt;
                promptGrid.appendChild(promptEl);
            });

            categoryEl.appendChild(promptGrid);
            container.appendChild(categoryEl);
        }
    }

    togglePromptSelection(element) {
        const maxCount = parseInt(document.getElementById('highlight-count').value, 10);
        const selectedCount = document.querySelectorAll('.prompt-item.selected').length;

        if (!element.classList.contains('selected') && selectedCount >= maxCount) {
            alert(`최대 ${maxCount}개까지 선택할 수 있습니다.`);
            return;
        }
        element.classList.toggle('selected');
        this.updatePromptSelectionCount();
    }
    
    updatePromptSelectionCount() {
        const selectedCount = document.querySelectorAll('.prompt-item.selected').length;
        document.getElementById('promptSelectionCount').textContent = selectedCount;
    }

    updatePromptMaxCount(count) {
        document.getElementById('promptMaxCount').textContent = count;
        // 선택 개수가 최대 개수를 초과하면 초과된 만큼 선택 해제
        const selectedItems = document.querySelectorAll('.prompt-item.selected');
        if (selectedItems.length > count) {
            for (let i = count; i < selectedItems.length; i++) {
                selectedItems[i].classList.remove('selected');
            }
        }
        this.updatePromptSelectionCount();
    }

    filterPrompts(searchTerm) {
        const lowerCaseTerm = searchTerm.toLowerCase();
        document.querySelectorAll('.prompt-item').forEach(item => {
            const isVisible = item.textContent.toLowerCase().includes(lowerCaseTerm);
            item.style.display = isVisible ? '' : 'none';
        });
    }

    confirmPromptSelection() {
        const selectedElements = document.querySelectorAll('.prompt-item.selected');
        const selectedPrompts = Array.from(selectedElements).map(el => el.dataset.prompt);
        
        optionData.video.selectedPrompts = selectedPrompts;
        
        this.updateSelectedPromptsDisplay();
        this.closeModal('promptSelectionModal');
    }

    updateSelectedPromptsDisplay() {
        const container = document.getElementById('selected-prompts-list');
        container.innerHTML = '';
        optionData.video.selectedPrompts.forEach(prompt => {
            const tag = document.createElement('span');
            tag.className = 'prompt-tag';
            tag.textContent = prompt;
            container.appendChild(tag);
        });
    }
}

// 전역 적용 함수들 (HTML의 onclick에서 호출)
function applyVideoProcessingOptions() {
    if (window.optionsModalManager) {
        window.optionsModalManager.applyOptions('video');
    }
}

function applyAudioProcessingOptions() {
    if (window.optionsModalManager) {
        window.optionsModalManager.applyOptions('audio');
    }
}

function applyAdditionalFeaturesOptions() {
    if (window.optionsModalManager) {
        window.optionsModalManager.applyOptions('features');
    }
}

function applyFaceAnalysisOptions() {
    if (window.optionsModalManager) {
        window.optionsModalManager.applyOptions('face');
    }
}

function applyShortsSettingsOptions() {
    if (window.optionsModalManager) {
        window.optionsModalManager.applyOptions('shorts');
    }
}

function applyStorageManagementOptions() {
    if (window.optionsModalManager) {
        window.optionsModalManager.applyOptions('storage');
    }
}

function applyPerformanceCacheOptions() {
    const memoryLimit = document.getElementById('memoryLimitSlider').value;
    setMemoryLimit(memoryLimit);
    alert(`최대 메모리 사용량이 ${memoryLimit}MB로 설정되었습니다.`);
    if (window.optionsModalManager) {
        window.optionsModalManager.closeModal('performanceCacheModal');
    }
}

// 전역 함수로 노출
window.applyVideoProcessingOptions = applyVideoProcessingOptions;
window.applyAudioProcessingOptions = applyAudioProcessingOptions;
window.applyAdditionalFeaturesOptions = applyAdditionalFeaturesOptions;
window.applyFaceAnalysisOptions = applyFaceAnalysisOptions;
window.applyShortsSettingsOptions = applyShortsSettingsOptions;
window.applyStorageManagementOptions = applyStorageManagementOptions;
window.applyPerformanceCacheOptions = applyPerformanceCacheOptions;

// 옵션 데이터 접근을 위한 전역 함수
function getOptionData() {
    return optionData;
}

function getCurrentOptions() {
    return {
        // 영상 처리 옵션 - 기존 호환성 유지
        videoProcessing: {
            autoHighlight: optionData.video.autoHighlight,
            autoCrop: optionData.video.autoCrop,
            colorCorrection: optionData.video.colorCorrection,
            videoStabilization: optionData.video.videoStabilization
        },
        // 오디오 처리 옵션
        audioProcessing: {
            removeSilence: optionData.audio.removeSilence,
            enhanceAudio: optionData.audio.enhanceAudio,
            noiseReduction: optionData.audio.noiseReduction
        },
        // 추가 기능
        features: {
            addTitle: optionData.features.addTitle,
            addSubtitles: optionData.features.addSubtitles,
            addEffects: optionData.features.addEffects
        },
        // 배우얼굴분석
        faceAnalysis: {
            faceAnalysisEnable: optionData.face.faceAnalysisEnable,
            faceTracking: optionData.face.faceTracking,
            expressionAnalysis: optionData.face.expressionAnalysis,
            multiplePersons: optionData.face.multiplePersons
        },
        // 숏츠 설정
        settings: {
            shortsLength: optionData.shorts.shortsLength,
            shortsCount: optionData.shorts.shortsCount
        },
        // 저장 관리 설정
        storage: {
            outputFolder: optionData.storage.outputFolder,
            autoSave: optionData.storage.autoSave,
            fileNaming: optionData.storage.fileNaming,
            customName: optionData.storage.customName
        }
    };
}

// 초기화
let optionsModalManager;

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    optionsModalManager = new OptionsModalManager();
    // 전역으로 노출
    window.optionsModalManager = optionsModalManager;
    window.getOptionData = getOptionData;
    window.getCurrentOptions = getCurrentOptions;
    console.log('🎛️ 옵션 모달 관리자 초기화 완료');
});

// 모듈 내보내기
export { optionsModalManager, getOptionData, getCurrentOptions }; 