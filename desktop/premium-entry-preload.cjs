const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('packEntry',{
 licence:()=>ipcRenderer.invoke('premium-entry-licence'),
 activate:code=>ipcRenderer.invoke('premium-entry-activate',code),
 deviceStatus:()=>ipcRenderer.invoke('premium-entry-device-status'),
 repairDevice:()=>ipcRenderer.invoke('premium-entry-repair-device'),
 progress:callback=>{ipcRenderer.on('premium-entry-progress',(_,status)=>callback(status));}
});
