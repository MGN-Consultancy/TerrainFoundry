import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync('src/generated/expansions.json'));
for(const id of ['q-quarry-wall','q-quarry-arch','c-door','c-tower-roof','t-jaws']){const d=data[id],edges=new Map();for(let i=0;i<d.indices.length;i+=3)for(let j=0;j<3;j++){const a=d.indices[i+j],b=d.indices[i+(j+1)%3],key=[a,b].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)||0)+1);}console.log(id,[...edges].filter(([k,v])=>v!==2).slice(0,10).map(([k,v])=>[v,...k.split(',').map(i=>d.positions.slice(i*3,i*3+3))]));}
