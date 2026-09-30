// The committed original metadata is the reproducible source of truth.
import {DUNGEON_RANGE_KIT} from '../src/dungeon-range-kit.js';
if(DUNGEON_RANGE_KIT.length!==431||new Set(DUNGEON_RANGE_KIT.map(k=>k.id)).size!==431)throw Error('Invalid original scenery metadata');
console.log('Verified 431 original Underkeep shapes');
