import fs from 'node:fs/promises';
import {defaults,piece} from '../src/model.js';
import {printFiles} from '../src/print-pack.js';
const p=defaults();p.name='Underkeep connector test';p.items=[piece('r-041',0,0),piece('r-029',.25,.25),piece('r-022',5,0),piece('r-035',5,1.25),piece('r-005',6.25,0)];p.items.forEach(i=>i.color='#ffffff');
const pack=printFiles(p);if(pack.report.overlaps.length||pack.report.matches.length!==4||pack.clipQuantity!==5)throw Error('Test assembly does not join as expected');
const dir='deliverables/underkeep-fit-test';await fs.mkdir(dir,{recursive:true});for(const f of pack.files)await fs.writeFile(`${dir}/${f.name}`,f.data);
console.log('Five terrain pieces, four assembly connections, five clips including the existing fit-test pair. Physical fit remains unverified.');
