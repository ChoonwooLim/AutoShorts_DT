import { contextBridge } from 'electron';

// 최소 브리지. 필요 시 API 확장
contextBridge.exposeInMainWorld('env', {
  isElectron: true
});


