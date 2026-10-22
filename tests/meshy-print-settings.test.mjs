import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{DEFAULT_MESHY_PRINT,normalizeMeshyPrint,printParameters}=require('../desktop/meshy-print-settings.cjs');
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
test('Meshy defaults use free FDM analysis at actual model dimensions and bounded triangle density',()=>{assert.deepEqual(normalizeMeshyPrint(),DEFAULT_MESHY_PRINT);assert.deepEqual(printParameters({}, {longestMm:50.8,heightMm:24}),{printer_type:'fdm',intended_print_longest_side_mm:50.8});});
test('printer and print size overrides send exactly one documented size field',()=>{assert.deepEqual(printParameters({printerType:'sla',sizeMode:'height',sizeMm:75},{longestMm:50,heightMm:20}),{printer_type:'sla',intended_print_height_mm:75});assert.deepEqual(printParameters({printerType:'full_color',sizeMode:'longest',sizeMm:250},{longestMm:50,heightMm:20}),{printer_type:'full_color',intended_print_longest_side_mm:250});});
test('raw scenery body repair accounts for connector datum and final print scale',()=>{const geometry={longestMm:50.8,heightMm:24};assert.deepEqual(printParameters({},geometry,{bodyHeightMm:16.25}),{printer_type:'fdm',intended_print_height_mm:16.25});assert.equal(printParameters({sizeMode:'height',sizeMm:48},geometry,{bodyHeightMm:16.25}).intended_print_height_mm,32.5);});
test('invalid updates reject while malformed persisted settings recover safe defaults',()=>{for(const options of [{printerType:'laser'},{sizeMode:'both'},{sizeMm:0},{sizeMm:Infinity},{analyzeAfterGeneration:'true'},{targetPolycount:300001},{targetPolycount:100.5}])assert.throws(()=>normalizeMeshyPrint(options,{strict:true}),/Invalid/);assert.deepEqual(normalizeMeshyPrint({printerType:'laser',sizeMm:NaN}),DEFAULT_MESHY_PRINT);assert.throws(()=>printParameters({}, {longestMm:1500}),/print size/);});
test('advanced Meshy defaults persist independently of companion provider and malformed updates are atomic',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-meshy-settings-'));try{
  const {createCampaignAI}=require('../desktop/campaign-ai.cjs'),args={directory,safeStorage:{},inventory:async()=>({}),fetchImpl:async()=>{throw Error('No provider calls allowed');}},ai=createCampaignAI(args),settings={analyzeAfterGeneration:false,printerType:'sla',sizeMode:'height',sizeMm:45,targetPolycount:75000};
  assert.deepEqual((await ai.configure({provider:'openai',meshyPrint:settings})).meshyPrint,settings);await ai.configure({provider:'claude'});assert.deepEqual((await createCampaignAI(args).status()).meshyPrint,settings);
  const before=await fs.readFile(path.join(directory,'ai-settings.json'));await assert.rejects(ai.configure({provider:'claude',meshyPrint:{sizeMm:0}}),/Invalid/);assert.deepEqual(await fs.readFile(path.join(directory,'ai-settings.json')),before);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
test('clone inherits printable options but never reuses original provider jobs or reports',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-meshy-clone-'));try{
  const library=require('../desktop/creative-library.cjs').createCreativeLibrary({directory}),original=await library.create({kind:'scenery',name:'Original wall',design:{meshyPrintOptions:{printerType:'sla'},meshyPrintWorkflow:{status:'paused',jobs:{repair:{taskId:'private-prior-task'}}},meshyPrintReport:{status:'SUCCEEDED',thinWalls:{status:'healthy'}}}}),clone=await library.cloneAsset(original.id);
  assert.deepEqual(clone.design.meshyPrintOptions,original.design.meshyPrintOptions);assert.equal(clone.design.meshyPrintWorkflow,undefined);assert.equal(clone.design.meshyPrintReport,undefined);assert.ok((await library.load(original.id)).design.meshyPrintWorkflow);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
