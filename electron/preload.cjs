const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  appVersion: (() => {
    try {
      return ipcRenderer.sendSync('get-app-version-sync') || '1.4.6';
    } catch {
      return '1.4.6';
    }
  })(),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  openExternalUrl: (url) => ipcRenderer.send('open-external-url', url),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  reloadApp: () => ipcRenderer.send('app-reload-update'),
  applyInAppUpdate: (url) => ipcRenderer.invoke('apply-in-app-update', url),
});
