const fs=require('node:fs/promises');
const path=require('node:path');
const {version}=require('../package.json');
const {execFileSync}=require('node:child_process');
(async()=>{execFileSync(process.execPath,['scripts/asset-catalog.mjs'],{stdio:'inherit'});const {packager}=await import('@electron/packager');const paths=await packager({dir:'.',name:'TerrainFoundry',platform:'win32',arch:'x64',out:'release/desktop-'+version,overwrite:true,prune:false,ignore:file=>{const top=file.replace(/^[\\/]+/,'').split(/[\\/]/)[0];return !!top&&!['dist','desktop','package.json','README.md','LICENSE','ASSET-LICENSE.txt','THIRD-PARTY-NOTICES.md'].includes(top);},asar:true,appCopyright:'Terrain Foundry contributors',win32metadata:{CompanyName:'MGN CONSULTANCY LIMITED',FileDescription:'Offline tabletop terrain designer',ProductName:'Terrain Foundry'}});for(const p of paths){await fs.copyFile('README.md',path.join(p,'START-HERE.md'));console.log(p);}})().catch(e=>{console.error(e);process.exit(1);});







