import { themeToggle } from './dom-elements.js';

/**
 * Applies the saved theme (dark/light) when the page loads.
 */
export function applyInitialTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const isDarkMode = savedTheme === 'dark';
    document.body.classList.toggle('dark-mode', isDarkMode);
    if (themeToggle) {
        themeToggle.textContent = isDarkMode ? '☀️' : '🌙';
    }
}

/**
 * Updates the theme and saves the preference to localStorage.
 * @param {boolean} isDarkMode - Whether dark mode should be enabled.
 */
export function updateTheme(isDarkMode) {
    document.body.classList.toggle('dark-mode', isDarkMode);
    if (themeToggle) {
        themeToggle.textContent = isDarkMode ? '☀️' : '🌙';
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

/**
 * Sets up the event listener for the theme toggle button.
 */
export function setupThemeEventListeners() {
    // 기존 버튼 이벤트 리스너 (헤더 제거 예정)
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDarkMode = document.body.classList.toggle('dark-mode');
            updateTheme(isDarkMode);
        });
    }
    
    // Electron 메뉴에서 테마 전환 이벤트 수신
    if (window.themeAPI && window.themeAPI.onToggleTheme) {
        window.themeAPI.onToggleTheme(() => {
            const isDarkMode = !document.body.classList.contains('dark-mode');
            updateTheme(isDarkMode);
        });
    }
} 