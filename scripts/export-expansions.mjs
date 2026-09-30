import fs from 'node:fs/promises';
import {EXPANSION_KIT} from '../src/expansion-kit.js';
import {defaults,piece,expansionDemo} from '../src/model.js';
import {printFiles} from '../src/print-pack.js';
const root='deliverables/expansion-test-pack';await fs.mkdir(root,{recursive:true});
for(const [prefix,name]of [['q-','Ember Quarry'],['t-','The Gauntlet'],['c-','Greywatch Castle']]){
 const kit=EXPANSION_KIT.filter(k=>k.id.startsWith(prefix)),p=defaults();p.name=name+' asset catalogue';p.items=kit.map((k,i)=>({...piece(k.id,(i%5-2)*3,(Math.floor(i/5)-2)*3),color:'#ffffff'}));const dir=root+'/'+name;await fs.mkdir(dir,{recursive:true});
 for(const f of printFiles(p).files)await fs.writeFile(dir+'/'+f.name,f.data);
 await fs.writeFile(dir+'/Example.terrain',JSON.stringify(expansionDemo(prefix),null,2));
 await fs.writeFile('examples/'+name+'.terrain',JSON.stringify(expansionDemo(prefix),null,2));
}
await fs.copyFile('docs/EXPANSION-COLLECTIONS.md',root+'/START-HERE.md');
console.log('Exported 51 unique expansion STLs, three catalogues and three editable examples.');
