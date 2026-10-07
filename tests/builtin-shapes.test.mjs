import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {builtinShapeReader} from '../desktop/builtin-shapes.cjs';
test('desktop reads only the selected immutable asset range',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'terrain-shape-reader-'));
 await fs.writeFile(path.join(dir,'meshes.bin'),Buffer.from([1,2,3,4,5,6,7,8]));
 await fs.writeFile(path.join(dir,'index.json'),JSON.stringify({'r-001':{offset:2,raw:{length:2},connected:{length:4}}}));
 const read=builtinShapeReader(dir);assert.deepEqual([...read('r-001',false)],[3,4]);assert.deepEqual([...read('r-001',true)],[5,6,7,8]);
 for(const id of ['../../secret','r-999',null,'r-001/../'])assert.throws(()=>read(id,true));assert.throws(()=>read('r-001','true'));
 await fs.writeFile(path.join(dir,'meshes.bin'),Buffer.from([1,2,3]));assert.throws(()=>read('r-001',true),/Incomplete asset pack/);
});
test('desktop reads each piece from its own replaceable content file',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'terrain-piece-content-'));
 try{
  await fs.mkdir(path.join(dir,'models'));
  await fs.writeFile(path.join(dir,'models','r-001.bin'),Buffer.from([1,2,3,4,5,6]));
  await fs.writeFile(path.join(dir,'index.json'),JSON.stringify({'r-001':{file:'models/r-001.bin',raw:{length:2},connected:{length:4}}}));
  const read=builtinShapeReader(dir);assert.deepEqual([...read('r-001',false)],[1,2]);assert.deepEqual([...read('r-001',true)],[3,4,5,6]);
  await fs.writeFile(path.join(dir,'index.json'),JSON.stringify({'r-001':{file:'../outside.bin',raw:{length:2},connected:{length:4}}}));
  assert.throws(()=>builtinShapeReader(dir)('r-001',false),/Unsafe asset file path/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
