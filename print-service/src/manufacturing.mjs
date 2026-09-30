import {zipSync,strToU8} from 'fflate';

const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
// Called only with inspectPack-validated models and quantities. Meshes are stored
// once; build items carry copy counts without multiplying large mesh payloads.
export function manufacturing3mf(files,items) {
 const resources=[],build=[];let instance=0;
 const columns=Math.ceil(Math.sqrt(items.reduce((n,i)=>n+i.quantity,0)));
 const pitch=Math.max(...items.flatMap(i=>i.sizeMm.slice(0,2)))+10;
 for(const [index,item] of items.entries()){
  const bytes=files.get(item.file.toLowerCase()).bytes,points=[];
  if(bytes.length>=84&&84+bytes.readUInt32LE(80)*50===bytes.length){
   for(let i=0;i<bytes.readUInt32LE(80);i++)for(let j=0;j<3;j++)points.push([0,1,2].map(k=>bytes.readFloatLE(84+i*50+12+j*12+k*4)));
  }else for(const m of bytes.toString('utf8').matchAll(/\bvertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/g))points.push(m.slice(1).map(Number));
  const minimum=[Infinity,Infinity,Infinity];for(const p of points)for(let k=0;k<3;k++)minimum[k]=Math.min(minimum[k],p[k]);
  const vertices=[],triangles=[],lookup=new Map();
  for(let i=0;i<points.length;i+=3){const face=[];for(const p of points.slice(i,i+3)){
   const key=p.join(',');let id=lookup.get(key);if(id===undefined){id=vertices.length;lookup.set(key,id);vertices.push(`<vertex x="${p[0]}" y="${p[1]}" z="${p[2]}"/>`);}face.push(id);
  }triangles.push(`<triangle v1="${face[0]}" v2="${face[1]}" v3="${face[2]}"/>`);}
  const id=index+1;resources.push(`<object id="${id}" type="model" name="${xml(item.name)}"><mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh></object>`);
  for(let copy=0;copy<item.quantity;copy++,instance++)build.push(`<item objectid="${id}" transform="1 0 0 0 1 0 0 0 1 ${(instance%columns)*pitch-minimum[0]} ${Math.floor(instance/columns)*pitch-minimum[1]} ${-minimum[2]}"/>`);
 }
 const model=`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Application">Terrain Foundry</metadata><resources>${resources.join('')}</resources><build>${build.join('')}</build></model>`;
 return zipSync({
  '[Content_Types].xml':strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'),
  '_rels/.rels':strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
  '3D/3dmodel.model':strToU8(model)
 },{level:1});
}

export const workshopReadme=`Terrain Foundry workshop pack
Open OPEN-IN-BAMBU.3mf in Bambu Studio once. If prompted, load geometry.
Every quoted copy is already included, including listed clips and fit tests.
Do not import the STLs as well: they are fallback originals, not extra pieces.
This is an unsliced geometry collection, not a printer-specific project.
Select the requested printer, nozzle, material and colour from the work order.
Use Arrange All to distribute the objects across plates; the initial staging
grid is not a printable plate layout. Check quantities against quantities.csv.
Inspect orientation, supports, layers and fit tests before printing.
No G-code, printer credentials or remote printing commands are included.
OpenLOCK components retain their source licences. Commercial printing relies
on the operator's separate permission; this pack grants no new licence.
`;
