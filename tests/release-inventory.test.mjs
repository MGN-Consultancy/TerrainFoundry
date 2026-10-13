import {test} from 'node:test';
import assert from 'node:assert/strict';
import {uploadRecords} from '../scripts/release/upload-files.mjs';
import {verifyCollection} from '../scripts/release/collection-coverage.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateKeyPairSync,createHash,sign} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const repository = 'MGN-Consultancy/TerrainFoundry';
const product = {repository, launcherVersion: '1.2.3'};
const tag = 'v1.19.1-content-9-1';
const file = (name, releaseTag=tag) => ({name, url:`https://github.com/${repository}/releases/download/${releaseTag}/${name}`, size:10, sha256:'a'.repeat(64)});
function fixture() {
  const launcher = file('TerrainFoundryLauncher.exe', 'old-launcher');
  return {release:{schema:2,repository,launcher,client:{files:{'TerrainFoundry.exe':file('client-new.bin'), 'old.dll':file('client-old.bin','old-client')}},assets:[{id:'starter',files:{'models/piece.bin':file('content-new.bin'), 'models/old.bin':file('content-old.bin','old-content')}}]},legacy:{schema:1,repository,launcher}};
}
test('upload includes only declared artifacts belonging to the current tag', () => {
  const {release,legacy}=fixture();
  assert.deepEqual([...uploadRecords(release,legacy,product,tag,'content').keys()],
    ['channel.json','component-channel.json','client-new.bin','content-new.bin']);
});
test('launcher updates include current installer and deduplicate shared launcher reference', () => {
  const {release,legacy}=fixture();
  release.launcher=legacy.launcher=file('TerrainFoundryLauncher.exe');
  const names=[...uploadRecords(release,legacy,product,tag,'launcher').keys()];
  assert.equal(names.filter(name=>name==='TerrainFoundryLauncher.exe').length,1);
  assert.ok(names.includes('TerrainFoundryLauncher-1.2.3-win-x64.msi'));
});
test('unchanged components can publish only channels without copying prior artifacts', () => {
  const {release,legacy}=fixture();
  release.client.files={'TerrainFoundry.exe':file('client-old.bin','old-client')};
  release.assets=[];
  assert.equal(uploadRecords(release,legacy,product,tag,'client').size,2);
});
test('upload rejects traversal, foreign repositories, conflicting content and missing new launcher', () => {
  const {release,legacy}=fixture();
  release.client.files={'TerrainFoundry.exe':file('../private.bin')};
  assert.throws(()=>uploadRecords(release,legacy,product,tag,'content'),/Unsafe/);
  release.client.files={'TerrainFoundry.exe':{...file('client-new.bin'),url:'https://evil.invalid/file'}};
  assert.throws(()=>uploadRecords(release,legacy,product,tag,'content'),/URL/);
  release.client.files={'TerrainFoundry.exe':file('content-new.bin')};
  release.assets[0].files['models/piece.bin'].sha256='b'.repeat(64);
  assert.throws(()=>uploadRecords(release,legacy,product,tag,'content'),/Conflicting/);
  release.assets=[];
  assert.throws(()=>uploadRecords(release,legacy,product,tag,'launcher'),/missing/);
  assert.throws(()=>uploadRecords({...release,repository:'other/repo'},legacy,product,tag,'client'),/repository/);
});
test('CLI verifies both signed channels and selected hashes while ignoring stale local files', async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'terrain-upload-test-'));
  try {
    const out=path.join(root,'release/publish');
    await fs.mkdir(out,{recursive:true});
    await fs.mkdir(path.join(root,'release-config'));
    const keys=generateKeyPairSync('rsa',{modulusLength:2048});
    await fs.writeFile(path.join(root,'release-config/update-public.pem'),keys.publicKey.export({type:'spki',format:'pem'}));
    await fs.writeFile(path.join(root,'release-config/product.json'),JSON.stringify(product));
    await fs.writeFile(path.join(root,'package.json'),JSON.stringify({version:'1.19.1'}));
    const {release,legacy}=fixture();
    release.version=legacy.version='1.19.1';
    const bytes=Buffer.alloc(48,7);
    const meta={...file('content-current.bin'),size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
    release.client.files={'TerrainFoundry.exe':file('client-old.bin','old-client')};
    const part={vertices:1,indices:0,length:24};
    release.assets=[{id:'starter',files:{'models/piece.bin':meta},index:{piece:{file:'models/piece.bin',raw:part,connected:part,sha256:meta.sha256}}}];
    await fs.mkdir(path.join(root,'desktop'));
    await fs.writeFile(path.join(root,'desktop/builtin-index.json'),JSON.stringify({piece:{pack:'starter'}}));
    await fs.writeFile(path.join(out,meta.name),bytes);
    await fs.writeFile(path.join(out,'old-client.zip'),'do not publish');
    const signed=value=>{const payload=Buffer.from(JSON.stringify(value));return {payload:payload.toString('base64'),signature:sign('RSA-SHA256',payload,keys.privateKey).toString('base64')};};
    await fs.writeFile(path.join(out,'channel.json'),JSON.stringify(signed(legacy)));
    const envelope=signed(release);
    await fs.writeFile(path.join(out,'component-channel.json'),JSON.stringify(envelope));
    const script=fileURLToPath(new URL('../scripts/release/upload-files.mjs',import.meta.url));
    const invoke=env=>spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8',env:{...process.env,TERRAIN_COMPONENT:'content',TERRAIN_RELEASE_TAG:tag,GITHUB_REPOSITORY:repository,...env}});
    let result=invoke();
    assert.equal(result.status,0,result.stderr);
    assert.equal(result.stdout.trim().split(/\r?\n/).length,3);
    assert.doesNotMatch(result.stdout,/old-client/);
    await fs.writeFile(path.join(out,meta.name),'tampered');
    result=invoke();
    assert.notEqual(result.status,0);
    assert.equal(result.stdout,'');
    assert.match(result.stderr,/differs from signed channel/);
    await fs.writeFile(path.join(out,meta.name),bytes);
    await fs.writeFile(path.join(out,'component-channel.json'),JSON.stringify({...envelope,signature:Buffer.alloc(256).toString('base64')}));
    result=invoke();
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/Invalid channel signature/);
    result=invoke({GITHUB_REPOSITORY:'wrong/repository'});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/Workflow repository differs/);
  } finally {await fs.rm(root,{recursive:true,force:true});}
});
test('collection coverage retains required legacy pieces and full-detail print dependencies', () => {
  const part={vertices:1,indices:0,length:24},sha256='a'.repeat(64);
  const entry={file:'models/piece.bin',raw:part,connected:part,sha256,
    printFiles:[{pack:'print-pack',file:'piece.stl',size:84,sha256}]};
  const release={assets:[{id:'legacy',index:{piece:entry},files:{'models/piece.bin':{size:48,sha256}}},
    {id:'print-pack',index:{},files:{'print/piece.stl':{size:84,sha256}}}]};
  assert.deepEqual(verifyCollection(release,{piece:{pack:'legacy'}}),{requiredPieces:1,shippedPieces:1,packs:2,printFiles:1});
  assert.throws(()=>verifyCollection(release,{missing:{pack:'legacy'}}),/Missing catalogue piece/);
  release.assets[1].files={};
  assert.throws(()=>verifyCollection(release,{piece:{pack:'legacy'}}),/print file/);
  release.assets[1].files={'print/piece.stl':{size:84,sha256}};
  release.assets[0].files['models/piece.bin'].size=47;
  assert.throws(()=>verifyCollection(release,{piece:{pack:'legacy'}}),/truncated/);
  release.assets[0].files['models/piece.bin'].size=48;
  release.assets[0].files['models/piece.bin'].sha256='b'.repeat(64);
  assert.throws(()=>verifyCollection(release,{piece:{pack:'legacy'}}),/Model hash/);
});
