/**
 * CLAUDE.md 파일 자동 관리 시스템
 * - 일주일 이상 된 개발 내역 자동 정리
 * - 파일 크기 최적화
 */

const fs = require('fs').promises;
const path = require('path');

class ClaudeMdManager {
    constructor() {
        this.filePath = path.join(process.cwd(), 'CLAUDE.md');
        this.maxDaysToKeep = 7; // 최대 보관 일수
    }

    /**
     * CLAUDE.md 파일 자동 정리
     */
    async cleanupOldEntries() {
        try {
            const content = await fs.readFile(this.filePath, 'utf-8');
            const lines = content.split('\n');
            const today = new Date();
            const oneWeekAgo = new Date(today.getTime() - (this.maxDaysToKeep * 24 * 60 * 60 * 1000));
            
            let updatedLines = [];
            let inDevSection = false;
            let currentSectionDate = null;
            let skipSection = false;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                // 개발 내역 섹션 시작 감지
                if (line.startsWith('## 최근 개발 내역')) {
                    const dateMatch = line.match(/\((\d{4}-\d{2}-\d{2})\)/);
                    if (dateMatch) {
                        currentSectionDate = new Date(dateMatch[1]);
                        // 일주일 이상 된 섹션은 건너뛰기
                        if (currentSectionDate < oneWeekAgo) {
                            skipSection = true;
                            continue;
                        }
                    }
                    inDevSection = true;
                    skipSection = false;
                }
                
                // 다음 주요 섹션 시작 (개발 내역 섹션 종료)
                if (inDevSection && line.startsWith('## ') && !line.startsWith('## 최근 개발 내역')) {
                    inDevSection = false;
                    skipSection = false;
                }
                
                // 스킵하지 않는 라인만 추가
                if (!skipSection) {
                    updatedLines.push(line);
                }
            }
            
            // 업데이트된 내용 저장
            await fs.writeFile(this.filePath, updatedLines.join('\n'), 'utf-8');
            
            return {
                success: true,
                message: `오래된 개발 내역이 정리되었습니다.`
            };
            
        } catch (error) {
            console.error('CLAUDE.md 정리 중 오류:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    /**
     * 새로운 개발 내역 추가
     * @param {string} category - 개발 카테고리
     * @param {string} description - 개발 내용
     */
    async addDevelopmentEntry(category, description) {
        try {
            const content = await fs.readFile(this.filePath, 'utf-8');
            const today = new Date().toISOString().split('T')[0];
            const lines = content.split('\n');
            
            // 오늘 날짜의 섹션이 있는지 확인
            let hasTodaySection = false;
            let sectionIndex = -1;
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(`## 최근 개발 내역 (${today})`)) {
                    hasTodaySection = true;
                    sectionIndex = i;
                    break;
                }
            }
            
            if (!hasTodaySection) {
                // 새로운 날짜 섹션 추가
                const devSectionStart = lines.findIndex(line => line.startsWith('## 향후 작업 계획'));
                if (devSectionStart > -1) {
                    lines.splice(devSectionStart, 0, 
                        `## 최근 개발 내역 (${today})`,
                        '',
                        `### ${category}`,
                        `- ${description}`,
                        ''
                    );
                }
            } else {
                // 기존 섹션에 추가
                let categoryExists = false;
                let categoryIndex = -1;
                
                // 해당 카테고리 찾기
                for (let i = sectionIndex + 1; i < lines.length; i++) {
                    if (lines[i].startsWith('## ')) break; // 다음 섹션
                    if (lines[i] === `### ${category}`) {
                        categoryExists = true;
                        categoryIndex = i;
                        break;
                    }
                }
                
                if (categoryExists) {
                    // 카테고리에 항목 추가
                    lines.splice(categoryIndex + 1, 0, `- ${description}`);
                } else {
                    // 새 카테고리 추가
                    let insertIndex = sectionIndex + 1;
                    while (insertIndex < lines.length && !lines[insertIndex].startsWith('## ')) {
                        insertIndex++;
                    }
                    lines.splice(insertIndex, 0, '', `### ${category}`, `- ${description}`);
                }
            }
            
            // 파일 저장
            await fs.writeFile(this.filePath, lines.join('\n'), 'utf-8');
            
            // 오래된 항목 정리
            await this.cleanupOldEntries();
            
            return {
                success: true,
                message: '개발 내역이 추가되었습니다.'
            };
            
        } catch (error) {
            console.error('개발 내역 추가 중 오류:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    /**
     * 파일 크기 확인 및 경고
     */
    async checkFileSize() {
        try {
            const stats = await fs.stat(this.filePath);
            const fileSizeInKB = stats.size / 1024;
            
            if (fileSizeInKB > 50) { // 50KB 이상이면 경고
                console.warn(`CLAUDE.md 파일 크기가 큽니다 (${fileSizeInKB.toFixed(2)}KB). 정리가 필요할 수 있습니다.`);
                return {
                    needsCleanup: true,
                    sizeKB: fileSizeInKB
                };
            }
            
            return {
                needsCleanup: false,
                sizeKB: fileSizeInKB
            };
            
        } catch (error) {
            console.error('파일 크기 확인 중 오류:', error);
            return {
                needsCleanup: false,
                sizeKB: 0
            };
        }
    }
}

// Electron 환경에서 사용할 수 있도록 export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClaudeMdManager;
}

// 브라우저 환경에서도 사용 가능하도록
if (typeof window !== 'undefined') {
    window.ClaudeMdManager = ClaudeMdManager;
}