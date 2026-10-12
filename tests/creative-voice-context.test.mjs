import test from 'node:test';
import assert from 'node:assert/strict';
import {creativeVoiceContext} from '../src/creative-voice-context.js';
import {setupCampaignVoice} from '../src/campaign-voice.js';
test('voice receives current saved concepts, approval and dimensions without images or paths',async()=>{
 const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),originalDocument=globalThis.document,originalPeer=globalThis.RTCPeerConnection,sent=[];let channel;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[]})}}});
 globalThis.document={body:{append(){}},createElement:()=>({pause(){},remove(){},play:async()=>{}})};
 globalThis.RTCPeerConnection=class{addTrack(){}createDataChannel(){channel={readyState:'open',send:v=>sent.push(JSON.parse(v)),close(){}};return channel;}async createOffer(){return {sdp:'v=0'};}async setLocalDescription(value){this.localDescription=value;}async setRemoteDescription(){}close(){}};
 const voice=setupCampaignVoice({api:{campaignVoiceStart:async()=>({sdp:'v=0',provider:'realtime',maximumSeconds:600}),campaignVoiceStop:async()=>{}},getCampaign:()=>({id:'test'}),onStatus:()=>{}});
 try{
  const record={id:'asset',kind:'character',name:'Strider',design:{heightMm:32,baseDiameterMm:25},concepts:[]};voice.updateDesignerContext({record,step:'concept'});await voice.talk();channel.onopen();
  record.concepts.push({id:'one',name:'Concept 1',image:'PRIVATE IMAGE BYTES',retained:true,approved:false});record.selectedConceptId='one';record.mainConceptId='one';voice.updateDesignerContext({record,step:'concept'});record.concepts[0].approved=true;voice.updateDesignerContext({record,step:'model'});
  const last=sent.at(-1).item.content[0].text;assert.match(last,/"approved":true/);assert.match(last,/"heightMm":32/);assert.match(last,/"baseDiameterMm":25/);assert.doesNotMatch(last,/PRIVATE IMAGE/);assert.equal(sent.some(e=>e.type==='response.create'),false);const count=sent.length;voice.updateDesignerContext({record,step:'model'});assert.equal(sent.length,count);
  assert.equal(creativeVoiceContext({record}).concepts.length,1);
 }finally{await voice.stop();if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;globalThis.document=originalDocument;globalThis.RTCPeerConnection=originalPeer;}
});
