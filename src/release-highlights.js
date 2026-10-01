import release from './release-highlights.json';
const acknowledgedKey='terrain-foundry-release-acknowledged';
export function showReleaseHighlights(continueStartup){
 let acknowledged='';try{acknowledged=localStorage.getItem(acknowledgedKey);}catch{}
 if(acknowledged===release.version){continueStartup();return;}
 const dialog=document.createElement('dialog');dialog.id='release-dialog';dialog.setAttribute('aria-labelledby','release-title');
 const eyebrow=document.createElement('p');eyebrow.className='eyebrow';eyebrow.textContent='WHAT’S NEW · '+release.version;
 const title=document.createElement('h2');title.id='release-title';title.textContent=release.title;
 const list=document.createElement('ul');list.className='release-features';
 for(const feature of release.features){const li=document.createElement('li'),heading=document.createElement('strong'),body=document.createElement('p');heading.textContent=feature.title;body.textContent=feature.description;li.append(heading,body);list.append(li);}
 const note=document.createElement('p');note.className='tutorial-local';note.textContent='Acknowledgement is saved on this PC. No internet connection is required.';
 const button=document.createElement('button');button.id='release-acknowledge';button.className='primary';button.textContent='Got it';
 dialog.append(eyebrow,title,list,note,button);document.body.append(dialog);
 // Acknowledge explicitly; Escape must not silently suppress the release next time.
 dialog.addEventListener('cancel',event=>event.preventDefault());
 button.onclick=()=>{try{localStorage.setItem(acknowledgedKey,release.version);}catch{}dialog.close();};
 dialog.addEventListener('close',()=>{dialog.remove();continueStartup();},{once:true});
 dialog.showModal();button.focus();
}
