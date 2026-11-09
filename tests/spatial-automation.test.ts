import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SpatialAutomation} from '../src/index.js';
import type {SceneActor} from '../src/index.js';
const scope={tenantId:'tenant',application:'scenesignal' as const,sessionId:'session'};
const organizer:SceneActor={tenantId:'tenant',sessionId:'session',identityId:'organizer',roles:['organizer'],expiresAtMs:10000};
const observer:SceneActor={...organizer,identityId:'observer',roles:[]};
const scene={id:'scene',revision:1,sampleRate:8000,frames:8000,
  sources:[{id:'strings',assetId:'encrypted-stem',position:{x:0,y:0,z:0},spreadMeters:2,gain:0.2,role:'full-range'}]};
const frames=[{atMs:1000,scene},{atMs:2000,scene:{...scene,sources:[{...scene.sources[0]!,position:{x:10,y:0,z:0},gain:0.6,spreadMeters:4}]}}];
test('samples deterministic source movement on the supplied common clock',()=>{
 const automation=new SpatialAutomation(scope,()=>true);
 automation.schedule(organizer,frames,900);
 assert.equal(automation.sample(999),null);
 assert.equal(automation.sample(1500)!.sources[0]!.position.x,5);
 assert.equal(automation.sample(1500)!.sources[0]!.gain,0.4);
 assert.equal(automation.sample(2000)!.sources[0]!.position.x,10);
 assert.equal(automation.sample(9000)!.sources[0]!.position.x,10);
});
test('denies foreign or missing roles and cancels without stale movement',()=>{
 const automation=new SpatialAutomation(scope,()=>true);
 assert.throws(()=>automation.schedule(observer,frames,900));
 assert.throws(()=>automation.schedule({...organizer,tenantId:'other'},frames,900));
 automation.schedule(organizer,frames,900);
 assert.throws(()=>automation.cancel(observer,1200));
 automation.cancel(organizer,1200);
 assert.equal(automation.sample(1500),null);
});
test('rejects clock reversal, asset substitution and mutable scene revisions',()=>{
 const automation=new SpatialAutomation(scope,()=>true);
 assert.throws(()=>automation.schedule(organizer,[frames[1]!,frames[0]!],900));
 assert.throws(()=>automation.schedule(organizer,[frames[0]!,{...frames[1]!,scene:{...frames[1]!.scene,revision:2}}],900));
 assert.throws(()=>automation.schedule(organizer,[frames[0]!,{...frames[1]!,scene:{...frames[1]!.scene,
   sources:[{...scene.sources[0]!,assetId:'other'}]}}],900));
});
test('rights revocation prevents later sampling',()=>{
 let allowed=true;
 const automation=new SpatialAutomation(scope,()=>allowed);
 automation.schedule(organizer,frames,900);
 allowed=false;
 assert.throws(()=>automation.sample(1500));
});

test('mutating the constructor scope cannot rebind an authorized private timeline',()=>{
 const mutable={...scope};
 const automation=new SpatialAutomation(mutable,()=>true);
 mutable.sessionId='other-session';
 automation.assertScope(scope);
 assert.throws(()=>automation.assertScope(mutable),/AUTOMATION_SCOPE_CONFLICT/);
 automation.schedule(organizer,frames,900);
 assert.equal(automation.sample(1500)!.sources[0]!.position.x,5);
});

test('a distinct authorized scene switches at its exact clock boundary without leaking new stems early',()=>{
 const chorus={...scene,id:'scene-chorus',sources:[{...scene.sources[0]!,
   id:'drums',assetId:'encrypted-drums',position:{x:4,y:0,z:0},gain:0.5}]};
 const moved={...chorus,sources:[{...chorus.sources[0]!,position:{x:8,y:0,z:0},gain:0.3}]};
 const timeline=[frames[0]!,{atMs:2000,scene:chorus},{atMs:3000,scene:moved}];
 const automation=new SpatialAutomation(scope,()=>true);
 automation.schedule(organizer,timeline,900);
 for(const at of [1000,1500,1999]){
   const current=automation.sample(at)!;
   assert.equal(current.id,'scene');
   assert.deepEqual(current.sources.map(source=>source.assetId),['encrypted-stem']);
   assert.equal(current.sources[0]!.position.x,0);
 }
 assert.equal(automation.sample(2000)!.id,'scene-chorus');
 assert.deepEqual(automation.sample(2000)!.sources.map(source=>source.assetId),['encrypted-drums']);
 assert.equal(automation.sample(2500)!.sources[0]!.position.x,6);
 assert.equal(automation.sample(3000)!.sources[0]!.position.x,8);
});
test('cross-scene rights are checked on each frame and again at its scheduled playback time',()=>{
 let allowDrums=true;
 const chorus={...scene,id:'scene-chorus',sources:[{...scene.sources[0]!,
   id:'drums',assetId:'encrypted-drums'}]};
 const timeline=[frames[0]!,{atMs:2000,scene:chorus}];
 const automation=new SpatialAutomation(scope,asset=>asset!=='encrypted-drums'||allowDrums);
 automation.schedule(organizer,timeline,900);
 allowDrums=false;
 assert.equal(automation.sample(1500)!.id,'scene');
 assert.throws(()=>automation.sample(2000),/AUTOMATION_SOURCE_RIGHTS_DENIED/);
 assert.throws(()=>automation.schedule(organizer,timeline,900),/AUTOMATION_SOURCE_RIGHTS_DENIED/);
});
test('revisiting a scene identifier with changed revision or source binding is denied',()=>{
 const chorus={...scene,id:'scene-chorus'};
 const changed={...scene,revision:2};
 const automation=new SpatialAutomation(scope,()=>true);
 assert.throws(()=>automation.schedule(organizer,
   [frames[0]!,{atMs:2000,scene:chorus},{atMs:3000,scene:changed}],900),
   /AUTOMATION_SCENE_OR_SOURCE_CONFLICT/);
 const alternative={...scene,sources:[{...scene.sources[0]!,assetId:'another-encrypted-asset'}]};
 assert.throws(()=>automation.schedule(organizer,
   [frames[0]!,{atMs:2000,scene:chorus},{atMs:3000,scene:alternative}],900),
   /AUTOMATION_SCENE_OR_SOURCE_CONFLICT/);
});
