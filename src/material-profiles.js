import {DUNGEON_RANGE_KIT} from './dungeon-range-kit.js';
import {CURVE_KIT} from './curve-kit.js';
const families=new Map([...DUNGEON_RANGE_KIT,...CURVE_KIT].map(k=>[k.id,k.recipe||k.family]));
export function materialProfile(type){
 const f=families.get(type)||'';
 if(type.startsWith('u-'))return 'imported';
 if(type.startsWith('w-'))return 'foliage';
 if(type.startsWith('n-')||f==='Cavern'||type==='boulder')return 'rock';
 if(/^o-(grass|path|daisies|buttercups|wildflowers|shrubs|mixed|heather|tufts|moss|transition)/.test(type))return 'grass';
 if(/^o-(sand|dunes|cracked)/.test(type))return 'sand';
 if(type.includes('river')||type.includes('oasis'))return 'river';
 if(f==='Timber'||/timber|tudor|barrel|crate|wood|roof/.test(type))return 'wood';
 if(f==='Grating'||/grate|blade|axe/.test(type))return 'metal';
 return 'stone';
}
