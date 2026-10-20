import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const generator=path.join(repo,'scripts/release/launcher-msi.mjs');
const run=(exe,args,cwd)=>{const r=spawnSync(exe,args,{cwd,encoding:'utf8',windowsHide:true,timeout:120000});assert.equal(r.error,undefined,r.error?.message);assert.equal(r.status,0,`${exe} failed:\n${r.stdout}\n${r.stderr}`);return r.stdout;};

test('launcher MSI cleanup requires explicit uninstall, excludes major upgrade and propagates failure',async()=>{
 const source=await fs.readFile(generator,'utf8');
 const action=source.match(/<CustomAction\s+Id="CleanupLauncherPayload"[^>]*\/>/)?.[0];
 assert.ok(action,'cleanup custom action exists');
 for(const attribute of ['FileKey="LauncherExe"','ExeCommand="--uninstall-cleanup"','Execute="deferred"','Impersonate="yes"','Return="check"'])assert.ok(action.includes(attribute),attribute);
 assert.match(source,/<Custom Action="CleanupLauncherPayload" Before="RemoveFiles">REMOVE=&quot;ALL&quot; AND NOT UPGRADINGPRODUCTCODE<\/Custom>/);
 assert.match(source,/<File Id="InstallationMarker"/,'ownership marker installed with launcher');
 assert.match(source,/<MajorUpgrade DowngradeErrorMessage=/,'downgrade protection retained');
 assert.match(source,/UpgradeCode="DA58A4EE-E058-4A59-A955-208F3C556AA5"/,'existing upgrade family retained');
 assert.doesNotMatch(source,/<RemoveFile[^>]+Name="\*"/,'no wildcard removal of chosen directory');
});

test('isolated generated MSI compiles checked uninstall cleanup before file removal and preserves upgrade condition',async t=>{
 if(process.platform!=='win32'){t.skip('Windows Installer COM requires Windows');return;}
 const wix=path.join(repo,'.tools','wix314');
 if(!await fs.stat(path.join(wix,'candle.exe')).catch(()=>null)){t.skip('Pinned WiX toolchain not provisioned; run node scripts/release/wix.mjs');return;}
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'tf-msi-tables-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const copy=async relative=>{const target=path.join(root,relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(path.join(repo,relative),target);};
 for(const relative of ['release-config/product.json','launcher/installation.json','launcher/License.rtf','LICENSE','ASSET-LICENSE.txt','third-party/openlock/CLIP-LICENSE.txt','third-party/openlock/MGN-COMMERCIAL-LICENSE.txt','LICENSE-SCOPE.md','THIRD-PARTY-NOTICES.md','scripts/release/create-icon.ps1'])await copy(relative);
 await fs.mkdir(path.join(root,'.tools'),{recursive:true});await fs.symlink(wix,path.join(root,'.tools','wix314'),'junction');
 run('powershell.exe',['-NoProfile','-File',path.join(root,'scripts/release/create-icon.ps1')],root);
 const fixture=path.join(root,'launcher','Fixture.cs');await fs.writeFile(fixture,'class Fixture { static int Main() { return 0; } }');
 const compiler=path.join(process.env.WINDIR,'Microsoft.NET','Framework64','v4.0.30319','csc.exe');
 run(compiler,['/nologo','/target:exe',`/out:${path.join(root,'launcher','TerrainFoundryLauncher.exe')}`,fixture],root);
 run(process.execPath,[generator],root);
 const {launcherVersion}=JSON.parse(await fs.readFile(path.join(root,'release-config/product.json'),'utf8'));
 const msi=path.join(root,'release','publish',`TerrainFoundryLauncher-${launcherVersion}-win-x64.msi`);
 const inspect=path.join(root,'inspect.ps1');await fs.writeFile(inspect,`param([string]$File)
$ErrorActionPreference='Stop'
$installer=New-Object -ComObject WindowsInstaller.Installer
$db=$installer.OpenDatabase($File,0)
function Row([string]$query){$v=$db.OpenView($query);[void]$v.Execute();$r=$v.Fetch();if(!$r){throw 'Required MSI table row missing'};$values=@();for($i=1;$i -le (($query -split ' FROM ')[0] -split ',').Count;$i++){$values+=,$r.StringData($i)};[void]$v.Close();return ,$values}
$action=Row 'SELECT \`Type\`, \`Source\`, \`Target\` FROM \`CustomAction\` WHERE \`Action\` = ''CleanupLauncherPayload'''
$cleanup=Row 'SELECT \`Condition\`, \`Sequence\` FROM \`InstallExecuteSequence\` WHERE \`Action\` = ''CleanupLauncherPayload'''
$remove=Row 'SELECT \`Sequence\` FROM \`InstallExecuteSequence\` WHERE \`Action\` = ''RemoveFiles'''
$initialize=Row 'SELECT \`Sequence\` FROM \`InstallExecuteSequence\` WHERE \`Action\` = ''InstallInitialize'''
$marker=Row 'SELECT \`Component_\` FROM \`File\` WHERE \`File\` = ''InstallationMarker'''
$exe=Row 'SELECT \`Component_\` FROM \`File\` WHERE \`File\` = ''LauncherExe'''
@{type=$action[0];source=$action[1];target=$action[2];condition=$cleanup[0];cleanup=$cleanup[1];remove=$remove[0];initialize=$initialize[0];markerComponent=$marker[0];exeComponent=$exe[0]} | ConvertTo-Json -Compress
`);
 const table=JSON.parse(run('powershell.exe',['-NoProfile','-File',inspect,msi],root).trim());assert.ok(table.type,JSON.stringify(table));
 assert.equal(table.type&0x3f,18,'installed-file executable custom action');
 assert.equal(table.type&0x400,0x400,'deferred inside installation transaction');
 assert.equal(table.type&0x800,0,'runs as current user, matching per-user profile');
 assert.equal(table.type&0xc0,0,'checked synchronous return; failures abort uninstall');
 assert.equal(table.source,'LauncherExe');assert.equal(table.target,'--uninstall-cleanup');
 assert.equal(table.condition,'REMOVE="ALL" AND NOT UPGRADINGPRODUCTCODE');
 assert.ok(Number(table.cleanup)>Number(table.initialize)&&Number(table.cleanup)<Number(table.remove),'cleanup before file removal, while marker and executable exist');
 assert.equal(table.markerComponent,table.exeComponent,'MSI marker shares launcher lifetime');
});
