const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('packEntry',{
 start:email=>ipcRenderer.invoke('premium-entry-start',email),
 verify:otp=>ipcRenderer.invoke('premium-entry-verify',otp),
 activate:code=>ipcRenderer.invoke('premium-entry-activate',code),
 progress:callback=>{ipcRenderer.on('premium-entry-progress',(_,status)=>callback(status));}
});
