// Yield between previews and cancel obsolete searches before doing expensive work.
export function createThumbnailQueue({render,onReady,onError=()=>{},schedule=fn=>setTimeout(fn,16),cancel=clearTimeout}){
 let revision=0,handle=null,disposed=false;
 function stop(){revision++;if(handle!==null)cancel(handle);handle=null;}
 function replace(items,context){stop();if(disposed)return;const current=revision,pending=[...items];
  function next(){handle=null;if(disposed||current!==revision||!pending.length)return;const item=pending.shift();try{const image=render(item,context);if(current===revision)onReady(item,image,context);}catch(error){if(current===revision)onError(item,error);}if(current===revision&&pending.length)handle=schedule(next);}
  if(pending.length)handle=schedule(next);
 }
 return {replace,stop,dispose(){stop();disposed=true;}};
}
