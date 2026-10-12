import {chromium} from 'playwright';
import {characterSheetHtml} from '../desktop/character-sheet.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.TERRAIN_BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const page=await browser.newPage({viewport:{width:900,height:1150}});
 let image;try{const local=await chromium.connectOverCDP('http://127.0.0.1:9229');const tab=local.contexts()[0].pages()[0];image=await tab.evaluate(async()=>{const list=await window.desktop.creativeList({kind:'character'}),r=(Array.isArray(list)?list:list.records||[]).find(x=>x.name==='Strider');if(!r)return;const a=await window.desktop.creativeLoad(r.id);return a.concepts?.find(c=>c.id===a.mainConceptId&&c.retained!==false)?.image||a.concepts?.find(c=>c.retained!==false)?.image;});await local.close();}catch{}
 const record={name:'Strider',sheet:{species:'Human',class:'Ranger',background:'Distant noble roots',level:3,hitPoints:28,currentHitPoints:24,armourClass:15,abilities:{strength:14,dexterity:16,constitution:13,intelligence:10,wisdom:14,charisma:12},skills:{survival:true,perception:true},attacks:'Longsword · +4 to hit · 1d8 + 2 slashing',features:'Quiet loner with a sharp wit. Skilled traveller and observant tracker.',equipment:'Brown leathers, boots, longsword and travelling pack.',biography:'A scarred ranger with distant noble roots. His motivation is still an open question.'},concepts:image?[{id:'sample',image,retained:true}]:[],mainConceptId:'sample'};
 await fs.mkdir('test-results',{recursive:true});
 for(const format of ['card','sheet'])for(const theme of ['clean','fantasy','technical']){
  await page.setContent(characterSheetHtml(record,format,{theme}));await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));
  await page.screenshot({path:`test-results/character-${format}-${theme}.png`,fullPage:true});if(format==='card'){const overflow=await page.locator('.card').evaluateAll(nodes=>nodes.map(n=>({overflow:n.scrollHeight>n.clientHeight+1,footer:n.querySelector('footer')?.getBoundingClientRect().top,last:n.querySelector('section:last-of-type')?.getBoundingClientRect().bottom})));for(const state of overflow){assert.equal(state.overflow,false,JSON.stringify({theme,state}));if(state.footer&&state.last)assert.ok(state.last<=state.footer,'card text must not overlap footer');}}
  await page.screenshot({path:`test-results/character-${format}-${theme}.png`,fullPage:true});
  const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});await fs.writeFile(`test-results/character-${format}-${theme}.pdf`,pdf);const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;assert.equal(pages,format==='card'?2:1,`${format} ${theme} page count`);
 }
 console.log(JSON.stringify({passed:true,themes:3,cardPages:2,sheetPages:1,providerCalls:0}));
}finally{await browser.close();}
