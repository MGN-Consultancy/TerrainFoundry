const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('packEntry',{
 licence:()=>ipcRenderer.invoke('premium-entry-licence'),
 activate:code=>ipcRenderer.invoke('premium-entry-activate',code),
 progress:callback=>{ipcRenderer.on('premium-entry-progress',(_,status)=>callback(status));}
});
