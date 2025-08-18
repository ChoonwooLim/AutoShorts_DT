// --- Main Application Entry Point for Web ---

// Core modules
import { initializeApiManagement } from './api.js';
import { state } from './state.js';
import { googleConfig } from './config.js';
import lazyLoader from './utils/lazy-loader.js';

// Feature modules
import { setupFileEventListeners } from './ui/ui-file.js';
import { applyInitialTheme, setupThemeEventListeners } from './ui/ui-theme.js';
import { initializeSettingsUI, setupSettingsEventListeners } from './ui/ui-settings.js';
import { setupChatEventListeners } from './ui/ui-chat.js';

// Expose state globally for easier debugging
window.state = state;

// Global function for lazy loading file-related modules
window.loadFileModules = async function() {
    if (window.loadFileModules.loaded) return true;
    try {
        const { setupProcessingEventListeners, updateProcessButtonState } = await lazyLoader.loadModule('ui-processing', () => import('./ui/ui-processing.js'));
        await setupProcessingEventListeners();
        updateProcessButtonState();
        window.loadFileModules.loaded = true;
        console.log('📦 File processing modules loaded.');
        return true;
    } catch (error) {
        console.error('❌ Failed to load file processing modules:', error);
        return false;
    }
};

/**
 * Initializes the web application.
 */
async function main() {
    console.log('🚀 AutoShorts Web Initializing...');
    
    try {
        // 1. Apply theme and set up theme toggling immediately
        applyInitialTheme();
        setupThemeEventListeners();
        console.log('🎨 Theme system initialized.');

        // 2. Set up file handling events
        setupFileEventListeners();
        console.log('📁 File upload system initialized.');

        // 3. Initialize API keys and services
        await initializeApiManagement();
        console.log('🔑 API keys loaded.');
        
        // 4. Initialize settings UI and event listeners
        initializeSettingsUI();
        setupSettingsEventListeners();
        console.log('⚙️ Settings UI initialized.');

        // 5. Setup chat event listeners
        setupChatEventListeners();
        console.log('💬 Chat system initialized.');

        // 6. Initialize transcription system
        await initializeTranscriptionSystem();
        console.log('🎙️ Transcription system initialized.');

        // 7. Initialize face analysis system
        await initializeFaceAnalysisSystem();
        console.log('🎭 Face analysis system initialized.');

        // 8. Preload non-critical modules in the background
        setupBackgroundPreloading();
        
        console.log('✅ AutoShorts Web successfully initialized.');
        
    } catch (error) {
        console.error('❌ Application initialization failed:', error);
        alert(`Failed to initialize the application.\n\nError: ${error.message}\nPlease refresh the page.`);
    }
}

/**
 * Initialize transcription system
 */
async function initializeTranscriptionSystem() {
    try {
        // Load transcription module and initialize
        const transcriptionModule = await lazyLoader.loadModule('simple-transcription', () => import('./modules/simple-transcription.js'));
        
        // Initialize transcription if available
        if (transcriptionModule && transcriptionModule.initializeTranscription) {
            await transcriptionModule.initializeTranscription();
            console.log('✅ Transcription module loaded and initialized');
        } else {
            console.warn('⚠️ Transcription module initialization function not found');
        }
        
        // Load audio extraction module
        const audioModule = await lazyLoader.loadModule('audio-extraction', () => import('./modules/audio-extraction.js'));
        if (audioModule && audioModule.initializeAudioExtraction) {
            await audioModule.initializeAudioExtraction();
            console.log('✅ Audio extraction module loaded and initialized');
        }
        
    } catch (error) {
        console.error('❌ Failed to initialize transcription system:', error);
    }
}

/**
 * Initialize face analysis system
 */
async function initializeFaceAnalysisSystem() {
    try {
        // Load face analysis module and initialize
        const faceAnalysisModule = await lazyLoader.loadModule('face-analysis', () => import('./modules/face-analysis.js'));
        
        // Initialize face analysis if available
        if (faceAnalysisModule && faceAnalysisModule.initializeFaceAnalysis) {
            await faceAnalysisModule.initializeFaceAnalysis();
            console.log('✅ Face analysis module loaded and initialized');
        } else {
            console.warn('⚠️ Face analysis module initialization function not found');
        }
        
        // Load face analyzer new module
        const faceAnalyzerModule = await lazyLoader.loadModule('face-analyzer-new', () => import('./modules/face-analyzer-new.js'));
        if (faceAnalyzerModule && faceAnalyzerModule.initializeFaceAnalyzer) {
            await faceAnalyzerModule.initializeFaceAnalyzer();
            console.log('✅ Face analyzer V2 module loaded and initialized');
        }
        
    } catch (error) {
        console.error('❌ Failed to initialize face analysis system:', error);
    }
}

/**
 * Preloads non-critical modules in the background to improve performance.
 */
function setupBackgroundPreloading() {
    lazyLoader.addToPreloadQueue('ui-processing', () => import('./ui/ui-processing.js'));
    lazyLoader.addToPreloadQueue('simple-transcription', () => import('./modules/simple-transcription.js'));
    lazyLoader.addToPreloadQueue('shorts-processing', () => import('./modules/shorts-processing-real.js'));
    lazyLoader.addToPreloadQueue('face-analyzer-new', () => import('./modules/face-analyzer-new.js'));

    setTimeout(() => {
        lazyLoader.startPreloading();
    }, 1500); // Start preloading after a short delay
}

// --- Google Auth Initialization ---
window.handleGapiLoaded = async () => {
  try {
    const api = await lazyLoader.loadModule('api', () => import('./api.js'));
    gapi.load('client', api.initializeGapiClient);
  } catch (error) {
    console.error('Google API initialization failed:', error);
  }
};

window.handleGisLoaded = async () => {
  try {
    const clientId = googleConfig.getClientId();
    console.log(`🔐 Initializing Google Auth with client ID from: ${googleConfig.getCurrentIdInfo().source}`);
    const api = await lazyLoader.loadModule('api', () => import('./api.js'));
    api.initializeGis(clientId);
  } catch (error) {
    console.error('Google Identity Services initialization failed:', error);
  }
};


// Run the main initialization function when the DOM is ready.
document.addEventListener('DOMContentLoaded', main);
