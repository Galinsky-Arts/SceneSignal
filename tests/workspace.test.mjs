import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { encodePcm16 } from '@neophilism/distributed-audio-engine';
const files=await readdir('web-dist/assets');const bundle=await readFile('web-dist/assets/'+files.find(x=>x.endsWith('.js')),'utf8');
function fixture(cryptoProvider=webcrypto){const dom=new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>',{url:'https://workspace.example/',runScripts:'outside-only'});Object.defineProperty(dom.window,'crypto',{value:cryptoProvider});dom.window.TextEncoder=TextEncoder;dom.window.TextDecoder=TextDecoder;dom.window.structuredClone=value=>{const cloned=structuredClone(value);const convert=x=>{if(x===null||typeof x!=='object')return x;if(ArrayBuffer.isView(x)){if(x instanceof DataView)return new dom.window.DataView(convert(x.buffer));return new dom.window[x.constructor.name](x);}if(x instanceof ArrayBuffer)return new dom.window.Uint8Array(new Uint8Array(x)).buffer;if(Array.isArray(x))return dom.window.Array.from(x,convert);const result=new dom.window.Object();for(const [k,v] of Object.entries(x))result[k]=convert(v);return result;};return convert(cloned);};let requests=0;dom.window.fetch=()=>{requests++;throw Error('unexpected network');};dom.window.eval(bundle);return{dom,document:dom.window.document,requests:()=>requests};}
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
function click(f,label){const b=[...f.document.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(b,label);b.click();}
async function upload(f){click(f,'Spatial scene');const input=f.document.querySelector('#stem-file');const bytes=encodePcm16({sampleRate:8000,channels:1,samples:new Float32Array([0.2,-0.2,0.1,-0.1])});const file={name:'private-stem.wav',type:'audio/wav',size:bytes.byteLength,async arrayBuffer(){return new f.dom.window.Uint8Array(bytes).buffer;}};Object.defineProperty(input,'files',{value:[file]});input.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));await flush();}
test('browser plan saves without network, escapes user descriptions and keeps activation unavailable',async()=>{const f=fixture();try{const form=f.document.querySelector('#plan-form');form.elements.summary.value='<img src=x onerror="window.leaked=true">';form.dispatchEvent(new f.dom.window.Event('submit',{bubbles:true,cancelable:true}));await flush();assert.match(f.document.body.textContent,/plan saved/);assert.equal(f.dom.window.leaked,undefined);assert.equal(f.document.querySelector('img'),null);click(f,'Authorization');assert.ok([...f.document.querySelectorAll('button')].find(b=>b.textContent==='Activate session').disabled);assert.equal(f.requests(),0);}finally{f.dom.window.close();}});
test('actual uploaded WAV drives instrument movement, draft speaker placement and clear simulation states',async()=>{const f=fixture();try{await upload(f);assert.match(f.document.body.textContent,/private-stem.wav/);const form=f.document.querySelector('[data-source]');form.elements.x.value='4';form.dispatchEvent(new f.dom.window.Event('submit',{bubbles:true,cancelable:true}));assert.equal(f.document.querySelector('circle').getAttribute('cx'),'380');click(f,'Contributors');const add=f.document.querySelector('#speaker-form');add.dispatchEvent(new f.dom.window.Event('submit',{bubbles:true,cancelable:true}));assert.match(f.document.body.textContent,/speaker-1/);assert.match(f.document.body.textContent,/output unverified/);click(f,'Remove');assert.match(f.document.body.textContent,/No speakers placed/);assert.equal(f.requests(),0);}finally{f.dom.window.close();}});
test('editing a plan supersedes a delayed audio audition before any source starts',async()=>{const f=fixture();let release;let starts=0;let closed=0;class Audio{currentTime=0;resume(){return new Promise(r=>{release=r;});}async close(){closed++;}createBuffer(){return{copyToChannel(){}};}createBufferSource(){return{connect(){},start(){starts++;},stop(){}};}get destination(){return{};}}f.dom.window.AudioContext=Audio;try{await upload(f);click(f,'Contributors');f.document.querySelector('#speaker-form').dispatchEvent(new f.dom.window.Event('submit',{bubbles:true,cancelable:true}));click(f,'Audition mix');await flush();assert.equal(typeof release,'function');click(f,'Plan');f.document.querySelector('#plan-form').dispatchEvent(new f.dom.window.Event('submit',{bubbles:true,cancelable:true}));await flush();release();await flush();assert.equal(starts,0);assert.ok(closed>=1);assert.equal(f.requests(),0);}finally{f.dom.window.close();}});
test('production bundle has no remote credentials or plaintext-persistence shortcut',()=>{assert.doesNotMatch(bundle,/ENGINE_API_KEY|WEBHOOK_SECRET|localStorage\.setItem/);});

// Explicit account HTTP fixture only; real account/cookie behavior is tested
// separately against Better Auth and PostgreSQL over an actual HTTP server.
async function signedInFixture(f){
 f.dom.window.AbortSignal.timeout=()=>undefined;
 f.dom.window.fetch=async path=>({ok:true,status:200,headers:{get:()=> 'application/json'},async json(){return path.endsWith('get-session')?{user:{id:'fixture-user',name:'Fixture account'}}:path.endsWith('/sessions')?{sessions:[]}:{};}});
 click(f,'Account');const form=f.document.querySelector('#account-sign-in');
 form.elements.email.value='fixture@example.test';form.elements.password.value='fixture-test-password';
 form.dispatchEvent(new f.dom.window.Event('submit',{bubbles:true,cancelable:true}));await flush();
 assert.ok(f.document.querySelector('#account-sign-out'));
}
function delayedCrypto(method){
 let enter,release,complete;
 const entered=new Promise(resolve=>{enter=resolve;});const blocked=new Promise(resolve=>{release=resolve;});
 const completed=new Promise(resolve=>{complete=resolve;});
 const subtle=new Proxy(webcrypto.subtle,{get(target,key){const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;
 return async(...args)=>{if(key===method){enter();await blocked;}const result=await value.apply(target,args);if(key==='digest')complete();return result;};}});
 return {provider:{subtle,getRandomValues:webcrypto.getRandomValues.bind(webcrypto),randomUUID:webcrypto.randomUUID.bind(webcrypto)},entered,release,completed};
}
test('sign-out fences a private WAV read that completes in the next draft',async()=>{
 const f=fixture();try{
  await signedInFixture(f);click(f,'Spatial scene');let release;
  const bytes=encodePcm16({sampleRate:8000,channels:1,samples:new Float32Array([.2,-.2])});
  const input=f.document.querySelector('#stem-file');
  Object.defineProperty(input,'files',{value:[{name:'stale-private.wav',size:bytes.byteLength,async arrayBuffer(){return new Promise(resolve=>{release=()=>resolve(new f.dom.window.Uint8Array(bytes).buffer);});}}]});
  input.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));
  click(f,'Account');click(f,'Sign out and clear this draft');await flush();release();await flush();
  click(f,'Spatial scene');assert.match(f.document.body.textContent,/Your composition starts here/);
  assert.doesNotMatch(f.document.body.textContent,/stale-private.wav/);
 }finally{f.dom.window.close();}
});
test('sign-out fences a private site-plan hash that finishes after draft reset',async()=>{
 const crypto=delayedCrypto('digest'),f=fixture(crypto.provider);try{
  await signedInFixture(f);click(f,'Plan');const form=f.document.querySelector('#plan-form');
  form.elements.site.value='private-old-site';form.elements.conditions.value='private-old-conditions';
  form.dispatchEvent(new f.dom.window.Event('submit',{bubbles:true,cancelable:true}));await crypto.entered;
  click(f,'Account');click(f,'Sign out and clear this draft');await flush();crypto.release();await crypto.completed;await flush();
  click(f,'Plan');assert.equal(f.document.querySelector('[name=site]').value,'draft-site');
  assert.equal(f.document.querySelector('[name=conditions]').value,'');
 }finally{f.dom.window.close();}
});
test('sign-out discards private permit encryption that finishes after draft reset',async()=>{
 const crypto=delayedCrypto('encrypt'),f=fixture(crypto.provider);try{
  await signedInFixture(f);click(f,'Authorization');const input=f.document.querySelector('#permit-file');
  Object.defineProperty(input,'files',{value:[{name:'private.pdf',type:'application/pdf',size:3,async arrayBuffer(){return new f.dom.window.Uint8Array([1,2,3]).buffer;}}]});
  input.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));await crypto.entered;
  click(f,'Account');click(f,'Sign out and clear this draft');await flush();crypto.release();await crypto.completed;await flush();
  click(f,'Authorization');assert.doesNotMatch(f.document.body.textContent,/Private evidence prepared/);
 }finally{f.dom.window.close();}
});
