// Electron packages native files without the development node_modules tree.
const fs=require('node:fs/promises'),path=require('node:path');
async function sync(){const moduleFile=require.resolve('fflate'),root=path.dirname(path.dirname(moduleFile)),target=path.join(__dirname,'../desktop/vendor');await fs.mkdir(target,{recursive:true});await fs.copyFile(moduleFile,path.join(target,'fflate.cjs'));await fs.copyFile(path.join(root,'LICENSE'),path.join(target,'fflate-LICENSE.txt'));}
module.exports=sync;if(require.main===module)sync().catch(e=>{console.error(e.message);process.exitCode=1;});
