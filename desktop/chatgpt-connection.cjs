// Public Sign in with ChatGPT: app-owned registrations, never another app's tokens.
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const {atomicWrite} = require('./project-store.cjs');
const AUTH = 'https://auth.openai.com';
const API = 'https://api.openai.com/v1';
const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function verifyIdentity(token, keys, client, nonce, subject) {
  if (typeof token !== 'string' || token.length > 32000) throw Error('Invalid ChatGPT identity token.');
  const parts = token.split('.');
  if (parts.length !== 3) throw Error('Invalid ChatGPT identity token.');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url'));
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url'));
  const key = keys.find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.use || key.use === 'sig') && (!key.alg || key.alg === 'RS256'));
  if (header.alg !== 'RS256' || !key || !crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), crypto.createPublicKey({key, format: 'jwk'}), Buffer.from(parts[2], 'base64url')))
    throw Error('ChatGPT identity signature could not be verified.');
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const now = Date.now() / 1000;
  if (claims.iss !== AUTH || !audience.includes(client) || !Number.isFinite(claims.exp) || claims.exp < now - 30 || (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now + 30)) || typeof claims.sub !== 'string' || !claims.sub || (nonce !== undefined && !same(claims.nonce, nonce)) || (subject && claims.sub !== subject))
    throw Error('ChatGPT identity did not match this sign-in attempt.');
  return claims;
}

function createChatGPTConnection({directory, safeStorage, fetchImpl = fetch, openExternal}) {
  const filename = path.join(directory, 'chatgpt-accounts.protected');
  let pending = null, starting = false, message = '', mutation = Promise.resolve(); const refreshing = new Map();
  function secure() {
    if (!safeStorage.isEncryptionAvailable() || safeStorage.getSelectedStorageBackend?.() === 'basic_text') throw Error('OS-protected credential storage is required to link ChatGPT.');
  }
  async function read() {
    try {
      secure();
      if ((await fs.stat(filename)).size > 512000) throw Error('ChatGPT settings exceed their size limit.');
      const value = JSON.parse(safeStorage.decryptString(await fs.readFile(filename)));
      if (!value || typeof value.host !== 'string' || !Array.isArray(value.accounts)) throw Error('Invalid saved ChatGPT settings.');
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') return {host: 'urn:uuid:' + crypto.randomUUID(), accounts: [], active: null};
      throw error;
    }
  }
  function update(fn) {
    const task = mutation.then(async () => {
      secure();
      const value = await read();
      const result = await fn(value);
      await fs.mkdir(directory, {recursive: true});
      await atomicWrite(filename, safeStorage.encryptString(JSON.stringify(value)));
      return result;
    });
    mutation = task.catch(() => {});
    return task;
  }
  async function json(url, options = {}, maximum = 2000000) {
    const response = await fetchImpl(url, {...options, redirect: 'error', signal: AbortSignal.timeout(20000)});
    if (!response.ok) {
      const stage=url.endsWith('/oauth/token')?'token exchange':url.endsWith('/jwks.json')?'identity-key lookup':url.endsWith('/models')?'model lookup':'connection request';
      // Only known protocol error codes may leave this boundary; never expose a raw response or credentials.
      const known=new Set(['invalid_grant','invalid_client','invalid_request','invalid_scope','unsupported_grant_type','access_denied','server_error','temporarily_unavailable']);
      let code='';
      try {
        const reader=response.body?.getReader(),chunks=[];let size=0;
        if(reader)for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>4096){await reader.cancel();break;}chunks.push(Buffer.from(part.value));}
        const error=JSON.parse(Buffer.concat(chunks).toString('utf8')).error;
        const value=typeof error==='string'?error:error?.code;
        if(known.has(value))code='; '+value;
      } catch {}
      throw Error('ChatGPT '+stage+' failed (HTTP '+response.status+code+'). Retry using the saved account or unfinished registration. Existing linked accounts are unchanged.');
    }
    const reader = response.body.getReader(); let size = 0; const chunks = [];
    for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > maximum) { await reader.cancel(); throw Error('ChatGPT connection response is too large.'); } chunks.push(Buffer.from(part.value)); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  async function status() {
    // An unconfigured app can still show settings when OS storage is unavailable.
    try { await fs.access(filename); } catch (error) { if (error.code === 'ENOENT') return {signedIn: false, enabled: false, pending: !!pending, accounts: [], message}; throw error; }
    let value;try { value = await read(); } catch { return {signedIn:false,enabled:false,pending:!!pending,accounts:[],unreadable:true,message:'The saved ChatGPT connection cannot be read. Repair its local connection, or choose API key only for conversation. The encrypted connection is preserved.'}; } const account = value.accounts.find(a => a.id === value.active);
    return {signedIn: !!account?.access_token, enabled: !!account?.access_token && account.scopes.includes('chatgpt.tokens.use.direct'), pending: !!pending, active: value.active,
      accounts: value.accounts.map(a => ({id: a.id, label: a.email || 'ChatGPT account', registeredOnly:!a.subject, enabled: !!a.access_token && a.scopes.includes('chatgpt.tokens.use.direct')})),
      message: message || (account?.access_token ? 'ChatGPT linked. Concept images still require an OpenAI API key.' : 'Continue with ChatGPT to use the companion.')};
  }
  async function exchange(fields) {
    return json(AUTH + '/api/accounts/oauth/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({...fields, resource: API}).toString()});
  }
  function tokenFields(tokens, previous = {}) {
    if (typeof tokens.access_token !== 'string' || !tokens.access_token || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0 || tokens.token_type?.toLowerCase() !== 'bearer') throw Error('ChatGPT returned an invalid token response.');
    if (tokens.scope !== undefined && typeof tokens.scope !== 'string') throw Error('ChatGPT returned invalid permissions.');
    return {...previous, access_token: tokens.access_token, refresh_token: tokens.refresh_token || previous.refresh_token,
      id_token: tokens.id_token || previous.id_token, scopes: tokens.scope === undefined ? previous.scopes || [] : tokens.scope.split(/\s+/), expires: Date.now() + tokens.expires_in * 1000};
  }
  async function begin(accountID) {
    if (pending) return status();
    secure();
    let attempt;
    await update(value => {
      const account = accountID ? value.accounts.find(a => a.id === accountID) : null;
      if (accountID && !account) throw Error('Choose an existing ChatGPT account or add an account.');
      attempt = {host: value.host, account, state: crypto.randomBytes(32).toString('base64url'), nonce: crypto.randomBytes(32).toString('base64url'), verifier: crypto.randomBytes(48).toString('base64url')};
    });
    let handling = false;
    const listener = http.createServer(async (request, response) => {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (request.method !== 'GET' || request.headers.host !== '127.0.0.1:' + listener.address()?.port || url.pathname !== '/auth/callback' || !same(url.searchParams.get('state'), attempt.state) || handling || pending !== attempt) {
        response.writeHead(400, {'Content-Type': 'text/plain'}); response.end('Invalid sign-in callback.'); return;
      }
      handling = true;
      try {
        if (url.searchParams.has('error')) throw Error('ChatGPT sign-in was declined. Existing connections are unchanged.');
        const client = url.searchParams.get('client_id') || attempt.account?.client_id;
        if (!client || !/^oaiapp_[A-Za-z0-9_-]+$/.test(client) || (attempt.account && client !== attempt.account.client_id)) throw Error('ChatGPT registration did not match. Try signing in again.');
        const code = url.searchParams.get('code');
        if (!code || code.length > 8000) throw Error('ChatGPT sign-in returned no valid code.');
        const registrationID=attempt.account?.id||crypto.randomUUID();
        // Authorization has issued a registration even when the following exchange fails.
        // Keep it separate from the active connection until identity verification succeeds.
        await update(value=>{
          if(pending!==attempt)throw Error('Sign-in was cancelled.');
          if(!value.accounts.some(account=>account.id===registrationID))value.accounts.push({id:registrationID,client_id:client,subject:null,email:'Unfinished ChatGPT connection',scopes:[]});
        });
        const tokens = await exchange({grant_type: 'authorization_code', client_id: client, code, code_verifier: attempt.verifier, redirect_uri: attempt.redirect});
        const keys = await json(AUTH + '/.well-known/jwks.json');
        if (!Array.isArray(keys.keys)) throw Error('ChatGPT identity keys are unavailable.');
        const identity = verifyIdentity(tokens.id_token, keys.keys, client, attempt.nonce, attempt.account?.subject);
        const record = tokenFields(tokens, {id: registrationID, client_id: client, subject: identity.sub, email: typeof identity.email === 'string' ? identity.email.slice(0,320) : '', scopes: []});
        await update(value => {
          if (pending !== attempt) throw Error('Sign-in was cancelled.');
          const index = value.accounts.findIndex(a => a.id === record.id);
          if (index < 0) value.accounts.push(record); else value.accounts[index] = record;
          value.active = record.id;
        });
        message = record.scopes.includes('chatgpt.tokens.use.direct') ? 'ChatGPT connected. Return to Terrain Foundry.' : 'Signed in. Enable ChatGPT plan use by reconnecting with that permission.';
      } catch (error) { message = error.message.startsWith('ChatGPT') || error.message.startsWith('Signed') ? error.message : 'ChatGPT sign-in could not be verified. Try again.'; }
      response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'"});
      response.end('<!doctype html><title>Terrain Foundry</title><p>' + message.replace(/[<>&]/g, '') + '</p>');
      finish(attempt);
    });
    await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
    attempt.listener = listener;
    attempt.redirect = 'http://127.0.0.1:' + listener.address().port + '/auth/callback';
    const params = new URLSearchParams({client_id: attempt.account?.client_id || 'dynamic_agent_client', ext_agent_host_id: attempt.host, response_type: 'code', redirect_uri: attempt.redirect,
      scope: SCOPES, resource: API, state: attempt.state, nonce: attempt.nonce, code_challenge_method: 'S256', code_challenge: crypto.createHash('sha256').update(attempt.verifier).digest('base64url')});
    if (attempt.account?.id_token) params.set('id_token_hint', attempt.account.id_token);
    if (attempt.account?.email) params.set('login_hint', attempt.account.email);
    if (!attempt.account) params.set('agent_name_hint', 'Terrain Foundry');
    if (attempt.account && !attempt.account.scopes.includes('chatgpt.tokens.use.direct')) params.set('prompt', 'consent');
    pending = attempt; message = 'Complete ChatGPT sign-in in your browser.';
    attempt.timer = setTimeout(() => { if (pending === attempt) { message = 'ChatGPT sign-in timed out. Try again.'; finish(attempt); } }, 300000);
    attempt.timer.unref();
    try { await openExternal(AUTH + '/api/accounts/authorize?' + params); } catch { finish(attempt); throw Error('Could not open the ChatGPT sign-in browser.'); }
    return status();
  }
  function start(accountID) { if (starting || pending) return status(); starting = true; return begin(accountID).finally(() => { starting = false; }); }
  function finish(attempt) { clearTimeout(attempt.timer); if(attempt.listener.listening)attempt.listener.close(); if (pending === attempt) pending = null; }
  async function select(id) { if (pending) finish(pending); await update(value => { if (!value.accounts.some(a => a.id === id)) throw Error('Unknown ChatGPT account.'); value.active = id; }); message = ''; return status(); }
  async function token() {
    const value = await read(), account = value.accounts.find(a => a.id === value.active);
    if (!account?.access_token || !account.scopes.includes('chatgpt.tokens.use.direct')) throw Error('ChatGPT plan use is not enabled. Reconnect in AI settings.');
    if (account.expires > Date.now() + 60000) return account.access_token;
    if (!account.refresh_token) throw Error('ChatGPT sign-in expired. Reconnect in AI settings.');
    if (!refreshing.has(account.id)) refreshing.set(account.id, (async () => {
      const tokens = await exchange({grant_type: 'refresh_token', client_id: account.client_id, refresh_token: account.refresh_token});
      if (tokens.id_token) {
        const keys = await json(AUTH + '/.well-known/jwks.json');
        verifyIdentity(tokens.id_token, keys.keys, account.client_id, undefined, account.subject);
      }
      const refreshed = tokenFields(tokens, account);
      return update(value => {
        const index = value.accounts.findIndex(a => a.id === account.id);
        if (index < 0 || !value.accounts[index].access_token) throw Error('ChatGPT was disconnected.');
        if (value.accounts[index].access_token !== account.access_token) return value.accounts[index].access_token;
        value.accounts[index] = refreshed;
        return refreshed.access_token;
      });
    })().finally(() => { refreshing.delete(account.id); }));
    return refreshing.get(account.id);
  }

  async function models() {
    const result = await json(API + '/models', {headers: {Authorization: 'Bearer ' + await token()}});
    if (!Array.isArray(result.models)) throw Error('ChatGPT returned no model catalogue.');
    return result.models.filter(model => model.visibility === 'list' && typeof model.slug === 'string' && typeof model.display_name === 'string').map(model => ({id: model.slug, name: model.display_name}));
  }
  async function disconnect() {
    if (pending) finish(pending);
    const value = await read(), account = value.accounts.find(a => a.id === value.active);
    let revoked = !account?.refresh_token;
    if (account?.refresh_token) {
      try {
        const config = await json(AUTH + '/.well-known/openid-configuration');
        const endpoint = new URL(config.revocation_endpoint);
        if (endpoint.origin !== AUTH || endpoint.username || endpoint.password) throw Error('Invalid revocation endpoint.');
        const response = await fetchImpl(endpoint.href, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({token: account.refresh_token, token_type_hint: 'refresh_token', client_id: account.client_id}).toString(), redirect: 'error', signal: AbortSignal.timeout(15000)});
        revoked = response.status === 200;
      } catch { revoked = false; }
    }
    await update(value => {
      const current = value.accounts.find(a => a.id === account?.id);
      if (current) { delete current.access_token; delete current.refresh_token; delete current.id_token; current.scopes = []; }
    });
    message = revoked ? 'ChatGPT disconnected. API settings are unchanged.' : 'Disconnected locally. Remote revocation was not confirmed; disconnect Terrain Foundry in ChatGPT Settings too.';
    return status();
  }
  async function repair() {
    if(pending||starting)throw Error('Cancel the current sign-in before repairing its saved connection.');
    const task=mutation.then(async()=>{
      if(pending||starting)throw Error('Cancel the current sign-in before repairing its saved connection.');
      secure();
      const stat=await fs.stat(filename);if(!stat.isFile()||stat.size>512000)throw Error('Saved ChatGPT connection cannot be repaired automatically.');
      let readable=false;try{await read();readable=true;}catch{}
      if(readable)throw Error('The saved ChatGPT connection is readable. Use normal sign-in instead.');
      const fresh=safeStorage.encryptString(JSON.stringify({host:'urn:uuid:'+crypto.randomUUID(),accounts:[],active:null}));
      const backup=filename+'.recovery-'+crypto.randomUUID();
      await fs.copyFile(filename,backup,require('node:fs').constants.COPYFILE_EXCL);
      await atomicWrite(filename,fresh);
      message='The previous encrypted connection is backed up. Continue with ChatGPT to reconnect. API keys are unchanged.';
    });
    mutation=task.catch(()=>{});await task;return status();
  }
  return {status, start, select, token, models, disconnect, repair, cancel: () => { if (pending) { finish(pending); message = 'ChatGPT sign-in cancelled. Existing connections are unchanged.'; } }};
}
module.exports = {createChatGPTConnection, verifyIdentity};
