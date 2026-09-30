// Weld below printable resolution, removing collapsed slivers from boolean seams.
export function cleanMeshData(data){
 const positions=[],colors=[],lookup=new Map(),remap=[];
 for(let i=0;i<data.positions.length;i+=3){const p=data.positions.slice(i,i+3).map(n=>Math.round(n*10000)/10000),key=p.join(',');let id=lookup.get(key);
  if(id===undefined){id=positions.length/3;lookup.set(key,id);positions.push(...p);colors.push(...data.colors.slice(i,i+3).map(n=>Math.round(n*10000)/10000));}remap.push(id);
 }
 const faces=new Map();for(let i=0;i<data.indices.length;i+=3){const tri=data.indices.slice(i,i+3).map(j=>remap[j]);if(new Set(tri).size!==3)continue;const key=[...tri].sort((a,b)=>a-b).join(',');if(faces.has(key))faces.delete(key);else faces.set(key,tri);}
 return {...data,positions,colors,indices:[...faces.values()].flat()};
}
