// A bounded local view of the saved relationship graph; no provider request.
export function renderCampaignNetwork(container,campaign,openItem) {
  const section=document.createElement('section');section.className='campaign-network';
  const heading=document.createElement('h3');heading.textContent='Relationships';section.append(heading);
  const nodes=campaign.items.slice(0,75),known=new Set(nodes.map(item=>item.id));
  const links=campaign.relationships.filter(link=>known.has(link.from)&&known.has(link.to));
  if(!nodes.length){const empty=document.createElement('p');empty.textContent='Add people, places or other entries to connect them.';section.append(empty);container.append(section);return;}
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 800 600');svg.setAttribute('role','img');svg.setAttribute('aria-label','Saved project relationship graph');svg.style.cssText='width:100%;max-height:36rem';
  const positions=new Map(nodes.map((item,index)=>{const angle=index*Math.PI*2/nodes.length;return [item.id,{x:400+Math.cos(angle)*260,y:300+Math.sin(angle)*220}];}));
  for(const link of links){const from=positions.get(link.from),to=positions.get(link.to),line=document.createElementNS(svg.namespaceURI,'line');for(const [key,value]of Object.entries({x1:from.x,y1:from.y,x2:to.x,y2:to.y,stroke:'#9a8a64','stroke-width':2}))line.setAttribute(key,value);svg.append(line);}
  for(const item of nodes){const point=positions.get(item.id),group=document.createElementNS(svg.namespaceURI,'g'),circle=document.createElementNS(svg.namespaceURI,'circle'),text=document.createElementNS(svg.namespaceURI,'text');circle.setAttribute('cx',point.x);circle.setAttribute('cy',point.y);circle.setAttribute('r',8);circle.setAttribute('fill','#e5bd74');text.setAttribute('x',point.x);text.setAttribute('y',point.y-15);text.setAttribute('text-anchor','middle');text.setAttribute('fill','currentColor');text.setAttribute('font-size',12);text.textContent=item.title.slice(0,36);group.append(circle,text);svg.append(group);}
  section.append(svg);
  const list=document.createElement('ul');
  for(const link of links){const row=document.createElement('li'),from=campaign.items.find(item=>item.id===link.from),to=campaign.items.find(item=>item.id===link.to);row.textContent=from.title+' — '+link.label+' — '+to.title;list.append(row);}section.append(list);
  const choices=document.createElement('div');choices.className='studio-choices';for(const item of nodes){const button=document.createElement('button');button.type='button';button.textContent=item.title;button.onclick=()=>openItem(item.id);choices.append(button);}section.append(choices);
  if(campaign.items.length>nodes.length){const note=document.createElement('p');note.textContent='Showing the first 75 entries. Use the record list to find other entries and relationships.';section.append(note);}container.append(section);
}
