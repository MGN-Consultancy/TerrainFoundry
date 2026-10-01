// Browsing taxonomy only: asset IDs, geometry and project data remain unchanged.
export const CATEGORIES=['All','Floors','Walls','Doors & openings','Stairs & ramps','Roofs','Terrain','Water','Bridges','Trees & plants','Traps','Props','Details','Imported'];
export function classifyAsset(asset){
 const text=(asset.name+' '+(asset.feature||'')).toLowerCase(),shape=asset.shape||'';
 let category=asset.category;
 if(category==='Imported')return {category,subcategory:'Your models'};
 if(asset.id.startsWith('t-')||['falling','spikes','plates','pit','axe','murderhole','control'].includes(asset.feature))category='Traps';
 else if(asset.id.startsWith('w-')||/flower|dais|buttercup|shrub|heather|tuft/.test(text))category='Trees & plants';
 else if(/stairs|staircase|ladder|ramp|riser/.test(text))category='Stairs & ramps';
 else if(['Walls','Details'].includes(category)&&/door|gate|window|entrance|arch|portcullis|hatch/.test(text))category='Doors & openings';
 let subcategory='Other';
 if(category==='Floors')subcategory=/arc|quarter|concave|curv|round/.test(shape+' '+text)?'Curved & round':/channel|drain|grate|track/.test(text)?'Channels & tracks':/raised|plinth|platform/.test(text)?'Raised floors':'Straight floors';
 if(category==='Walls')subcategory=/curv|arc|concave/.test(shape+' '+text)?'Curved walls':/corner/.test(shape+' '+text)?'Corners & junctions':/cave|cavern|hollowdeep|rock/.test(text)?'Cave & rock walls':/low|half/.test(text)?'Low walls':'Straight walls';
 if(category==='Doors & openings')subcategory=/window/.test(text)?'Windows':/cave|cavern|entrance/.test(text)?'Cave entrances':/gate|portcullis/.test(text)?'Gates':/arch/.test(text)?'Arches':'Doors & hatches';
 if(category==='Stairs & ramps')subcategory=/ladder/.test(text)?'Ladders':/ramp/.test(text)?'Ramps':'Stairs & risers';
 if(category==='Roofs')subcategory=/gable/.test(text)?'Gables':'Roof sections';
 if(category==='Terrain')subcategory=/grotto/.test(text)?'Caves & grottos':/sand|desert|dune/.test(text)?'Desert':/rock|boulder|cliff/.test(text)?'Rock & cliffs':'Grass & ground';
 if(category==='Water')subcategory=/oasis/.test(text)?'Oasis':/pond|pool/.test(text)?'Pools':'Rivers & channels';
 if(category==='Bridges')subcategory=/wood|timber|rope/.test(text)?'Wooden bridges':'Stone bridges';
 if(category==='Trees & plants')subcategory=/stump|dead/.test(text)?'Dead trees & stumps':asset.id.startsWith('w-')?'Trees':/flower|dais|buttercup/.test(text)?'Flowers':'Shrubs & ground cover';
 if(category==='Traps')subcategory=/pit|floor|plate|spike/.test(text)?'Floor traps':/door|wall|mouth|murderhole/.test(text)?'Wall traps':'Mechanisms';
 if(category==='Props')subcategory=/cart|track|mine/.test(text)?'Mining & machinery':/tomb|coffin|bones|corpse/.test(text)?'Tombs & remains':/crate|barrel|chest/.test(text)?'Crates & barrels':/rock|boulder/.test(text)?'Rocks':'Scatter & furnishings';
 if(category==='Details')subcategory=/column|pillar/.test(text)?'Columns & pillars':/fire|brazier|torch/.test(text)?'Fire & lighting':'Architectural details';
 return {category:CATEGORIES.includes(category)?category:'Details',subcategory};
}
export function filterAssets(assets,{category='All',subcategory='All',query=''}={}){
 const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 return assets.filter(asset=>{const group=classifyAsset(asset),text=[asset.name,asset.hint,asset.referenceName,group.category,group.subcategory].filter(Boolean).join(' ').toLowerCase();return(category==='All'||group.category===category)&&(subcategory==='All'||group.subcategory===subcategory)&&terms.every(term=>text.includes(term));});
}
