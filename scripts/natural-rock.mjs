import {M,noise} from './sculpt-library.mjs';
const clamp=x=>Math.max(0,Math.min(1,x));
// A continuous rock mass: broad weathered planes, interrupted strata and fissures.
// All displacement fades at the ends and footing to preserve assembly dimensions.
export function naturalRock(w,h,d,seed=0){
 return M.cube([w,h,d],true).refineToLength(.65).warp(p=>{
  const [x,y,z]=p,ends=clamp((w/2-Math.abs(x))/2),vertical=clamp((h/2-Math.abs(y))/2.5);
  if(Math.abs(z)>d/2-.001){
   const strata=y*.55+x*.065+1.7*noise(x*.065,seed,y*.09);
   const fracture=Math.pow(.5+.5*Math.sin(x*.24+y*.11+noise(x*.08,y*.08,seed)*2),16);
   const broad=1.55*noise(x*.10+seed,y*.12,z*.16)+.48*noise(x*.36,y*.4,seed);
   p[2]+=Math.sign(z)*ends*vertical*(broad-.85*Math.pow(.5+.5*Math.sin(strata),12)-.7*fracture);
  }
  if(y>h/2-5)p[1]-=clamp((y-h/2+5)/5)*ends*(.8+1.25*(.5+.5*noise(x*.17,seed,z*.2)));
 }).setProperties(3,(c,p)=>{
  const [x,y,z]=p,n=noise(x*.08+seed,y*.10,z*.08),fine=noise(x*.8,y*.8,z*.8),seam=Math.pow(.5+.5*Math.sin(y*.55+x*.065+1.7*noise(x*.065,seed,y*.09)),12);
  const shade=.9+.20*n+.07*fine-.18*seam;
  [.43,.415,.37].forEach((v,i)=>c[i]=v*shade+(i===0?.025*n:0));
 });
}

