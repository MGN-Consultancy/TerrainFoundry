import fs from 'node:fs/promises';
import {defaults,piece,openlockDemo} from '../src/model.js';
import {printFiles,stlFile} from '../src/print-pack.js';
const dir='deliverables/integrated-openlock';await fs.mkdir(dir,{recursive:true});
const p=defaults();p.name='OpenLOCK first-fit test';p.items=[piece('floor',0,0),piece('wall-low',0,1.25,180)];
for(const file of printFiles(p).files)await fs.writeFile(dir+'/'+file.name,file.data);
await fs.writeFile('examples/OpenLOCK Courtyard.terrain',JSON.stringify(openlockDemo(),null,2));
await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/import-column.stl',stlFile('pillar',{...defaults(),connectors:'none'}).file.data);
console.log('Exported first-fit pack, courtyard project and plain import fixture.');
