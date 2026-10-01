// Weld below printable resolution, removing collapsed slivers from boolean seams.
export function cleanMeshData(data){
 const positions=[],colors=[],lookup=new Map(),remap=[];
 for(let i=0;i<data.positions.length;i+=3){const p=data.positions.slice(i,i+3).map(n=>Math.round(n*10000)/10000),key=p.join(',');let id=lookup.get(key);
  if(id===undefined){id=positions.length/3;lookup.set(key,id);positions.push(...p);colors.push(...data.colors.slice(i,i+3).map(n=>Math.round(n*10000)/10000));}remap.push(id);
 }
 const faces=new Map();for(let i=0;i<data.indices.length;i+=3){const tri=data.indices.slice(i,i+3).map(j=>remap[j]);if(new Set(tri).size!==3)continue;const key=[...tri].sort((a,b)=>a-b).join(',');if(faces.has(key))faces.delete(key);else faces.set(key,tri);}
 return {...data,positions,colors,indices:[...faces.values()].flat()};
}

// Check the exported Float32 coordinates, not just Manifold's internal topology.
export function printableMesh(data){
 const ids=[],points=new Map(),edges=new Map();
 for(let i=0;i<data.positions.length;i+=3){const key=data.positions.slice(i,i+3).map(Math.fround).join(',');if(!points.has(key))points.set(key,points.size);ids.push(points.get(key));}
 for(let i=0;i<data.indices.length;i+=3){const tri=data.indices.slice(i,i+3),p=tri.map(v=>data.positions.slice(v*3,v*3+3).map(Math.fround)),u=p[1].map((x,j)=>x-p[0][j]),v=p[2].map((x,j)=>x-p[0][j]);
  if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2<1e-10)return false;
  for(let j=0;j<3;j++){const a=ids[tri[j]],b=ids[tri[(j+1)%3]],key=a<b?a+','+b:b+','+a,e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);}
 }
 return [...edges.values()].every(e=>e[0]===2&&e[1]===0);
}
// Re-triangulate welded seams before Float32/STL export. Dropping a collinear
// triangle alone would leave a hole. Adaptive repair is limited to 0.01 mm.
export function repairMeshData(data,wasm){
 const d=cleanMeshData(data),values=[];
 for(let i=0;i<d.positions.length;i+=3)values.push(...d.positions.slice(i,i+3),...d.colors.slice(i,i+3));
 const mesh=new wasm.Mesh({numProp:6,vertProperties:Float32Array.from(values),triVerts:Uint32Array.from(d.indices),tolerance:.0001});mesh.merge();
 const solid=new wasm.Manifold(mesh);if(solid.status()!=='NoError')throw Error('Welded mesh is not manifold: '+solid.status());
 try{for(const tolerance of [.0001,.001,.003,.01]){
  const simple=solid.simplify(tolerance),m=simple.getMesh(),positions=[],colors=[];
  for(let i=0;i<m.vertProperties.length;i+=m.numProp){positions.push(...m.vertProperties.slice(i,i+3));colors.push(...m.vertProperties.slice(i+3,i+6));}
  const result={...data,positions,colors,indices:Array.from(m.triVerts)};simple.delete();if(printableMesh(result))return result;
 }}finally{solid.delete();}
 throw Error('Mesh still has collapsed triangles or touching edges after bounded repair');
}
