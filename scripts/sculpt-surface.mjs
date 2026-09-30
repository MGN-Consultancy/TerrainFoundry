import {wasm,M} from './sculpt-library.mjs';
export function surface(w,d,nx,nz,top,color,bottom=null){
 const values=[],indices=[],topCount=(nx+1)*(nz+1);
 const add=(x,y,z,c)=>{values.push(x,y,z,...c);return values.length/6-1;};
 for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const xx=(x/nx-.5)*w,zz=(z/nz-.5)*d;add(xx,top(xx,zz),zz,color(xx,zz));}
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const a=z*(nx+1)+x,b=a+1,c=a+nx+1,e=c+1;indices.push(a,c,b,b,c,e);}
 const rim=[];for(let x=0;x<=nx;x++)rim.push(x);for(let z=1;z<=nz;z++)rim.push(z*(nx+1)+nx);for(let x=nx-1;x>=0;x--)rim.push(nz*(nx+1)+x);for(let z=nz-1;z>0;z--)rim.push(z*(nx+1));
 const lows=new Map();
 if(bottom){for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const xx=(x/nx-.5)*w,zz=(z/nz-.5)*d;add(xx,bottom(xx,zz),zz,color(xx,zz));}
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const a=topCount+z*(nx+1)+x,b=a+1,c=a+nx+1,e=c+1;indices.push(a,b,c,b,e,c);}for(const i of rim)lows.set(i,i+topCount);
 }else{const centre=add(0,0,0,[.30,.29,.26]);for(const i of rim)lows.set(i,add(values[i*6],0,values[i*6+2],[.30,.29,.26]));for(let i=0;i<rim.length;i++)indices.push(centre,lows.get(rim[i]),lows.get(rim[(i+1)%rim.length]));}
 for(let k=0;k<rim.length;k++){const a=rim[k],b=rim[(k+1)%rim.length],c=lows.get(a),d=lows.get(b);indices.push(a,b,c,b,d,c);}
 const s=new M(new wasm.Mesh({numProp:6,vertProperties:new Float32Array(values),triVerts:new Uint32Array(indices)}));if(s.status()!=='NoError')throw Error('Surface: '+s.status());return s;
}
