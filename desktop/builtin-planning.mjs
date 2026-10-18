import {sceneryMetadata} from './scenery-metadata.mjs';

const categories={'Walls':'wall','Floors':'floor','Doors & openings':'door','Stairs & ramps':'stairs','Bridges':'bridge','Details':'prop','Props':'prop','Terrain':'other','Water':'water','Roofs':'roof'};
const dimension=value=>Number.isFinite(value)&&value>0?value:null;

// Planning hints come from the declared catalogue, never from assumed mesh measurements.
// The connection carrier height is not the full model height.
export function builtinSceneryDesign(asset){
  const name=asset.name||'',connection=asset.connection||{},category=categories[asset.category]||'other';
  const materials=[];
  for(const [pattern,material] of [[/stone|rock|boulder|cavern|grotto|flagstone|brick/i,'stone'],[/timber|wood|plank|log/i,'wood'],[/iron|metal|anvil|forge/i,'metal'],[/water|river|pond/i,'water'],[/tree|bush|vegetation|moss/i,'vegetation']])if(pattern.test(name))materials.push(material);
  const environment=/cave|cavern|grotto|deepstone|flowstone|stalag/i.test(name)?'cave or cavern':/dungeon/i.test(name)?'underground interior':/river|pond|water/i.test(name)?'waterside':'unspecified; use the preview to choose a setting';
  const connector=(connection.ports||[]).length?'openlock':'none';
  return {purpose:'other',style:'Original miniature scenery; catalogue-derived planning hints',scenery:sceneryMetadata({
    schema:1,category,environment,era:'unspecified',scale:'25.4 mm modular grid; miniature scale ratio unspecified',
    floorType:category==='floor'?name:'unknown',placement:category==='roof'?'roof':category==='water'?'water':'ground',
    connectorSystem:connector,compatibilityGroup:connector==='openlock'?'openlock-catalogue':'none',
    edgeRules:connector==='openlock'?'Use declared connector ports; alignment does not certify physical fit.':'No declared connector ports; inspect adjacent edges.',
    entrances:category==='door'?'An opening is indicated by the catalogue; clear width and height need inspection.':'Entrance locations and clearances are not recorded.',
    traversal:category==='stairs'?'Vertical route indicated; landing heights, slope and clearance need inspection.':category==='bridge'?'Crossing indicated; span, approach and clearances need inspection.':'Walkability and clearance are not recorded.',
    elevation:'Full model height and support surfaces are not recorded; inspect the model.',quality:'unknown',
    widthMm:dimension(connection.width),depthMm:dimension(connection.depth),heightMm:null,gridMm:25.4,floorDatumMm:null,spacingMm:null,
    materials,tags:['catalogue-derived','rules-neutral',category]
  })};
}
