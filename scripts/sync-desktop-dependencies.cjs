// Electron packages native files without the development node_modules tree.
const fs=require('node:fs/promises'),path=require('node:path');
async function sync(){
 const moduleFile=require.resolve('fflate'),root=path.dirname(path.dirname(moduleFile)),target=path.join(__dirname,'../desktop/vendor');
 await fs.mkdir(target,{recursive:true});
 await fs.copyFile(moduleFile,path.join(target,'fflate.cjs'));
 await fs.copyFile(path.join(root,'LICENSE'),path.join(target,'fflate-LICENSE.txt'));
 const manifold=path.join(__dirname,'../node_modules/manifold-3d');
 if(JSON.parse(await fs.readFile(path.join(manifold,'package.json'),'utf8')).name!=='manifold-3d')throw Error('Unexpected geometry runtime package');
 for(const file of ['manifold.js','manifold.wasm'])await fs.copyFile(path.join(manifold,file),path.join(target,file));
 await fs.copyFile(path.join(manifold,'LICENSE'),path.join(target,'manifold-LICENSE.txt'));
 for(const file of ['openlock-build.js','openlock-profile.js','official-socket-data.js'])await fs.copyFile(path.join(__dirname,'../src',file),path.join(target,file));
 await fs.copyFile(path.join(__dirname,'clean-mesh-data.mjs'),path.join(target,'clean-mesh-data.mjs'));
}
module.exports=sync;if(require.main===module)sync().catch(e=>{console.error(e.message);process.exitCode=1;});
