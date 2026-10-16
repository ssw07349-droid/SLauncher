const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('native', {
  list: () => ipcRenderer.invoke('list'),
  icon: (p) => ipcRenderer.invoke('icon', p),
  run: (p) => ipcRenderer.invoke('run', p),
  add: () => ipcRenderer.invoke('add')
});
