export function aiCapabilities(status = {}) {
  const consent = status.consent?.accepted === true;
  const linked = status.chatgpt?.enabled === true;
  const api = status.configured || {};
  const route = status.route || 'auto';
  const selected = status.provider || 'openai';
  const wantsLinked = route === 'chatgpt' || (route !== 'api' && status.chatgpt?.signedIn);
  const conversation = consent && (wantsLinked ? linked : !!api[selected]);
  const images = consent && !!api.openai;
  const models = consent && !!api.meshy && (linked || !!api.openai || !!api.claude);
  return {conversation,images,models,
    conversationReason: !consent ? 'Accept online AI data sharing in Settings.' : wantsLinked ? 'Link ChatGPT and enable plan use in Settings.' : 'Link ChatGPT or add a working text-provider API key in Settings.',
    imageReason: !consent ? 'Accept online AI data sharing in Settings. You can upload artwork without AI.' : 'Concept image generation requires an OpenAI API key. Upload your own concept art to continue; linked ChatGPT conversation does not include image generation.',
    modelReason: !consent ? 'Accept online AI data sharing in Settings.' : 'Requires linked AI and a Meshy API key. With linked ChatGPT plus Meshy, upload and approve your own concept art; an OpenAI API key is needed only for AI images.'};
}

export function generationConfirmation(status,mode='assistant'){
  const linked=!['illustration','test'].includes(mode)&&status.route!=='api'&&(status.route==='chatgpt'||status.chatgpt?.signedIn);
  const provider=mode==='illustration'?'openai':status.provider||'openai';
  return {type:'question',buttons:['Cancel',linked?'Continue with linked ChatGPT':'Generate with my API account'],defaultId:0,cancelId:0,
    title:linked?'Linked ChatGPT request':'Provider-billed generation',message:linked?'Send the relevant project context to ChatGPT?':'Send the relevant project context to '+provider+'?',
    detail:(linked?'Uses your linked ChatGPT plan and credit settings. Remaining allowance and monetary charges are unknown. A failed linked request does not switch to an API key.':'Uses your '+provider+' API account; the provider may charge it.')+' Only relevant excerpts and recent messages are sent. Proposed changes require review unless you have enabled Agent mode.'};
}
