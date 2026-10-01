import {naturalRock} from './natural-rock.mjs';
import {M,wasm,noise,paint} from './sculpt-library.mjs';
import {surface} from './sculpt-surface.mjs';
import {B,U,cyl,orb,brick,timber,masonry,archCut,archTrim,ring,sawBlade,stone,dark,iron,rust,wood,bone} from './dungeon-sculpt.mjs';
import {socketCut} from '../src/openlock-build.js';
const G=25.4, TAU=Math.PI*2;
const mod=(n,d)=>(n%d+d)%d;
function floor(r){
 const {width:w,depth:d,family:f,variant:v}=r,small=f==='Smallstone',tile=small?6.35:12.7;
 return surface(w,d,Math.ceil(w*1.5),Math.ceil(d*1.5),(x,z)=>{
  let h=8;const row=Math.floor((z+d/2)/tile),a=mod(x+w/2+row%2*tile/2,tile),b=mod(z+d/2,tile),edge=Math.min(a,tile-a,b,tile-b);
  if(f==='Timber'){const a=mod(x+w/2,6.35);return 8-.55*Math.exp(-((Math.min(a,6.35-a)/.35)**2))+.10*Math.sin(x*11+Math.sin(z*.35))+.04*noise(x*3,v,z);}
  if(['Cavern','Mine'].includes(f))return 8+.35*noise(x*.3,v,z*.3)+.12*Math.sin(z*1.6+Math.sin(x*.4));
  if(f==='Ruins')h-=.3*Math.abs(noise(x*.3,v,z*.3));
  return h-.48*Math.exp(-((edge/.35)**2))+.085*noise(x*.8,v,z*.8);
 },(x,z)=>{const n=.87+.11*noise(Math.floor((x+w/2)/tile)*7,v,Math.floor((z+d/2)/tile)*7);return (f==='Timber'?wood:f==='Grating'?iron:f==='Baths'?[.62,.60,.51]:stone).map(a=>a*n);});
}
function skull(x,y,z,size=2){let s=orb(size,x,y,z,bone).scale([1,1,1]);const eyes=[-.4,.4].map(k=>orb(size*.31,x+size*k,y+size*.16,z+size*.79,dark));return s.subtract(U(eyes)).add(B(size*1.2,size*.7,size,x,y-size*.64,z+size*.16,bone));}
function ribs(x,y,z,scale=1){const p=[B(1.4*scale,1.6*scale,7*scale,x,y,z-5*scale,bone),B(1.2*scale,1.4*scale,12*scale,x,y,z,bone),skull(x,y+1,z-8*scale,2*scale)];for(let i=0;i<5;i++)p.push(B((8-i*.7)*scale,1.2*scale,1.1*scale,x,y+.25,z-3*scale+i*2*scale,bone));return U(p);}
function rail(r){const w=r.width,d=r.depth,n=r.referenceName,parts=[];
 const straight=(len,turn=0)=>{const p=[];for(let z=-len/2+3;z<len/2;z+=7)p.push(timber(18,2,3.6,0,8.4,z));for(const x of [-6,6])p.push(B(1.8,3,len,x,10,0,iron));return U(p).rotate([0,turn,0]);};
 if(r.shape==='quarter'||/-B$/.test(n)){const rad=Math.min(w,d)*.65,cx=-w/2,cz=-d/2;for(let i=0;i<=16;i++){const a=i/16*Math.PI/2;parts.push(timber(18,2.4,3.5,0,0,0).rotate([0,-a*180/Math.PI,0]).translate([cx+rad*Math.cos(a),8.8,cz+rad*Math.sin(a)]));}for(const off of [-6,6]){const c=cyl(rad+off+.9,3,0,10,0,iron).subtract(cyl(rad+off-.9,5,0,10,0));parts.push(c.translate([cx,0,cz]).intersect(B(w,30,d,0,10)));}}
 else {parts.push(straight(d));if(/-[TX]$/.test(n)){const cross=straight(w,90);parts.push(/-T$/.test(n)?cross.intersect(B(w/2+1,30,d,w/4,10)):cross);}}
 return U(parts);
}
function floorDetails(r){let s=floor(r);const p=[],{width:w,depth:d,family:f,feature:k,variant:v}=r,n=r.referenceName;
 if(f==='Sewer'||f==='Baths'){
  const layout=f==='Baths'?n.split('-')[1]:String(Number(n.match(/-(\d+)$/)?.[1]||1));
  const channel=(x,z)=>{const X=Math.abs(x)<w*.19,Z=Math.abs(z)<d*.19;switch(layout){case '2':case 'L':return x>0&&Z||z>0&&X;case '3':case 'L2':return x<0&&Z||z>0&&X;case '4':case 'D':return X&&z<d*.1;case '5':return X||Z&&x>0;case '6':return X||Z;case '7':return X&&z>0||Z;case '8':return x<0;case '9':return z<0;case '10':case 'O':return Math.abs(x)>w*.21||Math.abs(z)>d*.21;case '11':return true;case 'Flat':return false;default:return X;}};
  s=surface(w,d,Math.ceil(w*1.5),Math.ceil(d*1.5),(x,z)=>channel(x,z)?6.8+.075*Math.sin(x*2+z*1.4):8.2+.08*noise(x,v,z),(x,z)=>channel(x,z)?[.14,.28,.19]:stone);
 }
 if(f==='Grating'){const cuts=[];for(let x=-w/2+5;x<w/2-3;x+=5)for(let z=-d/2+5;z<d/2-3;z+=5)cuts.push(B(3.1,2.1,3.1,x,7.8,z));if(cuts.length)s=s.subtract(U(cuts));for(let x=-w/2+2.5;x<w/2;x+=12.7)for(const z of [-d/2+2,d/2-2])p.push(orb(.65,x,8,z,rust));}
 if(f==='Ossuary'){for(let x=-w/2+5;x<w/2-3;x+=9)for(let z=-d/2+5;z<d/2-3;z+=10)p.push(skull(x,8.2,z,1.9));}
 if(k==='track')p.push(rail(r));
 if(k==='hatch'){const hw=Math.min(25,w-6),hd=Math.min(30,d-6);p.push(B(hw,1.1,hd,0,8,0,iron));for(let x=-hw/2+2;x<hw/2;x+=4)p.push(timber(3.7,1.5,hd-2,x,8.8,0));for(const z of [-hd/3,hd/3])p.push(B(hw,1,2,0,9.5,z,iron));p.push(ring(2.1,.6,0,10,hd/3,iron));}
 if(k==='spikes'){for(let x=-w/2+7;x<w/2-4;x+=10)for(let z=-d/2+7;z<d/2-4;z+=10){p.push(cyl(2.2,1,x,8,z,rust),cyl(1.35,/Spring/.test(n)?13:9,x,/Spring/.test(n)?14:12,z,iron,.15,8));}}
 if(k==='plates')for(const x of [-w/4,w/4])for(const z of [-d/4,d/4]){p.push(B(w/2-2,1.4,d/2-2,x,8,z,iron));for(const dx of [-1,1])for(const dz of [-1,1])p.push(orb(.6,x+dx*(w/4-3),8.9,z+dz*(d/4-3),rust));}
 if(k==='pit'){s=s.subtract(B(w-13,4,d-13,0,8,0));for(let z=-d/2+9;z<d/2-6;z+=7)p.push(cyl(1.2,3,0,6,z,iron,.1,6));}
 if(k==='axe'){p.push(B(36,1.5,5,0,8.3,0,rust),B(2.5,21,3,0,18,0,wood),sawBlade(13,2.4).intersect(B(30,15,5,7,2)).translate([0,22,0]));}
 if(k==='stairs'){const steps=8,rise=/III/.test(n)?38.1:/II/.test(n)?25.4:/-I-/.test(n)?12.7:/-B-/.test(n)?38.1:/-C-/.test(n)?50.8:25.4;if(/Platform/.test(n))p.push(B(w,12.7,d,0,14.2));else for(let i=0;i<steps;i++){const h=(i+1)*rise/steps;p.push(brick(w-.12,h+.3,d/steps+.2,0,7+h/2,-d/2+(i+.5)*d/steps));}}
 if(k==='tomb'){const td=Math.min(d-6,38),tw=Math.min(w-6,23);p.push(brick(tw+3,4,td+3,0,9.8,0),brick(tw,11,td,0,15,0),brick(tw+3,3,td+3,0,21.7,0),ribs(0,23,0,.85));}
 if(k==='brazier'){p.push(cyl(9,18,0,16,0),cyl(13,5,0,27,0,iron,10),cyl(10,4,0,30,0,[.52,.16,.025],4));for(let i=0;i<7;i++){const a=i*TAU/7;p.push(cyl(1.9,8+i%3,Math.sin(a)*7,34,Math.cos(a)*7,[.78,.24,.025],.2,10));}}
 if(k==='riser'){const h=r.height;p.push(masonry(w,h-8,d).translate([0,7.5,0]),B(w,1.2,d,0,h-.6));}
 if(k==='bones'){for(let i=0;i<(/Big/.test(n)?18:9);i++){const x=Math.sin(i*8.13)*w*.3,z=Math.cos(i*4.1)*d*.3;p.push(i%3===0?skull(x,8.7,z,2.5):ribs(x,8,z,.48).rotate([0,i*29,0]));}}
 if(k==='cart'){p.push(B(17,7,21,0,11.1,0,wood));for(const x of [-9,9])p.push(timber(2.5,12,23,x,14,0));for(const z of [-11,11])p.push(timber(20,12,2.5,0,14,z));for(const x of [-10,10])for(const z of [-7,7])p.push(cyl(3.7,2,0,0,0,iron).rotate([0,0,90]).translate([x,9,z]));}
 if(r.referenceIndex===262)p.push(masonry(w,17,8).translate([0,7,-d/2+4]));
 return U([s,...p]);
}
export function wallShape(r,w=r.width,depth=r.depth){const h=r.height,n=r.referenceName,f=r.family,k=r.feature,base=8,bodyH=h-base;
 let s=masonry(w,bodyH,Math.min(depth-1,9.8),r.variant).translate([0,base,0]);const p=[B(w,8,depth,0,4)];
 if(f==='Cavern')s=naturalRock(w,bodyH,Math.min(depth-1,9.8),r.variant).translate([0,base+bodyH/2-.2,0]);
 if(f!=='Cavern')s=s.add(U([-1,1].map(sign=>brick(Math.min(12,w/2),bodyH+.6,depth-.2,sign*(w/2-Math.min(12,w/2)/2),base+bodyH/2-.3,0))));
 const opening=['arch','door','gate','window','secret','outfall'].includes(k)||/CryptArch|SnakeArch/.test(n),window=k==='window'||k==='outfall';
 const ow=Math.min(w-12,window?17:27,(bodyH-5)*1.5),oh=Math.min(bodyH-5,window?25:34),oy=window?base+8:base;
 if(opening&&ow>5&&oh>8){const cut=archCut(ow,oh,depth+20).translate([0,oy,0]);s=s.subtract(cut);p.push(archTrim(ow,oh,Math.min(depth,12)).translate([0,oy,0]));if(['door','secret'].includes(k)){
  if(k==='secret')p.push(masonry(ow-.7,oh-1,6).intersect(archCut(ow-.7,oh-.5,10)).translate([0,oy,0]));
  else {const door=[B(ow,oh,2,0,oh/2,0,wood)];for(let x=-ow/2+2;x<ow/2;x+=4)door.push(timber(3.6,oh,3,x,oh/2,0));for(const y of [oh*.25,oh*.75]){door.push(B(ow,2,4,0,y,0,iron));for(let x=-ow/2+3;x<ow/2;x+=5)door.push(orb(.65,x,y,2.2,rust));}p.push(U(door).intersect(archCut(ow-.8,oh-.4,8)).translate([0,oy-.2,0]));p.push(B(1.5,2,3,3,oy+oh*.48+1.3,1.5,iron),ring(1.8,.55,0,0,0,iron).rotate([90,0,0]).translate([3,oy+oh*.48,2.5]));}
 }if(k==='gate'||k==='outfall'||/Grate|Spike/.test(n)){for(let x=-ow/2+2;x<ow/2;x+=4)p.push(B(1.7,oh,2,x,oy+oh/2,0,iron).intersect(cut));for(const y of [.25,.65])p.push(B(ow+1,2.1,3,0,oy+oh*y,0,iron));}}
 if(f==='Crypt'&&!opening){const count=Math.max(1,Math.floor(w/22));for(let i=0;i<count;i++){const x=(i-(count-1)/2)*22;const cut=archCut(13,Math.min(28,bodyH-3),5).translate([x,base+1,5]);s=s.subtract(cut);p.push(archTrim(13,Math.min(28,bodyH-3),11).translate([x,base+1,0]));if(k==='corpses')p.push(ribs(0,0,0,.7).rotate([90,0,0]).translate([x,base+14,1.9]));}}
 if(f==='Ossuary'||/Skull|Snake/.test(n)){for(let x=-w/2+7;x<w/2-3;x+=12){if(opening&&Math.abs(x)<ow/2+3)continue;p.push(skull(x,base+bodyH*.66,5.3,2.3));for(const y of [base+5,h-4])p.push(B(7,1.6,2.4,x,y,5,bone));}}
 if(f==='Gothic'){for(let x=-w/2+5;x<w/2;x+=12)p.push(brick(3.4,bodyH,11,x,base+bodyH/2,0));p.push(B(w,2.5,12,0,h-1,0));}
 if(f==='Mine'||f==='Timber'){for(const x of [-w/2+3,w/2-3])p.push(timber(5,bodyH,depth-1,x,base+bodyH/2,0));p.push(timber(w,5,depth-1,0,h-3,0));for(const x of [-w/2+3,w/2-3])for(const y of [12,h-6])p.push(B(5.5,3,depth,x,y,0,iron));}
 if(k==='ladder'){for(const x of [-5,5])p.push(B(1.8,bodyH-3,3,x,base+bodyH/2,6,iron));for(let y=base+4;y<h-2;y+=6)p.push(B(12,1.7,3,0,y,6,iron));}
 if(k==='murderhole'){s=s.subtract(B(Math.min(17,w-10),3,depth+20,0,h*.61));p.push(B(Math.min(21,w-6),2.5,12,0,h*.61-3));}
 if(['switch','control','valve'].includes(k)){p.push(B(12,15,3,0,base+15,6,iron));if(k==='valve')p.push(ring(6,1.3,0,0,0,rust).rotate([90,0,0]).translate([0,base+16,8]),B(1.8,11,3,0,base+16,7,rust),B(11,1.8,3,0,base+16,7,rust));else {p.push(B(2,9,3,0,base+17,8,iron).rotate([0,0,12]),orb(2.3,0,base+22,9,rust));if(k==='control')for(const x of [-3,3])p.push(orb(1.3,x,base+11,8,bone));}}
 if(k==='mouth'){p.push(orb(8,0,base+19,3,stone).scale([1,1.2,.85]).subtract(orb(4.7,0,(base+19)*1.2,7)));for(const x of [-4,4])p.push(orb(2,x,base+27,6,dark));}
 if(k==='fire'){p.push(B(12,3,9,0,base+10,5,iron),cyl(3.6,10,0,base+16,5,[.77,.26,.035],.3,12));}
 if(k==='falling'){p.push(B(w-12,2.5,5,0,h-5,7,iron));for(const x of [-w/2+7,w/2-7])p.push(B(3,bodyH-4,6,x,base+bodyH/2,5,iron));p.push(brick(w-17,11,7,0,h-13,5));}
 s=U([s,...p]);if(f==='Ruins'){s=s.subtract(B(w*1.6,h,depth+30,0,0,0).rotate([0,0,8+(r.variant%3)*9]).translate([w*.1,h*1.25,0]));}
 return s;
}
export function footprint(r){const w=r.width,d=r.depth;if(r.shape==='rectangle')return [[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]]];
 if(r.shape==='corner')return [[[-w/2,-d/2],[w/2,-d/2],[w/2,-d/2+12.7],[-w/2,-d/2+12.7]],[[-w/2,-d/2+12.7],[-w/2+12.7,-d/2+12.7],[-w/2+12.7,d/2],[-w/2,d/2]]];
 const R=w,inner=r.shape==='arc-wall'||r.shape==='arc-strip'?R-r.ring:0,parts=[];
 if(r.shape==='concave'){for(let i=0;i<24;i++){const a=i*Math.PI/48,b=(i+1)*Math.PI/48;parts.push([[w/2,d/2],[-w/2+R*Math.cos(a),-d/2+R*Math.sin(a)],[-w/2+R*Math.cos(b),-d/2+R*Math.sin(b)]]);}return parts;}
 for(let i=0;i<32;i++){const a=i*Math.PI/64,b=(i+1)*Math.PI/64;parts.push([[inner*Math.cos(a)-w/2,inner*Math.sin(a)*d/w-d/2],[R*Math.cos(a)-w/2,R*Math.sin(a)*d/w-d/2],[R*Math.cos(b)-w/2,R*Math.sin(b)*d/w-d/2],...(inner?[[inner*Math.cos(b)-w/2,inner*Math.sin(b)*d/w-d/2]]:[])]);}return parts;
}
function mask(r,h=300){if(r.shape==='rectangle')return B(r.width,h,r.depth,0,h/2);if(r.shape==='corner')return U([B(r.width,h,12.7,0,h/2,-r.depth/2+6.35),B(12.7,h,r.depth,-r.width/2+6.35,h/2)]);
 const w=r.width,d=r.depth,round=cyl(w,h,0,h/2,0,stone,w,128).scale([1,1,d/w]).translate([-w/2,0,-d/2]),rect=B(w,h,d,0,h/2);if(r.shape==='concave')return rect.subtract(round);let result=round.intersect(rect);if(r.shape==='arc-wall'||r.shape==='arc-strip')result=result.subtract(cyl(w-r.ring,h+2,-w/2,h/2,-d/2,stone,w-r.ring,128));return result;
}
export function makeRangeSolid(r){let s;
 if(r.category==='Walls'){
  if(r.shape==='arc-wall'){const rad=r.width-r.ring/2,len=rad*Math.PI/2;s=wallShape(r,len,r.ring).warp(p=>{const a=(p[0]/len+.5)*Math.PI/2,radius=rad-p[2];p[0]=-r.width/2+radius*Math.cos(a);p[2]=-r.depth/2+radius*Math.sin(a);});}
  else s=wallShape(r);
 }else if(r.feature==='column'){
  s=masonry(r.width,r.height,r.depth,r.variant);const p=[s,B(r.width,3,r.depth,0,1.5),B(r.width,3,r.depth,0,r.height-1.5)];if(r.family==='Ossuary')for(const y of [12,r.height-10])p.push(skull(0,y,r.depth/2-1,2));if(r.family==='Mine')for(const x of [-r.width/2+2,r.width/2-2])p.push(timber(3,r.height-3,r.depth,x,r.height/2,0));s=U(p);
 }else {s=floorDetails(r);if(r.shape==='corner'){const walls=U([wallShape({...r,feature:'wall',family:'Crypt'},r.width,12.7).translate([0,0,-r.depth/2+6.35]),wallShape({...r,feature:'wall',family:'Crypt'},r.depth,12.7).rotate([0,90,0]).translate([-r.width/2+6.35,0,0])]);s=s.add(walls);}}
 const bounds=mask(r);s=s.intersect(bounds);return s;
}
export function rangeSpec(r){const w=r.width,d=r.depth,ports=[],add=(x,z,nx,nz,angle,y=3.5,roll=0)=>ports.push({x,z,nx,nz,angle,y,roll});
 const vertical=(x,z,nx,nz,a)=>{for(const y of [12.7,38.1])if(y+8<r.height)add(x,z,nx,nz,a,y,90);};
 if(r.feature==='column'){const sides=r.junction==='O'?[0]:r.junction==='I'?[0,180]:r.junction==='L'?[0,90]:r.junction==='T'?[0,90,180]:[0,90,180,270];for(const a of sides){const rad=a*Math.PI/180;vertical(Math.cos(rad)*w/2,-Math.sin(rad)*d/2,Math.cos(rad),-Math.sin(rad),a);}}
 else if(r.shape==='arc-wall'||r.shape==='arc-strip'){const inner=w-r.ring,mid=(inner+w)/2;const radius=r.shape==='arc-wall'?inner:w,sign=r.shape==='arc-wall'?-1:1;add(radius/Math.SQRT2-w/2,radius/Math.SQRT2-d/2,sign/Math.SQRT2,sign/Math.SQRT2,sign===1?-45:135);vertical(mid-w/2,-d/2,0,-1,90);vertical(-w/2,mid-d/2,-1,0,180);if(r.ring>=20){add(mid-w/2,-d/2,0,-1,90);add(-w/2,mid-d/2,-1,0,180);}}
 else if(r.shape==='quarter'){add(0,-d/2,0,-1,90);add(-w/2,0,-1,0,180);if(Math.abs(w-d)<.001)add(w/Math.SQRT2-w/2,d/Math.SQRT2-d/2,1/Math.SQRT2,1/Math.SQRT2,-45);}
 else if(r.shape==='concave'){add(w/2,0,1,0,0);add(0,d/2,0,1,-90);}
 else if(r.category==='Walls'){add(0,d/2,0,1,-90);if(d>=25.4)add(0,-d/2,0,-1,90);vertical(w/2,0,1,0,0);vertical(-w/2,0,-1,0,180);}
 else if(r.shape==='corner'){add(0,-d/2,0,-1,90);add(-w/2,0,-1,0,180);}
 else {if(d>=25.4){add(w/2,0,1,0,0);add(-w/2,0,-1,0,180);}if(w>=25.4){add(0,d/2,0,1,-90);if(d>=25.4)add(0,-d/2,0,-1,90);}}
 return {templateSource:'printable-scenery-8.6',revision:3,kind:r.category==='Walls'?'wall':r.feature==='column'?'column':'floor',width:w,depth:d,height:8,ports,footprints:footprint(r)};
}
export function cutRangeSockets(s,spec){const raw=socketCut(wasm).translate([0,-3.5,0]);const cuts=spec.ports.map(p=>raw.rotate([p.roll,0,0]).rotate([0,p.angle,0]).translate([p.x,p.y,p.z]));const result=cuts.length?s.subtract(U(cuts)):s;raw.delete();return result;}



