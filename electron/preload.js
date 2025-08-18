import { contextBridge, ipcRenderer } from 'electron';

// 최소 브리지. 필요 시 API 확장
contextBridge.exposeInMainWorld('env', {
  isElectron: true
});

contextBridge.exposeInMainWorld('nativeFFmpeg', {
  extractAudio: (filePath) => ipcRenderer.invoke('ffmpeg:extract-audio', filePath),
  version: () => ipcRenderer.invoke('ffmpeg:version'),
  transcode: (params) => ipcRenderer.invoke('ffmpeg:transcode', params),
  onProgress: (cb) => ipcRenderer.on('ffmpeg:progress', (_e, data) => cb?.(data))
});

contextBridge.exposeInMainWorld('nativeIO', {
  readFileAsBlobUrl: async (absolutePath) => ipcRenderer.invoke('io:read-file-url', absolutePath)
});


