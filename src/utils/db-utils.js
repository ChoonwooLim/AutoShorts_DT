// js/utils/db-utils.js

const DB_NAME = 'AutoShortsDB';
const DB_VERSION = 1;
const STORE_NAME = 'fileHandles';

let db;

/**
 * IndexedDB를 열거나 업그레이드합니다.
 * @returns {Promise<IDBDatabase>} 데이터베이스 인스턴스
 */
function openDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject('IndexedDB error');
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('✅ IndexedDB opened successfully.');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const dbInstance = event.target.result;
            if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
                dbInstance.createObjectStore(STORE_NAME);
                console.log(`📦 Object store "${STORE_NAME}" created.`);
            }
        };
    });
}

/**
 * IndexedDB에서 값을 가져옵니다.
 * @param {string} key 가져올 값의 키
 * @returns {Promise<any>} 저장된 값
 */
export async function get(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onerror = (event) => {
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
    });
}

/**
 * IndexedDB에 값을 저장합니다.
 * @param {string} key 저장할 값의 키
 * @param {any} value 저장할 값
 * @returns {Promise<void>}
 */
export async function set(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);

        request.onerror = (event) => {
            reject(event.target.error);
        };

        request.onsuccess = () => {
            resolve();
        };
    });
}

/**
 * IndexedDB에서 값을 삭제합니다.
 * @param {string} key 삭제할 값의 키
 * @returns {Promise<void>}
 */
export async function del(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onerror = (event) => {
            reject(event.target.error);
        };

        request.onsuccess = () => {
            resolve();
        };
    });
}
