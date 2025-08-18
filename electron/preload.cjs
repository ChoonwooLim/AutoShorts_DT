const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('env', { isElectron: true });

contextBridge.exposeInMainWorld('nativeFFmpeg', {
  extractAudio: (filePath) => ipcRenderer.invoke('ffmpeg:extract-audio', filePath),
  version: () => ipcRenderer.invoke('ffmpeg:version'),
  transcode: (params) => ipcRenderer.invoke('ffmpeg:transcode', params),
  onProgress: (cb) => ipcRenderer.on('ffmpeg:progress', (_e, data) => cb?.(data))
});

contextBridge.exposeInMainWorld('nativeIO', {
  readFileAsBlobUrl: async (absolutePath) => ipcRenderer.invoke('io:read-file-url', absolutePath),
  readFileBytes: async (absolutePath) => ipcRenderer.invoke('io:read-file-bytes', absolutePath)
});

contextBridge.exposeInMainWorld('secureKeys', {
  load: () => ipcRenderer.invoke('keys:load'),
  save: (data) => ipcRenderer.invoke('keys:save', data)
});

contextBridge.exposeInMainWorld('sttProxy', {
  openai: (bytes, language, apiKey) => ipcRenderer.invoke('stt:openai', { bytes, language, apiKey })
});


