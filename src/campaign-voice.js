// Microphone media stays in WebRTC; only bounded tool calls cross the desktop bridge.
export function setupCampaignVoice({api,getCampaign,getTerrain,onTranscript,onProposal,onDictation,onStatus}){
 let pc=null,channel=null,stream=null,audio=null,timer=null,dictating=false,queue=Promise.resolve();
 const send=event=>{if(channel?.readyState==='open')channel.send(JSON.stringify(event));};
 async function stop(){clearTimeout(timer);timer=null;stream?.getTracks().forEach(t=>t.stop());stream=null;if(channel)channel.onmessage=null;channel?.close();channel=null;await queue;pc?.close();pc=null;if(audio){audio.pause();audio.srcObject=null;audio.remove();audio=null;}await api.campaignVoiceStop();if(dictating){await api.campaignDictationStop();dictating=false;}onStatus('Microphone off');}
 async function talk(mode='talk'){
  if(pc||dictating)throw Error('Stop the current microphone session first');const id=getCampaign()?.id;if(!id)throw Error('Open a campaign first');
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});pc=new RTCPeerConnection();audio=document.createElement('audio');audio.autoplay=true;document.body.append(audio);pc.ontrack=e=>{audio.srcObject=e.streams[0];audio.play().catch(()=>onStatus('Use Resume audio to hear your companion'));};for(const track of stream.getTracks())pc.addTrack(track,stream);channel=pc.createDataChannel('oai-events');const pending=new Map();
   channel.onmessage=event=>{if(event.data.length>200000)return;let e;try{e=JSON.parse(event.data);}catch{return;}
    queue=queue.then(async()=>{if(!pc||getCampaign()?.id!==id)return;
     if(e.type==='conversation.item.input_audio_transcription.completed'&&e.transcript){if(mode==='dictate')onDictation(e.transcript);else await onTranscript('user',e.transcript);}
     if(e.type==='response.output_audio_transcript.done'&&e.transcript&&mode==='talk')await onTranscript('assistant',e.transcript);
     if(e.type==='response.function_call_arguments.done'&&mode==='talk'){
      if(pending.has(e.call_id))return;pending.set(e.call_id,true);let result;try{result=await api.campaignVoiceTool(id,e.name,JSON.parse(e.arguments),getTerrain?.());if(result.proposed)onProposal(result.action);}catch{result={error:'The app rejected this request. Refresh context or ask for a simpler supported proposal.'};}
      send({type:'conversation.item.create',item:{type:'function_call_output',call_id:e.call_id,output:JSON.stringify(result)}});send({type:'response.create'});
     }
     if(e.type==='error')onStatus('Voice provider reported an error. Stop and check your API account.');
    }).catch(error=>onStatus(error.message));
   };
   channel.onopen=()=>onStatus(mode==='dictate'?'Online dictation listening · API billed':'Live conversation listening · API billed');
   pc.onconnectionstatechange=()=>{if(['failed','disconnected'].includes(pc?.connectionState))void stop();};
   await pc.setLocalDescription(await pc.createOffer());const reply=await api.campaignVoiceStart(id,pc.localDescription.sdp,mode,getTerrain?.());if(!reply){await stop();return;}await pc.setRemoteDescription({type:'answer',sdp:reply.sdp});timer=setTimeout(()=>void stop(),reply.maximumSeconds*1000);
  }catch(e){await stop();throw e;}
 }
 const unsubscribe=api.onCampaignDictation?.(event=>{if(event.text)onDictation(event.text);if(event.error){onStatus(event.error);dictating=false;}if(event.stage==='stopped')dictating=false;});
 async function dictate(){if(pc||dictating)throw Error('Stop the current microphone session first');await api.campaignDictationStart();dictating=true;onStatus('Offline Windows dictation listening · words stay in your draft');}
 function mute(){if(dictating){onStatus('Offline dictation is listening. Use Stop microphone to stop it.');return;}for(const track of stream?.getAudioTracks()||[])track.enabled=!track.enabled;onStatus(stream?.getAudioTracks()[0]?.enabled?'Microphone listening':'Microphone muted');}
 return {talk,dictate,stop,mute,resume:()=>audio?.play(),active:()=>!!pc||dictating,dispose:async()=>{unsubscribe?.();await stop();}};
}
