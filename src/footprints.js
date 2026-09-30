// Convex decomposition permits floor tiles to occupy the empty part of an arc.
export function footprintsOverlap(a,sa,b,sb){
 const polygons=(i,s)=>{const angle=i.rotation*Math.PI/180,c=Math.cos(angle),sn=Math.sin(angle);const shapes=s.footprints||[[[-s.width/2,-s.depth/2],[s.width/2,-s.depth/2],[s.width/2,s.depth/2],[-s.width/2,s.depth/2]]];return shapes.map(p=>p.map(([x,z])=>[i.x*25.4+c*x+sn*z,i.z*25.4-sn*x+c*z]));};
 const intersects=(p,q)=>{for(const polygon of [p,q])for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.00001)continue;const axis=[-dz/len,dx/len],proj=poly=>poly.map(v=>v[0]*axis[0]+v[1]*axis[1]),pp=proj(p),qq=proj(q);if(Math.max(...pp)<=Math.min(...qq)+.01||Math.max(...qq)<=Math.min(...pp)+.01)return false;}return true;};
 const pa=polygons(a,sa),pb=polygons(b,sb);return pa.some(p=>pb.some(q=>intersects(p,q)));
}
