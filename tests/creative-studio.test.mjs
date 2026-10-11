import test from 'node:test';
import assert from 'node:assert/strict';
import {abilityModifier,normaliseCharacterSheet,characterSheetHtml} from '../src/character-sheet.js';
import {CREATIVE_STEPS,approvedConcept,retainedConcepts,creativePromptBundle} from '../src/creative-studio.js';

test('character sheet supports all six abilities and clamps imported values',()=>{
 const sheet=normaliseCharacterSheet({abilities:{strength:100,dexterity:8},level:50,saves:{strength:true},skills:{stealth:true}});
 assert.equal(sheet.abilities.strength,30);assert.equal(sheet.abilities.dexterity,8);assert.equal(sheet.level,20);assert.equal(abilityModifier(8),-1);assert.equal(Object.keys(sheet.abilities).length,6);assert.equal(sheet.skills.stealth,true);assert.equal(sheet.saves.strength,true);
});
test('only selected retained and explicitly approved concept can advance to Meshy',()=>{
 const record={selectedConceptId:'a',concepts:[{id:'a',retained:true,approved:false},{id:'b',retained:true,approved:true}]};assert.equal(approvedConcept(record),null);record.concepts[0].approved=true;assert.equal(approvedConcept(record).id,'a');record.concepts[0].retained=false;assert.equal(approvedConcept(record),null);assert.equal(retainedConcepts(record).length,1);
});
test('full sheet and compact card use escaped original markup with usable game stats',()=>{
 const record={name:'<script>alert(1)</script>',id:'character-one',sheet:{abilities:{strength:16},hitPoints:15,currentHitPoints:12,attacks:'<img onerror=bad>',biography:'History'}};
 const sheet=characterSheetHtml(record),card=characterSheetHtml(record,'card');assert.match(sheet,/&lt;script&gt;/);assert.doesNotMatch(sheet,/<script>/);assert.match(sheet,/Saving throws/);assert.match(sheet,/Skills/);assert.match(card,/12 \/ 15/);assert.doesNotMatch(card,/Saving throws/);assert.match(card,/A5 landscape/);
});
test('four-step workflows remain distinct and prompt exports retain production constraints',()=>{
 assert.deepEqual(CREATIVE_STEPS.character,['Brief','Appearance','3D model','Character sheet']);assert.equal(CREATIVE_STEPS.scenery[3],'Pack');const prompt=creativePromptBundle({id:'piece',kind:'scenery',name:'Cave',description:'Original cave',design:{openlock:true,clearanceMm:8}});assert.match(prompt,/official template/);assert.match(prompt,/8/);assert.match(prompt,/physical tests/);assert.match(prompt,/boxed tray/);
});
