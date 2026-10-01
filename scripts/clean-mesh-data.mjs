// Weld below printable resolution, removing collapsed slivers from boolean seams.
export function cleanMeshData(data){
 const positions=[],colors=[],lookup=new Map(),remap=[];
 for(let i=0;i<data.positions.length;i+=3){const p=data.positions.slice(i,i+3).map(n=>Math.round(n*10000)/10000),key=p.join(',');let id=lookup.get(key);
  if(id===undefined){id=positions.length/3;lookup.set(key,id);positions.push(...p);colors.push(...data.colors.slice(i,i+3).map(n=>Math.round(n*10000)/10000));}remap.push(id);
 }
 const faces=new Map();for(let i=0;i<data.indices.length;i+=3){const tri=data.indices.slice(i,i+3).map(j=>remap[j]);if(new Set(tri).size!==3)continue;const key=[...tri].sort((a,b)=>a-b).join(',');if(faces.has(key))faces.delete(key);else faces.set(key,tri);}
 return {...data,positions,colors,indices:[...faces.values()].flat()};
}

// Re-triangulate welded seams before Float32/STL export. Dropping a collinear
// triangle alone would leave a topological hole; Manifold collapses its edge.
export function repairMeshData(data,wasm){
 const d=cleanMeshData(data),values=[];
 for(let i=0;i<d.positions.length;i+=3)values.push(...d.positions.slice(i,i+3),...d.colors.slice(i,i+3));
 const mesh=new wasm.Mesh({numProp:6,vertProperties:Float32Array.from(values),triVerts:Uint32Array.from(d.indices),tolerance:.0001});mesh.merge();
 const solid=new wasm.Manifold(mesh);if(solid.status()!=='NoError')throw Error('Welded mesh is not manifold: '+solid.status());
 const simple=solid.simplify(.0001),m=simple.getMesh(),positions=[],colors=[];
 for(let i=0;i<m.vertProperties.length;i+=m.numProp){positions.push(...m.vertProperties.slice(i,i+3));colors.push(...m.vertProperties.slice(i+3,i+6));}
 simple.delete();solid.delete();return {...data,positions,colors,indices:Array.from(m.triVerts)};
}
