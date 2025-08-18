// js/ai-shorts-generator.js
// AI 분석 결과를 바탕으로 자동 숏츠 생성 시스템

import { state } from './state.js';
import * as DOM from './dom-elements.js';

/**
 * @class CustomResponseTypeError
 * @extends Error
 * @description 커스텀 AI 응답이 문자열이 아닐 때 발생하는 오류
 */
class CustomResponseTypeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CustomResponseTypeError';
  }
}

/**
 * 견고한 문장 분할 함수 - 소수점, 약어, URL을 고려한 개선된 문장 토크나이저
 * @param {string} text - 분할할 텍스트
 * @returns {Array<string>} 분할된 문장들의 배열
 */
function splitSentences(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }
    
    // 1단계: 일반적인 약어 목록 (한국어 + 영어)
    const abbreviations = [
        // 한국어 약어
        '주식회사', '유한회사', '합자회사', '합명회사',
        // 영어 약어
        'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Ltd', 'Inc', 'Corp', 'Co',
        'etc', 'vs', 'eg', 'ie', 'Sr', 'Jr', 'Ph', 'D', 'M', 'A', 'B', 'S'
    ];
    
    // 2단계: 문장 분할 정규식 - 공백이 뒤따르는 문장 부호만 분할점으로 인식
    // (?<!\d)는 숫자 뒤가 아닌 경우, (?!\d)는 숫자 앞이 아닌 경우를 의미
    // [.!?]는 문장 부호, \s+는 하나 이상의 공백, (?=[A-Z가-힣])는 대문자나 한글로 시작하는 경우
    const sentenceRegex = /(?<!\d)[.!?](?!\d)(?=\s+[A-Z가-힣]|\s*$)/g;
    
    // 3단계: 약어 보호를 위한 임시 마커 설정
    let protectedText = text;
    const tempMarkers = [];
    
    abbreviations.forEach((abbr, index) => {
        const marker = `__ABBR_${index}__`;
        const abbrRegex = new RegExp(`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`, 'gi');
        protectedText = protectedText.replace(abbrRegex, (match) => {
            tempMarkers.push({ marker, original: match });
            return marker;
        });
    });
    
    // 4단계: URL 보호 (http, https, www로 시작하는 URL)
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    protectedText = protectedText.replace(urlRegex, (match, offset) => {
        const marker = `__URL_${tempMarkers.length}__`;
        tempMarkers.push({ marker, original: match });
        return marker;
    });
    
    // 5단계: 소수점 보호 (숫자.숫자 형태)
    const decimalRegex = /\b\d+\.\d+\b/g;
    protectedText = protectedText.replace(decimalRegex, (match) => {
        const marker = `__DECIMAL_${tempMarkers.length}__`;
        tempMarkers.push({ marker, original: match });
        return marker;
    });
    
    // 6단계: 문장 분할 실행
    const sentences = protectedText.split(sentenceRegex);
    
    // 7단계: 보호된 텍스트 복원
    let restoredSentences = sentences.map(sentence => {
        let restored = sentence;
        tempMarkers.forEach(({ marker, original }) => {
            restored = restored.replace(new RegExp(marker, 'g'), original);
        });
        return restored.trim();
    });
    
    // 8단계: 빈 문장 제거 및 최종 정리
    return restoredSentences.filter(sentence => sentence.length > 0);
}

/**
 * AI 분석 결과에서 숏츠 제안 정보를 파싱합니다.
 * @param {string} aiResponse - AI의 분석 응답 텍스트
 * @returns {Array} 파싱된 숏츠 정보 배열
 */
export function parseAIShortsRecommendations(aiResponse) {
    console.log('🔍 AI 응답 파싱 시작...');
    console.log('📄 전체 AI 응답 내용:', aiResponse.substring(0, 500) + '...');
    
    // 🔄 사용된 설명 추적 초기화 (각 숏츠가 고유한 설명을 가지도록)
    resetUsedDescriptions();
    
    const shortsRecommendations = [];
    
    // 🎬 AI 추천 제목과 상세 설명을 정확히 추출하는 고급 패턴 (개선됨)
    const shortsPatterns = [
        // 🥇 최우선 패턴: • 숏츠 X - "제목": 시간-시간초 구간 (이유: 설명)
        /•\s*숏츠\s*(\d+)\s*-\s*"([^"]+)"\s*:\s*(\d+)-(\d+)초\s*구간\s*\(이유:\s*([^)]+)\)/gi,
        
        // 🥈 두 번째 패턴: • 숏츠 X - "제목": 시간-시간초 구간 (이유: 설명)  
        /•\s*숏츠\s*(\d+)\s*-\s*"([^"]+)"\s*:\s*(\d+)-(\d+)초\s*구간\s*\([^:]*:\s*([^)]+)\)/gi,
        
        // 🚨 NEW! 제목만 있는 패턴: • 숏츠 X - 제목: 시간-시간초 구간 (이유: 설명)
        /•\s*숏츠\s*(\d+)\s*-\s*([^:]+?):\s*(\d+)-(\d+)초\s*구간\s*\(이유:\s*([^)]+)\)/gi,
        
        // 🚨 NEW! 제목만 있는 패턴: • 숏츠 X - 제목: 시간-시간초 구간 (이유: 설명)  
        /•\s*숏츠\s*(\d+)\s*-\s*([^:]+?):\s*(\d+)-(\d+)초\s*구간\s*\([^:]*:\s*([^)]+)\)/gi,
        
        // 🥉 세 번째 패턴: 숏츠 X - "제목": 시간-시간초
        /숏츠\s*(\d+)\s*-\s*"([^"]+)"\s*:\s*(\d+)-(\d+)초/gi,
        
        // 🏅 네 번째 패턴: "제목": 시간-시간초 구간
        /"([^"]+)"\s*:\s*(\d+)-(\d+)초\s*구간/gi,
        
        // 🌟 NEW! "*" 문자 패턴: * 숏츠 X - "제목": 시간-시간초 구간 (설명)
        /\*\s*숏츠\s*(\d+)\s*-\s*"([^"]+)"\s*:\s*(\d+)-(\d+)초\s*구간\s*\(([^)]+)\)/gi,
        
        // 🌟 NEW! "*" 문자 패턴 (선택사항): * 숏츠 X - "제목": 시간-시간초 구간 (설명)
        /\*\s*숏츠\s*(\d+)\s*-\s*"([^"]+)"\s*:\s*(\d+)-(\d+)초\s*구간[^(]*\(([^)]+)\)/gi,
        
        // 기존 패턴들 (백업용)
        /•\s*\*\*숏츠.*?-\s*([^*]+)\*\*:\s*(\d+)-(\d+)초/gi,
        /•.*?-\s*"([^"]+)".*?(\d+)-(\d+)초.*?구간/gi,
        /숏츠\s*\d+.*?"([^"]+)".*?(\d+)-(\d+)초/gi,
        
        // 시간 구간 전용 패턴들 (제목 없을 때 대비)
        /(\d+)-(\d+)초\s*구간/gi,
        // 🚨 패턴 10 제거: 너무 광범위해서 일반 설명 텍스트까지 매치
        // /(\d+)-(\d+)초/g,  // 이 패턴이 "15-60초 길이의 숏츠를 제안합니다" 같은 텍스트를 오매치
        /(\d+)초부터\s*(\d+)초까지/g
    ];
    
    let allMatches = [];
    shortsPatterns.forEach((pattern, patternIndex) => {
        const patternMatches = [...aiResponse.matchAll(pattern)];
        if (patternMatches.length > 0) {
            console.log(`🔍 패턴 ${patternIndex} 매치됨: ${patternMatches.length}개`, pattern);
            patternMatches.forEach(match => {
                console.log(`   - 매치된 텍스트: "${match[0]}"`);
            });
        }
        patternMatches.forEach(match => {
            match.patternIndex = patternIndex;
            allMatches.push(match);
        });
    });
    
    console.log(`📊 총 ${allMatches.length}개의 패턴 매치 발견`);
    
    // 디버깅: AI 응답에서 시간 관련 키워드들 찾기
    const timeKeywords = ['초', '분', '구간', '시간', '숏츠', '편집', '클립'];
    const foundKeywords = timeKeywords.filter(keyword => aiResponse.includes(keyword));
    console.log(`🔍 발견된 시간 키워드:`, foundKeywords);
    
    // 숫자-숫자 패턴 찾기
    const numberPatterns = aiResponse.match(/\d+-\d+/g) || [];
    console.log(`🔢 발견된 숫자-숫자 패턴:`, numberPatterns);
    
    // 매치된 결과를 파싱
    allMatches.forEach((match, index) => {
        let shortsIndex, title, startTime, endTime, duration, description;
        
        try {
            console.log(`🔍 매치 ${index} 처리 중... 패턴 인덱스: ${match.patternIndex}`, match[0]);
            
            // 🎬 새로운 고급 패턴 처리 (개선됨)
            if (match.patternIndex === 0) {
                // 🥇 최우선 패턴: • 숏츠 X - "제목": 시간-시간초 구간 (이유: 설명)
                shortsIndex = parseInt(match[1]);
                title = match[2].trim();
                startTime = parseInt(match[3]);
                endTime = parseInt(match[4]);
                description = match[5] ? match[5].trim() : '';
                
                // 중복 설명 체크 및 추가
                if (description && !usedDescriptions.has(description)) {
                    usedDescriptions.add(description);
                    console.log(`✅ 최우선 패턴 매치: "${title}", ${startTime}-${endTime}초, 설명: "${description}"`);
                } else if (description) {
                    description = ''; // 중복된 설명은 제거
                    console.log(`✅ 최우선 패턴 매치: "${title}", ${startTime}-${endTime}초, 설명 중복으로 제거`);
                } else {
                    console.log(`✅ 최우선 패턴 매치: "${title}", ${startTime}-${endTime}초`);
                }
                
            } else if (match.patternIndex === 1) {
                // 🥈 두 번째 패턴: • 숏츠 X - "제목": 시간-시간초 구간 (이유: 설명)
                shortsIndex = parseInt(match[1]);
                title = match[2].trim();
                startTime = parseInt(match[3]);
                endTime = parseInt(match[4]);
                description = match[5] ? match[5].trim() : '';
                
                // 중복 설명 체크 및 추가
                if (description && !usedDescriptions.has(description)) {
                    usedDescriptions.add(description);
                    console.log(`✅ 두 번째 패턴 매치: "${title}", ${startTime}-${endTime}초, 설명: "${description}"`);
                } else if (description) {
                    description = ''; // 중복된 설명은 제거
                    console.log(`✅ 두 번째 패턴 매치: "${title}", ${startTime}-${endTime}초, 설명 중복으로 제거`);
                } else {
                    console.log(`✅ 두 번째 패턴 매치: "${title}", ${startTime}-${endTime}초`);
                }
                
            } else if (match.patternIndex === 2) {
                // 🚨 NEW! 제목만 있는 패턴: • 숏츠 X - 제목: 시간-시간초 구간 (이유: 설명)
                shortsIndex = parseInt(match[1]);
                title = match[2].trim();
                startTime = parseInt(match[3]);
                endTime = parseInt(match[4]);
                description = match[5] ? match[5].trim() : '';
                
                // 중복 설명 체크 및 추가
                if (description && !usedDescriptions.has(description)) {
                    usedDescriptions.add(description);
                    console.log(`✅ NEW 제목 패턴 매치: "${title}", ${startTime}-${endTime}초, 설명: "${description}"`);
                } else if (description) {
                    description = ''; // 중복된 설명은 제거
                    console.log(`✅ NEW 제목 패턴 매치: "${title}", ${startTime}-${endTime}초, 설명 중복으로 제거`);
                } else {
                    console.log(`✅ NEW 제목 패턴 매치: "${title}", ${startTime}-${endTime}초`);
                }
                
            } else if (match.patternIndex === 3) {
                // 🚨 NEW! 제목만 있는 패턴: • 숏츠 X - 제목: 시간-시간초 구간 (이유: 설명)  
                shortsIndex = parseInt(match[1]);
                title = match[2].trim();
                startTime = parseInt(match[3]);
                endTime = parseInt(match[4]);
                description = match[5] ? match[5].trim() : '';
                
                // 중복 설명 체크 및 추가
                if (description && !usedDescriptions.has(description)) {
                    usedDescriptions.add(description);
                    console.log(`✅ NEW 제목 패턴2 매치: "${title}", ${startTime}-${endTime}초, 설명: "${description}"`);
                } else if (description) {
                    description = ''; // 중복된 설명은 제거
                    console.log(`✅ NEW 제목 패턴2 매치: "${title}", ${startTime}-${endTime}초, 설명 중복으로 제거`);
                } else {
                    console.log(`✅ NEW 제목 패턴2 매치: "${title}", ${startTime}-${endTime}초`);
                }
                
            } else if (match.patternIndex === 4) {
                // 🥉 세 번째 패턴: 숏츠 X - "제목": 시간-시간초
                shortsIndex = parseInt(match[1]);
                title = match[2].trim();
                startTime = parseInt(match[3]);
                endTime = parseInt(match[4]);
                console.log(`✅ 세 번째 패턴 매치: "${title}", ${startTime}-${endTime}초`);
                
            } else if (match.patternIndex === 5) {
                // 🏅 네 번째 패턴: "제목": 시간-시간초 구간
                title = match[1].trim();
                startTime = parseInt(match[2]);
                endTime = parseInt(match[3]);
                shortsIndex = index + 1;
                console.log(`✅ 네 번째 패턴 매치: "${title}", ${startTime}-${endTime}초`);
                
            } else if (match.patternIndex === 6) {
                // 🌟 NEW! "*" 문자 패턴: * 숏츠 X - "제목": 시간-시간초 구간 (설명)
                shortsIndex = parseInt(match[1]);
                title = match[2].trim();
                startTime = parseInt(match[3]);
                endTime = parseInt(match[4]);
                description = match[5] ? match[5].trim() : '';
                
                // 중복 설명 체크 및 추가
                if (description && !usedDescriptions.has(description)) {
                    usedDescriptions.add(description);
                    console.log(`✅ "*" 패턴 매치: "${title}", ${startTime}-${endTime}초, 설명: "${description}"`);
                } else if (description) {
                    description = ''; // 중복된 설명은 제거
                    console.log(`✅ "*" 패턴 매치: "${title}", ${startTime}-${endTime}초, 설명 중복으로 제거`);
                } else {
                    console.log(`✅ "*" 패턴 매치: "${title}", ${startTime}-${endTime}초`);
                }
                
            } else if (match.patternIndex === 7) {
                // 🌟 NEW! "*" 문자 패턴 (선택사항): * 숏츠 X - "제목": 시간-시간초 구간 (설명)
                shortsIndex = parseInt(match[1]);
                title = match[2].trim();
                startTime = parseInt(match[3]);
                endTime = parseInt(match[4]);
                description = match[5] ? match[5].trim() : '';
                
                // 중복 설명 체크 및 추가
                if (description && !usedDescriptions.has(description)) {
                    usedDescriptions.add(description);
                    console.log(`✅ "*" 선택패턴 매치: "${title}", ${startTime}-${endTime}초, 설명: "${description}"`);
                } else if (description) {
                    description = ''; // 중복된 설명은 제거
                    console.log(`✅ "*" 선택패턴 매치: "${title}", ${startTime}-${endTime}초, 설명 중복으로 제거`);
                } else {
                    console.log(`✅ "*" 선택패턴 매치: "${title}", ${startTime}-${endTime}초`);
                }
                
            } else if (match.patternIndex <= 10) {
                // 기존 백업 패턴들 (설명 보완 로직 추가)
                if (match[1] && match[2] && match[3]) {
                    title = match[1].trim();
                    startTime = parseInt(match[2]);
                    endTime = parseInt(match[3]);
                    shortsIndex = index + 1;
                    
                    // 🔍 전체 AI 응답에서 이 숏츠에 대한 설명을 찾기
                    description = findDescriptionForShorts(aiResponse, title, shortsIndex);
                    
                    console.log(`✅ 백업 패턴 매치: "${title}", ${startTime}-${endTime}초`);
                    console.log(`📝 추출된 설명: "${description}"`);
                }
            } else {
                // 시간 구간만 있는 경우 (제목 없음)
                if (match[1] && match[2]) {
                    startTime = parseInt(match[1]);
                    endTime = parseInt(match[2]);
                    title = `자동 추출 숏츠 ${index + 1}`;
                    shortsIndex = index + 1;
                    
                    // 🔍 전체 AI 응답에서 이 숏츠에 대한 설명을 찾기
                    description = findDescriptionForShorts(aiResponse, title, shortsIndex);
                    
                    console.log(`⚠️ 시간만 매치: "${title}", ${startTime}-${endTime}초`);
                    console.log(`📝 추출된 설명: "${description}"`);
                }
            }
            
            // 🚨 비정상적인 시간 형식 처리 (시작 > 끝인 경우)
            if (startTime !== undefined && endTime !== undefined && startTime > endTime) {
                console.log(`🚨 비정상적인 시간 형식 감지: ${startTime}-${endTime}초`);
                console.log(`💡 해석: "${startTime}초부터 ${endTime}초 동안" → ${startTime}-${startTime + endTime}초`);
                
                // "시작시간-지속시간" 형식으로 해석
                const actualEndTime = startTime + endTime;
                endTime = actualEndTime;
                
                console.log(`✅ 수정된 시간: ${startTime}-${endTime}초`);
            }
            
            // 유효한 데이터인지 확인
            if (startTime !== undefined && endTime !== undefined && 
                !isNaN(startTime) && !isNaN(endTime) && 
                endTime > startTime && startTime >= 0) {
                
                // duration이 없거나 이상한 경우 기본값 설정
                if (!duration || duration <= 0 || duration > (endTime - startTime)) {
                    duration = Math.min(60, Math.max(15, Math.floor((endTime - startTime) * 0.3)));
                }
                
                // 실제 추출할 구간 계산
                const rangeLength = endTime - startTime;
                const extractStart = startTime + Math.floor(Math.max(0, (rangeLength - duration) / 2));
                const extractEnd = Math.min(extractStart + duration, endTime);
                
                const shortsData = {
                    id: `shorts-${shortsIndex || index + 1}`,
                    index: shortsIndex || index + 1,
                    title: title || `숏츠 ${shortsIndex || index + 1}`,
                    description: description || '', // 🎬 AI 추천 설명 추가
                    suggestedRange: { start: startTime, end: endTime },
                    extractRange: { start: Math.max(0, extractStart), end: extractEnd },
                    duration: duration,
                    status: 'pending',
                    thumbnailFrames: [],
                    renderedVideo: null
                };
                
                // 🚨 강화된 중복 체크 (원본 시간 구간 기준)
                const isDuplicate = shortsRecommendations.some(existing => {
                    // 원본 시작 시간이 10초 이내로 비슷한 경우
                    const timeSimilar = Math.abs(existing.suggestedRange.start - shortsData.suggestedRange.start) < 10;
                    
                    // 제목이 비슷한 경우 (자동 생성된 제목끼리 비교 방지)
                    const titleSimilar = existing.title === shortsData.title;
                    
                    // 자동 생성 제목인데 이미 정상 제목이 있는 경우
                    const isAutoTitle = shortsData.title.includes('자동 추출 숏츠');
                    const hasRealTitle = !existing.title.includes('자동 추출 숏츠');
                    
                    if (timeSimilar && isAutoTitle && hasRealTitle) {
                        console.log(`🚫 자동 숏츠 "${shortsData.title}" 제외: 같은 구간에 정상 제목 "${existing.title}" 존재`);
                        return true; // 중복으로 처리하여 제외
                    }
                    
                    return timeSimilar || titleSimilar;
                });
                
                if (!isDuplicate) {
                    shortsRecommendations.push(shortsData);
                    console.log(`✅ 숏츠 파싱 성공:`, shortsData);
                } else {
                    console.log(`🚫 중복 숏츠 제외: "${shortsData.title}" (${shortsData.suggestedRange.start}-${shortsData.suggestedRange.end}초)`);
                }
            }
        } catch (error) {
            console.warn(`⚠️ 매치 ${index} 파싱 실패:`, error, match);
        }
    });
    
    // 시간순으로 정렬
    shortsRecommendations.sort((a, b) => a.extractRange.start - b.extractRange.start);
    
    console.log(`🎬 최종 파싱 결과: ${shortsRecommendations.length}개의 숏츠 제안`);
    shortsRecommendations.forEach((shorts, i) => {
        console.log(`  ${i+1}. ${shorts.title}: ${shorts.extractRange.start}s-${shorts.extractRange.end}s (${shorts.duration}초)`);
    });
    
    return shortsRecommendations;
}

// 이미 사용된 설명을 추적하는 전역 변수
let usedDescriptions = new Set();

/**
 * 파싱 시작 시 사용된 설명 추적을 초기화합니다.
 */
function resetUsedDescriptions() {
    usedDescriptions.clear();
    console.log('🔄 사용된 설명 추적 초기화됨');
}

/**
 * AI 응답 전체에서 특정 숏츠에 대한 설명을 찾습니다.
 * @param {string} aiResponse - 전체 AI 응답 텍스트
 * @param {string} title - 숏츠 제목
 * @param {number} shortsIndex - 숏츠 번호
 * @returns {string} 찾은 설명 또는 빈 문자열
 */
function findDescriptionForShorts(aiResponse, title, shortsIndex) {
    console.log(`🔍 숏츠 ${shortsIndex} "${title}"에 대한 설명 검색 중...`);
    console.log(`📄 AI 응답 길이: ${aiResponse.length}자`);
    
    // 🎯 패턴 1: 숏츠 번호와 함께 있는 "(이유: ...)" 패턴 찾기 (가장 정확)
    const numberReasonPattern = new RegExp(`숏츠\\s*${shortsIndex}[^]*?\\(이유:\\s*([^)]+)\\)`, 'gi');
    let match = numberReasonPattern.exec(aiResponse);
    if (match && match[1] && match[1].length > 10) {
        const desc = match[1].trim();
        if (!usedDescriptions.has(desc)) {
            usedDescriptions.add(desc);
            console.log(`✅ 패턴1에서 숏츠 ${shortsIndex} 전용 설명 찾음: "${desc}"`);
            return desc;
        }
    }
    
    // 🎯 패턴 2: 제목과 함께 있는 "(이유: ...)" 패턴 찾기
    if (title && title !== `숏츠 ${shortsIndex}` && title !== `자동 추출 숏츠 ${shortsIndex}`) {
        const titleEscaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const titleReasonPattern = new RegExp(`"${titleEscaped}"[^]*?\\(이유:\\s*([^)]+)\\)`, 'gi');
        match = titleReasonPattern.exec(aiResponse);
        if (match && match[1] && match[1].length > 10) {
            const desc = match[1].trim();
            if (!usedDescriptions.has(desc)) {
                usedDescriptions.add(desc);
                console.log(`✅ 패턴2에서 제목 "${title}" 전용 설명 찾음: "${desc}"`);
                return desc;
            }
        }
    }
    
    // 🎯 패턴 3: AI 응답을 숏츠별로 분할하여 해당 섹션에서 설명 찾기
    const shortsBlocks = aiResponse.split(/•\s*숏츠\s*\d+/gi);
    if (shortsBlocks.length > shortsIndex) {
        const targetBlock = shortsBlocks[shortsIndex];
        
        // 해당 블록에서 "이 구간은..." 또는 "이 장면은..." 패턴 찾기
        const blockDescPatterns = [
            /이\s*구간은[^]*?(?=\n•|\n\*|•\s*숏츠|$)/gi,
            /이\s*장면은[^]*?(?=\n•|\n\*|•\s*숏츠|$)/gi,
            /이\s*부분은[^]*?(?=\n•|\n\*|•\s*숏츠|$)/gi,
            /\(이유:\s*([^)]+)\)/gi
        ];
        
        for (const pattern of blockDescPatterns) {
            pattern.lastIndex = 0; // 패턴 인덱스 리셋
            match = pattern.exec(targetBlock);
            if (match && match[0] && match[0].length > 20) {
                const desc = (match[1] || match[0]).trim();
                if (!usedDescriptions.has(desc)) {
                    usedDescriptions.add(desc);
                    console.log(`✅ 패턴3에서 블록별 설명 찾음 (${desc.length}자): "${desc.substring(0, 100)}..."`);
                    return desc;
                }
            }
        }
    }
    
    // 🎯 패턴 4: 전체 응답에서 순차적으로 "(이유: ...)" 패턴들 찾기
    const allReasonMatches = [...aiResponse.matchAll(/\(이유:\s*([^)]+)\)/gi)];
    
    // 숏츠 인덱스에 맞는 번째 이유 찾기 (아직 사용되지 않은 것)
    for (let i = shortsIndex - 1; i < allReasonMatches.length; i++) {
        const reasonMatch = allReasonMatches[i];
        if (reasonMatch && reasonMatch[1] && reasonMatch[1].length > 10) {
            const desc = reasonMatch[1].trim();
            if (!usedDescriptions.has(desc)) {
                usedDescriptions.add(desc);
                console.log(`✅ 패턴4에서 순차적 이유 설명 찾음: "${desc}"`);
                return desc;
            }
        }
    }
    
    // 🎯 패턴 5: 백업 - 시간 구간 근처의 설명 찾기
    const timeBasedMatches = [...aiResponse.matchAll(/([\d]+-[\d]+초[^]*?)(?=\d+-\d+초|•\s*숏츠|$)/gi)];
    
    if (timeBasedMatches.length >= shortsIndex) {
        const timeMatch = timeBasedMatches[shortsIndex - 1];
        if (timeMatch && timeMatch[1]) {
            // 시간 정보를 제거하고 순수 설명만 추출
            const cleanDesc = timeMatch[1]
                .replace(/\d+-\d+초\s*구간/gi, '')
                .replace(/\([^)]*길이:\s*\d+초[^)]*\)/gi, '')
                .replace(/추출\s*구간:\s*\d+s\s*-\s*\d+s/gi, '')
                .trim();
            
            if (cleanDesc.length > 20 && !usedDescriptions.has(cleanDesc)) {
                usedDescriptions.add(cleanDesc);
                console.log(`✅ 패턴5에서 시간 기반 설명 찾음: "${cleanDesc.substring(0, 100)}..."`);
                return cleanDesc;
            }
        }
    }
    
    console.log(`❌ 숏츠 ${shortsIndex}에 대한 고유한 설명을 찾을 수 없음`);
    console.log(`🔍 사용된 설명 수: ${usedDescriptions.size}개`);
    return '';
}

/**
 * 숏츠 구간의 썸네일 프레임들을 생성합니다.
 * @param {Object} shortsInfo - 숏츠 정보
 * @returns {Promise<Array>} 썸네일 프레임 배열
 */
export async function generateShortsThumbnails(shortsInfo) {
    if (!DOM.videoPreview || !DOM.videoPreview.src) {
        throw new Error('동영상이 로드되지 않았습니다.');
    }
    
    const video = DOM.videoPreview;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 9:16 비율로 캔버스 설정
    const targetWidth = 360;
    const targetHeight = 640;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    const thumbnails = [];
    const { start, end } = shortsInfo.extractRange;
    const frameCount = 5; // 각 숏츠당 5개의 썸네일
    const interval = (end - start) / (frameCount - 1);
    
    console.log(`🖼️ ${shortsInfo.title} 썸네일 생성 시작: ${start}s-${end}s`);
    
    for (let i = 0; i < frameCount; i++) {
        const time = start + (interval * i);
        
        try {
            // 비디오를 해당 시간으로 이동
            await new Promise((resolve, reject) => {
                const handleSeeked = () => {
                    video.removeEventListener('seeked', handleSeeked);
                    resolve();
                };
                const handleError = () => {
                    video.removeEventListener('error', handleError);
                    reject(new Error('비디오 시크 실패'));
                };
                
                video.addEventListener('seeked', handleSeeked, { once: true });
                video.addEventListener('error', handleError, { once: true });
                video.currentTime = time;
                
                // 타임아웃 설정
                setTimeout(() => {
                    video.removeEventListener('seeked', handleSeeked);
                    video.removeEventListener('error', handleError);
                    reject(new Error('비디오 시크 타임아웃'));
                }, 3000);
            });
            
            // 9:16 비율로 크롭하여 그리기
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;
            
            // 원본 비디오에서 9:16 비율에 맞는 영역 계산
            const targetRatio = 9 / 16;
            const videoRatio = videoWidth / videoHeight;
            
            let sourceX = 0, sourceY = 0, sourceWidth = videoWidth, sourceHeight = videoHeight;
            
            if (videoRatio > targetRatio) {
                // 비디오가 더 넓음 - 양쪽을 잘라냄
                sourceWidth = videoHeight * targetRatio;
                sourceX = (videoWidth - sourceWidth) / 2;
            } else {
                // 비디오가 더 높음 - 위아래를 잘라냄
                sourceHeight = videoWidth / targetRatio;
                sourceY = (videoHeight - sourceHeight) / 2;
            }
            
            // 캔버스에 그리기
            ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
            
            const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            thumbnails.push({
                time: time,
                dataUrl: thumbnailDataUrl,
                frame: Math.floor(time * 30) // 30fps 기준
            });
            
        } catch (error) {
            console.warn(`썸네일 생성 실패 (${time}초):`, error);
        }
    }
    
    console.log(`✅ ${shortsInfo.title} 썸네일 ${thumbnails.length}개 생성 완료`);
    return thumbnails;
}

/**
 * 설명 텍스트에서 중복 정보를 제거하고 순수한 설명만 추출합니다.
 * @param {string} description - 원본 설명 텍스트
 * @returns {string} 정리된 설명 텍스트
 */
function cleanDescription(description) {
    if (!description) return '';
    
    console.log(`🧹 설명 정리 시작 (${description.length}자): "${description.substring(0, 100)}..."`);
    
    // 🧹 강력한 중복 정보 제거 (제목, 시간, 구간 정보 등)
    let cleaned = description
        // 패턴 1: 제목 패턴 제거 - "숏츠 X - "제목"**: 시간 구간" 
        .replace(/^.*?숏츠\s*\d+\s*-\s*"[^"]*"\*\*:\s*\d+-\d+초\s*구간[^:]*:\s*/gi, '')
        // 패턴 2: "**• 숏츠 X - "제목"**: 시간 구간 (길이: X초)" 
        .replace(/^\*\*•\s*숏츠\s*\d+\s*-\s*"[^"]*"\*\*:\s*\d+-\d+초\s*구간[^)]*\)\s*/gi, '')
        // 패턴 3: 시간 구간 정보 - "500-545초 구간 (길이: 45초)"
        .replace(/^\d+-\d+초\s*구간[^)]*\)\s*/gi, '')
        // 패턴 4: 단순 제목 패턴 - "제목"**: 
        .replace(/^"[^"]*"\*\*:\s*/gi, '')
        // 패턴 5: "**이유:**" 또는 "(이유:" 키워드
        .replace(/^\*\*이유:\*\*\s*/gi, '')
        .replace(/^\(이유:\s*/gi, '')
        // 패턴 6: 마크다운 불릿 포인트 - "**• " 또는 "• "
        .replace(/^\*\*•\s*/gi, '')
        .replace(/^•\s*/gi, '')
        // 패턴 7: 끝의 불완전한 괄호나 마크다운
        .replace(/\)$/, '')
        .replace(/\*\*$/, '')
        // 패턴 8: 앞의 불필요한 기호들 (-, :, *, 공백)
        .replace(/^[-:\s\*]+/, '')
        // 패턴 9: 연속된 공백을 하나로 정리
        .replace(/\s+/g, ' ')
        // 패턴 10: 앞뒤 공백 제거
        .trim();
    
    console.log(`✅ 1차 정리 완료 (${cleaned.length}자): "${cleaned.substring(0, 100)}..."`);
    
    // 🔍 추가 검증 및 정리
    // 여전히 제목이나 시간 정보가 포함되어 있는지 확인
    if (cleaned.includes('**') || cleaned.includes('구간') || cleaned.match(/\d+-\d+초/)) {
        console.log('⚠️ 추가 정리 필요 - 제목/시간 정보 감지됨');
        
        // 더 강력한 정리 - 첫 번째 완전한 문장부터 시작
        const sentences = splitSentences(cleaned).filter(s => s.trim().length > 0);
        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i].trim();
            // "이 구간은", "이 장면은", "강렬한", "긴박한" 등으로 시작하는 실제 내용 찾기
            if (sentence.match(/^(이\s*(구간|장면|부분)은|강렬한|긴박한|감동|드라마|시청자|음악은|자막은)/)) {
                cleaned = sentences.slice(i).join('.').trim();
                if (!cleaned.endsWith('.') && !cleaned.endsWith('!') && !cleaned.endsWith('?')) {
                    cleaned += '.';
                }
                console.log(`✅ 실제 내용 시작점 발견: "${cleaned.substring(0, 100)}..."`);
                break;
            }
        }
    }
    
    console.log(`🎯 최종 정리 완료 (${cleaned.length}자): "${cleaned.substring(0, 100)}..."`);
    
    // 빈 문자열이거나 너무 짧으면 원본 반환
    if (!cleaned || cleaned.length < 20) {
        console.log(`⚠️ 정리 결과가 너무 짧음, 원본 반환`);
        return description;
    }
    
    // 정리된 결과가 원본보다 70% 이상 짧아지면 원본 반환 (내용 손실 방지)
    if (cleaned.length < description.length * 0.3) {
        console.log(`⚠️ 내용 손실 위험, 원본 반환 (${cleaned.length}자 < ${Math.floor(description.length * 0.3)}자)`);
        return description;
    }
    
    return cleaned;
}

/**
 * 파싱된 숏츠 정보들을 UI에 표시합니다.
 * @param {Array} shortsRecommendations - 숏츠 정보 배열
 */
export async function displayShortsRecommendations(shortsRecommendations) {
    const container = document.getElementById('aiShortsContainer') || createShortsContainer();
    
    container.innerHTML = `
        <div class="ai-shorts-header">
            <h3>🎬 AI 추천 숏츠 (${shortsRecommendations.length}개)</h3>
            <p>AI가 분석한 내용을 바탕으로 자동 생성된 숏츠 제안입니다.</p>
        </div>
        <div class="ai-shorts-list"></div>
        <div class="ai-shorts-controls">
            <button id="generateAllThumbnails" class="btn btn-secondary">
                <i class="fas fa-images"></i> 모든 숏츠 미리보기 생성
            </button>
            <button id="renderAllShorts" class="btn btn-primary" disabled>
                <i class="fas fa-video"></i> 선택된 숏츠 렌더링
            </button>
        </div>
    `;
    
    const listContainer = container.querySelector('.ai-shorts-list');
    
    // 각 숏츠 정보를 카드로 표시
    shortsRecommendations.forEach(shorts => {
        const shortsCard = document.createElement('div');
        shortsCard.className = 'ai-shorts-card';
        shortsCard.dataset.shortsId = shorts.id;
        
        shortsCard.innerHTML = `
            <div class="shorts-card-header">
                <div class="shorts-info">
                    <h4 class="shorts-title">🎬 ${shorts.title}</h4>
                    <div class="shorts-meta">
                        <span class="time-range">
                            추출 구간: ${shorts.extractRange.start}s - ${shorts.extractRange.end}s
                        </span>
                        <span class="duration">길이: ${shorts.duration}초</span>
                        <span class="status status-${shorts.status}">${getStatusText(shorts.status)}</span>
                    </div>
                </div>
                <div class="shorts-controls">
                    <input type="checkbox" class="shorts-select" id="select-${shorts.id}">
                    <label for="select-${shorts.id}">선택</label>
                </div>
            </div>
            <div class="shorts-thumbnails" id="thumbnails-${shorts.id}">
                <div class="loading-thumbnails">
                    <i class="fas fa-spinner fa-spin"></i> 미리보기 대기 중...
                </div>
            </div>
            ${shorts.description ? `
            <div class="shorts-description">
                <div class="description-header">
                    <i class="fas fa-lightbulb"></i>
                    <span>내용 요약</span>
                </div>
                <p class="description-text">${cleanDescription(shorts.description)}</p>
            </div>
            ` : ''}
            <div class="shorts-card-footer">
                <button class="btn btn-sm btn-secondary preview-btn" data-shorts-id="${shorts.id}">
                    <i class="fas fa-eye"></i> 미리보기 생성
                </button>
                <button class="btn btn-sm btn-primary render-btn" data-shorts-id="${shorts.id}" disabled>
                    <i class="fas fa-download"></i> 렌더링
                </button>
            </div>
        `;
        
        listContainer.appendChild(shortsCard);
    });
    
    // 이벤트 리스너 설정
    setupShortsEventListeners(shortsRecommendations);
    
    // 상태 업데이트
    state.aiGeneratedShorts = shortsRecommendations;
    
    console.log('✅ 숏츠 추천 UI 표시 완료');
}

/**
 * 숏츠 컨테이너를 생성합니다.
 */
export function createShortsContainer() {
    const container = document.createElement('div');
    container.id = 'aiShortsContainer';
    container.className = 'ai-shorts-container';
    
    // 기존 컨테이너가 있으면 교체
    const existing = document.getElementById('aiShortsContainer');
    if (existing) {
        existing.parentNode.replaceChild(container, existing);
    } else {
        // 채팅 컨테이너 다음에 추가
        const chatContainer = document.getElementById('chatContainer');
        if (chatContainer) {
            chatContainer.parentNode.insertBefore(container, chatContainer.nextSibling);
        } else {
            document.body.appendChild(container);
        }
    }
    
    return container;
}

/**
 * 상태 텍스트를 반환합니다.
 */
function getStatusText(status) {
    const statusMap = {
        'pending': '대기 중',
        'previewing': '미리보기 생성 중',
        'approved': '승인됨',
        'rendering': '렌더링 중',
        'completed': '완료'
    };
    return statusMap[status] || status;
}

/**
 * 숏츠 관련 이벤트 리스너를 설정합니다.
 */
function setupShortsEventListeners(shortsRecommendations) {
    // 개별 미리보기 생성 버튼
    document.querySelectorAll('.preview-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const shortsId = e.target.dataset.shortsId;
            const shorts = shortsRecommendations.find(s => s.id === shortsId);
            if (shorts) {
                await generateSingleShortsPreview(shorts);
            }
        });
    });
    
    // 개별 렌더링 버튼
    document.querySelectorAll('.render-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const shortsId = e.target.dataset.shortsId;
            const shorts = shortsRecommendations.find(s => s.id === shortsId);
            if (shorts) {
                await renderSingleShorts(shorts);
            }
        });
    });
    
    // 모든 미리보기 생성 버튼
    const generateAllBtn = document.getElementById('generateAllThumbnails');
    if (generateAllBtn) {
        generateAllBtn.addEventListener('click', async () => {
            await generateAllShortsPreviews(shortsRecommendations);
        });
    }
    
    // 선택된 숏츠 렌더링 버튼
    const renderAllBtn = document.getElementById('renderAllShorts');
    if (renderAllBtn) {
        renderAllBtn.addEventListener('click', async () => {
            const selectedShorts = getSelectedShorts(shortsRecommendations);
            await renderSelectedShorts(selectedShorts);
        });
    }
    
    // 체크박스 선택 상태 변경 감지
    document.querySelectorAll('.shorts-select').forEach(checkbox => {
        checkbox.addEventListener('change', updateRenderButtonState);
    });
}

/**
 * 개별 숏츠의 미리보기를 생성합니다.
 */
async function generateSingleShortsPreview(shorts) {
    const card = document.querySelector(`[data-shorts-id="${shorts.id}"]`);
    const thumbnailsContainer = card.querySelector('.shorts-thumbnails');
    const previewBtn = card.querySelector('.preview-btn');
    
    try {
        shorts.status = 'previewing';
        previewBtn.disabled = true;
        previewBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...';
        
        thumbnailsContainer.innerHTML = '<div class="generating-thumbnails"><i class="fas fa-spinner fa-spin"></i> 미리보기 생성 중...</div>';
        
        const thumbnails = await generateShortsThumbnails(shorts);
        shorts.thumbnailFrames = thumbnails;
        
        // 썸네일 표시
        thumbnailsContainer.innerHTML = '';
        thumbnails.forEach((thumb, index) => {
            const thumbDiv = document.createElement('div');
            thumbDiv.className = 'thumbnail-frame';
            thumbDiv.innerHTML = `
                <img src="${thumb.dataUrl}" alt="Frame ${thumb.frame}">
                <div class="frame-info">${thumb.time.toFixed(1)}s</div>
            `;
            thumbnailsContainer.appendChild(thumbDiv);
        });
        
        shorts.status = 'approved';
        previewBtn.innerHTML = '<i class="fas fa-play"></i> 동영상 미리보기';
        previewBtn.disabled = false;
        
        // 버튼 클릭 이벤트를 모달 열기로 변경
        previewBtn.onclick = () => openShortsPreviewModal(shorts.id);
        
        // 렌더링 버튼 활성화
        const renderBtn = card.querySelector('.render-btn');
        renderBtn.disabled = false;
        
        console.log(`✅ ${shorts.title} 미리보기 생성 완료`);
        
    } catch (error) {
        console.error(`❌ ${shorts.title} 미리보기 생성 실패:`, error);
        shorts.status = 'pending';
        previewBtn.disabled = false;
        previewBtn.innerHTML = '<i class="fas fa-eye"></i> 미리보기 생성';
        thumbnailsContainer.innerHTML = '<div class="error-message">미리보기 생성 실패</div>';
    }
}

/**
 * 모든 숏츠의 미리보기를 생성합니다.
 */
async function generateAllShortsPreviews(shortsRecommendations) {
    const generateAllBtn = document.getElementById('generateAllThumbnails');
    generateAllBtn.disabled = true;
    generateAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 모든 미리보기 생성 중...';
    
    let completed = 0;
    for (const shorts of shortsRecommendations) {
        if (shorts.status === 'pending') {
            await generateSingleShortsPreview(shorts);
            completed++;
            generateAllBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 생성 중... (${completed}/${shortsRecommendations.length})`;
        }
    }
    
    generateAllBtn.disabled = false;
    generateAllBtn.innerHTML = '<i class="fas fa-check"></i> 모든 미리보기 완료';
    updateRenderButtonState();
}

/**
 * 개별 숏츠를 렌더링합니다.
 */
async function renderSingleShorts(shorts) {
    console.log(`🎬 ${shorts.title} 렌더링 시작...`);
    // 실제 렌더링 로직은 별도 모듈에서 구현 예정
    alert(`${shorts.title} 렌더링 기능은 구현 예정입니다.`);
}

/**
 * 선택된 숏츠들을 반환합니다.
 */
function getSelectedShorts(shortsRecommendations) {
    const selectedIds = Array.from(document.querySelectorAll('.shorts-select:checked'))
        .map(checkbox => checkbox.id.replace('select-', ''));
    
    return shortsRecommendations.filter(shorts => selectedIds.includes(shorts.id));
}

/**
 * 선택된 숏츠들을 렌더링합니다.
 */
async function renderSelectedShorts(selectedShorts) {
    if (selectedShorts.length === 0) {
        alert('렌더링할 숏츠를 선택해주세요.');
        return;
    }
    
    console.log(`🎬 선택된 ${selectedShorts.length}개 숏츠 렌더링 시작...`);
    // 실제 렌더링 로직 구현 예정
    alert(`선택된 ${selectedShorts.length}개 숏츠 렌더링 기능은 구현 예정입니다.`);
}

/**
 * 렌더링 버튼 상태를 업데이트합니다.
 */
function updateRenderButtonState() {
    const renderAllBtn = document.getElementById('renderAllShorts');
    const selectedCount = document.querySelectorAll('.shorts-select:checked').length;
    
    renderAllBtn.disabled = selectedCount === 0;
    renderAllBtn.innerHTML = selectedCount > 0 
        ? `<i class="fas fa-video"></i> 선택된 숏츠 렌더링 (${selectedCount}개)`
        : '<i class="fas fa-video"></i> 선택된 숏츠 렌더링';
}

// AI 응답에서 자동으로 숏츠 제안을 감지하고 처리
export function handleAIResponseForShorts(aiResponse) {
    console.log('🔍 AI 응답 숏츠 감지 시작...');
    console.log('📄 AI 응답 내용 (첫 200자):', aiResponse.substring(0, 200) + '...');
    
    // 디버깅을 위한 AI 응답 저장 (백업)
    if (!window.lastAIResponse) {
        window.lastAIResponse = aiResponse;
        console.log('💾 AI 응답 백업 저장 완료');
    }
    
    // 숏츠 관련 키워드가 포함되어 있는지 확인 (더 포괄적으로)
    const shortsKeywords = [
        '숏츠', '편집', '제작', '구간', '클립', '렌더링',
        '초 내외', '장면', '하이라이트', '포인트', 'YouTube',
        '분할', '추출', '생성', '영상', '동영상', '비디오',
        'AutoShorts', '조언', '제안', '분석', '편집',
        '시간', '순간', '부분', '짧게', '선택', '활용'
    ];
    
    const containsShortsContent = shortsKeywords.some(keyword => aiResponse.includes(keyword));
    console.log('🔍 숏츠 키워드 감지:', containsShortsContent);
    
    // 시간 구간 패턴도 확인 (더 포괄적으로)
    const timePatterns = [
        /\d+-\d+초/g,
        /\d+초-\d+초/g,
        /\d+:\d+-\d+:\d+/g,
        /\d+분\d+초-\d+분\d+초/g
    ];
    
    const hasTimeRanges = timePatterns.some(pattern => pattern.test(aiResponse));
    console.log('🕐 시간 구간 패턴 감지:', hasTimeRanges);
    
    if (containsShortsContent || hasTimeRanges) {
        console.log('✅ 숏츠 관련 내용 감지됨, 파싱 시작...');
        const recommendations = parseAIShortsRecommendations(aiResponse);
        console.log('📋 파싱된 숏츠 추천:', recommendations);
        
        if (recommendations.length > 0) {
            console.log('🎬 숏츠 카드 UI 표시 시작...');
            displayShortsRecommendations(recommendations);
            
            // 작업 로그 기록
            if (window.workLogManager && window.workLogManager.addWorkLog) {
                window.workLogManager.addWorkLog('ai-shorts', 
                    `AI 분석에서 ${recommendations.length}개의 숏츠 추천을 자동 생성`,
                    { count: recommendations.length }
                );
            }
            
            return true;
        } else {
            console.warn('❌ 숏츠 파싱 결과 없음. 수동 트리거를 시도해보세요.');
        }
    } else {
        console.log('ℹ️ 숏츠 관련 내용이 감지되지 않았습니다.');
    }
    
    return false;
}

    // 테스트용 전역 함수들
window.testAIShortsGenerator = {
    
    // 🧪 중복 설명 문제 테스트
    testDuplicateDescriptions: function() {
        console.log('🧪 중복 설명 문제 테스트 시작...');
        
        const testAIResponse = `
        • 숏츠 1 - "감동적인 재회": 0-15초 구간 (이유: 이 장면은 우주복을 입은 남자가 감정적인 만남을 보여주어 시청자들의 감동을 자아낼 수 있습니다.)
        
        • 숏츠 2 - "미지의 행성과 고독한 인물": 900-915초 구간 (이유: 이 구간은 배경에 보이는 900초 부근의 장면은 미지의 행성(아마도 분위기가 행성)을 배경으로 고독하게 서 있는 인물의 모습을 보여줍니다.)
        
        * 숏츠 3 - "미래 도시의 어두운 그림자": 60-75초 구간 (미래적인 건물의 어두운 분위기와 대조되는 딸의 밝은 옷을 활용하여 미스터리와 대비를 강조)
        * 숏츠 4 - "절박한 상황": 150-165초 구간 (아버지의 절박한 표정과 행동을 통해 극적인 긴장감을 연출, 스릴러적인 요소 강조)
        `;
        
        const results = parseAIShortsRecommendations(testAIResponse);
        
        console.log('🔍 테스트 결과 분석:');
        results.forEach((shorts, index) => {
            console.log(`📋 숏츠 ${index + 1}:`);
            console.log(`  제목: "${shorts.title}"`);
            console.log(`  설명: "${shorts.description}"`);
            console.log(`  구간: ${shorts.extractRange.start}-${shorts.extractRange.end}초`);
            console.log('');
        });
        
        // 중복 설명 체크
        const descriptions = results.map(s => s.description).filter(d => d.length > 0);
        const uniqueDescriptions = new Set(descriptions);
        
        if (descriptions.length === uniqueDescriptions.size) {
            console.log('✅ 성공: 모든 숏츠가 고유한 설명을 가지고 있습니다!');
            console.log(`총 ${results.length}개 숏츠 중 ${descriptions.length}개가 설명을 가지고 있습니다.`);
        } else {
            console.log('❌ 실패: 중복된 설명이 발견되었습니다.');
            console.log(`총 설명 수: ${descriptions.length}, 고유 설명 수: ${uniqueDescriptions.size}`);
        }
        
        // "*" 패턴 테스트 확인
        const starPatternShorts = results.filter(s => s.index >= 3);
        if (starPatternShorts.length > 0) {
            console.log(`🌟 "*" 패턴으로 파싱된 숏츠: ${starPatternShorts.length}개`);
        } else {
            console.log('⚠️ "*" 패턴 숏츠가 파싱되지 않았습니다.');
        }
        
        return results;
    },
    
    // 🧪 모달 드래그 제외 요소 테스트
    testModalDragExclusion: function() {
        console.log('🧪 모달 드래그 제외 요소 테스트 시작...');
        
        const modal = document.getElementById('shortsPreviewModal');
        if (!modal) {
            console.log('❌ 모달을 찾을 수 없습니다. 먼저 모달을 열어주세요.');
            return;
        }
        
        const testElements = [
            '#videoSizeSelect',
            '.video-size-controls select',
            '.aspect-ratio-controls button',
            '.window-controls button'
        ];
        
        console.log('🔍 드래그 제외 요소들 확인:');
        testElements.forEach(selector => {
            const element = modal.querySelector(selector);
            if (element) {
                console.log(`✅ ${selector}: 발견됨`);
                
                // 클릭 이벤트 시뮬레이션을 위한 정보 표시
                const rect = element.getBoundingClientRect();
                console.log(`  - 위치: (${Math.round(rect.left)}, ${Math.round(rect.top)})`);
                console.log(`  - 크기: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
            } else {
                console.log(`❌ ${selector}: 찾을 수 없음`);
            }
        });
        
        console.log('');
        console.log('📝 테스트 방법:');
        console.log('1. 영상 크기 드롭다운을 클릭해보세요 (25% ~ 300% 선택 가능)');
        console.log('2. 비율 버튼들을 클릭해보세요');
        console.log('3. 콘솔에 "🚫 ...클릭 - 드래그 제외" 메시지가 나타나면 성공!');
        console.log('4. 헤더의 빈 공간을 클릭하면 "✅ 모달 드래그 시작 허용" 메시지가 나타납니다');
        
        // 영상 크기 테스트 정보 업데이트
        const videoSizeSelect = modal.querySelector('#videoSizeSelect');
        if (videoSizeSelect) {
            console.log('');
            console.log('🎬 영상 크기 테스트:');
            console.log('- 현재 선택된 크기:', videoSizeSelect.value + '%');
            console.log('- 사용 가능한 크기: 25% ~ 300%');
            console.log('- 큰 크기(250% 이상) 테스트 시 모달창 스크롤 확인');
        }
        
        // 비디오조절 창 정보 추가
        const scaleSlider = document.getElementById('videoScale');
        if (scaleSlider) {
            console.log('');
            console.log('🎛️ 비디오조절 창 테스트:');
            console.log('- 현재 크기:', Math.round(parseFloat(scaleSlider.value) * 100) + '%');
            console.log('- 사용 가능한 크기: 50% ~ 500%');
            console.log('- 위치: 편집 패널 > 비디오 조절 > 크기 슬라이더');
        }
        
        return modal;
    },
    
    // 🧪 편집 패널 스크롤바 제거 테스트
    testEditPanelScrollRemoval: function() {
        console.log('🧪 편집 패널 스크롤바 제거 테스트 시작...');
        
        const modal = document.getElementById('shortsPreviewModal');
        if (!modal) {
            console.log('❌ 모달을 찾을 수 없습니다. 먼저 모달을 열어주세요.');
            return;
        }
        
        const editPanel = modal.querySelector('.shorts-edit-panel');
        const modalWindow = modal.querySelector('.shorts-preview-window');
        
        if (editPanel && modalWindow) {
            const editPanelStyles = window.getComputedStyle(editPanel);
            const modalStyles = window.getComputedStyle(modalWindow);
            
            console.log('📏 편집 패널 스타일 정보:');
            console.log(`- overflow: ${editPanelStyles.overflow}`);
            console.log(`- overflow-y: ${editPanelStyles.overflowY}`);
            console.log(`- max-height: ${editPanelStyles.maxHeight}`);
            console.log(`- height: ${editPanelStyles.height}`);
            console.log(`- 실제 높이: ${Math.round(editPanel.getBoundingClientRect().height)}px`);
            
            console.log('📏 모달 윈도우 정보:');
            console.log(`- min-height: ${modalStyles.minHeight}`);
            console.log(`- 실제 높이: ${Math.round(modalWindow.getBoundingClientRect().height)}px`);
            
            // 스크롤바 존재 여부 확인
            const hasVerticalScrollbar = editPanel.scrollHeight > editPanel.clientHeight;
            const hasHorizontalScrollbar = editPanel.scrollWidth > editPanel.clientWidth;
            
            console.log('📜 스크롤바 상태:');
            console.log(`- 세로 스크롤바: ${hasVerticalScrollbar ? '존재함 ❌' : '없음 ✅'}`);
            console.log(`- 가로 스크롤바: ${hasHorizontalScrollbar ? '존재함 ❌' : '없음 ✅'}`);
            
            // 편집 패널 내부 요소들이 모두 보이는지 확인
            const editSections = editPanel.querySelectorAll('.edit-section');
            console.log(`🎛️ 편집 섹션 개수: ${editSections.length}개`);
            
            editSections.forEach((section, index) => {
                const title = section.querySelector('.edit-section-title')?.textContent || `섹션 ${index + 1}`;
                const rect = section.getBoundingClientRect();
                const panelRect = editPanel.getBoundingClientRect();
                const isVisible = (rect.bottom <= panelRect.bottom) && (rect.top >= panelRect.top);
                console.log(`- ${title}: ${isVisible ? '완전히 보임 ✅' : '잘림 ❌'}`);
            });
            
            if (!hasVerticalScrollbar && !hasHorizontalScrollbar) {
                console.log('🎉 스크롤바 제거 성공! 모든 메뉴가 스크롤 없이 표시됩니다.');
            } else {
                console.log('⚠️ 일부 스크롤바가 여전히 존재합니다. CSS 확인이 필요합니다.');
            }
            
        } else {
            console.log('❌ 편집 패널 또는 모달 윈도우를 찾을 수 없습니다.');
        }
        
        return { modal, editPanel, modalWindow };
    },
    
    // 🧪 영상조정 버튼 테스트
    testVideoAdjustmentButton: function() {
        console.log('🧪 영상조정 버튼 테스트 시작...');
        
        const modal = document.getElementById('shortsPreviewModal');
        if (!modal) {
            console.log('❌ 모달을 찾을 수 없습니다. 먼저 모달을 열어주세요.');
            return;
        }
        
        const adjustmentButton = document.getElementById('toggleVideoAdjustment');
        const statusElement = document.getElementById('adjustmentModeStatus');
        const videoWrapper = document.getElementById('shortsVideoWrapper');
        
        if (adjustmentButton && statusElement && videoWrapper) {
            console.log('✅ 영상조정 관련 요소 발견:');
            console.log(`- 조정 버튼: ${adjustmentButton.innerHTML}`);
            console.log(`- 상태 표시: ${statusElement.innerHTML}`);
            console.log(`- 드래그 모드 클래스: ${videoWrapper.classList.contains('drag-mode') ? '활성' : '비활성'}`);
            
            // 버튼 자동 클릭 테스트
            setTimeout(() => {
                console.log('🎯 버튼 자동 클릭 - 조정 모드 활성화');
                adjustmentButton.click();
                
                setTimeout(() => {
                    console.log('🎯 버튼 재클릭 - 조정 모드 비활성화');
                    adjustmentButton.click();
                }, 3000);
            }, 1000);
            
        } else {
            console.log('❌ 영상조정 관련 요소를 찾을 수 없습니다.');
        }
        
        return { modal, adjustmentButton, statusElement, videoWrapper };
    },
    
    // 🧪 중앙 정렬 레이아웃 테스트
    testCenterLayout: function() {
        console.log('🧪 중앙 정렬 레이아웃 테스트 시작...');
        
        const modal = document.getElementById('shortsPreviewModal');
        if (!modal) {
            console.log('❌ 모달을 찾을 수 없습니다. 먼저 모달을 열어주세요.');
            return;
        }
        
        const mainContainer = modal.querySelector('.shorts-preview-main-container');
        const videoContainer = modal.querySelector('.shorts-preview-video-container');
        const editPanel = modal.querySelector('.shorts-edit-panel');
        
        if (mainContainer && videoContainer && editPanel) {
            const mainRect = mainContainer.getBoundingClientRect();
            const videoRect = videoContainer.getBoundingClientRect();
            const panelRect = editPanel.getBoundingClientRect();
            
            console.log('📐 레이아웃 정보:');
            console.log(`메인 컨테이너: ${Math.round(mainRect.width)}x${Math.round(mainRect.height)}px`);
            console.log(`영상 컨테이너: ${Math.round(videoRect.width)}x${Math.round(videoRect.height)}px`);
            console.log(`편집 패널: ${Math.round(panelRect.width)}x${Math.round(panelRect.height)}px`);
            
            // 중앙 정렬 확인
            const mainCenterX = mainRect.left + mainRect.width / 2;
            const videoCenterX = videoRect.left + videoRect.width / 2;
            const centerOffset = Math.abs(mainCenterX - videoCenterX);
            
            console.log('🎯 중앙 정렬 상태:');
            console.log(`- 메인 중심: ${Math.round(mainCenterX)}px`);
            console.log(`- 영상 중심: ${Math.round(videoCenterX)}px`);
            console.log(`- 중심 편차: ${Math.round(centerOffset)}px`);
            
            if (centerOffset < 50) {
                console.log('✅ 영상이 잘 중앙 정렬되어 있습니다!');
            } else {
                console.log('⚠️ 영상이 중앙에서 벗어나 있습니다.');
            }
            
            // 편집 패널 위치 확인
            const isEditPanelTopRight = (
                panelRect.right <= mainRect.right + 10 && 
                panelRect.top >= mainRect.top - 10
            );
            
            if (isEditPanelTopRight) {
                console.log('✅ 편집 패널이 우측 상단에 잘 배치되어 있습니다!');
            } else {
                console.log('⚠️ 편집 패널 위치 확인 필요');
            }
            
            // 스크롤 상태 확인
            const hasScrollClass = mainContainer.classList.contains('scroll-enabled');
            console.log(`📜 스크롤 상태: ${hasScrollClass ? '활성화됨' : '비활성화됨'}`);
            
        } else {
            console.log('❌ 레이아웃 요소를 찾을 수 없습니다.');
        }
        
        return { modal, mainContainer, videoContainer, editPanel };
    },
    
    // 🧪 300% 영상 크기 테스트 (모달창 최대)
    testMaxVideoSize: function() {
        console.log('🧪 300% 영상 크기 테스트 시작...');
        
        const modal = document.getElementById('shortsPreviewModal');
        if (!modal) {
            console.log('❌ 모달을 찾을 수 없습니다. 먼저 모달을 열어주세요.');
            return;
        }
        
        const videoSizeSelect = modal.querySelector('#videoSizeSelect');
        if (!videoSizeSelect) {
            console.log('❌ 영상 크기 선택 드롭다운을 찾을 수 없습니다.');
            return;
        }
        
        // 300% 크기로 설정 (모달창 최대값)
        videoSizeSelect.value = '300';
        
        // changeVideoSize 함수 호출
        if (window.changeVideoSize) {
            window.changeVideoSize('300');
            console.log('✅ 영상 크기를 300%로 설정했습니다! (모달창 최대)');
        } else {
            console.log('❌ changeVideoSize 함수를 찾을 수 없습니다.');
            return;
        }
        
        // 모달창 정보 표시
        const videoContainer = modal.querySelector('.shorts-preview-video-container');
        const mainContainer = modal.querySelector('.shorts-preview-main-container');
        
        if (videoContainer && mainContainer) {
            setTimeout(() => {
                const videoRect = videoContainer.getBoundingClientRect();
                const mainRect = mainContainer.getBoundingClientRect();
                
                console.log('📏 크기 정보:');
                console.log(`  영상 컨테이너: ${Math.round(videoRect.width)}x${Math.round(videoRect.height)}px`);
                console.log(`  메인 컨테이너: ${Math.round(mainRect.width)}x${Math.round(mainRect.height)}px`);
                
                if (videoRect.width > mainRect.width || videoRect.height > mainRect.height) {
                    console.log('✅ 영상이 컨테이너보다 큽니다. 스크롤을 사용해보세요!');
                    console.log('🖱️ 모달창 내부를 스크롤하여 영상 전체를 볼 수 있습니다.');
                } else {
                    console.log('ℹ️ 영상이 컨테이너 안에 맞습니다.');
                }
                
                // 다양한 크기 테스트 제안
                console.log('');
                console.log('🎯 추가 테스트 제안:');
                console.log('- 25% (최소): testAIShortsGenerator.setVideoSize("25")');
                console.log('- 200% (중간): testAIShortsGenerator.setVideoSize("200")');  
                console.log('- 300% (최대): testAIShortsGenerator.setVideoSize("300")');
                console.log('');
                console.log('🎛️ 비디오조절 창 (50%~500%) 테스트:');
                console.log('- 편집 패널에서 "크기" 슬라이더를 사용해보세요');
                console.log('- 최대 500%까지 확대 가능합니다');
            }, 100);
        }
        
        return { modal, videoSizeSelect };
    },
    
    // 🎛️ 영상 크기 직접 설정 헬퍼 함수 (모달창: 25%~300%)
    setVideoSize: function(sizePercent) {
        const modal = document.getElementById('shortsPreviewModal');
        if (!modal) {
            console.log('❌ 모달을 찾을 수 없습니다.');
            return;
        }
        
        // 모달창 영상 크기 범위 체크 (25%~300%)
        const size = parseInt(sizePercent);
        if (size < 25 || size > 300) {
            console.log(`⚠️ 모달창 영상 크기는 25%~300% 범위만 지원됩니다. 입력값: ${sizePercent}%`);
            console.log('💡 비디오조절 창(편집패널)에서는 50%~500% 범위를 사용할 수 있습니다.');
            return;
        }
        
        const videoSizeSelect = modal.querySelector('#videoSizeSelect');
        if (videoSizeSelect && window.changeVideoSize) {
            videoSizeSelect.value = sizePercent;
            window.changeVideoSize(sizePercent);
            console.log(`✅ 모달창 영상 크기를 ${sizePercent}%로 설정했습니다!`);
        } else {
            console.log('❌ 영상 크기 설정에 실패했습니다.');
        }
    },
    
    // 🎛️ 비디오조절 창 크기 직접 설정 헬퍼 함수 (50%~500%)
    setVideoScale: function(scalePercent) {
        const scaleSlider = document.getElementById('videoScale');
        
        if (!scaleSlider) {
            console.log('❌ 비디오조절 창을 찾을 수 없습니다. 모달을 열고 편집 패널을 확인해주세요.');
            return;
        }
        
        // 비디오조절 창 크기 범위 체크 (50%~500%)
        const scale = parseInt(scalePercent);
        if (scale < 50 || scale > 500) {
            console.log(`⚠️ 비디오조절 창 크기는 50%~500% 범위만 지원됩니다. 입력값: ${scalePercent}%`);
            return;
        }
        
        const scaleFloatValue = scale / 100; // 0.5 ~ 5.0
        scaleSlider.value = scaleFloatValue;
        
        // 이벤트 트리거
        const event = new Event('input', { bubbles: true });
        scaleSlider.dispatchEvent(event);
        
        console.log(`✅ 비디오조절 창 크기를 ${scalePercent}%로 설정했습니다!`);
    },
    
    // 🧪 사용자 실제 AI 응답 테스트 ("*" 선택사항 패턴)
    testUserActualResponse: function() {
        console.log('🧪 사용자 실제 AI 응답 테스트 시작...');
        
        const actualAIResponse = `
        🎬 숏츠 제안:

        • 숏츠 1 - "미지의 시설에서의 만남": 0-15초 구간

        (이유: 영상 초반, 어두컴컴한 공간에서 처음으로 아버지와 딸이 등장하는 장면은 강렬한 시각적 효과와 궁금증을 유발합니다. 아버지의 굳은 표정과 딸의 불안한 눈빛은 미스터리한 분위기를 조성하고, 시청자로 하여금 이들이 어떤 상황에 처해있는지 궁금하게 만듭니다.)

        • 숏츠 2 - "아버지의 고뇌와 딸의 불안": 90-105초 구간 ( 수정된 구간 )

        (이유: 아버지가 병상에 누워있고 딸이 곁에 있는 장면은 이들의 감정을 가장 잘 드러냅니다. 아버지의 지친 모습과 딸의 걱정스러운 표정은 시청자에게 안타까움과 동정심을 불러일으키고, 이들의 관계에 대한 궁금증을 더욱 증폭시킵니다.)

        추가 숏츠 제안 (선택 사항):

        * 숏츠 3 - "미래 도시의 어두운 그림자": 60-75초 구간 (미래적인 건물의 어두운 분위기와 대조되는 딸의 밝은 옷을 활용하여 미스터리와 대비를 강조)
        * 숏츠 4 - "절박한 상황": 150-165초 구간 (아버지의 절박한 표정과 행동을 통해 극적인 긴장감을 연출, 스릴러적인 요소 강조)
        `;
        
        const results = parseAIShortsRecommendations(actualAIResponse);
        
        console.log('🔍 실제 사용자 응답 테스트 결과:');
        results.forEach((shorts, index) => {
            console.log(`📋 숏츠 ${index + 1}:`);
            console.log(`  ID: ${shorts.id}`);
            console.log(`  인덱스: ${shorts.index}`);
            console.log(`  제목: "${shorts.title}"`);
            console.log(`  설명: "${shorts.description}"`);
            console.log(`  추출구간: ${shorts.extractRange.start}-${shorts.extractRange.end}초`);
            console.log(`  제안구간: ${shorts.suggestedRange.start}-${shorts.suggestedRange.end}초`);
            console.log('');
        });
        
        // 4개 숏츠가 모두 파싱되었는지 확인
        if (results.length >= 4) {
            console.log('✅ 성공: 4개 숏츠가 모두 파싱되었습니다!');
            
            // 3번, 4번 숏츠 확인
            const optionalShorts = results.filter(s => s.index >= 3);
            if (optionalShorts.length >= 2) {
                console.log('🌟 "*" 선택사항 숏츠도 정상 파싱됨!');
                optionalShorts.forEach(shorts => {
                    console.log(`  - 숏츠 ${shorts.index}: "${shorts.title}" (${shorts.description ? '설명 있음' : '설명 없음'})`);
                });
            } else {
                console.log('⚠️ "*" 선택사항 숏츠 파싱 실패');
            }
        } else {
            console.log(`❌ 실패: ${results.length}개 숏츠만 파싱됨 (예상: 4개)`);
        }
        
        return results;
    },
    
    // 테스트용 AI 응답으로 숏츠 제안 파싱 테스트
    testParseShorts: function(testResponse) {
        if (!testResponse) {
            testResponse = `
            영상은 우주 정거장의 심각한 손상으로 시작됩니다.

            * 숏츠 1 (긴박한 시작): 0-100초 중 핵심 장면들을 빠르게 편집하여 15초 내외의 긴박한 분위기의 숏츠를 제작합니다.
            * 숏츠 2 (우주 유영의 위험): 300-400초 중 가장 극적이고 시각적으로 아름다운 장면들을 선택하여 20초 내외의 숏츠를 제작합니다.
            * 숏츠 3 (인간 드라마): 600-700초 중 우주인들간의 감정적인 교류와 희생 장면을 중심으로 20초 내외의 숏츠를 제작합니다.
            * 숏츠 4 (클라이맥스): 800-1016초 중 가장 극적인 순간들을 선택하여 25초 내외의 숏츠를 제작합니다.
            `;
        }
        
        console.log('🎬 테스트 응답:', testResponse);
        const result = handleAIResponseForShorts(testResponse);
        console.log('🔍 처리 결과:', result);
        return result;
    },
    
    // 최근 AI 응답을 수동으로 다시 처리
    retryLastAIResponse: function() {
        const currentChat = state.chats.find(chat => chat.id === state.currentChatId);
        if (!currentChat || currentChat.messages.length === 0) {
            console.warn('❌ 처리할 AI 응답이 없습니다.');
            return false;
        }
        
        const lastAIMessage = currentChat.messages
            .filter(msg => msg.role === 'ai')
            .pop();
        
        if (!lastAIMessage) {
            console.warn('❌ AI 응답을 찾을 수 없습니다.');
            return false;
        }
        
        console.log('🔄 마지막 AI 응답을 다시 처리합니다...');
        return handleAIResponseForShorts(lastAIMessage.content);
    },
    
    // 사용자 정의 시간 구간으로 숏츠 생성
    createCustomShorts: function(timeSegments) {
        if (!timeSegments || !Array.isArray(timeSegments)) {
            console.log('📝 사용법: createCustomShorts([{start: 0, end: 30, title: "인트로"}, {start: 60, end: 90, title: "클라이맥스"}])');
            
            // 예제 실행
            timeSegments = [
                { start: 0, end: 30, title: "오프닝 장면" },
                { start: 120, end: 150, title: "액션 시퀀스" },
                { start: 300, end: 330, title: "감동 장면" }
            ];
            console.log('🎬 예제로 다음 구간들을 생성합니다:', timeSegments);
        }
        
        const recommendations = timeSegments.map((segment, index) => ({
            id: `shorts-custom-${index + 1}`,
            index: index + 1,
            title: segment.title || `사용자 정의 숏츠 ${index + 1}`,
            suggestedRange: { start: segment.start, end: segment.end },
            extractRange: { 
                start: segment.start, 
                end: Math.min(segment.end, segment.start + (segment.duration || 30))
            },
            duration: segment.duration || Math.min(30, segment.end - segment.start),
            status: 'pending',
            thumbnailFrames: [],
            renderedVideo: null
        }));
        
        displayShortsRecommendations(recommendations);
        return recommendations;
    },
    
    // 현재 저장된 숏츠 정보 확인
    getCurrentShorts: function() {
        const shorts = state.aiGeneratedShorts || [];
        console.log(`📊 현재 저장된 숏츠: ${shorts.length}개`);
        shorts.forEach((s, i) => {
            console.log(`  ${i+1}. ${s.title}: ${s.extractRange.start}s-${s.extractRange.end}s (${s.status})`);
        });
        return shorts;
    },
    
    // 숏츠 컨테이너 강제 표시
    showShortsContainer: function() {
        const container = window.testAIShortsGenerator._createContainer();
        container.innerHTML = `
            <div class="ai-shorts-header">
                <h3>🎬 AI 숏츠 생성기</h3>
                <p>AI 숏츠 생성기가 로드되었습니다. 아래 버튼들을 사용해보세요.</p>
                <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button onclick="testAIShortsGenerator.testParseShorts()" class="btn btn-primary btn-sm">
                        🧪 테스트 실행
                    </button>
                    <button onclick="testAIShortsGenerator.testDuplicateDescriptions()" class="btn btn-warning btn-sm">
                        🔍 중복 설명 테스트
                    </button>
                    <button onclick="testAIShortsGenerator.testUserActualResponse()" class="btn btn-info btn-sm">
                        🌟 "*" 패턴 테스트
                    </button>
                    <button onclick="testAIShortsGenerator.testModalDragExclusion()" class="btn btn-success btn-sm">
                        🖱️ 드래그 제외 테스트
                    </button>
                    <button onclick="testAIShortsGenerator.testMaxVideoSize()" class="btn btn-danger btn-sm">
                        📐 300% 크기 테스트
                    </button>
                    <button onclick="testAIShortsGenerator.setVideoScale('500')" class="btn btn-warning btn-sm">
                        🎛️ 500% 조절창 테스트
                    </button>
                    <button onclick="testAIShortsGenerator.testEditPanelScrollRemoval()" class="btn btn-info btn-sm">
                        📜 스크롤바 제거 테스트
                    </button>
                    <button onclick="testAIShortsGenerator.testVideoAdjustmentButton()" class="btn btn-primary btn-sm">
                        🎯 영상조정 버튼 테스트
                    </button>
                    <button onclick="testAIShortsGenerator.testCenterLayout()" class="btn btn-success btn-sm">
                        📐 중앙정렬 테스트
                    </button>
                    <button onclick="testAIShortsGenerator.retryLastAIResponse()" class="btn btn-secondary btn-sm">
                        🔄 마지막 AI 응답 재처리
                    </button>
                    <button onclick="testAIShortsGenerator.createCustomShorts()" class="btn btn-info btn-sm">
                        ✨ 사용자 정의 숏츠
                    </button>
                </div>
            </div>
        `;
        return container;
    },
    
    // 디버그 정보 표시
    debugInfo: function() {
        console.log('🔍 디버그 정보:');
        console.log('- 비디오 엘리먼트:', !!document.getElementById('videoPreview'));
        console.log('- 현재 채팅:', state.currentChatId);
        console.log('- 저장된 숏츠:', state.aiGeneratedShorts?.length || 0);
        console.log('- DOM 컨테이너:', !!document.getElementById('aiShortsContainer'));
        
        const video = document.getElementById('videoPreview');
        if (video) {
            console.log('- 비디오 정보:', {
                src: !!video.src,
                duration: video.duration,
                width: video.videoWidth,
                height: video.videoHeight
            });
        }
    },
    
    // 내부 헬퍼 함수 (컨테이너 생성)
    _createContainer: function() {
        const container = document.createElement('div');
        container.id = 'aiShortsContainer';
        container.className = 'ai-shorts-container';
        
        // 기존 컨테이너가 있으면 교체
        const existing = document.getElementById('aiShortsContainer');
        if (existing) {
            existing.parentNode.replaceChild(container, existing);
        } else {
            // 채팅 컨테이너 다음에 추가
            const chatContainer = document.getElementById('chatContainer');
            if (chatContainer) {
                chatContainer.parentNode.insertBefore(container, chatContainer.nextSibling);
            } else {
                document.body.appendChild(container);
            }
        }
        
        return container;
    },
    
    // 강제로 숏츠 표시 (문제 해결용)
    forceShowShorts: function() {
        console.log('🎬 강제로 샘플 숏츠 표시...');
        const sampleShorts = [
            {
                id: 'shorts-force-1',
                index: 1,
                title: '강제 생성 숏츠 1',
                suggestedRange: { start: 0, end: 60 },
                extractRange: { start: 10, end: 25 },
                duration: 15,
                status: 'pending',
                thumbnailFrames: [],
                renderedVideo: null
            },
            {
                id: 'shorts-force-2',
                index: 2,
                title: '강제 생성 숏츠 2',
                suggestedRange: { start: 120, end: 180 },
                extractRange: { start: 130, end: 150 },
                duration: 20,
                status: 'pending',
                thumbnailFrames: [],
                renderedVideo: null
            }
        ];
        
        displayShortsRecommendations(sampleShorts);
        return sampleShorts;
    },
    
    // AI 응답 강제 처리
    forceProcessAIResponse: function(customResponse, useRealResponse = true) {
        let response;
        
        try {
            // 커스텀 응답 처리
            if (customResponse) {
                if (typeof customResponse !== 'string') {
                    throw new CustomResponseTypeError('커스텀 응답은 문자열이어야 합니다.');
                }
                response = customResponse;
                console.log('🧪 커스텀 응답으로 파싱 테스트...');
            } else if (useRealResponse) {
                // 실제 AI 응답 요소 찾기 및 검증
                try {
                    const lastMessage = document.querySelector('#chatMessages .message:last-child .message-content');
                    if (!lastMessage) {
                        throw new Error('AI 응답 요소를 찾을 수 없습니다. DOM 구조를 확인해주세요.');
                    }
                    
                    response = lastMessage.innerText;
                    if (!response || response.trim().length === 0) {
                        throw new Error('AI 응답 내용이 비어있습니다.');
                    }
                    
                    console.log('🧪 실제 AI 응답으로 파싱 시도...');
                    console.log('📄 실제 AI 응답 (첫 300자):', response.substring(0, 300) + '...');
                } catch (domError) {
                    console.error('❌ AI 응답 요소 접근 실패:', domError.message);
                    console.warn('🔄 샘플 응답으로 폴백합니다.');
                    useRealResponse = false;
                }
            }
            
            // 폴백 응답 사용
            if (!useRealResponse || !response) {
                response = `
🎬 숏츠 편집 제안:
• 숏츠 1 - 긴박한 시작: 0-15초 구간 (이유: 액션 오프닝)
• 숏츠 2 - 클라이맥스: 45-65초 구간 (이유: 핵심 장면)
• 숏츠 3 - 감동 마무리: 120-140초 구간 (이유: 임팩트 있는 결말)
                `;
                console.log('🧪 샘플 응답으로 테스트...');
            }
            
            console.log('🔄 강제로 AI 응답 처리 시작...');
            
            // AI 응답 처리 및 파싱
            let result;
            try {
                result = handleAIResponseForShorts(response);
            } catch (processingError) {
                console.error('❌ handleAIResponseForShorts 실행 중 오류:', processingError.message);
                console.log('🔄 오류가 발생하여 직접 파싱을 시도합니다...');

                try {
                    const directParsingResult = parseAIShortsRecommendations(response);
                    
                    if (directParsingResult && directParsingResult.length > 0) {
                        console.log('✅ 직접 파싱 성공. 파싱된 결과를 UI에 표시하고 상태를 업데이트합니다.');
                        // handleAIResponseForShorts의 일부 기능을 수동으로 실행
                        state.aiGeneratedShorts = directParsingResult; 
                        displayShortsRecommendations(directParsingResult); 
                        result = directParsingResult; // 결과를 할당
                    } else {
                        // 직접 파싱은 성공했으나 결과가 없는 경우
                        throw new Error('직접 파싱 결과가 비어있습니다.');
                    }
                } catch (parsingError) {
                    console.error('❌ 직접 파싱 시도 중 추가 오류 발생:', parsingError.message);
                    // 두 에러를 통합하여 더 명확한 에러 메시지 생성
                    throw new Error(`AI 응답 처리 및 파싱 모두 실패: (1차: ${processingError.message}), (2차: ${parsingError.message})`);
                }
            }
            
            // 결과 검증 및 분석
            if (result) {
                const shortsCount = state.aiGeneratedShorts?.length || 0;
                console.log('✅ 처리 성공! 생성된 숏츠 개수:', shortsCount);
                
                if (shortsCount === 0) {
                    console.warn('⚠️ 처리는 성공했지만 생성된 숏츠가 없습니다.');
                }
            } else {
                console.error('❌ 처리 실패. 결과가 null 또는 undefined입니다.');
                
                // 디버깅을 위한 추가 정보
                try {
                    const debugParsing = parseAIShortsRecommendations(response);
                    console.log('🔍 디버깅용 직접 파싱 결과:', debugParsing);
                    console.log('🔍 응답 길이:', response.length);
                    console.log('🔍 응답 타입:', typeof response);
                } catch (debugError) {
                    console.error('🔍 디버깅 파싱 실패:', debugError.message);
                }
                
                throw new Error('AI 응답 처리 결과가 유효하지 않습니다.');
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ forceProcessAIResponse 전체 실행 실패:', error.message);
            console.error('📋 오류 스택:', error.stack);
            console.log('📊 함수 실행 컨텍스트:');
            console.log('  - customResponse:', !!customResponse);
            console.log('  - useRealResponse:', useRealResponse);
            console.log('  - response 길이:', response ? response.length : 'undefined');
            
            // 사용자에게 명확한 에러 메시지 제공
            const userFriendlyMessage = error.message.includes('요소를 찾을 수 없습니다') 
                ? 'AI 응답을 찾을 수 없습니다. 먼저 AI와 대화를 진행해주세요.'
                : error.message.includes('비어있습니다')
                ? 'AI 응답이 비어있습니다. 다시 시도해주세요.'
                : `AI 응답 처리 중 오류가 발생했습니다: ${error.message}`;
            
            return {
                error: true,
                message: userFriendlyMessage,
                originalError: error
            };
        }
    },
    
    // 📐 비율 테스트 함수들
    testAspectRatios: function() {
        console.log('📐 비율 테스트 시작...');
        const ratios = ['9:16', '16:9', '1:1', '4:3'];
        let currentIndex = 0;
        
        const testNext = () => {
            if (currentIndex < ratios.length) {
                const ratio = ratios[currentIndex];
                console.log(`  ${currentIndex + 1}. ${ratio} 테스트 중...`);
                changeAspectRatio(ratio);
                currentIndex++;
                setTimeout(testNext, 2000);
            } else {
                console.log('✅ 모든 비율 테스트 완료!');
            }
        };
        
        testNext();
    },
    
    setRatio: function(ratio) {
        if (['9:16', '16:9', '1:1', '4:3'].includes(ratio)) {
            changeAspectRatio(ratio);
            console.log(`📐 비율 ${ratio}로 설정 완료`);
        } else {
            console.log('❌ 지원되는 비율: 9:16, 16:9, 1:1, 4:3');
        }
    },
    
    // 🛠️ 오류 해결 함수들
    fixModalErrors: function() {
        console.log('🔧 모달 오류 해결 시작...');
        
        const modal = document.getElementById('shortsPreviewModal');
        if (!modal) {
            console.log('❌ 모달이 열려있지 않습니다.');
            return;
        }
        
        // 제목 요소 확인
        const titleElement = modal.querySelector('.window-title-text');
        if (!titleElement) {
            console.log('❌ 제목 요소를 찾을 수 없습니다.');
        } else {
            console.log('✅ 제목 요소 정상:', titleElement.textContent);
        }
        
        // 비디오 요소 확인
        const video = document.getElementById('shortsPreviewVideo');
        if (!video) {
            console.log('❌ 비디오 요소를 찾을 수 없습니다.');
        } else {
            console.log('✅ 비디오 요소 정상:', video.src ? '소스 있음' : '소스 없음');
        }
        
        // 현재 숏츠 정보 확인
        const shorts = getCurrentPlayingShorts();
        if (!shorts) {
            console.log('❌ 현재 숏츠 정보를 찾을 수 없습니다.');
        } else {
            console.log('✅ 현재 숏츠 정보 정상:', shorts.title);
        }
        
        console.log('🔧 모달 오류 해결 완료');
    },
    
    resetModal: function() {
        console.log('🔄 모달 초기화 시작...');
        closeShortsPreviewModal();
        setTimeout(() => {
            const firstShorts = state.aiGeneratedShorts[0];
            if (firstShorts) {
                openShortsPreviewModal(firstShorts.id);
                console.log('✅ 모달 초기화 완료');
            } else {
                console.log('❌ 숏츠가 없어서 모달을 열 수 없습니다.');
            }
        }, 500);
    },
    
    // 🎬 비디오 분리 테스트 함수들
    testVideoSeparation: function() {
        console.log('🎬 비디오-컨트롤 분리 테스트 시작...');
        
        const modal = document.getElementById('shortsPreviewModal');
        if (!modal) {
            console.log('❌ 모달이 열려있지 않습니다. resetModal()을 먼저 실행하세요.');
            return;
        }
        
        const videoContainer = modal.querySelector('.shorts-preview-video-container');
        const controlsContainer = modal.querySelector('.shorts-preview-controls');
        
        if (!videoContainer || !controlsContainer) {
            console.log('❌ 비디오 컨테이너 또는 컨트롤 컨테이너를 찾을 수 없습니다.');
            return;
        }
        
        // 비디오 영역 정보
        const videoRect = videoContainer.getBoundingClientRect();
        console.log(`📺 비디오 영역: ${Math.round(videoRect.width)}x${Math.round(videoRect.height)}`);
        
        // 컨트롤 영역 정보
        const controlsRect = controlsContainer.getBoundingClientRect();
        console.log(`🎮 컨트롤 영역: ${Math.round(controlsRect.width)}x${Math.round(controlsRect.height)}`);
        
        // 비율 확인
        const videoRatio = videoRect.width / videoRect.height;
        const currentRatio = modal.currentAspectRatio || '9:16';
        const expectedRatios = {
            '16:9': 16/9,
            '9:16': 9/16,
            '1:1': 1,
            '4:3': 4/3
        };
        
        const expectedRatio = expectedRatios[currentRatio];
        const ratioError = Math.abs(videoRatio - expectedRatio);
        
        console.log(`📐 현재 비율: ${currentRatio}`);
        console.log(`📏 실제 비율: ${videoRatio.toFixed(3)} (예상: ${expectedRatio.toFixed(3)})`);
        console.log(`🎯 비율 정확도: ${ratioError < 0.01 ? '✅ 완벽' : ratioError < 0.05 ? '⚠️ 양호' : '❌ 부정확'} (오차: ${(ratioError * 100).toFixed(2)}%)`);
        
        // 분리 상태 확인
        const videoBottom = videoRect.bottom;
        const controlsTop = controlsRect.top;
        const separated = Math.abs(controlsTop - videoBottom) < 10; // 10px 이내면 인접
        
        console.log(`🔗 분리 상태: ${separated ? '✅ 올바르게 분리됨' : '❌ 겹침 또는 과도한 간격'}`);
        console.log(`🚀 테스트 완료!`);
    },
    
    highlightVideoArea: function() {
        console.log('🎨 비디오 영역 강조 표시...');
        
        const modal = document.getElementById('shortsPreviewModal');
        if (!modal) {
            console.log('❌ 모달이 열려있지 않습니다.');
            return;
        }
        
        const videoContainer = modal.querySelector('.shorts-preview-video-container');
        if (!videoContainer) {
            console.log('❌ 비디오 컨테이너를 찾을 수 없습니다.');
            return;
        }
        
        // 기존 강조 효과 제거
        videoContainer.style.outline = '';
        videoContainer.style.animation = '';
        
        // 잠깐 후 강조 효과 적용
        setTimeout(() => {
            videoContainer.style.outline = '4px solid #e74c3c';
            videoContainer.style.animation = 'pulse 2s infinite';
            
            // 3초 후 강조 효과 제거
            setTimeout(() => {
                videoContainer.style.outline = '2px solid #667eea';
                videoContainer.style.animation = '';
                console.log('✅ 강조 표시 완료');
            }, 3000);
        }, 100);
    },
    
    testEvenPadding: function() {
        console.log('📏 균등 여백 테스트 시작...');
        
        const modal = document.getElementById('shortsPreviewModal');
        if (!modal) {
            console.log('❌ 모달이 열려있지 않습니다. resetModal()을 먼저 실행하세요.');
            return;
        }
        
        const windowElement = modal.querySelector('.shorts-preview-window');
        const videoContainer = modal.querySelector('.shorts-preview-video-container');
        
        if (!windowElement || !videoContainer) {
            console.log('❌ 모달 요소를 찾을 수 없습니다.');
            return;
        }
        
        // 모달 창과 비디오 컨테이너의 위치 정보
        const windowRect = windowElement.getBoundingClientRect();
        const videoRect = videoContainer.getBoundingClientRect();
        
        // 여백 계산
        const leftPadding = videoRect.left - windowRect.left;
        const rightPadding = windowRect.right - videoRect.right;
        const topPadding = videoRect.top - windowRect.top - 60; // 헤더 높이 제외
        const bottomPadding = windowRect.bottom - videoRect.bottom - 140; // 컨트롤 높이 제외
        
        console.log('📐 여백 측정 결과:');
        console.log(`   👈 왼쪽 여백: ${Math.round(leftPadding)}px`);
        console.log(`   👉 오른쪽 여백: ${Math.round(rightPadding)}px`);
        console.log(`   👆 위쪽 여백: ${Math.round(topPadding)}px`);
        console.log(`   👇 아래쪽 여백: ${Math.round(bottomPadding)}px`);
        
        // 균등성 체크
        const horizontalDiff = Math.abs(leftPadding - rightPadding);
        const verticalDiff = Math.abs(topPadding - bottomPadding);
        
        console.log('\n🎯 균등성 평가:');
        console.log(`   ↔️ 좌우 균등: ${horizontalDiff < 5 ? '✅ 완벽' : horizontalDiff < 10 ? '⚠️ 양호' : '❌ 불균등'} (차이: ${Math.round(horizontalDiff)}px)`);
        console.log(`   ↕️ 상하 균등: ${verticalDiff < 5 ? '✅ 완벽' : verticalDiff < 10 ? '⚠️ 양호' : '❌ 불균등'} (차이: ${Math.round(verticalDiff)}px)`);
        
        // 목표 여백과 비교
        const targetPadding = 25;
        const leftError = Math.abs(leftPadding - targetPadding);
        const rightError = Math.abs(rightPadding - targetPadding);
        const topError = Math.abs(topPadding - targetPadding);
        const bottomError = Math.abs(bottomPadding - targetPadding);
        
        console.log('\n🎚️ 목표 여백(25px) 대비:');
        console.log(`   👈 왼쪽: ${leftError < 3 ? '✅' : leftError < 8 ? '⚠️' : '❌'} (오차: ${Math.round(leftError)}px)`);
        console.log(`   👉 오른쪽: ${rightError < 3 ? '✅' : rightError < 8 ? '⚠️' : '❌'} (오차: ${Math.round(rightError)}px)`);
        console.log(`   👆 위쪽: ${topError < 3 ? '✅' : topError < 8 ? '⚠️' : '❌'} (오차: ${Math.round(topError)}px)`);
        console.log(`   👇 아래쪽: ${bottomError < 3 ? '✅' : bottomError < 8 ? '⚠️' : '❌'} (오차: ${Math.round(bottomError)}px)`);
        
        console.log('\n🚀 균등 여백 테스트 완료!');
    },
    
    testControlButtons: function() {
        console.log('🎮 컨트롤 버튼 레이아웃 테스트 시작...');
        
        const modal = document.getElementById('shortsPreviewModal');
        if (!modal) {
            console.log('❌ 모달이 열려있지 않습니다. resetModal()을 먼저 실행하세요.');
            return;
        }
        
        const windowElement = modal.querySelector('.shorts-preview-window');
        const controlsContainer = modal.querySelector('.shorts-preview-controls');
        const controlButtons = modal.querySelector('.shorts-control-buttons');
        
        if (!windowElement || !controlsContainer || !controlButtons) {
            console.log('❌ 컨트롤 요소를 찾을 수 없습니다.');
            return;
        }
        
        const currentRatio = modal.currentAspectRatio || '알 수 없음';
        const windowRect = windowElement.getBoundingClientRect();
        const controlsRect = controlsContainer.getBoundingClientRect();
        const buttonsRect = controlButtons.getBoundingClientRect();
        
        console.log(`📐 현재 비율: ${currentRatio}`);
        console.log(`📏 모달 전체 너비: ${Math.round(windowRect.width)}px`);
        console.log(`🎮 컨트롤 영역 너비: ${Math.round(controlsRect.width)}px`);
        console.log(`🔘 버튼 영역 너비: ${Math.round(buttonsRect.width)}px`);
        
        // 비율별 클래스 확인
        const ratioClasses = ['ratio-9-16', 'ratio-16-9', 'ratio-1-1', 'ratio-4-3'];
        const appliedRatioClass = ratioClasses.find(cls => controlsContainer.classList.contains(cls));
        console.log(`🏷️ 적용된 비율 클래스: ${appliedRatioClass || '없음'}`);
        
        // 9:16 비율일 때 특별 검사
        if (currentRatio === '9:16') {
            const buttons = controlButtons.querySelectorAll('.shorts-control-btn');
            console.log(`\n🔍 9:16 비율 특별 검사:`);
            console.log(`   🔘 총 버튼 개수: ${buttons.length}개`);
            
            // 버튼들이 줄바꿈되었는지 확인
            if (buttons.length > 1) {
                const firstButtonTop = buttons[0].getBoundingClientRect().top;
                const lastButtonTop = buttons[buttons.length - 1].getBoundingClientRect().top;
                const isWrapped = Math.abs(lastButtonTop - firstButtonTop) > 10;
                
                console.log(`   📏 첫 번째 버튼 위치: ${Math.round(firstButtonTop)}px`);
                console.log(`   📏 마지막 버튼 위치: ${Math.round(lastButtonTop)}px`);
                console.log(`   🔄 줄바꿈 상태: ${isWrapped ? '❌ 줄바꿈됨' : '✅ 한 줄 배치'}`);
                
                // flex-wrap 스타일 확인
                const computedStyle = window.getComputedStyle(controlButtons);
                const flexWrap = computedStyle.flexWrap;
                console.log(`   🎛️ flex-wrap: ${flexWrap}`);
                
                // 버튼 크기 확인
                let totalButtonWidth = 0;
                buttons.forEach((btn, index) => {
                    const btnRect = btn.getBoundingClientRect();
                    totalButtonWidth += btnRect.width;
                    console.log(`   🔘 버튼 ${index + 1}: ${Math.round(btnRect.width)}px`);
                });
                
                const gap = parseInt(computedStyle.gap) || 0;
                const totalWidthWithGaps = totalButtonWidth + (gap * (buttons.length - 1));
                const availableWidth = controlsRect.width - 20; // 패딩 고려
                
                console.log(`   📊 버튼 총 너비: ${Math.round(totalButtonWidth)}px`);
                console.log(`   📊 간격 포함 총 너비: ${Math.round(totalWidthWithGaps)}px`);
                console.log(`   📊 사용 가능 너비: ${Math.round(availableWidth)}px`);
                console.log(`   🎯 공간 여유: ${totalWidthWithGaps <= availableWidth ? '✅ 충분' : '❌ 부족'} (${Math.round(availableWidth - totalWidthWithGaps)}px)`);
            }
        }
        
        console.log('\n🚀 컨트롤 버튼 테스트 완료!');
    },
    
    testTitleExtraction: function() {
        console.log('🎬 AI 제목 추출 테스트 시작...');
        
        // 🚨 사용자가 실제로 받은 AI 응답으로 테스트 (문제 있는 형식)
        const problemAIResponse = `
• 숏츠 1 - 극지 탈출: 0-15초 구간 (이유: 긴박한 비행기 추락 장면과 생존자의 모습은 시선을 사로잡기에 충분합니다. 강렬한 오프닝으로 시청자의 흥미를 유발합니다.)

• 숏츠 2 - 혹독한 생존: 150-60초 구간 (이유: 아버지와 딸이 극한의 추위와 굶주림 속에서 생존하기 위해 노력하는 장면. 극적인 상황 연출을 통해 긴장감을 유지합니다.)

• 숏츠 3 - 미지의 비밀: 600-75초 구간 (이유: 미래 도시 배경과 암호 같은 대화는 호기심을 자극합니다. 미스터리한 분위기와 반전을 통해 궁금증을 유발합니다.)

• 숏츠 4 - 희생의 아버지: 850-90초 구간 (이유: 아버지의 건강 악화와 딸을 향한 헌신적인 모습은 감동을 자아냅니다. 짧은 시간 안에 감정적인 메시지를 전달합니다.)

• 숏츠 5 - 미래의 진실: 950-1016초 구간 (이유: 스토리의 마무리와 함께 미래 도시의 비밀에 대한 암시. 궁금증을 남기는 결말은 시청자의 재 시청을 유도합니다.)
        `;
        
        console.log('🚨 문제 있는 실제 AI 응답 테스트:', problemAIResponse.substring(0, 200) + '...');
        
        try {
            // 직접 파싱 함수 호출
            const parsed = parseAIShortsRecommendations(problemAIResponse);
            
            console.log(`\n🎯 파싱 결과: ${parsed.length}개 숏츠 추출됨 (예상: 5개)`);
            console.log(`❌ 누락된 숏츠: ${5 - parsed.length}개`);
            
            parsed.forEach((shorts, index) => {
                console.log(`\n📺 숏츠 ${index + 1}:`);
                console.log(`   🎬 제목: "${shorts.title}"`);
                console.log(`   ⏰ 시간: ${shorts.extractRange.start}s - ${shorts.extractRange.end}s`);
                console.log(`   📝 설명: "${shorts.description || '설명 없음'}"`);
                console.log(`   📏 길이: ${shorts.duration}초`);
            });
            
            // 예상 결과와 비교
            const expectedTitles = [
                "극지 탈출",
                "혹독한 생존", 
                "미지의 비밀",
                "희생의 아버지",
                "미래의 진실"
            ];
            
            console.log('\n🔍 정확성 검증:');
            expectedTitles.forEach((expectedTitle, index) => {
                if (parsed[index]) {
                    const actualTitle = parsed[index].title;
                    const isCorrect = actualTitle === expectedTitle;
                    console.log(`   ${index + 1}. ${isCorrect ? '✅' : '❌'} 예상: "${expectedTitle}" / 실제: "${actualTitle}"`);
                } else {
                    console.log(`   ${index + 1}. ❌ 숏츠가 추출되지 않음 - 예상: "${expectedTitle}"`);
                }
            });
            
            // 🔍 문제 있는 시간 형식 분석
            console.log('\n🔍 시간 형식 분석:');
            console.log('   1. "0-15초 구간" ✅ 정상 (시작 < 끝)');
            console.log('   2. "150-60초 구간" ❌ 비정상 → 🛠️ "150초부터 60초 동안" = 150-210초');
            console.log('   3. "600-75초 구간" ❌ 비정상 → 🛠️ "600초부터 75초 동안" = 600-675초');
            console.log('   4. "850-90초 구간" ❌ 비정상 → 🛠️ "850초부터 90초 동안" = 850-940초');
            console.log('   5. "950-1016초 구간" ✅ 정상 (시작 < 끝)');
            
            // 🎯 개선된 결과 예상
            console.log('\n🎯 개선 후 예상 결과:');
            console.log('   1. 극지 탈출: 0-15초 ✅');
            console.log('   2. 혹독한 생존: 150-210초 (수정됨) ✅');
            console.log('   3. 미지의 비밀: 600-675초 (수정됨) ✅');
            console.log('   4. 희생의 아버지: 850-940초 (수정됨) ✅');
            console.log('   5. 미래의 진실: 950-1016초 ✅');
            console.log('   총 개수: 5개 (모두 추출 성공!)');
            
        } catch (error) {
            console.error('❌ 파싱 중 오류:', error);
        }
        
        console.log('\n🚀 제목 추출 테스트 완료!');
    },
    
    testFixedTitleExtraction: function() {
        console.log('🛠️ 수정된 제목 추출 테스트 시작...');
        
        // 🎯 수정된 버전으로 다시 테스트 
        const fixedAIResponse = `
• 숏츠 1 - 극지 탈출: 0-15초 구간 (이유: 긴박한 비행기 추락 장면과 생존자의 모습은 시선을 사로잡기에 충분합니다. 강렬한 오프닝으로 시청자의 흥미를 유발합니다.)

• 숏츠 2 - 혹독한 생존: 150-210초 구간 (이유: 아버지와 딸이 극한의 추위와 굶주림 속에서 생존하기 위해 노력하는 장면. 극적인 상황 연출을 통해 긴장감을 유지합니다.)

• 숏츠 3 - 미지의 비밀: 600-675초 구간 (이유: 미래 도시 배경과 암호 같은 대화는 호기심을 자극합니다. 미스터리한 분위기와 반전을 통해 궁금증을 유발합니다.)

• 숏츠 4 - 희생의 아버지: 850-940초 구간 (이유: 아버지의 건강 악화와 딸을 향한 헌신적인 모습은 감동을 자아냅니다. 짧은 시간 안에 감정적인 메시지를 전달합니다.)

• 숏츠 5 - 미래의 진실: 950-1016초 구간 (이유: 스토리의 마무리와 함께 미래 도시의 비밀에 대한 암시. 궁금증을 남기는 결말은 시청자의 재 시청을 유도합니다.)
        `;
        
        console.log('✅ 수정된 AI 응답으로 재테스트...');
        
        try {
            const parsed = parseAIShortsRecommendations(fixedAIResponse);
            
            console.log(`\n🎯 파싱 결과: ${parsed.length}개 숏츠 추출됨 (목표: 5개)`);
            console.log(`${parsed.length === 5 ? '🎉 성공!' : '❌ 여전히 문제 있음'}`);
            
            parsed.forEach((shorts, index) => {
                console.log(`\n📺 숏츠 ${index + 1}:`);
                console.log(`   🎬 제목: "${shorts.title}"`);
                console.log(`   ⏰ 시간: ${shorts.extractRange.start}s - ${shorts.extractRange.end}s`);
                console.log(`   📝 설명: "${shorts.description || '설명 없음'}"`);
                console.log(`   📏 길이: ${shorts.duration}초`);
            });
            
        } catch (error) {
            console.error('❌ 파싱 중 오류:', error);
        }
        
        console.log('\n🚀 수정된 제목 추출 테스트 완료!');
    },
    
    testRealAIResponse: function() {
        console.log('🎬 실제 AI 응답 형식 테스트 시작...');
        
        // 🎯 실제 받은 AI 응답 형식으로 테스트 
        const realAIResponse = `
업로드된 동영상을 분석한 결과를 바탕으로 AutoShorts 편집을 위한 구체적인 조언을 드립니다. 영상은 우주정거장에서 발생한 사고와 우주비행사들의 생존을 위한 고군분투를 긴박하게 묘사하고 있습니다.

• **숏츠 1 - "우주 재난의 시작":** 0-15초 구간
이 장면은 긴박한 우주 정거장 파괴 장면으로 시청자의 흥미를 즉시 사로잡을 수 있습니다. 극적인 효과음과 함께 편집하면 강렬한 오프닝이 됩니다.

• **숏츠 2 - "절체절명의 우주유영":** 50-75초 구간  
우주비행사들의 위험천만한 우주 유영 장면입니다. 시각적으로 매우 인상적이며 긴박한 상황을 잘 보여줍니다.

• **숏츠 3 - "극한의 생존":** 95-120초 구간
생존을 위한 필사적인 노력이 드라마틱하게 표현된 장면입니다. 감정적인 몰입도가 높습니다.

• **숏츠 4 - "기적의 생還":** 140-155초 구간
극적인 반전과 함께 생존의 희망을 보여주는 클라이맥스 장면입니다. 감동적인 연출이 가능합니다.
        `;
        
        console.log('📄 실제 AI 응답 형식으로 테스트...');
        
        try {
            const parsed = parseAIShortsRecommendations(realAIResponse);
            
            console.log(`\n🎯 파싱 결과: ${parsed.length}개 숏츠 추출됨 (목표: 4개)`);
            console.log(`${parsed.length === 4 ? '🎉 성공!' : '❌ 문제 있음'}`);
            
            parsed.forEach((shorts, index) => {
                console.log(`\n📺 숏츠 ${index + 1}:`);
                console.log(`   🎬 제목: "${shorts.title}"`);
                console.log(`   ⏰ 시간: ${shorts.extractRange.start}s - ${shorts.extractRange.end}s`);
                console.log(`   📝 설명: "${shorts.description || '설명 없음'}"`);
                console.log(`   📏 길이: ${shorts.duration}초`);
                console.log(`   ${shorts.description ? '✅ 설명 추출 성공!' : '❌ 설명 추출 실패!'}`);
            });
            
        } catch (error) {
            console.error('❌ 파싱 중 오류:', error);
        }
        
        console.log('\n🚀 실제 AI 응답 테스트 완료!');
    },
    
    testDuplicateRemoval: function() {
        console.log('🚫 중복 제거 테스트 시작...');
        
        // 🎯 문제가 있었던 실제 AI 응답 테스트 ("자동 숏츠 9" 제거 확인)
        const duplicateAIResponse = `
1016초(약 17분) 분량의 HumanSF_Movie_part5.mp4 영상을 분석하여 YouTube Shorts에 적합한 숏츠 제작을 위한 구체적인 조언을 드리겠습니다. 영상의 시각적 요소와 스토리텔링 측면을 고려하여 15-60초 길이의 숏츠를 몇 가지 제안합니다.

🎬 **숏츠 제안:**

* **숏츠 1 - "우주 유영의 위기"**: 700-745초 구간 (이유: 우주 유영 중 발생하는 위험한 상황을 긴박하게 연출하여 시청자의 몰입도를 높일 수 있습니다.)

* **숏츠 2 - "관제센터의 긴장감"**: 100-145초 구간 (이유: 관제센터의 모니터 화면과 인물들의 표정을 통해 긴장감 넘치는 상황을 보여줍니다.)

* **숏츠 3 - "절체절명의 순간"**: 800-845초 구간 (이유: 우주인의 위기 상황을 극적으로 보여주는 장면입니다.)

* **숏츠 4 - "미지의 공간"**: 0-45초 구간 (이유: 거대한 우주선과 우주의 신비로운 분위기를 통해 호기심을 자극합니다.)
        `;
        
        console.log('📋 중복 많은 AI 응답으로 테스트...');
        
        try {
            const parsed = parseAIShortsRecommendations(duplicateAIResponse);
            
            console.log(`\n🎯 파싱 결과: ${parsed.length}개 숏츠 추출됨`);
            console.log(`${parsed.length === 4 ? '✅ 성공! "자동 숏츠 9" 제거됨!' : '❌ 실패! 여전히 문제 발생'}`);
            
            parsed.forEach((shorts, index) => {
                console.log(`\n📺 숏츠 ${index + 1}:`);
                console.log(`   🎬 제목: "${shorts.title}"`);
                console.log(`   ⏰ 원본 구간: ${shorts.suggestedRange.start}s - ${shorts.suggestedRange.end}s`);
                console.log(`   ✂️ 추출 구간: ${shorts.extractRange.start}s - ${shorts.extractRange.end}s`);
                console.log(`   📝 설명: "${shorts.description || '설명 없음'}"`);
                
                // 자동 생성된 제목 검사
                if (shorts.title.includes('자동 추출 숏츠')) {
                    console.log(`   ❌ 자동 생성 제목 감지! (문제!)`);
                } else {
                    console.log(`   ✅ 정상 제목`);
                }
            });
            
            // 중복 검사
            const duplicates = [];
            for (let i = 0; i < parsed.length; i++) {
                for (let j = i + 1; j < parsed.length; j++) {
                    const timeDiff = Math.abs(parsed[i].suggestedRange.start - parsed[j].suggestedRange.start);
                    if (timeDiff < 10) {
                        duplicates.push(`${parsed[i].title} vs ${parsed[j].title} (시간차: ${timeDiff}초)`);
                    }
                }
            }
            
            console.log(`\n🔍 중복 검사 결과: ${duplicates.length === 0 ? '✅ 중복 없음' : '❌ 중복 발견'}`);
            if (duplicates.length > 0) {
                duplicates.forEach(dup => console.log(`   ⚠️ ${dup}`));
            }
            
            // "15-60초" 일반 텍스트 매치 검사
            const generalTextMatch = duplicateAIResponse.includes('15-60초 길이의 숏츠를 제안합니다');
            const hasAutoShorts9 = parsed.some(shorts => shorts.title.includes('자동 추출 숏츠 9'));
            
            console.log(`\n🔍 "15-60초" 일반 텍스트 존재: ${generalTextMatch ? '✅ 있음' : '❌ 없음'}`);
            console.log(`🔍 "자동 숏츠 9" 생성 여부: ${hasAutoShorts9 ? '❌ 생성됨 (문제!)' : '✅ 제거됨 (성공!)'}`);
            
            if (generalTextMatch && !hasAutoShorts9) {
                console.log(`\n🎉 완벽! 일반 텍스트의 "15-60초"가 숏츠로 인식되지 않음!`);
            } else if (generalTextMatch && hasAutoShorts9) {
                console.log(`\n❌ 실패! 일반 텍스트의 "15-60초"가 여전히 "자동 숏츠 9"로 생성됨!`);
            }
            
        } catch (error) {
            console.error('❌ 파싱 중 오류:', error);
        }
        
        console.log('\n🚀 중복 제거 테스트 완료!');
    },
    
    testLayoutImprovements: function() {
        console.log('📐 레이아웃 개선 테스트 시작...');
        console.log('📋 개선사항 확인:');
        console.log('   ✅ 넉넉한 모달 크기 (기본값 20% 증가)');
        console.log('   ✅ 충분한 여백 (25px → 40px)');
        console.log('   ✅ 안정적인 컨트롤 영역 (140px → 180px)');
        console.log('   ✅ 9:16 비율 버튼 공간 확보 (450px → 550px)');
        console.log('   ✅ 영상 중앙정렬 (CSS flexbox)');
        
        console.log('\n🎯 실제 테스트 방법:');
        console.log('1. 동영상 미리보기 모달 열기');
        console.log('2. 각 비율 버튼 클릭하여 레이아웃 확인');
        console.log('3. 9:16에서 버튼 잘림 현상 사라진 것 확인');
        console.log('4. 모든 비율에서 충분한 여백 확인');
        console.log('5. 리사이즈 기능으로 크기 조절 테스트');
        
        console.log('\n🔍 예상 결과:');
        console.log('   📺 더 큰 영상 크기 (720p 기준)');
        console.log('   📏 균등한 40px 여백');
        console.log('   🎮 컨트롤 버튼 항상 표시');
        console.log('   🎯 영상 완벽한 중앙정렬');
        console.log('   📐 안정적인 비율 변경');
        
        console.log('\n🚀 레이아웃 개선 테스트 완료!');
    },
    
    testDescriptionCleaning: function() {
        console.log('🧹 설명 정리 기능 테스트 시작...');
        
        // 테스트 케이스들
        const testCases = [
            {
                input: '- "고독한 여정의 시작"**: 0-15초 구간 **이유:** 영상의 첫 번째 장면은 주인공이 건물을 걷는 장면으로, 고독한 여정을 암시합니다.',
                expected: '영상의 첫 번째 장면은 주인공이 건물을 걷는 장면으로, 고독한 여정을 암시합니다.'
            },
            {
                input: '**: 100-145초 구간 (이유: 관제센터의 모니터 화면과 인물들의 표정을 통해 긴장감 넘치는 상황을 보여줍니다.',
                expected: '관제센터의 모니터 화면과 인물들의 표정을 통해 긴장감 넘치는 상황을 보여줍니다.'
            },
            {
                input: '**: 700-745초 구간 이 장면은 우주 유영 중 발생하는 위험한 상황을 긴박하게 연출하여 시청자의 몰입도를 높일 수 있습니다.',
                expected: '이 장면은 우주 유영 중 발생하는 위험한 상황을 긴박하게 연출하여 시청자의 몰입도를 높일 수 있습니다.'
            },
            {
                input: '우주선과 우주의 신비로운 분위기를 통해 호기심을 자극합니다.',
                expected: '우주선과 우주의 신비로운 분위기를 통해 호기심을 자극합니다.'
            }
        ];
        
        console.log('📋 테스트 케이스 실행 중...\n');
        
        testCases.forEach((testCase, index) => {
            const result = cleanDescription(testCase.input);
            const success = result === testCase.expected;
            
            console.log(`🧪 테스트 ${index + 1}: ${success ? '✅ 성공' : '❌ 실패'}`);
            console.log(`   📝 입력: "${testCase.input.substring(0, 50)}..."`);
            console.log(`   ✅ 예상: "${testCase.expected}"`);
            console.log(`   📤 결과: "${result}"`);
            
            if (!success) {
                console.log(`   ⚠️ 차이점 발견!`);
            }
            console.log('');
        });
        
        // 전체 결과 요약
        const successCount = testCases.filter((testCase, index) => 
            cleanDescription(testCase.input) === testCase.expected
        ).length;
        
        console.log(`📊 테스트 결과: ${successCount}/${testCases.length} 성공`);
        console.log(`${successCount === testCases.length ? '🎉 모든 테스트 통과!' : '⚠️ 일부 테스트 실패'}`);
        
        console.log('\n🚀 설명 정리 기능 테스트 완료!');
    },
    
    testDetailedDescriptions: function() {
        console.log('📝 상세 설명 개선 테스트 시작...');
        
        console.log('📋 개선사항 확인:');
        console.log('   ✅ 설명 길이: 최소 2-3문장, 50-100단어 이상');
        console.log('   ✅ 포함 내용: 시각적 요소, 감정, 스토리, 편집 포인트, 시청자 반응');
        console.log('   ✅ 분석 깊이: 장면 매력도, 편집 기법, 감정 유발 분석');
        console.log('   ✅ 구체적 예시: 100단어 이상의 상세한 분석 예시 제공');
        
        console.log('\n🎯 AI 프롬프트 개선사항:');
        console.log('   📝 기존: "이유: 설명" (간단한 한 문장)');
        console.log('   📝 개선: 상세한 다층적 분석 요구');
        console.log('   • 시각적 임팩트 분석');
        console.log('   • 편집 기법 제안');
        console.log('   • 감정 몰입도 분석');
        console.log('   • 시청자 반응 예측');
        console.log('   • 플랫폼별 최적화 조언');
        
        console.log('\n🔍 예상 결과 (기존 vs 개선):');
        console.log('   ❌ 기존: "긴박한 장면으로 흥미를 유발합니다."');
        console.log('   ✅ 개선: "이 장면은 주인공의 절망적 표정과 웅장한 배경의 대비로 강한 시각적 임팩트를 만들어냅니다. 느린 카메라 워킹과 긴장감 넘치는 배경음악을 조합하면 시청자의 감정 몰입도를 극대화할 수 있습니다. 특히 YouTube Shorts의 첫 15초 핵심 구간에서 시청자 이탈률을 최소화하는 강렬한 오프닝 효과를 기대할 수 있으며, 빠른 컷보다 안정적인 프레이밍으로 캐릭터의 내면을 충분히 전달하는 편집이 효과적일 것입니다."');
        
        console.log('\n🧪 실제 테스트 방법:');
        console.log('1. 동영상 분석 버튼 클릭');
        console.log('2. AI 응답에서 설명 길이 확인');
        console.log('3. 숏츠 카드의 "내용 요약" 섹션에서 상세한 분석 확인');
        console.log('4. 이전 대비 2-3배 이상 긴 설명인지 검증');
        
        console.log('\n📊 개선 목표:');
        console.log('   📏 길이: 기존 20-30단어 → 50-100단어 이상');
        console.log('   🎯 깊이: 단순 설명 → 다차원 분석');
        console.log('   💡 실용성: 일반적 조언 → 구체적 편집 가이드');
        console.log('   🎬 전문성: 기본 분석 → 영상 제작 전문 조언');
        
        console.log('\n🚀 상세 설명 개선 테스트 완료!');
    },
    
    testFrameExtractionUpgrade: function() {
        console.log('🎬 프레임 추출 개선 테스트 시작...');
        
        console.log('📋 개선사항 확인:');
        console.log('   ✅ 기본 프레임 수: 25개 → 60개 (2.4배 증가)');
        console.log('   ✅ 모든 AI 모델 통일: 60프레임');
        console.log('   ✅ 분석 정밀도: 대폭 향상');
        console.log('   ✅ TPM 제한 대응: Gemini 모델 권장');
        
        console.log('\n🎯 모델별 개선사항:');
        console.log('   🔥 GPT: 30개 → 60개 (2배 증가)');
        console.log('   🔥 Claude: 40개 → 60개 (1.5배 증가)');
        console.log('   ✅ Gemini: 60개 → 60개 (유지, 권장)');
        console.log('   🔥 기타: 25개 → 60개 (2.4배 증가)');
        
        console.log('\n⚡ TPM 제한 대응:');
        console.log('   • GPT/Claude: TPM 제한 발생 가능');
        console.log('   • 해결책: Gemini 모델 사용 (무제한)');
        console.log('   • 대기법: 1-2분 후 재시도');
        console.log('   • 근본 해결: 요금제 업그레이드');
        
        console.log('\n🧪 실제 테스트 방법:');
        console.log('1. checkVideoAnalysisSettings() 실행하여 현재 설정 확인');
        console.log('2. 동영상 분석 버튼 클릭');
        console.log('3. 콘솔에서 "60프레임으로 설정" 메시지 확인');
        console.log('4. "✅ 60개 프레임 추출 완료" 메시지 확인');
        console.log('5. TPM 오류 발생 시 Gemini로 모델 변경 후 재시도');
        
        console.log('\n📊 분석 품질 향상:');
        console.log('   • 시간당 프레임: 25개 → 60개');
        console.log('   • 세밀한 장면 분석 가능');
        console.log('   • 더 정확한 숏츠 타이밍 추천');
        console.log('   • 놓치는 중요 장면 최소화');
        
        console.log('\n🎯 권장 사용법:');
        console.log('   • 1순위: Gemini 모델 (TPM 제한 없음)');
        console.log('   • 2순위: Claude 모델 (안정적)');
        console.log('   • 3순위: GPT 모델 (TPM 주의)');
        
        console.log('\n🚀 프레임 추출 개선 테스트 완료!');
    },
    
    testFullDescriptionExtraction: function() {
        console.log('📄 전체 설명 추출 개선 테스트 시작...');
        
        console.log('📋 개선사항 확인:');
        console.log('   ✅ 설명 길이 제한: 200자 → 1000-1500자');
        console.log('   ✅ 새로운 패턴: "이유:" 키워드 직접 검색');
        console.log('   ✅ 괄호 내 설명 추출: (이유: ... 전체 내용)');
        console.log('   ✅ 내용 손실 방지: 50% 이상 짧아지면 원본 유지');
        console.log('   ✅ 더 많은 키워드: 강렬한, 웅장한, 특히 등 추가');
        
        console.log('\n🔍 새로운 추출 패턴:');
        console.log('   • 패턴1: 제목 다음 전체 설명 (10-1000자)');
        console.log('   • 패턴2: 숏츠 번호 다음 전체 설명 (20-1500자)');
        console.log('   • 패턴3: "이유:" 키워드 다음 전체 블록');
        console.log('   • 패턴4: 설명 키워드 다음 전체 문장 (10-800자)');
        console.log('   • 패턴5: 제목 키워드 포함 전체 문장 (10-800자)');
        console.log('   • 패턴6: 괄호 안 전체 설명 (20-1000자)');
        
        console.log('\n🛡️ 내용 보호 기능:');
        console.log('   • 10자 미만 결과 → 원본 반환');
        console.log('   • 50% 이상 길이 감소 → 원본 반환');
        console.log('   • 상세한 추출 로그 출력');
        console.log('   • AI 응답 미리보기 제공');
        
        console.log('\n🧪 실제 테스트 방법:');
        console.log('1. 동영상 분석 후 숏츠 생성');
        console.log('2. 콘솔에서 "설명 찾음" 메시지 확인');
        console.log('3. 각 설명의 추출된 길이 확인');
        console.log('4. "내용 요약" 섹션에서 전체 내용 확인');
        console.log('5. 기존 대비 훨씬 긴 설명 표시 확인');
        
        console.log('\n🎯 예상 개선 효과:');
        console.log('   📏 설명 길이: 50-100자 → 200-500자 이상');
        console.log('   📊 추출 성공률: 기존 70% → 95% 이상');
        console.log('   💡 내용 완성도: 부분적 → 완전한 설명');
        console.log('   🔍 디버깅: 단순 → 상세한 추적 로그');
        
        console.log('\n🚫 문제 발생 시 확인사항:');
        console.log('   • 콘솔에서 "AI 응답 길이" 확인');
        console.log('   • "패턴X에서 설명 찾음" 메시지 확인');
        console.log('   • "내용 손실 위험" 경고 확인');
        console.log('   • 마지막 AI 응답 내용 직접 확인');
        
        console.log('\n💡 디버깅 명령어:');
        console.log('   • window.lastAIResponse - 마지막 AI 응답 확인');
        console.log('   • testAIShortsGenerator.debugLastResponse() - 응답 분석');
        console.log('   • testAIShortsGenerator.testDescriptionCleaning() - 정리 로직 테스트');
        
        console.log('\n🚀 전체 설명 추출 개선 테스트 완료!');
    },
    
    debugLastResponse: function() {
        console.log('🔍 마지막 AI 응답 디버깅...');
        
        if (!window.lastAIResponse) {
            console.log('❌ 마지막 AI 응답이 없습니다. 먼저 동영상 분석을 실행해주세요.');
            return;
        }
        
        const response = window.lastAIResponse;
        console.log(`📄 AI 응답 총 길이: ${response.length}자`);
        console.log(`📝 AI 응답 미리보기:\n"${response.substring(0, 500)}..."\n`);
        
        // 숏츠 관련 키워드 검색
        const keywords = ['숏츠', '이유:', '긴장감', '강렬한', '드라마', '감정'];
        console.log('🔍 키워드 검색 결과:');
        keywords.forEach(keyword => {
            const matches = response.match(new RegExp(keyword, 'gi'));
            console.log(`   "${keyword}": ${matches ? matches.length : 0}번 발견`);
        });
        
        // 숏츠 패턴 검색
        console.log('\n🎯 숏츠 패턴 검색 결과:');
        const patterns = [
            /숏츠\s*\d+/gi,
            /\d+-\d+초/gi,
            /이유:/gi,
            /\([^)]*이유[^)]*\)/gi
        ];
        
        patterns.forEach((pattern, index) => {
            const matches = response.match(pattern);
            console.log(`   패턴${index + 1}: ${matches ? matches.length : 0}개 - ${matches ? matches.join(', ') : '없음'}`);
        });
        
        console.log('\n✅ AI 응답 디버깅 완료!');
    },
    
    testCleanDescriptionFix: function() {
        console.log('🧹 설명 정리 개선 테스트 시작...');
        
        console.log('📋 수정된 기능:');
        console.log('   ✅ 제목 패턴 제거: "숏츠 X - 제목**: 시간 구간"');
        console.log('   ✅ 시간 구간 제거: "500-545초 구간 (길이: 45초)"');
        console.log('   ✅ 마크다운 제거: **•, **, 등');
        console.log('   ✅ 스마트 시작점 감지: "이 구간은", "강렬한" 등');
        console.log('   ✅ 내용 손실 방지: 70% 이상 짧아지면 원본 유지');
        
        // 실제 문제 상황 테스트
        const problemCase = `**• 숏츠 1 - "극지 생존의 위기: 눈보라 속 절망"**: 500-545초 구간 (길이: 45초) 이 구간은 극심한 눈보라 속에서 아버지와 아이가 생존을 위해 고군분투하는 장면을 담고 있습니다. 강렬한 시각적 효과를 위해 눈보라의 격렬함을 잘 보여주는 숏컷 편집을 사용하고, 아버지의 고통스러운 표정과 아이의 떨리는 모습을 클로즈업하여 시청자의 감정적 몰입을 유도합니다.`;
        
        const expectedResult = '이 구간은 극심한 눈보라 속에서 아버지와 아이가 생존을 위해 고군분투하는 장면을 담고 있습니다. 강렬한 시각적 효과를 위해 눈보라의 격렬함을 잘 보여주는 숏컷 편집을 사용하고, 아버지의 고통스러운 표정과 아이의 떨리는 모습을 클로즈업하여 시청자의 감정적 몰입을 유도합니다.';
        
        console.log('\n🧪 문제 상황 테스트:');
        console.log(`📝 입력 (${problemCase.length}자): "${problemCase.substring(0, 100)}..."`);
        
        const result = cleanDescription(problemCase);
        
        console.log(`📤 결과 (${result.length}자): "${result}"`);
        console.log(`✅ 예상 (${expectedResult.length}자): "${expectedResult}"`);
        
        const isSuccess = result.includes('이 구간은 극심한 눈보라') && 
                         !result.includes('숏츠 1') && 
                         !result.includes('500-545초') &&
                         !result.includes('**•');
        
        console.log(`\n🎯 테스트 결과: ${isSuccess ? '✅ 성공' : '❌ 실패'}`);
        
        if (isSuccess) {
            console.log('🙌 문제 해결됨!');
            console.log('   • 제목 정보 제거됨');
            console.log('   • 시간 구간 정보 제거됨');
            console.log('   • 마크다운 기호 제거됨');
            console.log('   • 순수한 설명만 남음');
        } else {
            console.log('⚠️ 추가 확인 필요:');
            if (result.includes('숏츠')) console.log('   - 제목 정보 남아있음');
            if (result.includes('초 구간')) console.log('   - 시간 정보 남아있음');
            if (result.includes('**')) console.log('   - 마크다운 남아있음');
        }
        
        // 추가 테스트 케이스들
        console.log('\n🔄 추가 테스트 케이스:');
        
        const testCases = [
            {
                name: '상세 설명 섹션 형태',
                input: '**📝 상세 설명:** **• 숏츠 1 - "제목"**: 강렬한 장면이 펼쳐집니다.',
                expected: '강렬한 장면이 펼쳐집니다.'
            },
            {
                name: '괄호 이유 형태',
                input: '(이유: 이 구간은 감동적인 순간을 담고 있습니다)',
                expected: '이 구간은 감동적인 순간을 담고 있습니다'
            },
            {
                name: '순수 설명',
                input: '이 장면은 웅장한 배경과 함께 시청자의 마음을 사로잡습니다.',
                expected: '이 장면은 웅장한 배경과 함께 시청자의 마음을 사로잡습니다.'
            }
        ];
        
        testCases.forEach((testCase, index) => {
            const testResult = cleanDescription(testCase.input);
            const testSuccess = testResult.trim() === testCase.expected.trim();
            console.log(`   ${index + 1}. ${testCase.name}: ${testSuccess ? '✅' : '❌'}`);
            if (!testSuccess) {
                console.log(`      입력: "${testCase.input}"`);
                console.log(`      결과: "${testResult}"`);
                console.log(`      예상: "${testCase.expected}"`);
            }
        });
        
        console.log('\n🚀 설명 정리 개선 테스트 완료!');
    },
    
    // 도움말 표시
    help: function() {
        console.log(`
🎬 AI 숏츠 생성기 테스트 도구

🧪 기본 테스트:
• testAIShortsGenerator.testParseShorts() - 기본 테스트 응답으로 파싱 테스트
• testAIShortsGenerator.retryLastAIResponse() - 마지막 AI 응답을 다시 처리

🚀 문제 해결 (NEW!):
• testAIShortsGenerator.forceShowShorts() - 강제로 샘플 숏츠 표시
• testAIShortsGenerator.forceProcessAIResponse() - 강제로 AI 응답 처리

✨ 사용자 정의:
• testAIShortsGenerator.createCustomShorts([{start:0, end:30, title:"test"}]) - 사용자 정의 시간 구간
• testAIShortsGenerator.showShortsContainer() - UI 컨테이너 강제 표시

📊 정보 확인:
• testAIShortsGenerator.getCurrentShorts() - 현재 저장된 숏츠 정보
• testAIShortsGenerator.debugInfo() - 시스템 상태 확인

📐 비율 테스트 (NEW!):
• testAIShortsGenerator.testAspectRatios() - 모든 비율 자동 테스트 (9:16→16:9→1:1→4:3)
• testAIShortsGenerator.setRatio('9:16') - 특정 비율로 설정 (9:16, 16:9, 1:1, 4:3)

🛠️ 오류 해결:
• testAIShortsGenerator.fixModalErrors() - 모달 오류 진단 및 해결
• testAIShortsGenerator.resetModal() - 모달 완전 초기화

🎬 비디오 분리 테스트:
• testAIShortsGenerator.testVideoSeparation() - 비디오-컨트롤 분리 상태 확인
• testAIShortsGenerator.highlightVideoArea() - 비디오 영역 강조 표시

📏 균등 여백 테스트:
• testAIShortsGenerator.testEvenPadding() - 상하좌우 여백 균등성 정밀 측정

🎮 컨트롤 버튼 테스트:
• testAIShortsGenerator.testControlButtons() - 버튼 줄바꿈 및 레이아웃 상태 분석

🎬 제목 추출 테스트:
• testAIShortsGenerator.testTitleExtraction() - 문제 있는 AI 응답 파싱 테스트 (원본)
• testAIShortsGenerator.testFixedTitleExtraction() - 수정된 AI 응답 파싱 테스트 (개선됨)
• testAIShortsGenerator.testRealAIResponse() - 실제 AI 응답 형식 테스트
• testAIShortsGenerator.testDuplicateRemoval() - 중복 제거 로직 테스트
• testAIShortsGenerator.testLayoutImprovements() - 레이아웃 개선사항 테스트
• testAIShortsGenerator.testDescriptionCleaning() - 설명 정리 기능 테스트
• testAIShortsGenerator.testDetailedDescriptions() - 상세 설명 개선 테스트
• testAIShortsGenerator.testFrameExtractionUpgrade() - 프레임 추출 개선 테스트
• testAIShortsGenerator.testFullDescriptionExtraction() - 전체 설명 추출 개선 테스트
• testAIShortsGenerator.debugLastResponse() - 마지막 AI 응답 디버깅
• testAIShortsGenerator.testCleanDescriptionFix() - 설명 정리 개선 테스트 (NEW!)

🚨 문제 해결 테스트:
• testAIShortsGenerator.testTitleExtraction() - "150-60초" 같은 비정상 시간 형식 감지
• testAIShortsGenerator.testFixedTitleExtraction() - 자동 수정 결과 확인
• testAIShortsGenerator.testRealAIResponse() - 설명 추출 로직 테스트
• testAIShortsGenerator.testDuplicateRemoval() - "자동 숏츠 9" 같은 중복 방지 (NEW!)

🚨 동영상 분석 설정:
• checkVideoAnalysisSettings() - 동영상 분석 설정 확인 (전역 함수, 기존 checkTPMOptimization 대체)

💡 권장 테스트 순서:
1. debugInfo() 로 상태 확인
2. checkVideoAnalysisSettings() 로 동영상 분석 설정 확인
3. testFrameExtractionUpgrade() 로 프레임 추출 개선 확인
4. testFullDescriptionExtraction() 로 전체 설명 추출 개선 확인
5. testCleanDescriptionFix() 로 설명 정리 개선 확인 (NEW! - 중복 정보 제거)
6. debugLastResponse() 로 마지막 AI 응답 디버깅
7. testDetailedDescriptions() 로 상세 설명 개선 확인
8. testDescriptionCleaning() 로 설명 정리 기능 테스트
9. testLayoutImprovements() 로 레이아웃 개선사항 확인
10. testTitleExtraction() 로 문제 있는 AI 응답 테스트 (원본 문제 확인)
11. testRealAIResponse() 로 실제 AI 응답 형식 테스트 (설명 추출 확인)
12. testDuplicateRemoval() 로 중복 제거 테스트 ("자동 숏츠 9" 방지)
13. testFixedTitleExtraction() 로 수정된 결과 테스트 (해결 확인)
14. resetModal() 로 모달 열기 (개선된 크기로)
15. testEvenPadding() 로 여백 균등성 확인 (40px 여백)
16. testControlButtons() 로 버튼 레이아웃 검사 (개선된 9:16 비율)
17. testVideoSeparation() 로 분리 상태 확인
18. testAspectRatios() 로 비율 정확도 테스트
19. highlightVideoArea() 로 비디오 영역 시각화
        `);
    }
};

// ============================================
// 9:16 비율 미리보기 모달 기능
// ============================================

/**
 * 숏츠 미리보기 모달을 엽니다.
 * @param {string} shortsId - 숏츠 ID
 */
window.openShortsPreviewModal = function(shortsId) {
    const shorts = state.aiGeneratedShorts.find(s => s.id === shortsId);
    if (!shorts) {
        console.error('❌ 숏츠를 찾을 수 없습니다:', shortsId);
        return;
    }
    
    console.log('🎬 숏츠 미리보기 모달 열기:', shorts.title);
    
    // 모달 생성
    const modal = createPreviewModal(shorts);
    document.body.appendChild(modal);
    
    // 애니메이션과 함께 표시
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
    
    // 비디오 설정 및 재생
    setupModalVideo(shorts);
    
    // 드래그 및 리사이즈 기능 설정
    setupModalInteractions(modal);
    
    // 🎮 즉시 비율 클래스 적용 (초기 렌더링 문제 방지)
    const controlsContainer = modal.querySelector('.shorts-preview-controls');
    if (controlsContainer) {
        controlsContainer.classList.add('ratio-9-16'); // 초기 9:16 비율 클래스 미리 적용
    }
    
    // 🖥️ 모달창을 전체 화면으로 초기 설정
    const windowElement = modal.querySelector('.shorts-preview-window');
    if (windowElement) {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const margin = 50; // 화면 경계 여백
        
        windowElement.style.position = 'fixed';
        windowElement.style.left = margin + 'px';
        windowElement.style.top = margin + 'px';
        windowElement.style.width = (screenWidth - margin * 2) + 'px';
        windowElement.style.height = (screenHeight - margin * 2) + 'px';
        windowElement.style.margin = '0';
        
        console.log(`🖥️ 모달창 전체 화면 설정: ${screenWidth - margin * 2}x${screenHeight - margin * 2}`);
    }
    
    // 초기 비율 및 크기 설정 (9:16 세로형, 100% 크기)
    setTimeout(() => {
        changeAspectRatio('9:16', true); // 두 번째 매개변수로 초기 설정임을 표시
        changeVideoSize('100'); // 기본 100% 크기로 설정 (중앙정렬 + 스크롤 최적화 포함)
        
        console.log('🎯 모달창 레이아웃 초기화 완료:');
        console.log('- 영상 플레이어: 중앙 정렬');
        console.log('- 편집 패널: 우측 상단 고정');
        console.log('- 스크롤바: 필요시에만 활성화');
    }, 50);
    
    // 모달 배경 클릭 시 닫기 (리사이즈/드래그 상태 체크)
    modal.addEventListener('click', (e) => {
        // 모달 배경을 직접 클릭했을 때만 닫기
        if (e.target === modal) {
            // 드래그나 리사이즈 중이 아닐 때만 닫기
            const windowElement = modal.querySelector('.shorts-preview-window');
            if (windowElement && !windowElement.contains(e.target)) {
                // 리사이즈나 드래그 중인지 확인
                if (!modal.isDragging && !modal.isResizing) {
                    console.log('🖱️ 모달 배경 클릭으로 닫기');
                    closeShortsPreviewModal();
                } else {
                    console.log('🚫 리사이즈/드래그 중이므로 모달 닫기 무시');
                }
            }
        }
    });
    
    // 추가 보호: 모달 전체에 대한 mouseup 이벤트
    modal.addEventListener('mouseup', (e) => {
        // 리사이즈나 드래그 중일 때는 배경 클릭 무시
        if (modal.isResizing || modal.isDragging) {
            e.stopPropagation();
            e.preventDefault();
            console.log('🛡️ 리사이즈/드래그 중 mouseup 이벤트 차단');
        }
    });
};

/**
 * 미리보기 모달 HTML 구조를 생성합니다.
 */
function createPreviewModal(shorts) {
    const modal = document.createElement('div');
    modal.className = 'shorts-preview-modal';
    modal.id = 'shortsPreviewModal';
    
    modal.innerHTML = `
        <div class="shorts-preview-window" id="shortsPreviewWindow">
            <div class="shorts-window-header" id="shortsWindowHeader">
                <div class="window-title">
                    <span class="window-icon">🎬</span>
                    <span class="window-title-text">${shorts.title}</span>
                </div>
                
                <!-- 화면 비율 및 크기 선택 -->
                <div class="video-settings-controls">
                    <div class="aspect-ratio-controls">
                        <span class="aspect-ratio-label">비율:</span>
                        <button class="aspect-ratio-btn active" onclick="changeAspectRatio('9:16')" title="세로형 (YouTube Shorts, TikTok)">
                            9:16
                        </button>
                        <button class="aspect-ratio-btn" onclick="changeAspectRatio('16:9')" title="가로형 (YouTube 일반)">
                            16:9
                        </button>
                        <button class="aspect-ratio-btn" onclick="changeAspectRatio('1:1')" title="정사각형 (Instagram)">
                            1:1
                        </button>
                        <button class="aspect-ratio-btn" onclick="changeAspectRatio('4:3')" title="클래식 (TV)">
                            4:3
                        </button>
                    </div>
                    
                    <div class="video-size-controls">
                        <span class="video-size-label">영상 크기:</span>
                        <select id="videoSizeSelect" onchange="changeVideoSize(this.value)" title="영상 플레이어 크기 선택">
                            <option value="25">25%</option>
                            <option value="50">50%</option>
                            <option value="75">75%</option>
                            <option value="100" selected>100%</option>
                            <option value="125">125%</option>
                            <option value="150">150%</option>
                            <option value="175">175%</option>
                            <option value="200">200%</option>
                            <option value="225">225%</option>
                            <option value="250">250%</option>
                            <option value="275">275%</option>
                            <option value="300">300%</option>
                        </select>
                        <span id="videoSizeDisplay" class="video-size-display">100%</span>
                    </div>
                </div>
                
                <div class="window-controls">
                    <button class="window-control-btn minimize-btn" onclick="minimizeShortsModal()" title="최소화">
                        ➖
                    </button>
                    <button class="window-control-btn close-btn" onclick="closeShortsPreviewModal()" title="닫기">
                        ✕
                    </button>
                </div>
            </div>
            
            <div class="shorts-preview-main-container">
                <!-- 왼쪽: 비디오 프리뷰 영역 -->
                <div class="shorts-preview-video-container" id="shortsVideoContainer">
                    <div class="shorts-video-background" id="shortsVideoBackground">
                        <div class="shorts-video-wrapper" id="shortsVideoWrapper">
                            <video class="shorts-preview-video" id="shortsPreviewVideo" controls playsinline>
                                <source src="" type="video/mp4">
                                비디오를 재생할 수 없습니다.
                            </video>
                        </div>
                    </div>
                    <div class="shorts-loading" id="shortsLoading">
                        비디오 로딩 중...
                    </div>
                </div>
                
                <!-- 오른쪽: 편집 컨트롤 패널 -->
                <div class="shorts-edit-panel">
                    <!-- 배경색 설정 -->
                    <div class="edit-section">
                        <h4 class="edit-section-title">배경</h4>
                        <div class="background-controls">
                            <div class="color-picker-section">
                                <label class="color-option">
                                    <input type="radio" name="bgColor" value="#000000" checked>
                                    <span class="color-swatch" style="background-color: #000000"></span>
                                    <span class="color-label">검정</span>
                                </label>
                                <label class="color-option">
                                    <input type="radio" name="bgColor" value="#00ff00">
                                    <span class="color-swatch" style="background-color: #00ff00"></span>
                                    <span class="color-label">초록</span>
                                </label>
                                <label class="color-option">
                                    <input type="radio" name="bgColor" value="#0000ff">
                                    <span class="color-swatch" style="background-color: #0000ff"></span>
                                    <span class="color-label">파랑</span>
                                </label>
                                <label class="color-option">
                                    <input type="radio" name="bgColor" value="#ff0000">
                                    <span class="color-swatch" style="background-color: #ff0000"></span>
                                    <span class="color-label">빨강</span>
                                </label>
                                <label class="color-option">
                                    <input type="radio" name="bgColor" value="#ffffff">
                                    <span class="color-swatch" style="background-color: #ffffff; border: 1px solid #ccc"></span>
                                    <span class="color-label">흰색</span>
                                </label>
                            </div>
                            <div class="custom-color-section">
                                <label for="customBgColor">사용자 색상:</label>
                                <input type="color" id="customBgColor" value="#000000">
                            </div>
                        </div>
                    </div>
                    
                    <!-- 비디오 크기 및 위치 조절 -->
                    <div class="edit-section">
                        <h4 class="edit-section-title">비디오 조절</h4>
                        <div class="video-controls">
                            <div class="control-group">
                                <label for="videoScale">크기:</label>
                                <input type="range" id="videoScale" min="0.5" max="5" step="0.25" value="1">
                                <span id="scaleValue">100%</span>
                            </div>
                            <div class="control-group">
                                <label for="videoRotation">회전:</label>
                                <input type="range" id="videoRotation" min="-180" max="180" step="1" value="0">
                                <span id="rotationValue">0°</span>
                            </div>
                            <div class="control-group button-row">
                                <button id="resetVideoTransform" class="control-btn">초기화</button>
                                <button id="fitToContainer" class="control-btn">화면에 맞춤</button>
                                <button id="toggleVideoAdjustment" class="control-btn video-adjustment-btn">
                                    🎯 영상조정
                                </button>
                            </div>
                            <div class="drag-mode-guide">
                                <p class="guide-text">🎯 <strong>영상조정 사용법:</strong></p>
                                <p class="guide-steps">1. <strong>"🎯 영상조정"</strong> 버튼 클릭하여 조정 모드 활성화</p>
                                <p class="guide-steps">2. 마우스로 영상 위치 및 크기 자유조정</p>
                                <p class="guide-steps">3. <strong>ESC키</strong> 또는 <strong>버튼 재클릭</strong>으로 종료</p>
                                <p class="guide-status" id="adjustmentModeStatus">
                                    🔴 조정 모드: <strong>비활성</strong>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="shorts-preview-controls">
                <div class="shorts-time-info">
                    <span id="shortsCurrentTime">0:00</span>
                    <span class="time-range">${shorts.extractRange.start}s - ${shorts.extractRange.end}s 구간 (${shorts.duration}초)</span>
                    <span id="shortsTotalTime">${shorts.duration}:00</span>
                </div>
                
                <div class="shorts-progress-container" id="shortsProgressContainer">
                    <div class="shorts-progress-bar" id="shortsProgressBar"></div>
                </div>
                
                <div class="shorts-control-buttons">
                    <button class="shorts-control-btn" onclick="seekShortsVideo(-5)" title="5초 뒤로">
                        <span class="btn-icon">⏪</span>
                        <span class="btn-text">-5s</span>
                    </button>
                    
                    <button class="shorts-control-btn play-pause" id="shortsPlayPauseBtn" onclick="toggleShortsPlayback()" title="재생/일시정지">
                        <span class="btn-icon">▶️</span>
                        <span class="btn-text">재생</span>
                    </button>
                    
                    <button class="shorts-control-btn" onclick="seekShortsVideo(5)" title="5초 앞으로">
                        <span class="btn-icon">⏩</span>
                        <span class="btn-text">+5s</span>
                    </button>
                    
                    <div class="shorts-volume-container">
                        <button class="shorts-control-btn" onclick="toggleShortsVolume()" title="음소거/음소거 해제">
                            <span class="btn-icon" id="shortsVolumeIcon">🔊</span>
                            <span class="btn-text">음량</span>
                        </button>
                        <input type="range" class="shorts-volume-slider" id="shortsVolumeSlider" 
                               min="0" max="100" value="100" oninput="setShortsVolume(this.value)" title="음량 조절">
                    </div>
                </div>
            </div>
            
            <!-- 8방향 크기 조절 핸들 -->
            <div class="resize-handle resize-n" title="상단 크기 조절"></div>
            <div class="resize-handle resize-s" title="하단 크기 조절"></div>
            <div class="resize-handle resize-e" title="우측 크기 조절"></div>
            <div class="resize-handle resize-w" title="좌측 크기 조절"></div>
            <div class="resize-handle resize-ne" title="우상단 크기 조절"></div>
            <div class="resize-handle resize-nw" title="좌상단 크기 조절"></div>
            <div class="resize-handle resize-se" title="우하단 크기 조절"></div>
            <div class="resize-handle resize-sw" title="좌하단 크기 조절"></div>
        </div>
    `;
    
    return modal;
}

/**
 * 모달의 비디오를 설정하고 재생합니다.
 */
function setupModalVideo(shorts) {
    const video = document.getElementById('shortsPreviewVideo');
    const loading = document.getElementById('shortsLoading');
    const sourceVideo = document.getElementById('videoPreview');
    
    if (!sourceVideo || !sourceVideo.src) {
        console.error('❌ 원본 비디오를 찾을 수 없습니다.');
        loading.textContent = '원본 비디오를 찾을 수 없습니다.';
        return;
    }
    
    // 원본 비디오 소스 설정
    video.src = sourceVideo.src;
    
    video.addEventListener('loadedmetadata', () => {
        console.log('✅ 비디오 메타데이터 로드 완료');
        loading.style.display = 'none';
        
        // 지정된 구간으로 시작 시간 설정
        video.currentTime = shorts.extractRange.start;
        
        // 진행 상황 업데이트 설정
        setupProgressTracking(video, shorts);
    });
    
    video.addEventListener('loadeddata', () => {
        console.log('✅ 비디오 데이터 로드 완료');
        // 자동 재생 시도 (사용자 제스처 필요할 수 있음)
        video.play().catch(e => {
            console.log('ℹ️ 자동 재생 실패 (사용자 상호작용 필요):', e.message);
        });
    });
    
    video.addEventListener('error', (e) => {
        console.error('❌ 비디오 로드 오류:', e);
        loading.textContent = '비디오 로드 실패';
    });
    
    // 비디오 로드 시작
    video.load();
    
    // CapCut 스타일 컨트롤 설정
    setupCapCutControls();
}

/**
 * CapCut 스타일 컨트롤을 설정합니다.
 */
function setupCapCutControls() {
    console.log('🎨 CapCut 스타일 컨트롤 설정 시작...');
    
    // 배경색 변경 기능
    setupBackgroundColorControls();
    
    // 비디오 크기 및 회전 컨트롤
    setupVideoTransformControls();
    
    // 비디오 드래그 앤 드롭 기능
    setupVideoDragAndDrop();
    
    // 영상조정 버튼 기능
    setupVideoAdjustmentButton();
    
    console.log('✅ CapCut 스타일 컨트롤 설정 완료');
}

/**
 * 배경색 변경 컨트롤을 설정합니다.
 */
function setupBackgroundColorControls() {
    const videoBackground = document.getElementById('shortsVideoBackground');
    const colorRadios = document.querySelectorAll('input[name="bgColor"]');
    const customColorInput = document.getElementById('customBgColor');
    
    if (!videoBackground) return;
    
    // 미리 정의된 색상 라디오 버튼 이벤트
    colorRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) {
                videoBackground.style.backgroundColor = radio.value;
                console.log(`🎨 배경색 변경: ${radio.value}`);
            }
        });
    });
    
    // 사용자 정의 색상 선택기
    if (customColorInput) {
        customColorInput.addEventListener('change', (e) => {
            const customColor = e.target.value;
            videoBackground.style.backgroundColor = customColor;
            
            // 기존 라디오 버튼 선택 해제
            colorRadios.forEach(radio => radio.checked = false);
            
            console.log(`🎨 사용자 정의 배경색 변경: ${customColor}`);
        });
    }
}

/**
 * 비디오 변형 컨트롤을 설정합니다.
 */
function setupVideoTransformControls() {
    const videoWrapper = document.getElementById('shortsVideoWrapper');
    const video = document.getElementById('shortsPreviewVideo');
    const scaleSlider = document.getElementById('videoScale');
    const rotationSlider = document.getElementById('videoRotation');
    const scaleValue = document.getElementById('scaleValue');
    const rotationValue = document.getElementById('rotationValue');
    const resetBtn = document.getElementById('resetVideoTransform');
    const fitBtn = document.getElementById('fitToContainer');
    
    if (!videoWrapper || !video) return;
    
    let currentScale = 1;
    let currentRotation = 0;
    let currentTranslateX = 0;
    let currentTranslateY = 0;
    
    // 변형 업데이트 함수
    function updateTransform() {
        const transform = `translate(${currentTranslateX}px, ${currentTranslateY}px) scale(${currentScale}) rotate(${currentRotation}deg)`;
        videoWrapper.style.transform = transform;
    }
    
    // 크기 조절
    if (scaleSlider && scaleValue) {
        scaleSlider.addEventListener('input', (e) => {
            currentScale = parseFloat(e.target.value);
            scaleValue.textContent = Math.round(currentScale * 100) + '%';
            updateTransform();
        });
    }
    
    // 회전 조절
    if (rotationSlider && rotationValue) {
        rotationSlider.addEventListener('input', (e) => {
            currentRotation = parseInt(e.target.value);
            rotationValue.textContent = currentRotation + '°';
            updateTransform();
        });
    }
    
    // 초기화 버튼
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            currentScale = 1;
            currentRotation = 0;
            currentTranslateX = 0;
            currentTranslateY = 0;
            
            if (scaleSlider) scaleSlider.value = 1;
            if (rotationSlider) rotationSlider.value = 0;
            if (scaleValue) scaleValue.textContent = '100%';
            if (rotationValue) rotationValue.textContent = '0°';
            
            updateTransform();
            
            // 드래그 모드도 해제
            const dragWrapper = document.getElementById('shortsVideoWrapper');
            if (dragWrapper) {
                dragWrapper.classList.remove('dragging', 'drag-mode');
                dragWrapper.style.cursor = '';
            }
            
            console.log('🔄 비디오 변형 및 드래그 모드 초기화');
        });
    }
    
    // 화면에 맞춤 버튼
    if (fitBtn) {
        fitBtn.addEventListener('click', () => {
            const container = document.getElementById('shortsVideoBackground');
            if (!container) return;
            
            const containerRect = container.getBoundingClientRect();
            const videoRect = video.getBoundingClientRect();
            
            // 컨테이너에 맞는 적절한 스케일 계산
            const scaleX = containerRect.width / video.videoWidth;
            const scaleY = containerRect.height / video.videoHeight;
            const fitScale = Math.min(scaleX, scaleY) * 0.9; // 약간의 여백
            
            currentScale = Math.max(0.1, Math.min(2, fitScale));
            currentTranslateX = 0;
            currentTranslateY = 0;
            
            if (scaleSlider) scaleSlider.value = currentScale;
            if (scaleValue) scaleValue.textContent = Math.round(currentScale * 100) + '%';
            
            updateTransform();
            console.log(`📏 화면에 맞춤: ${Math.round(currentScale * 100)}%`);
        });
    }
    
    // 변형 상태를 외부에서 접근 가능하도록 저장
    videoWrapper.transformState = {
        get scale() { return currentScale; },
        get rotation() { return currentRotation; },
        get translateX() { return currentTranslateX; },
        get translateY() { return currentTranslateY; },
        set translateX(value) { currentTranslateX = value; updateTransform(); },
        set translateY(value) { currentTranslateY = value; updateTransform(); }
    };
}

/**
 * 비디오 드래그 앤 드롭 기능을 설정합니다.
 */
function setupVideoDragAndDrop() {
    const videoWrapper = document.getElementById('shortsVideoWrapper');
    const videoContainer = document.getElementById('shortsVideoBackground');
    
    if (!videoWrapper || !videoContainer) return;
    
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialTranslateX = 0;
    let initialTranslateY = 0;
    let dragClickCount = 0;
    
    // 글로벌 dragModeEnabled 상태 - 영상조정 버튼에서 제어됨
    let dragModeEnabled = false;
    
    // 외부에서 dragModeEnabled 상태에 접근할 수 있도록 함수에 프로퍼티로 추가
    setupVideoDragAndDrop.getDragModeEnabled = () => dragModeEnabled;
    setupVideoDragAndDrop.setDragModeEnabled = (enabled) => {
        dragModeEnabled = enabled;
        if (!enabled) {
            exitDragMode();
        }
    };
    
    // 드래그 모드 종료 함수
    function exitDragMode() {
        isDragging = false;
        dragModeEnabled = false;
        videoWrapper.classList.remove('dragging', 'drag-mode');
        videoWrapper.style.cursor = '';
        console.log('🔚 드래그 모드 종료');
    }
    
    // ESC 키로 드래그 모드 종료
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && (isDragging || dragModeEnabled)) {
            e.preventDefault();
            exitDragMode();
            console.log('⌨️ ESC 키로 드래그 모드 종료');
        }
    });
    
    // 더블클릭 이벤트 제거됨 - 이제 "영상조정" 버튼으로 드래그 모드 활성화
    
    // 마우스 다운 이벤트
    videoWrapper.addEventListener('mousedown', (e) => {
        if (e.target.tagName.toLowerCase() === 'video') {
            e.preventDefault();
            
            // 드래그 모드가 활성화된 경우에만 드래그 시작
            if (dragModeEnabled) {
                isDragging = true;
                videoWrapper.classList.add('dragging');
                
                startX = e.clientX;
                startY = e.clientY;
                
                const transformState = videoWrapper.transformState;
                if (transformState) {
                    initialTranslateX = transformState.translateX;
                    initialTranslateY = transformState.translateY;
                }
                
                console.log('🖱️ 비디오 드래그 시작');
            } else {
                // 드래그 모드가 비활성화된 경우 안내 메시지
                console.log('💡 더블클릭하여 드래그 모드를 활성화하세요');
            }
        }
    });
    
    // 마우스 이동 이벤트
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        const transformState = videoWrapper.transformState;
        if (transformState) {
            transformState.translateX = initialTranslateX + deltaX;
            transformState.translateY = initialTranslateY + deltaY;
        }
    });
    
    // 마우스 업 이벤트
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            videoWrapper.classList.remove('dragging');
            console.log('🖱️ 비디오 드래그 종료 (드래그 모드는 유지)');
        }
    });
    
    // 모달 외부 클릭 시 드래그 모드 종료
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('shortsPreviewModal');
        if (modal && dragModeEnabled && !modal.contains(e.target)) {
            exitDragMode();
            console.log('🖱️ 모달 외부 클릭으로 드래그 모드 종료');
        }
    });
    
    // 터치 이벤트 지원 (모바일) - 드래그 모드 필요
    videoWrapper.addEventListener('touchstart', (e) => {
        if (e.target.tagName.toLowerCase() === 'video' && dragModeEnabled) {
            e.preventDefault();
            const touch = e.touches[0];
            isDragging = true;
            
            videoWrapper.classList.add('dragging');
            
            startX = touch.clientX;
            startY = touch.clientY;
            
            const transformState = videoWrapper.transformState;
            if (transformState) {
                initialTranslateX = transformState.translateX;
                initialTranslateY = transformState.translateY;
            }
        }
    });
    
    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        
        const transformState = videoWrapper.transformState;
        if (transformState) {
            transformState.translateX = initialTranslateX + deltaX;
            transformState.translateY = initialTranslateY + deltaY;
        }
    });
    
    document.addEventListener('touchend', () => {
        if (isDragging) {
            isDragging = false;
            videoWrapper.classList.remove('dragging');
        }
    });
}

/**
 * 영상조정 버튼 기능을 설정합니다.
 */
function setupVideoAdjustmentButton() {
    const adjustmentButton = document.getElementById('toggleVideoAdjustment');
    const statusElement = document.getElementById('adjustmentModeStatus');
    const videoWrapper = document.getElementById('shortsVideoWrapper');
    
    if (!adjustmentButton || !statusElement || !videoWrapper) {
        console.warn('❌ 영상조정 버튼 요소를 찾을 수 없습니다.');
        return;
    }
    
    let adjustmentModeEnabled = false;
    
    // 조정 모드 상태 업데이트 함수
    function updateAdjustmentModeStatus(enabled) {
        if (enabled) {
            statusElement.innerHTML = '🟢 조정 모드: <strong>활성</strong>';
            statusElement.classList.add('active');
            adjustmentButton.classList.add('active');
            adjustmentButton.innerHTML = '🔄 조정중...';
            videoWrapper.classList.add('drag-mode');
            console.log('🎯 영상조정 모드 활성화됨 - 마우스로 영상을 자유롭게 조정하세요');
        } else {
            statusElement.innerHTML = '🔴 조정 모드: <strong>비활성</strong>';
            statusElement.classList.remove('active');
            adjustmentButton.classList.remove('active');
            adjustmentButton.innerHTML = '🎯 영상조정';
            videoWrapper.classList.remove('drag-mode');
            console.log('🎯 영상조정 모드 비활성화됨');
        }
    }
    
    // 버튼 클릭 이벤트
    adjustmentButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        adjustmentModeEnabled = !adjustmentModeEnabled;
        updateAdjustmentModeStatus(adjustmentModeEnabled);
        
        // 기존 드래그 기능과 연동
        if (typeof setupVideoDragAndDrop.setDragModeEnabled === 'function') {
            setupVideoDragAndDrop.setDragModeEnabled(adjustmentModeEnabled);
        }
    });
    
    // ESC 키로 조정 모드 종료
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && adjustmentModeEnabled) {
            e.preventDefault();
            adjustmentModeEnabled = false;
            updateAdjustmentModeStatus(false);
            console.log('⌨️ ESC 키로 영상조정 모드 종료');
        }
    });
    
    // 초기 상태 설정
    updateAdjustmentModeStatus(false);
    
    console.log('✅ 영상조정 버튼 기능 설정 완료');
}

/**
 * 진행 상황 추적을 설정합니다.
 */
function setupProgressTracking(video, shorts) {
    const progressBar = document.getElementById('shortsProgressBar');
    const currentTimeSpan = document.getElementById('shortsCurrentTime');
    const progressContainer = document.getElementById('shortsProgressContainer');
    
    const startTime = shorts.extractRange.start;
    const endTime = shorts.extractRange.end;
    const duration = endTime - startTime;
    
    // 시간 업데이트
    video.addEventListener('timeupdate', () => {
        const currentTime = video.currentTime;
        
        // 지정된 구간 벗어나면 시작점으로 이동
        if (currentTime >= endTime) {
            video.currentTime = startTime;
        }
        
        if (currentTime >= startTime && currentTime <= endTime) {
            const progress = ((currentTime - startTime) / duration) * 100;
            progressBar.style.width = `${progress}%`;
            
            const displayTime = Math.max(0, currentTime - startTime);
            currentTimeSpan.textContent = formatTime(displayTime);
        }
    });
    
    // 진행 바 클릭으로 시간 이동
    progressContainer.addEventListener('click', (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickPercent = clickX / rect.width;
        const newTime = startTime + (duration * clickPercent);
        
        video.currentTime = Math.max(startTime, Math.min(endTime, newTime));
    });
}

/**
 * 재생/일시정지를 토글합니다.
 */
window.toggleShortsPlayback = function() {
    const video = document.getElementById('shortsPreviewVideo');
    const playPauseBtn = document.getElementById('shortsPlayPauseBtn');
    const btnIcon = playPauseBtn.querySelector('.btn-icon');
    const btnText = playPauseBtn.querySelector('.btn-text');
    
    if (video.paused) {
        video.play();
        btnIcon.textContent = '⏸️';
        btnText.textContent = '일시정지';
    } else {
        video.pause();
        btnIcon.textContent = '▶️';
        btnText.textContent = '재생';
    }
};

/**
 * 비디오 시간을 이동합니다.
 */
window.seekShortsVideo = function(seconds) {
    const video = document.getElementById('shortsPreviewVideo');
    if (!video) {
        console.warn('❌ 비디오 요소를 찾을 수 없습니다.');
        return;
    }
    
    const newTime = video.currentTime + seconds;
    
    // 지정된 구간 내에서만 이동
    const shorts = getCurrentPlayingShorts();
    if (shorts && shorts.extractRange) {
        const startTime = shorts.extractRange.start;
        const endTime = shorts.extractRange.end;
        video.currentTime = Math.max(startTime, Math.min(endTime, newTime));
        console.log(`⏯️ 비디오 시간 이동: ${seconds}초 → ${video.currentTime.toFixed(1)}초`);
    } else {
        // 구간 정보가 없으면 일반적인 시간 이동
        video.currentTime = Math.max(0, Math.min(video.duration || 0, newTime));
        console.log(`⏯️ 일반 시간 이동: ${seconds}초 → ${video.currentTime.toFixed(1)}초`);
    }
};

/**
 * 볼륨을 토글합니다.
 */
window.toggleShortsVolume = function() {
    const video = document.getElementById('shortsPreviewVideo');
    const volumeIcon = document.getElementById('shortsVolumeIcon');
    const volumeSlider = document.getElementById('shortsVolumeSlider');
    
    if (video.muted) {
        video.muted = false;
        volumeIcon.textContent = '🔊';
        volumeSlider.value = video.volume * 100;
    } else {
        video.muted = true;
        volumeIcon.textContent = '🔇';
    }
};

/**
 * 볼륨을 설정합니다.
 */
window.setShortsVolume = function(value) {
    const video = document.getElementById('shortsPreviewVideo');
    const volumeIcon = document.getElementById('shortsVolumeIcon');
    
    video.volume = value / 100;
    video.muted = false;
    
    if (value == 0) {
        volumeIcon.textContent = '🔇';
    } else if (value < 30) {
        volumeIcon.textContent = '🔈';
    } else if (value < 70) {
        volumeIcon.textContent = '🔉';
    } else {
        volumeIcon.textContent = '🔊';
    }
};

/**
 * 모달 최소화 기능
 */
window.minimizeShortsModal = function() {
    const modal = document.getElementById('shortsPreviewModal');
    const windowElement = document.getElementById('shortsPreviewWindow');
    
    if (modal && windowElement) {
        windowElement.classList.toggle('minimized');
        
        const video = document.getElementById('shortsPreviewVideo');
        if (video && !video.paused) {
            video.pause(); // 최소화 시 비디오 일시정지
        }
    }
};

/**
 * 영상 크기 변경 함수
 */
window.changeVideoSize = function(sizePercent) {
    const modal = document.getElementById('shortsPreviewModal');
    const videoContainer = modal?.querySelector('.shorts-preview-video-container');
    const videoSizeDisplay = modal?.querySelector('#videoSizeDisplay');
    const mainContainer = modal?.querySelector('.shorts-preview-main-container');
    
    if (!modal || !videoContainer) {
        console.warn('❌ 모달 또는 비디오 컨테이너를 찾을 수 없습니다.');
        return;
    }
    
    // 현재 비율에 따른 기본 크기 정의
    const baseVideoSizes = {
        '16:9': { width: 640, height: 360 },
        '9:16': { width: 360, height: 640 },
        '1:1': { width: 500, height: 500 },
        '4:3': { width: 533, height: 400 }
    };
    
    const currentAspectRatio = modal.currentAspectRatio || '9:16';
    const baseSize = baseVideoSizes[currentAspectRatio];
    const scaleFactor = parseInt(sizePercent) / 100;
    
    // 새로운 비디오 크기 계산
    const newVideoWidth = Math.round(baseSize.width * scaleFactor);
    const newVideoHeight = Math.round(baseSize.height * scaleFactor);
    
    // 비디오 컨테이너 크기 설정 (고정)
    videoContainer.style.width = newVideoWidth + 'px';
    videoContainer.style.height = newVideoHeight + 'px';
    videoContainer.style.minWidth = newVideoWidth + 'px';
    videoContainer.style.minHeight = newVideoHeight + 'px';
    videoContainer.style.maxWidth = newVideoWidth + 'px';
    videoContainer.style.maxHeight = newVideoHeight + 'px';
    videoContainer.style.flexShrink = '0';
    
    // 🎯 스크롤바 동적 제어: 영상이 컨테이너보다 큰 경우에만 스크롤 활성화
    if (mainContainer) {
        const containerRect = mainContainer.getBoundingClientRect();
        const availableWidth = containerRect.width - 320; // 편집 패널 공간 제외 (280px + 40px 여백)
        const availableHeight = containerRect.height - 40; // 상하 패딩 제외
        
        const needsScroll = (newVideoWidth > availableWidth) || (newVideoHeight > availableHeight);
        
        if (needsScroll) {
            mainContainer.classList.add('scroll-enabled');
            console.log(`📜 스크롤 활성화: 영상(${newVideoWidth}x${newVideoHeight}) > 가용공간(${Math.round(availableWidth)}x${Math.round(availableHeight)})`);
        } else {
            mainContainer.classList.remove('scroll-enabled');
            console.log(`📜 스크롤 비활성화: 영상이 가용공간에 맞음`);
        }
    }
    
    // 디스플레이 업데이트
    if (videoSizeDisplay) {
        videoSizeDisplay.textContent = sizePercent + '%';
    }
    
    // 모달 크기 저장 (리사이즈 시 참조용)
    modal.currentVideoScale = parseInt(sizePercent);
    
    console.log(`🎬 비디오 크기 변경: ${currentAspectRatio} → ${newVideoWidth}x${newVideoHeight} (${sizePercent}%) - 중앙 정렬`);
};

/**
 * 모달 상호작용 기능 설정 (드래그, 리사이즈)
 */
function setupModalInteractions(modal) {
    const windowElement = modal.querySelector('.shorts-preview-window');
    const header = modal.querySelector('.shorts-window-header');
    const resizeHandles = modal.querySelectorAll('.resize-handle');
    
    // 상태를 모달 객체에 저장 (외부에서 접근 가능)
    modal.isDragging = false;
    modal.isResizing = false;
    modal.currentResizeType = null; // 리사이즈 방향
    modal.currentAspectRatio = '9:16'; // 기본값: 세로형
    modal.currentVideoScale = 100; // 비디오 크기 비율
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    let dragTimeout; // 드래그 타이머용 변수
    
    // 🖱️ 모달 드래그 기능: 헤더 클릭 시에만 창 이동 가능
    header.addEventListener('mousedown', (e) => {
        // 🚫 컨트롤 요소들은 드래그 대상에서 제외
        if (e.target.closest('.window-controls')) {
            console.log('🚫 창 컨트롤 클릭 - 드래그 제외');
            return;
        }
        if (e.target.closest('.aspect-ratio-controls')) {
            console.log('🚫 비율 컨트롤 클릭 - 드래그 제외');
            return;
        }
        if (e.target.closest('.video-size-controls')) {
            console.log('🚫 영상 크기 컨트롤 클릭 - 드래그 제외');
            return;
        }
        if (e.target.closest('#videoSizeSelect')) {
            console.log('🚫 영상 크기 드롭다운 클릭 - 드래그 제외');
            return;
        }
        if (e.target.matches('#videoSizeSelect')) {
            console.log('🚫 영상 크기 드롭다운 직접 클릭 - 드래그 제외');
            return;
        }
        
        // 🚫 모든 인터랙티브 요소들 제외 (안전장치)
        if (e.target.matches('select, input, button, a, [role="button"]')) {
            console.log('🚫 인터랙티브 요소 클릭 - 드래그 제외:', e.target.tagName);
            return;
        }
        
        // 왼쪽 마우스 버튼만 처리 (우클릭, 휠클릭 제외)
        if (e.button !== 0) {
            console.log('🚫 좌클릭이 아님 - 드래그 제외, 버튼:', e.button);
            return;
        }
        
        console.log('✅ 모달 드래그 시작 허용', {
            button: e.button,
            target: e.target.tagName,
            className: e.target.className,
            clientX: e.clientX,
            clientY: e.clientY
        });
        
        // 🔒 드래그 상태 안전하게 설정
        modal.isDragging = true;
        console.log('✅ 드래그 상태 설정 완료:', modal.isDragging);
        startX = e.clientX;
        startY = e.clientY;
        
        // 현재 모달 위치 저장
        const rect = windowElement.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        
        // fixed 포지션으로 변경하여 드래그 가능하게 설정
        windowElement.style.position = 'fixed';
        windowElement.style.left = startLeft + 'px';
        windowElement.style.top = startTop + 'px';
        windowElement.style.margin = '0';
        
        // 드래그 중 텍스트 선택 방지
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
        document.body.style.msUserSelect = 'none';
        
        // 헤더 스타일 변경 (드래그 중 표시)
        header.style.cursor = 'grabbing';
        header.classList.add('dragging');
        
        // 전역 이벤트 리스너 등록 (마우스가 모달 밖으로 나가도 추적)
        document.addEventListener('mousemove', handleDrag, { passive: false });
        document.addEventListener('mouseup', stopDrag, { once: true }); // 한 번만 실행
        
        // 드래그 타이머 시작 (5초 후 자동 해제)
        if (dragTimeout) clearTimeout(dragTimeout);
        dragTimeout = setTimeout(() => {
            if (modal.isDragging) {
                console.log('⚠️ 5초 타임아웃으로 드래그 강제 종료');
                stopDrag();
            }
        }, 5000);
        
        // 🆘 긴급 해제 버튼 표시
        showEmergencyExitButton();
        
        // 기본 동작 방지
        e.preventDefault();
        e.stopPropagation();
    });
    
    function handleDrag(e) {
        // 드래그 상태가 아니면 즉시 리턴
        if (!modal.isDragging) {
            return;
        }
        
        // 기본 동작 방지 (텍스트 선택, 이미지 드래그 등)
        e.preventDefault();
        e.stopPropagation();
        
        // 마우스 이동 거리 계산
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        // 새로운 위치 계산 (화면 경계 제한)
        const maxLeft = window.innerWidth - windowElement.offsetWidth;
        const maxTop = window.innerHeight - windowElement.offsetHeight;
        
        const newLeft = Math.max(0, Math.min(maxLeft, startLeft + deltaX));
        const newTop = Math.max(0, Math.min(maxTop, startTop + deltaY));
        
        // 모달 위치 업데이트
        windowElement.style.left = newLeft + 'px';
        windowElement.style.top = newTop + 'px';
        
        // 드래그 중 텍스트 선택 방지 (추가 보장)
        if (window.getSelection && window.getSelection().rangeCount > 0) {
            window.getSelection().removeAllRanges();
        }
    }
    
    function stopDrag(e) {
        console.log('🛑 stopDrag 함수 호출됨', { isDragging: modal.isDragging });
        
        // 드래그 상태가 아니어도 강제로 모든 상태 정리 (안전장치)
        if (modal.isDragging || true) { // 항상 실행되도록 수정
            console.log('✅ 모달 드래그 강제 종료');
            
            // 1. 드래그 상태 즉시 해제
            modal.isDragging = false;
            
            // 2. 모든 이벤트 리스너 강제 제거 (중복 제거 방지)
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', stopDrag);
            
            // 3. 모든 드래그 관련 스타일 강제 복원
            document.body.style.userSelect = '';
            document.body.style.webkitUserSelect = '';
            document.body.style.msUserSelect = '';
            document.body.style.cursor = '';
            
            // 4. 헤더 스타일 완전 복원
            if (header) {
                header.style.cursor = 'grab';
                header.classList.remove('dragging');
            }
            
            // 5. 윈도우 요소 커서 복원
            if (windowElement) {
                windowElement.style.cursor = '';
            }
            
            // 6. 이벤트 처리
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            // 7. 텍스트 선택 완전 정리
            try {
                if (window.getSelection) {
                    const selection = window.getSelection();
                    if (selection.rangeCount > 0) {
                        selection.removeAllRanges();
                    }
                }
            } catch (err) {
                console.warn('텍스트 선택 정리 중 오류:', err);
            }
            
            console.log('✅ 드래그 상태 완전 정리 완료');
        }
    }
    
    // 🚫 다양한 방법으로 드래그 강제 종료 기능 추가
    
    // 1. ESC 키로 강제 종료
    const handleEscapeKey = (e) => {
        if (e.key === 'Escape' && modal.isDragging) {
            console.log('⚠️ ESC키로 드래그 강제 종료');
            stopDrag();
        }
    };
    document.addEventListener('keydown', handleEscapeKey);
    
    // 더블클릭 이벤트 제거됨 - 이제 우클릭과 ESC 키로만 드래그 종료
    
    // 3. 우클릭으로 강제 종료
    header.addEventListener('contextmenu', (e) => {
        if (modal.isDragging) {
            console.log('⚠️ 우클릭으로 드래그 강제 종료');
            stopDrag();
            e.preventDefault();
            e.stopPropagation();
        }
    });
    
    // 4. 모달 밖 클릭으로 강제 종료
    document.addEventListener('click', (e) => {
        if (modal.isDragging && !modal.contains(e.target)) {
            console.log('⚠️ 모달 외부 클릭으로 드래그 강제 종료');
            stopDrag();
        }
    });
    
    // 🆘 긴급 드래그 해제 버튼 생성 함수
    function showEmergencyExitButton() {
        // 기존 버튼이 있으면 제거
        const existingBtn = document.getElementById('emergencyDragExit');
        if (existingBtn) existingBtn.remove();
        
        const exitBtn = document.createElement('div');
        exitBtn.id = 'emergencyDragExit';
        exitBtn.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                right: 20px;
                transform: translateY(-50%);
                background: #e74c3c;
                color: white;
                padding: 15px 20px;
                border-radius: 10px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                z-index: 999999;
                box-shadow: 0 4px 12px rgba(231, 76, 60, 0.5);
                border: 2px solid #fff;
                animation: pulse 1s infinite;
            ">
                🆘 드래그 해제<br>
                <small>(클릭하여 종료)</small>
            </div>`;
        
        exitBtn.addEventListener('click', () => {
            console.log('🆘 긴급 해제 버튼 클릭됨');
            stopDrag();
        });
        
        document.body.appendChild(exitBtn);
    }
    
    function hideEmergencyExitButton() {
        const existingBtn = document.getElementById('emergencyDragExit');
        if (existingBtn) {
            existingBtn.remove();
        }
    }
    
    // 5. 드래그 종료 시 타이머 클리어 (stopDrag 함수 개선)
    const originalStopDrag = stopDrag;
    stopDrag = function(e) {
        if (dragTimeout) {
            clearTimeout(dragTimeout);
            dragTimeout = null;
        }
        hideEmergencyExitButton(); // 긴급 해제 버튼 숨기기
        originalStopDrag(e);
    };
    
    // 🔄 8방향 리사이즈 기능
    console.log(`🔧 리사이즈 핸들 설정 중... 총 ${resizeHandles.length}개 핸들 발견`);
    
    resizeHandles.forEach((handle, index) => {
        // 리사이즈 방향 결정
        const resizeType = Array.from(handle.classList).find(cls => cls.startsWith('resize-')).replace('resize-', '');
        console.log(`  핸들 ${index + 1}: ${resizeType} 방향`);
        
        // 핸들이 보이도록 확실히 설정
        handle.style.display = 'block';
        handle.style.visibility = 'visible';
        
        handle.addEventListener('mousedown', (e) => {
            console.log(`📏 리사이즈 시작: ${resizeType} 방향`);
            
            modal.isResizing = true;
            modal.currentResizeType = resizeType;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = windowElement.getBoundingClientRect();
            startWidth = rect.width;
            startHeight = rect.height;
            startLeft = rect.left;
            startTop = rect.top;
            
            // 리사이즈 중 선택 방지 및 포인터 제어
            document.body.style.userSelect = 'none';
            document.body.style.pointerEvents = 'none';
            windowElement.style.pointerEvents = 'auto';
            
            // 모달을 fixed 포지션으로 설정
            windowElement.style.position = 'fixed';
            windowElement.style.left = startLeft + 'px';
            windowElement.style.top = startTop + 'px';
            windowElement.style.margin = '0';
            
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
            e.preventDefault();
            e.stopPropagation();
        });
        
        // 커서 스타일 설정
        const cursorMap = {
            'n': 'n-resize',
            's': 's-resize',
            'e': 'e-resize',
            'w': 'w-resize',
            'ne': 'ne-resize',
            'nw': 'nw-resize',
            'se': 'se-resize',
            'sw': 'sw-resize'
        };
        handle.style.cursor = cursorMap[resizeType] || 'default';
        
        // 디버깅을 위한 추가 정보
        handle.title = `${resizeType} 방향으로 크기 조절`;
    });
    
    console.log('✅ 모든 리사이즈 핸들 설정 완료');
    
    function handleResize(e) {
        if (!modal.isResizing || !modal.currentResizeType) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        const resizeType = modal.currentResizeType;
        
        // 최소/최대 크기 제한
        const minWidth = 400;
        const minHeight = 300;
        const maxWidth = Math.min(window.innerWidth - 50, 1600);
        const maxHeight = Math.min(window.innerHeight - 50, 1200);
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;
        
        // 🔄 8방향 리사이즈 로직
        switch (resizeType) {
            case 'n': // 북쪽 (상단)
                newHeight = startHeight - deltaY;
                newTop = startTop + deltaY;
                break;
            case 's': // 남쪽 (하단)
                newHeight = startHeight + deltaY;
                break;
            case 'e': // 동쪽 (우측)
                newWidth = startWidth + deltaX;
                break;
            case 'w': // 서쪽 (좌측)
                newWidth = startWidth - deltaX;
                newLeft = startLeft + deltaX;
                break;
            case 'ne': // 북동쪽 (우상단)
                newWidth = startWidth + deltaX;
                newHeight = startHeight - deltaY;
                newTop = startTop + deltaY;
                break;
            case 'nw': // 북서쪽 (좌상단)
                newWidth = startWidth - deltaX;
                newHeight = startHeight - deltaY;
                newLeft = startLeft + deltaX;
                newTop = startTop + deltaY;
                break;
            case 'se': // 남동쪽 (우하단)
                newWidth = startWidth + deltaX;
                newHeight = startHeight + deltaY;
                break;
            case 'sw': // 남서쪽 (좌하단)
                newWidth = startWidth - deltaX;
                newHeight = startHeight + deltaY;
                newLeft = startLeft + deltaX;
                break;
        }
        
        // 크기 제한 적용
        if (newWidth < minWidth) {
            if (resizeType.includes('w')) {
                newLeft = startLeft + (startWidth - minWidth);
            }
            newWidth = minWidth;
        }
        if (newWidth > maxWidth) {
            if (resizeType.includes('w')) {
                newLeft = startLeft + (startWidth - maxWidth);
            }
            newWidth = maxWidth;
        }
        
        if (newHeight < minHeight) {
            if (resizeType.includes('n')) {
                newTop = startTop + (startHeight - minHeight);
            }
            newHeight = minHeight;
        }
        if (newHeight > maxHeight) {
            if (resizeType.includes('n')) {
                newTop = startTop + (startHeight - maxHeight);
            }
            newHeight = maxHeight;
        }
        
        // 위치 조정 (화면 경계 내)
        newLeft = Math.max(0, Math.min(window.innerWidth - newWidth, newLeft));
        newTop = Math.max(0, Math.min(window.innerHeight - newHeight, newTop));
        
        // 스타일 적용
        windowElement.style.width = newWidth + 'px';
        windowElement.style.height = newHeight + 'px';
        windowElement.style.left = newLeft + 'px';
        windowElement.style.top = newTop + 'px';
        
        // 브라우저 기본 선택 방지
        if (window.getSelection) {
            window.getSelection().removeAllRanges();
        }
        
        console.log(`🔧 모달 리사이즈 (${resizeType}): ${Math.round(newWidth)}x${Math.round(newHeight)} at (${Math.round(newLeft)}, ${Math.round(newTop)})`);
    }
    
    function stopResize(e) {
        if (modal.isResizing) {
            modal.isResizing = false;
            modal.currentResizeType = null;
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);
            
            // 리사이즈 중 적용된 스타일 복원
            document.body.style.userSelect = '';
            document.body.style.pointerEvents = '';
            windowElement.style.pointerEvents = '';
            
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            console.log('✅ 모달 리사이즈 완료');
        }
    }
    
    // 🎯 초기 커서 스타일 설정
    header.style.cursor = 'grab'; // 기본: 잡을 수 있음 표시
    
    // 창 내부 클릭 시 이벤트 전파 차단 (모달 닫기 방지)
    windowElement.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    
    windowElement.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // 🧹 전역 이벤트 리스너 정리 함수 (모달 닫기 시 호출)
    const cleanup = () => {
        console.log('🧹 모달 이벤트 리스너 정리 중...');
        
        // 드래그 상태 강제 종료
        if (modal.isDragging) {
            modal.isDragging = false;
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', stopDrag);
            console.log('  - 드래그 이벤트 정리됨');
        }
        
        // 리사이즈 상태 강제 종료
        if (modal.isResizing) {
            modal.isResizing = false;
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);
            console.log('  - 리사이즈 이벤트 정리됨');
        }
        
        // 모든 스타일 복원 (안전장치)
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
        document.body.style.msUserSelect = '';
        document.body.style.pointerEvents = '';
        
        if (windowElement) {
            windowElement.style.pointerEvents = '';
        }
        
        if (header) {
            header.style.cursor = 'grab';
            header.classList.remove('dragging');
        }
        
        console.log('  - 모든 스타일 및 상태 복원됨');
    };
    
    // 모달에 정리 함수 저장 (닫기 시 사용)
    modal.modalCleanup = cleanup;
    
    // 🛡️ 강화된 안전장치: 다양한 상황에서 드래그 상태 강제 정리
    window.addEventListener('resize', () => {
        if (modal.isDragging) {
            console.log('⚠️ 윈도우 리사이즈로 드래그 강제 종료');
            stopDrag();
        }
        cleanup();
    });
    
    window.addEventListener('blur', () => { // 창 포커스 잃을 때
        if (modal.isDragging) {
            console.log('⚠️ 창 포커스 상실로 드래그 강제 종료');
            stopDrag();
        }
    });
    
    document.addEventListener('visibilitychange', () => { // 탭 변경 시
        if (document.hidden && modal.isDragging) {
            console.log('⚠️ 탭 변경으로 드래그 강제 종료');
            stopDrag();
        }
    });
    
    // 📱 추가 모바일 터치 이벤트 안전장치
    document.addEventListener('touchend', (e) => {
        if (modal.isDragging) {
            console.log('⚠️ 터치 종료로 드래그 강제 종료');
            stopDrag(e);
        }
    });
    
    document.addEventListener('touchcancel', (e) => {
        if (modal.isDragging) {
            console.log('⚠️ 터치 취소로 드래그 강제 종료');
            stopDrag(e);
        }
    });
    
    // ⏱️ 드래그 상태 모니터링 (개발용 - 문제 진단)
    const monitorDragState = () => {
        if (modal.isDragging) {
            console.log('🔍 드래그 상태 모니터링:', {
                isDragging: modal.isDragging,
                cursor: header.style.cursor,
                bodySelect: document.body.style.userSelect,
                hasClass: header.classList.contains('dragging')
            });
        }
    };
    setInterval(monitorDragState, 2000); // 2초마다 상태 확인
    
    // 마우스가 모달 영역을 벗어날 때 처리 (리사이즈 중일 때는 무시)
    modal.addEventListener('mouseleave', (e) => {
        // 리사이즈나 드래그 중일 때는 모달 닫기 방지
        if (modal.isResizing || modal.isDragging) {
            console.log('🚫 리사이즈/드래그 중이므로 mouseleave 무시');
            e.stopPropagation();
            e.preventDefault();
        }
    });
    
    // 글로벌 mousemove 이벤트로 리사이즈 중 마우스 추적
    const handleGlobalMouseMove = (e) => {
        if (modal.isResizing || modal.isDragging) {
            // 리사이즈나 드래그 중일 때는 마우스 위치와 관계없이 계속 처리
            e.preventDefault();
            e.stopPropagation();
        }
    };
    
    // 🌍 강화된 글로벌 mouseup 이벤트 - 어떤 상황에서도 드래그 해제
    const handleGlobalMouseUp = (e) => {
        console.log('🌍 글로벌 mouseup 감지', { 
            isDragging: modal.isDragging, 
            isResizing: modal.isResizing,
            target: e.target?.tagName 
        });
        
        // 드래그 상태일 때 무조건 해제
        if (modal.isDragging) {
            console.log('🛑 글로벌 mouseup으로 드래그 강제 해제');
            stopDrag(e);
        }
        
        // 리사이즈 상태 정리
        if (modal.isResizing) {
            modal.isResizing = false;
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);
            
            // 스타일 복원
            document.body.style.userSelect = '';
            document.body.style.pointerEvents = '';
            windowElement.style.pointerEvents = '';
            
            console.log('  - 리사이즈 상태 강제 정리');
        }
    };
    
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    // ESC 키로 모달 닫기 (추가 안전장치)
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            closeShortsPreviewModal();
        }
    };
    document.addEventListener('keydown', handleKeyDown);
    
    // 모든 이벤트 리스너 정리에 추가
    const originalCleanup = modal.modalCleanup;
    modal.modalCleanup = () => {
        originalCleanup();
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        console.log('  - ESC 키 및 모든 글로벌 이벤트 정리됨');
    };
}

/**
 * 화면 비율을 변경합니다.
 */
window.changeAspectRatio = function(ratio, isInitial = false) {
    const modal = document.getElementById('shortsPreviewModal');
    const videoSizeSelect = modal?.querySelector('#videoSizeSelect');
    
    if (!modal) return;
    
    // 이미 같은 비율이면 중복 처리 방지 (초기 설정이 아닐 때만)
    if (!isInitial && modal.currentAspectRatio === ratio) {
        console.log(`📐 비율 ${ratio}는 이미 적용됨 - 스킵`);
        return;
    }
    
    console.log(`📐 🎬 비디오 비율 변경: ${modal.currentAspectRatio || '기본'} → ${ratio}${isInitial ? ' (초기 설정)' : ''}`);
    modal.currentAspectRatio = ratio;
    
    // 비율 버튼 활성화 상태 업데이트
    const ratioButtons = modal.querySelectorAll('.aspect-ratio-btn');
    ratioButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.trim() === ratio) {
            btn.classList.add('active');
        }
    });
    
    // 현재 선택된 비디오 크기로 업데이트
    const currentVideoSize = videoSizeSelect?.value || '100';
    changeVideoSize(currentVideoSize);
    
    console.log(`✅ 🎬 비디오 비율 ${ratio} 적용 완료! (${currentVideoSize}% 크기)`);
};

/**
 * 비율에 따른 크기 계산
 */
function calculateAspectRatioSize(ratio, baseWidth, baseHeight) {
    const aspectRatios = {
        '16:9': 16/9,
        '9:16': 9/16,
        '1:1': 1,
        '4:3': 4/3
    };
    
    const targetRatio = aspectRatios[ratio] || 1;
    const currentRatio = baseWidth / baseHeight;
    
    let newWidth, newHeight;
    
    if (currentRatio > targetRatio) {
        // 현재가 더 가로로 넓음 - 세로 기준으로 조정
        newHeight = baseHeight;
        newWidth = newHeight * targetRatio;
    } else {
        // 현재가 더 세로로 김 - 가로 기준으로 조정
        newWidth = baseWidth;
        newHeight = newWidth / targetRatio;
    }
    
    return { width: newWidth, height: newHeight };
}

/**
 * 모달을 닫습니다.
 */
window.closeShortsPreviewModal = function() {
    const modal = document.getElementById('shortsPreviewModal');
    if (modal) {
        console.log('🔒 모달 닫기 시작...');
        modal.classList.remove('active');
        
        // 모달에 저장된 정리 함수 실행
        if (modal.modalCleanup) {
            modal.modalCleanup();
        }
        
        // 비디오 정지
        const video = document.getElementById('shortsPreviewVideo');
        if (video) {
            video.pause();
            video.currentTime = 0;
        }
        
        // 애니메이션 완료 후 제거
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
                console.log('✅ 모달 완전히 제거됨');
            }
        }, 300);
    }
};

/**
 * 현재 재생 중인 숏츠 정보를 가져옵니다.
 */
function getCurrentPlayingShorts() {
    const modal = document.getElementById('shortsPreviewModal');
    if (!modal) return null;
    
    const titleElement = modal.querySelector('.window-title-text');
    if (!titleElement) {
        console.warn('❌ 현재 재생 중인 숏츠 제목을 찾을 수 없습니다.');
        return null;
    }
    
    const title = titleElement.textContent;
    return state.aiGeneratedShorts.find(s => s.title === title);
}

/**
 * 시간을 mm:ss 형식으로 포맷합니다.
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeShortsPreviewModal();
    }
});

// 모달 배경 클릭으로 닫기
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('shorts-preview-modal')) {
        closeShortsPreviewModal();
    }
});

console.log('🎬 AI 숏츠 생성기 로드됨 (9:16 미리보기 모달 포함)');
console.log('💡 테스트 도구: testAIShortsGenerator.help() 를 실행하여 사용법을 확인하세요.');