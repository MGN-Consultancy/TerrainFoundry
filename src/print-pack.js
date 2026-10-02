import {OPENLOCK_COMMERCIAL_LICENSE,OPENLOCK_LOGO_BASE64} from './openlock-commercial.js';
import {clipFiles} from './print-clip.js';
import {detailedPrintFiles} from './print-scenery.js';
import {builtinIndex} from './builtin-data.js';
import * as THREE from 'three';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import {geometry,connectionSpec} from './geometry.js';
import {KIT} from './model.js';
import {connectionReport,CONNECTOR_NOTICE} from './connections.js';
export function stlFile(type,project){
 const detailed=detailedPrintFiles(type);if(detailed){if(project.grid!==25.4)throw Error('Deepstone uses a fixed 25.4 mm grid');const d=builtinIndex[type].dimensionsMm;return {file:detailed[0],componentFiles:detailed,size:new THREE.Vector3(d.width,d.height,d.depth)};}
 const geo=geometry(type,project.grid,project.assets,project.connectors==='openlock');
 geo.computeBoundingBox();const size=geo.boundingBox.getSize(new THREE.Vector3());
 const mesh=new THREE.Mesh(geo);mesh.rotation.x=Math.PI/2;mesh.updateMatrixWorld(true);
 const file={name:type+'.stl',data:new Uint8Array(new STLExporter().parse(mesh,{binary:true}).buffer)};
 geo.dispose();mesh.material.dispose();return {file,size};
}
export function printFiles(project){
 const types=[...new Set(project.items.map(i=>i.type))],files=[],warnings=[],rows=['Piece,File,Quantity,Width_mm,Depth_mm,Height_mm'];
 for(const type of types){const {file,componentFiles,size:d}=stlFile(type,project);files.push(...(componentFiles||[file]));
  if(d.x>project.printer.x||d.z>project.printer.y||d.y>project.printer.z)warnings.push(KIT.find(k=>k.id===type)?.name||project.assets[type].name);
  for(const part of componentFiles||[file])rows.push(`${type},${part.name},${project.items.filter(i=>i.type===type).length},${d.x.toFixed(2)},${d.z.toFixed(2)},${d.y.toFixed(2)}`);
 }
 const originalRange=types.map(t=>KIT.find(k=>k.id===t)).filter(k=>k?.referenceIndex);if(originalRange.length)files.push({name:'DUNGEON-PIECES.json',data:JSON.stringify(originalRange.map(k=>({id:k.id,name:k.name,referenceIndex:k.referenceIndex,dimensions:k.referenceDimensions,mechanism:k.mechanism,physicalFitVerified:false})),null,2)});
 const report=connectionReport(project),connected=project.connectors==='openlock';
 const clipQuantity=connected?report.matches.length+1:0;
 if(connected){const clip=clipFiles();files.push(...clip.files);rows.push(`OpenLOCK clip 5.4,openlock-clip.stl,${clipQuantity},${clip.size.map(n=>n.toFixed(2)).join(',')}`);
 for(const type of ['fit-floor','fit-wall']){const {file,size}=stlFile(type,project);files.push(file);rows.push(`${type},${file.name},1,${size.x.toFixed(2)},${size.z.toFixed(2)},${size.y.toFixed(2)}`);}
  files.push({name:'OpenLOCK-Compatible.png',data:Uint8Array.from(atob(OPENLOCK_LOGO_BASE64),c=>c.charCodeAt(0))},{name:'MGN-OPENLOCK-COMMERCIAL-LICENSE.txt',data:OPENLOCK_COMMERCIAL_LICENSE},{name:'OPENLOCK-NOTICE.txt',data:CONNECTOR_NOTICE},{name:'connections.json',data:JSON.stringify({units:'mm',connector:'openlock',license:'CC-BY-NC-4.0',nonCommercial:true,templateSource:'printable-scenery-8.6',commercialLicenseEntity:'MGN Consultancy',commercialLicenseUrl:'https://www.printablescenery.com/2026/10/01/mgn-consultancy/',clipCount:report.matches.length,clipFile:'openlock-clip.stl',fitTestClipCount:1,totalClipQuantity:clipQuantity,physicalFitVerified:false,...report,parts:Object.fromEntries(types.map(t=>[t,connectionSpec(t,project.assets)]))},null,2)});
 }
 files.push({name:'quantities.csv',data:rows.join('\n')},{name:'project.terrain',data:JSON.stringify(project,null,2)},{name:'README.txt',data:`Terrain Foundry print pack\nUnits: millimetres. Each STL is one solid at the print origin.\nSee quantities.csv for copy counts. Preview colours are not exported.\nOpen in Bambu Studio, select your printer, nozzle and filament, arrange and slice. Inspect layers and supports.\nBuild-volume warnings: ${warnings.join(', ')||'None for the configured volume; verify your actual printer profile.'}\n${connected?`${CONNECTOR_NOTICE}\nIncluded openlock-clip.stl: print ${clipQuantity} copies (${report.matches.length} for matched scene connections + 1 for the fit test). Add optional spares in Bambu Studio. Quantities are listed in quantities.csv; importing an STL does not set its copy count automatically.\nOverlapping base pairs: ${report.overlaps.length}. ${report.overlaps.length?'Reposition these before printing the full layout.':''}\nUnmatched ports: ${report.freePorts}; unused outside ports are normal.\n`:'Plain original geometry: CC0-1.0. Imported models retain source licensing. No connectors.\n'}`});
 return {files,warnings,types,report,clipQuantity};
}

