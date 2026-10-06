const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('keyEntry',{save:key=>ipcRenderer.invoke('campaign-key-entry',key)});
