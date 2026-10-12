import test from 'node:test';
import assert from 'node:assert/strict';
import {abilityModifier,normaliseCharacterSheet,characterSheetHtml} from '../src/character-sheet.js';
import {creativeSteps,conceptThumbnail,CREATIVE_STEPS,approvedConcept,retainedConcepts,creativePromptBundle} from '../src/creative-studio.js';

test('character sheet supports all six abilities and clamps imported values',()=>{
 const sheet=normaliseCharacterSheet({abilities:{strength:100,dexterity:8},level:50,saves:{strength:true},skills:{stealth:true}});
 assert.equal(sheet.abilities.strength,30);assert.equal(sheet.abilities.dexterity,8);assert.equal(sheet.level,20);assert.equal(abilityModifier(8),-1);assert.equal(Object.keys(sheet.abilities).length,6);assert.equal(sheet.skills.stealth,true);assert.equal(sheet.saves.strength,true);
});
test('only selected retained and explicitly approved concept can advance to Meshy',()=>{
 const record={selectedConceptId:'a',concepts:[{id:'a',retained:true,approved:false},{id:'b',retained:true,approved:true}]};assert.equal(approvedConcept(record),null);record.concepts[0].approved=true;assert.equal(approvedConcept(record).id,'a');record.concepts[0].retained=false;assert.equal(approvedConcept(record),null);assert.equal(retainedConcepts(record).length,1);
});
test('full sheet and compact card use escaped original markup with usable game stats',()=>{
 const record={name:'<script>alert(1)</script>',id:'character-one',sheet:{abilities:{strength:16},hitPoints:15,currentHitPoints:12,attacks:'<img onerror=bad>',biography:'History'}};
 const sheet=characterSheetHtml(record),card=characterSheetHtml(record,'card');assert.match(sheet,/&lt;script&gt;/);assert.doesNotMatch(sheet,/<script>/);assert.match(sheet,/Saving throws/);assert.match(sheet,/Skills/);assert.match(card,/12 \/ 15/);assert.doesNotMatch(card,/Saving throws/);assert.match(card,/63mm 88mm/);
});
test('four-step workflows remain distinct and prompt exports retain production constraints',()=>{
 assert.deepEqual(CREATIVE_STEPS.character,['Brief','Appearance','3D model','Character sheet']);assert.equal(CREATIVE_STEPS.scenery[3],'Pack');const prompt=creativePromptBundle({id:'piece',kind:'scenery',name:'Cave',description:'Original cave',design:{openlock:true,clearanceMm:8}});assert.match(prompt,/official template/);assert.match(prompt,/8/);assert.match(prompt,/physical tests/);assert.match(prompt,/boxed tray/);
});

test('universal asset purpose only offers D&D sheet for D&D characters',()=>{for(const purpose of ['railway','racing','other'])assert.equal(creativeSteps({kind:'character',design:{purpose}})[3],'Asset details');assert.equal(creativeSteps({kind:'character',design:{purpose:'dnd'}})[3],'Character sheet');assert.equal(creativeSteps({kind:'scenery',design:{purpose:'railway'}})[3],'Pack');});
test('main thumbnail prefers retained chosen concept and falls back to actual model render',()=>{const record={mainConceptId:'main',model:{thumbnail:'model-render'},concepts:[{id:'main',image:'main-image',retained:true}]};assert.equal(conceptThumbnail(record),'main-image');record.concepts[0].retained=false;assert.equal(conceptThumbnail(record),'model-render');delete record.model;assert.equal(conceptThumbnail(record),null);});

 test('print layouts reject unsupported themes and omit removed concepts',()=>{const r={name:'Ranger',sheet:{},selectedConceptId:'gone',mainConceptId:'main',concepts:[{id:'gone',retained:false,image:'data:image/png;base64,removed'},{id:'main',retained:true,image:'data:image/png;base64,main'}]};for(const theme of ['clean','fantasy','technical']){const html=characterSheetHtml(r,'card',{theme});assert.match(html,new RegExp('body class="'+theme+'"'));assert.match(html,/base64,main/);assert.doesNotMatch(html,/base64,removed/);}assert.throws(()=>characterSheetHtml(r,'card',{theme:'injected'}),/supported print layout/);});
