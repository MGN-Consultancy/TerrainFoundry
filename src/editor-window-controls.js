export function setupEditorWindowControls({api,onHome,isDirty=()=>false,save=async()=>{},onExit,toast=()=>{}}){
 const header=document.querySelector('#app>header');if(!header)return;
 const controls=document.createElement('div');controls.className='editor-window-controls';
 const confirmation=document.createElement('dialog');confirmation.className='editor-close-confirm';confirmation.innerHTML='<h2>Save your changes?</h2><p>Your scene has changes that have not been saved to its project file.</p><div class="editor-close-actions"><button data-choice="cancel">Keep editing</button><button data-choice="leave">Continue without saving</button><button class="primary" data-choice="save">Save and continue</button></div>';document.body.append(confirmation);
 async function proceed(action){
  if(!isDirty())return action();
  if(confirmation.open)return;
  const choice=await new Promise(resolve=>{confirmation.oncancel=e=>{e.preventDefault();confirmation.close();resolve('cancel');};for(const b of confirmation.querySelectorAll('button'))b.onclick=()=>{confirmation.close();resolve(b.dataset.choice);};confirmation.showModal();});
  if(choice==='cancel')return;
  if(choice==='save'){await save();if(isDirty())return;}
  await action();
 }
 const button=(id,text,title,action)=>{const b=document.createElement('button');b.id=id;b.type='button';b.textContent=text;b.title=title;b.onclick=async()=>{try{await action();}catch(error){toast(error.message,true);}};return b;};
 controls.append(button('editor-close','Close editor','Return to the workshop',()=>proceed(onHome)));
 if(api?.clientWindowAction){controls.append(button('editor-windowed','Windowed','Leave fullscreen or restore the maximised window',()=>api.clientWindowAction('windowed')),button('editor-exit','Exit app','Close Terrain Foundry',()=>proceed(onExit||(()=>api.clientWindowAction('close')))));}
 header.append(controls);
}
