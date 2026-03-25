const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('skoros', {
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  downloadFile: (opts) => ipcRenderer.invoke('download-file', opts),
  onBackendReady: (cb) => ipcRenderer.on('backend-ready', cb),
  onBackendError: (cb) => ipcRenderer.on('backend-error', (_, msg) => cb(msg)),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_, data) => cb(data)),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  isDesktop: true,
});
