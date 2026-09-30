import {CURVE_KIT} from './curve-kit.js';
import {WOODLAND_KIT} from './woodland-kit.js';
import {DUNGEON_RANGE_KIT} from './dungeon-range-kit.js';
import {CAVE_KIT} from './cave-kit.js';
import {EXPANSION_KIT} from './expansion-kit.js';
import {OUTDOOR_KIT} from './outdoor-kit.js';
import {VILLAGE_KIT} from './village-kit.js';
import {DUNGEON_KIT} from './dungeon-kit.js';
import {BENCHMARK_KIT} from './benchmark-kit.js';
export const KIT=[...CURVE_KIT,...WOODLAND_KIT,...DUNGEON_RANGE_KIT,...CAVE_KIT,...EXPANSION_KIT,...OUTDOOR_KIT,...BENCHMARK_KIT,...DUNGEON_KIT,...VILLAGE_KIT,
 {id:'floor',name:'Stone floor',category:'Floors',icon:'▦',hint:'2 × 2 squares'},
 {id:'floor-small',name:'Small floor',category:'Floors',icon:'▧',hint:'1 × 1 square'},
 {id:'wall',name:'Dungeon wall',category:'Walls',icon:'▥',hint:'2 squares · full height'},
 {id:'wall-low',name:'Low wall',category:'Walls',icon:'▬',hint:'2 squares · half height'},
 {id:'door',name:'Doorway',category:'Walls',icon:'Π',hint:'Open passage'},
 {id:'pillar',name:'Round pillar',category:'Details',icon:'▣',hint:'Freestanding column'},
 {id:'stairs',name:'Stone stairs',category:'Details',icon:'◩',hint:'Four solid steps'},
 {id:'crate',name:'Supply crate',category:'Props',icon:'◇',hint:'Scatter terrain'},
 {id:'boulder',name:'Boulder',category:'Props',icon:'⬟',hint:'Faceted rock'},
 {id:'platform',name:'Raised plinth',category:'Floors',icon:'▰',hint:'2 × 2 squares'},
];
export const defaults=()=>({version:1,name:'Untitled dungeon',grid:25.4,connectors:'openlock',connectorRevision:2,board:24,printer:{x:180,y:180,z:180},items:[]});
export function gardenDemo(){const p=defaults();p.name='Wildflower garden';const types=['o-daisies','o-buttercups','o-wildflowers','o-shrubs','o-mixed','o-heather','o-tufts','o-moss','o-grass'];types.forEach((type,i)=>p.items.push({...piece(type,(i%3-1)*2,(Math.floor(i/3)-1)*2),color:'#ffffff'}));return p;}
export function curveDemo(){const p=defaults();p.name='Matching curved walls';for(const [i,id]of ['r-041','r-188','r-268','r-207'].entries()){const f=DUNGEON_RANGE_KIT.find(k=>k.id===id),w=CURVE_KIT.find(k=>k.matches.includes(id)),x=(i%2)*8-4,z=Math.floor(i/2)*8-4;p.items.push({...piece(f.id,x,z),color:'#ffffff'},{...piece(w.id,x+.25,z+.25),color:'#ffffff'});}return p;}
export function validateProject(v){if(!v||v.version!==1||typeof v.name!=='string'||v.name.length>120||!Number.isFinite(v.grid)||v.grid<10||v.grid>100||!Number.isInteger(v.board)||v.board<8||v.board>80||!Array.isArray(v.items)||v.items.length>5000)throw Error('Unsupported or invalid terrain project.');if(!v.printer||!['x','y','z'].every(k=>Number.isFinite(v.printer[k])&&v.printer[k]>=50&&v.printer[k]<=1000))throw Error('Invalid printer dimensions.');if(v.assets){if(typeof v.assets!=='object'||Array.isArray(v.assets)||Object.keys(v.assets).length>30)throw Error('Invalid imported asset library');for(const [id,a]of Object.entries(v.assets)){if(!/^u-[a-z0-9-]+$/.test(id)||!a||typeof a.name!=='string'||a.name.length>80||!Array.isArray(a.positions)||a.positions.length>2700000||a.positions.length%3||!a.positions.every(n=>Number.isFinite(n)&&Math.abs(n)<10000)||!Array.isArray(a.indices)||a.indices.length>900000||a.indices.length%3||!a.indices.every(n=>Number.isInteger(n)&&n>=0&&n<a.positions.length/3)||!Array.isArray(a.colors)||a.colors.length!==a.positions.length||!a.colors.every(n=>Number.isFinite(n)&&n>=0&&n<=1))throw Error('Invalid imported mesh');}}if(v.connectors!==undefined&&!['none','openlock'].includes(v.connectors))throw Error('Unknown connector system');if(v.connectors==='openlock'&&v.grid!==25.4)throw Error('Foundry Link uses a fixed 25.4 mm grid');for(const a of Object.values(v.assets||{})){if(a.connected)validateConnected(a.connected);}const ids=new Set();for(const i of v.items){if(typeof i.id!=='string'||ids.has(i.id)||!(KIT.some(k=>k.id===i.type)||Object.hasOwn(v.assets||{},i.type))||!['x','z','y','rotation'].every(k=>Number.isFinite(i[k])&&Math.abs(i[k])<=10000)||i.y<0||!/^#[0-9a-f]{6}$/i.test(i.color))throw Error('Invalid terrain piece.');ids.add(i.id);}return structuredClone(v);}
export function demo(){const p=defaults();p.name='The Forgotten Watch';for(let x=-3;x<=3;x+=2)for(let z=-3;z<=3;z+=2)p.items.push(piece('floor',x,z));for(let x=-3;x<=3;x+=2){p.items.push(piece('wall',x,-4.25,0,0));p.items.push(piece(x===1?'door':'wall-low',x,4.25,180,0));}for(let z=-3;z<=3;z+=2){p.items.push(piece('wall',-4.25,z,90,0));p.items.push(piece('wall-low',4.25,z,270,0));}p.items.push(piece('pillar',-2,-2,0,8),piece('pillar',2,-2,0,8),piece('stairs',0,1,0,8),piece('crate',-2,2,0,8),piece('boulder',5,2));return p;}
export function piece(type,x,z,rotation=0,y=0){return{id:crypto.randomUUID(),type,x,z,y,rotation,color:type==='crate'?'#997351':'#9aa6ad'};}
export function villageDemo(){const p=defaults();p.name='Willowbrook Village House';const add=(type,x,z,r=0,y=0)=>p.items.push({...piece(type,x,z,r,y),color:'#ffffff'});for(const x of [-1,1])for(const z of [-1,1])add('v-stone-floor',x,z);for(const x of [-1,1]){add(x===-1?'v-tudor-door':'v-tudor-window',x,2.25,180,0);add('v-stone-wall',x,-2.25,0,0);}for(const z of [-1,1]){add('v-tudor-wall',-2.25,z,90,0);add('v-tudor-window',2.25,z,270,0);}add('v-gable',0,2.25,180,50.8);add('v-gable',0,-2.25,0,50.8);add('v-roof',0,-1,0,50.8);add('v-roof',0,1,0,50.8);add('v-barrel',-1,-1,0,8);add('v-barrel',1,-1,0,8);return p;}
export function dungeonDemo(){const p=defaults();p.name='Blackwater Crypt';const add=(t,x,z,r=0,y=0)=>p.items.push({...piece(t,x,z,r,y),color:'#ffffff'});for(const x of [-2,0,2])for(const z of [-2,0,2])add(x===0?'d-channel':'d-floor',x,z);for(const x of [-2,0,2]){add(x===0?'d-sewer-grate':'d-crypt',x,-3.25,0,0);add(x===0?'d-gate':'d-heavy-low',x,3.25,180,0);}for(const z of [-2,0,2]){add('d-heavy-wall',-3.25,z,90,0);add('d-heavy-low',3.25,z,270,0);}add('d-tomb',-2,-1,0,8);add('d-column',2,-2,0,8);add('d-column',2,2,0,8);add('d-stairs',-2,1,90,8);add('d-track',0,5);add('d-mine',0,6.25,180,0);return p;}
export function benchmarkDemo(){const p=defaults();p.name='Detail studies · stone and timber';p.items=[{...piece('b-weathered-wall',-1.15,0),color:'#ffffff'},{...piece('b-timber-window',1.15,0),color:'#ffffff'}];return p;}




function validateConnected(a){const valid=Array.isArray(a.positions)&&a.positions.length<=3000000&&a.positions.length%3===0&&a.positions.every(n=>Number.isFinite(n)&&Math.abs(n)<11000)&&Array.isArray(a.indices)&&a.indices.length<=1000000&&a.indices.length%3===0&&a.indices.every(n=>Number.isInteger(n)&&n>=0&&n<a.positions.length/3)&&Array.isArray(a.colors)&&a.colors.length===a.positions.length&&a.colors.every(n=>Number.isFinite(n)&&n>=0&&n<=1);const b=a.openlock;if(!valid||!b||![b.width,b.depth].every(n=>Number.isFinite(n)&&n>=0&&n<22000)||![0,8].includes(b.height)||!Array.isArray(b.ports)||b.ports.length>4||!b.ports.every(p=>['x','z','nx','nz','angle'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<22000)))throw Error('Invalid imported Foundry Link mesh');}
export function openlockDemo(){const p=defaults();p.name='Foundry Link courtyard';for(const x of [-1,1])for(const z of [-1,1])p.items.push({...piece('v-stone-floor',x,z),color:'#ffffff'});for(const x of [-1,1])for(const z of [-2.25,2.25])p.items.push({...piece(z<0?'b-weathered-wall':'v-tudor-window',x,z,z<0?0:180),color:'#ffffff'});for(const z of [-1,1])for(const x of [-2.25,2.25])p.items.push({...piece('wall-low',x,z,x<0?90:270),color:'#ffffff'});return p;}

export function outdoorDemo(){const p=defaults();p.name='The River of Palms';
 const add=(t,x,z,r=0)=>p.items.push({...piece(t,x,z,r),color:'#ffffff'});
 for(const z of [-3,-1,1,3,5])for(const x of [-5,-3,-1,1,3,5]){
  if(x===-1){add(z===-3?'o-bridge-wood':z===-1?'o-river-transition':z===1?'o-bridge-stone':z===3?'o-river-desert-junction':'o-river-desert-end',x,z,z===3?180:0);continue;}
  if(x===1&&z===3){add('o-oasis-inlet',x,z,270);continue;}
  if(x===3&&z===1){add('o-oasis',x,z);continue;}
  if(z===-1){add('o-transition',x,z,270);continue;}
  if(z===-3){add(x===-3||x===1?'o-path':x===-5?'o-grass-rough':'o-grass',x,z,90);continue;}
  add((x+z)%4===0?'o-dunes':x===5?'o-cracked':'o-sand',x,z);
 }
 return p;}

export function expansionDemo(collection='c-') {const p=defaults();p.name=collection==='c-'?'Greywatch Castle':collection==='q-'?'The Ember Quarry':'The Gauntlet';const add=(t,x,z,r=0,y=0)=>p.items.push({...piece(t,x,z,r,y),color:'#ffffff'});
 if(collection==='c-'){for(const x of [-3,-1,1,3])for(const z of [-3,-1,1,3])add(Math.abs(x)===3&&Math.abs(z)===3?(z<0?'c-tower-roof':'c-tower'):'c-courtyard',x,z);for(const x of [-3,-1,1,3]){add(x===-1?'c-gate':'c-battlement',x,4.25,180);add(x===1?'c-window':'c-slit',x,-4.25);}for(const z of [-3,-1,1,3]){add('c-buttress',-4.25,z,90);add('c-ruin',4.25,z,270);}}
 else if(collection==='q-'){for(const x of [-2,0,2])for(const z of [-2,0,2])add(x===0?'q-lava-straight':x===2&&z===0?'q-tomb':'q-quarry-floor',x,z);for(const x of [-2,0,2])add(x===0?'q-portal':'q-quarry-wall',x,-3.25);for(const z of [-2,0,2])add('q-low-wall',-3.25,z,90);}
 else for(let i=0;i<10;i++)add(EXPANSION_KIT.filter(k=>k.id.startsWith('t-'))[i].id,(i%5-2)*2,Math.floor(i/5)*2-1);
 return p;}

export function caveDemo(){const p=defaults();p.name='Hollowdeep Cavern';const add=(type,x,z,r=0)=>p.items.push({...piece(type,x,z,r),color:'#ffffff'});for(const x of [-2,0,2])for(const z of [-2,0,2])add(x===-2&&z===-2?'n-stalagmites':x===2&&z===-2?'n-rubble':'n-floor',x,z);add('n-entrance',0,3.25,180);for(const x of [-2,2])add('n-wall-low',x,3.25,180);for(const x of [-2,0,2])add('n-wall',x,-3.25);for(const z of [-2,0,2]){add('n-wall-fractured',-3.25,z,90);add('n-wall',3.25,z,270);}return p;}



