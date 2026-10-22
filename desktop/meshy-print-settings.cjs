const DEFAULT_MESHY_PRINT=Object.freeze({analyzeAfterGeneration:true,printerType:'fdm',sizeMode:'model',sizeMm:100,targetPolycount:100000});
const MINIMUM_WALL_MM=Object.freeze({fdm:1,sla:.8,full_color:2});
function normalizeMeshyPrint(value,{strict=false}={}){
 if(value===undefined||value===null)return {...DEFAULT_MESHY_PRINT};
 if(typeof value!=='object'||Array.isArray(value)){if(strict)throw Error('Choose valid advanced Meshy options.');return {...DEFAULT_MESHY_PRINT};}
 const result={...DEFAULT_MESHY_PRINT};
 const rules={analyzeAfterGeneration:v=>typeof v==='boolean',printerType:v=>Object.hasOwn(MINIMUM_WALL_MM,v),sizeMode:v=>['model','height','longest'].includes(v),sizeMm:v=>Number.isFinite(v)&&v>=1&&v<=1000,targetPolycount:v=>Number.isInteger(v)&&v>=1000&&v<=250000};
 for(const [key,valid]of Object.entries(rules))if(value[key]!==undefined){if(valid(value[key]))result[key]=value[key];else if(strict)throw Error('Invalid Meshy '+key+' setting. Print sizes must be 1–1000 mm and remesh targets 1000–250000 triangles.');}
 return result;
}
function printParameters(options,geometry,{bodyHeightMm}={}){
 const s=normalizeMeshyPrint(options,{strict:true});let mode=s.sizeMode==='height'?'height':'longest',size=s.sizeMode==='model'?geometry.longestMm:s.sizeMm;
 if(bodyHeightMm!==undefined){const ratio=s.sizeMode==='model'?1:s.sizeMm/(s.sizeMode==='height'?geometry.heightMm:geometry.longestMm);mode='height';size=bodyHeightMm*ratio;}
 if(!Number.isFinite(size)||size<1||size>1000)throw Error('The intended print size must be 1–1000 mm. Choose an explicit print size for this model.');
 return {printer_type:s.printerType,[mode==='height'?'intended_print_height_mm':'intended_print_longest_side_mm']:size};
}
module.exports={DEFAULT_MESHY_PRINT,MINIMUM_WALL_MM,normalizeMeshyPrint,printParameters};
