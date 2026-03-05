const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openDataDir: () => ipcRenderer.invoke('app:openDataDir'),
  getDataDir: () => ipcRenderer.invoke('app:getDataDir'),
  pickDataDir: () => ipcRenderer.invoke('app:pickDataDir'),
  readStateSync: () => ipcRenderer.sendSync('app:readStateSync'),
  writeStateSync: (state) => ipcRenderer.sendSync('app:writeStateSync', state),
  exportData: (state) => ipcRenderer.invoke('app:exportData', state),
  importData: () => ipcRenderer.invoke('app:importData'),
  recognizeImage: (b64) => ipcRenderer.invoke('app:ocr', b64)
})
