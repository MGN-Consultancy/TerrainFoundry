import test from 'node:test';import assert from 'node:assert/strict';
import {createThumbnailQueue} from '../src/thumbnail-queue.js';
test('search results return before thumbnails, obsolete searches cancel and previews yield between items',()=>{
 const work=new Map(),rendered=[],ready=[];let id=0;const q=createThumbnailQueue({schedule:fn=>{work.set(++id,fn);return id;},cancel:key=>work.delete(key),render:item=>{rendered.push(item);return item+' image';},onReady:(item,image)=>ready.push([item,image])});
 q.replace(['old-1','old-2']);assert.deepEqual(rendered,[]);q.replace(['new-1','new-2']);assert.equal(work.size,1);
 function tick(){const [key,fn]=work.entries().next().value;work.delete(key);fn();}tick();assert.deepEqual(rendered,['new-1']);assert.equal(work.size,1);tick();assert.deepEqual(ready,[['new-1','new-1 image'],['new-2','new-2 image']]);assert.equal(work.size,0);
 q.replace(['never']);q.dispose();assert.equal(work.size,0);
});
test('one broken preview does not prevent other results or leave the queue stuck',()=>{const work=[],errors=[],ready=[];const q=createThumbnailQueue({schedule:fn=>{work.push(fn);return work.length;},cancel:()=>{},render:item=>{if(item==='bad')throw Error('bad mesh');return item;},onReady:item=>ready.push(item),onError:item=>errors.push(item)});q.replace(['bad','good']);work.shift()();work.shift()();assert.deepEqual(errors,['bad']);assert.deepEqual(ready,['good']);});
