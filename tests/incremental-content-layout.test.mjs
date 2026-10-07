import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {splitPackedContent} from '../scripts/release/split-packed-content.mjs';

test('combined scenery content splits into independent verified piece files',()=>{
 const bin=Buffer.from([99,1,2,3,4,5,6,98]),first=bin.subarray(1,4),second=bin.subarray(4,7);
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const part=(length)=>({vertices:1,indices:0,length});
 const index={
  'a-001':{offset:1,raw:part(1),connected:part(2),sha256:hash(first)},
  'a-002':{offset:4,raw:part(2),connected:part(1),sha256:hash(second)}
 };
 const result=splitPackedContent(index,bin);
 assert.deepEqual([...result.files.get('models/a-001.bin')],[1,2,3]);
 assert.deepEqual([...result.files.get('models/a-002.bin')],[4,5,6]);
 assert.equal(result.index['a-001'].file,'models/a-001.bin');
 assert.ok(!('offset' in result.index['a-001']));
});

test('combined scenery splitter rejects overlapping or tampered ranges',()=>{
 const bin=Buffer.from([1,2,3,4,5,6]),raw={vertices:1,indices:0,length:1},connected={vertices:1,indices:0,length:2};
 assert.throws(()=>splitPackedContent({one:{offset:0,raw,connected},two:{offset:2,raw,connected}},bin),/overlap/);
 assert.throws(()=>splitPackedContent({one:{offset:0,raw:{...raw,length:2},connected:{...connected,length:1},sha256:'0'.repeat(64)}},bin),/hash mismatch/);
});
