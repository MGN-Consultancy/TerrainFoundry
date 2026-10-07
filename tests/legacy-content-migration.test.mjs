import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {strToU8,zipSync} from 'fflate';
import {splitLegacyArchive} from '../scripts/release/legacy-content.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const model=Buffer.from([1,2,3,4,5]),license=Buffer.from('CC0');
 const index={'a-001':{offset:0,raw:{length:2},connected:{length:3},sha256:sha(model),openlock:{kind:'floor'}}};
 const source={'index.json':strToU8(JSON.stringify(index)),'meshes.bin':model,'LICENSE.txt':license};
 const asset={id:'starter',name:'scenery-starter.zip',files:Object.fromEntries(Object.entries(source).map(([name,data])=>[name,sha(data)]))};
 return {asset,zip:Buffer.from(zipSync(source)),model,license};
}
test('migration splits verified legacy mesh ranges into one file per piece',()=>{
 const f=fixture(),result=splitLegacyArchive(f.asset,f.zip);
 assert.equal(result.pieceCount,1);assert.equal(result.index['a-001'].file,'models/a-001.bin');
 assert.deepEqual(result.files.get('models/a-001.bin'),f.model);assert.deepEqual(result.files.get('LICENSE.txt'),f.license);
 assert.equal(result.totalBytes,f.model.length+f.license.length+Buffer.byteLength(JSON.stringify({'a-001':{offset:0,raw:{length:2},connected:{length:3},sha256:sha(f.model),openlock:{kind:'floor'}}})));
});
test('migration rejects archive inventory tampering and unsafe paths',()=>{
 const f=fixture();assert.throws(()=>splitLegacyArchive({...f.asset,files:{...f.asset.files,'../escape':'0'.repeat(64)}},f.zip),/inventory differs|Unsafe/);
 assert.throws(()=>splitLegacyArchive({...f.asset,name:'scenery-starter/../../bad.zip'},f.zip),/Invalid pack entry/);
});
