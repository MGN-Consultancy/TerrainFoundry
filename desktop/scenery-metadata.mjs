// One contract for authoring, imports and automatic terrain planning.
export const SCENERY_TEXT_FIELDS=['category','environment','era','scale','floorType','placement','connectorSystem','compatibilityGroup','edgeRules','entrances','traversal','elevation','quality'];
export const SCENERY_NUMBER_FIELDS=['widthMm','depthMm','heightMm','gridMm','floorDatumMm','spacingMm'];
export const SCENERY_OPTIONS={category:['unknown','floor','wall','door','building','roof','stairs','bridge','road','river','water','vegetation','prop','other'],placement:['unknown','ground','floor','wall','roof','water'],connectorSystem:['unknown','none','openlock','other'],quality:['unknown','basic','detailed','high']};
export function sceneryMetadata(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid scenery metadata');
 const allowed=['schema',...SCENERY_TEXT_FIELDS,...SCENERY_NUMBER_FIELDS,'materials','tags'];
 if(Object.keys(value).some(k=>!allowed.includes(k))||value.schema!==undefined&&value.schema!==1)throw Error('Unsupported scenery metadata field');
 const result={schema:1};
 for(const k of SCENERY_TEXT_FIELDS){const v=value[k]??'unknown';if(typeof v!=='string'||v.length>2000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v))throw Error('Invalid scenery '+k);result[k]=v.trim()||'unknown';}
 for(const [key,values]of Object.entries(SCENERY_OPTIONS))if(!values.includes(result[key]))throw Error('Invalid scenery '+key);
 for(const k of SCENERY_NUMBER_FIELDS){const v=value[k]??null;if(v!==null&&(!Number.isFinite(v)||v<0||v>22000||(['widthMm','depthMm','heightMm','gridMm'].includes(k)&&v===0)))throw Error('Invalid scenery '+k);result[k]=v;}
 for(const k of ['materials','tags']){const v=value[k]??[];if(!Array.isArray(v)||v.length>30||v.some(s=>typeof s!=='string'||!s.trim()||s.length>120))throw Error('Invalid scenery '+k);result[k]=[...new Set(v.map(s=>s.trim()))];}
 return result;
}
export function sceneryReadiness(design={}){
 const m=sceneryMetadata(design.scenery),missing=[];
 if(!['dnd','railway','racing','other'].includes(design.purpose))missing.push('purpose');
 if(typeof design.style!=='string'||!design.style.trim()||/^(unknown|unspecified|tbd)$/i.test(design.style.trim()))missing.push('style');
 for(const k of SCENERY_TEXT_FIELDS)if(/^(unknown|unspecified|tbd|n\/a|not applicable)$/i.test(m[k]))missing.push(k);
 for(const k of SCENERY_NUMBER_FIELDS)if(m[k]===null)missing.push(k);
 for(const key of ['materials','tags'])if(!m[key].length||m[key].every(v=>/^(unknown|unspecified|tbd)$/i.test(v)))missing.push(key);
 return {ready:missing.length===0,missing,metadata:m};
}
export const sceneryMetadataInstructions=`Every new scenery asset requires design.scenery metadata (schema:1). Collect it progressively in the same conversation and merge updates; do not invent unknown facts. Required text fields: category (floor/wall/door/building/roof/stairs/bridge/road/river/water/vegetation/prop/other), environment, era, scale (e.g. 28mm tabletop or 1:87), floorType, placement (ground/floor/wall/roof/water), connectorSystem (none/openlock/other), compatibilityGroup (pack/style family, or independent), edgeRules (seam matching, allowed rotations and transition constraints, or independent edges), entrances (locations, opening widths and approach clearances, or none), traversal (walkable areas, barriers and clear routes, or non-walkable prop), elevation (ground surface, upper/lower landing relationship, or ground-only), quality (basic/detailed/high). Required arrays: materials and tags (functional uses and features). Required numeric millimetre fields: widthMm,depthMm,heightMm,gridMm,floorDatumMm,spacingMm. For non-grid objects gridMm is the chosen project grid, not an invented connector. Use 0 for floorDatumMm/spacingMm only when correct. Purpose and style are required in design. Unknown information remains unknown/null and blocks automatic placement, not manual editing. Describe intended dimensions as specifications; measured mesh bounds, verified thickness, connector fit and physical print status come from separate checks, never from descriptive metadata. For OpenLOCK use the approved 8mm joining datum and template compatibility, not an extra 8mm tray. Ask about material/style continuity, building entrances, roads, rivers, stair landings and realistic spacing before claiming compatibility.`;
