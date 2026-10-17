import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { IndexedDBWorkoutStore, workoutKey } from '/workspace/wp09-candidate591/apps/b2b-web/src/features/training/storage/workoutStore.ts'
import { unboundWorkoutScope } from '/workspace/wp09-candidate591/apps/b2b-web/src/features/training/storage/workoutIdentity.ts'
import { authenticatedRecoveryOwner, recoveryWorkoutScope, legacyWorkoutChoices, resumeLegacyWorkout, startNewLegacyWorkout, restoreSelectedWorkout, exportSelectedOwnerWorkout, mayResumeSelectedWorkout } from '/workspace/wp09-candidate591/apps/b2b-web/src/features/training/storage/selectedWorkoutRecovery.ts'
import { recoveryOwnerKey } from '/workspace/wp09-candidate591/apps/b2b-web/src/features/training/storage/recoverySelection.ts'
import { useSelectedWorkoutRecovery } from '/workspace/wp09-candidate591/apps/b2b-web/src/features/training/storage/useSelectedWorkoutRecovery.ts'
import { LegacyWorkoutEntryChoice } from '/workspace/wp09-candidate591/apps/b2b-web/src/features/training/sync/LegacyWorkoutEntryChoice.tsx'
import { queueWorkout, WorkoutSync } from '/workspace/wp09-candidate591/apps/b2b-web/src/features/training/sync/workoutSync.ts'
import { recoveryContext, legacyRecoveryDraft, legacyAssignment } from '/workspace/wp09-candidate591/apps/b2b-web/tests/fixtures/workoutRecovery.ts'
import { routine, now } from '/workspace/wp09-candidate591/apps/b2b-web/tests/fixtures/workout.ts'
let mounted: ReturnType<typeof createRoot> | null = null
const mount = (element: React.ReactNode) => { mounted?.unmount(); mounted = createRoot(document.getElementById('root')!); mounted.render(element) }
const name='wp09-durable-recovery-v5'
const req=<T,>(request:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
const check=(condition:unknown,message:string)=>{if(!condition)throw Error(message)}
const ctx=(key='realm-a')=>({...recoveryContext(key),origin:location.origin})
const finish=(tx:IDBTransaction)=>new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error)})
const store=()=>new IndexedDBWorkoutStore(indexedDB,name)
const oldKey=()=>{const d=legacyRecoveryDraft(ctx());return workoutKey(unboundWorkoutScope(d.scope),d.id)}
const inactive=()=>{const context=ctx();context.branchId='';context.access={...context.access,accessMode:'export-only',accessRevision:2,branches:[],capabilities:['export-own-records']};context.bootstrap={...context.bootstrap,memberships:context.bootstrap.memberships.map(m=>({...m,accessMode:'export-only',accessRevision:2,choices:[]}))};return context}
Object.assign(window,{recoveryProbe:{
 async seed() {
  const opening=indexedDB.open(name,2);opening.onupgradeneeded=()=>{opening.result.createObjectStore('workouts-v2');opening.result.createObjectStore('legacy-recovery')}
  const db=await req(opening);let d=legacyRecoveryDraft(ctx());d.scope=unboundWorkoutScope(d.scope);d.key=workoutKey(d.scope,d.id)
  d=await queueWorkout(d,1,'original-immutable-operation',now);d.operations[0].state='sending'
  const bytes=JSON.stringify(d), operations=JSON.stringify(d.operations)
  const tx=db.transaction(['workouts-v2','legacy-recovery'],'readwrite');tx.objectStore('workouts-v2').put(d,d.key);tx.objectStore('legacy-recovery').put('{old raw retry bytes}','old-copy');await finish(tx);db.close()
  const s=store(), choices=await legacyWorkoutChoices(s,ctx(),legacyAssignment)
  check(choices.choices.length===1&&choices.choices[0].requiresRealmAdoption,'Expected explicit old-draft choice')
  check(await s.selected(authenticatedRecoveryOwner(ctx()),ctx().signal)===null,'Inspection silently selected work')
  const selected=await resumeLegacyWorkout(s,ctx(),legacyAssignment,choices.choices[0])
  check(JSON.stringify(selected.document.operations)===operations,'Adoption changed immutable operation bytes')
  check(JSON.stringify(await s.read(d.key))===bytes,'Adoption changed original v2 document')
  const upgraded=await req(indexedDB.open(name,3));const old=await req(upgraded.transaction('legacy-recovery').objectStore('legacy-recovery').get('old-copy'));check(old==='{old raw retry bytes}','Upgrade deleted recovery bytes');upgraded.close();await s.close()
  return {databaseUpgrade:'2-to-3',oldKey:d.key,boundKey:selected.document.key,operations,originalBytes:bytes,explicitChoice:true}
 },
 async inactiveReload() {
  const s=store(), context=inactive(), selected=await restoreSelectedWorkout(s,context)
  check(selected?.document.id==='legacy-session','Reload lost selected identity')
  check(!mayResumeSelectedWorkout(context,selected!.document),'Inactive reload enabled replay')
  const exported=JSON.parse((await exportSelectedOwnerWorkout(s,context))!)
  check(exported.serverConfirmed===false&&exported.operations[0].operationId==='original-immutable-operation','Wrong local export')
  const result={id:selected!.document.id,operations:JSON.stringify(selected!.document.operations),readOnly:true,exportedOperation:exported.operations[0].operationId};await s.close();return result
 },
 async boundaries() {
  const s=store(), other=ctx();other.bootstrap.user.id='other';other.access.userId='other'
  check(await restoreSelectedWorkout(s,other)===null,'Other account saw selection')
  check(await restoreSelectedWorkout(s,ctx('realm-b'))===null,'Other realm saw selection')
  const owner=ctx(), selected=(await restoreSelectedWorkout(s,owner))!
  const retired=ctx();retired.access.branches=[];retired.bootstrap.memberships[0].choices=[]
  check(!mayResumeSelectedWorkout(retired,selected.document),'Retired grant restored operation rights')
  let sent=0;const transport={access:async()=>{sent++;return owner.access},save:async()=>{sent++;return null}}
  await new WorkoutSync(s,{...selected.document.scope,realm:{mode:'white-label',key:'realm-b'}},transport,true).replay(selected.document.key)
  check(sent===0,'Cross-realm runner contacted the server')
  const before=JSON.stringify(await s.read(oldKey()));let rejected=false
  try{await startNewLegacyWorkout(s,owner,{...legacyAssignment,active:false},routine,()=> 'forbidden',now)}catch{rejected=true}
  check(rejected&&JSON.stringify(await s.read(oldKey()))===before,'Retired new-session denial changed original')
  await s.close();return {otherAccountHidden:true,otherRealmHidden:true,retiredResumeBlocked:true,crossRealmRequests:sent,retiredNewBlocked:true}
 },
 async races() {
  const context=ctx(), a=store(), b=store(), before=(await restoreSelectedWorkout(a,context))!
  const next=legacyRecoveryDraft(context,'cas-target');await a.compareAndSet(next,null)
  const input={owner:authenticatedRecoveryOwner(context),scope:next.scope,id:next.id,expectedDocumentGeneration:0,expectedPointerGeneration:before.pointer.generation}
  const results=await Promise.allSettled([a.commitSelection(input,context.signal),b.commitSelection(input,context.signal)])
  check(results.filter(x=>x.status==='fulfilled').length===1,'Two pointer CAS winners')
  const c=ctx('claim-c'),d=ctx('claim-d');let source=legacyRecoveryDraft(c,'race-adoption');source.scope=unboundWorkoutScope(source.scope);source.key=workoutKey(source.scope,source.id);source=await queueWorkout(source,1,'claim-operation',now);await a.compareAndSet(source,null)
  const original=JSON.stringify(source.operations), choicesC=await legacyWorkoutChoices(a,c,legacyAssignment), choicesD=await legacyWorkoutChoices(b,d,legacyAssignment)
  const adopted=await Promise.allSettled([resumeLegacyWorkout(a,c,legacyAssignment,choicesC.choices.find(x=>x.id==='race-adoption')!),resumeLegacyWorkout(b,d,legacyAssignment,choicesD.choices.find(x=>x.id==='race-adoption')!)])
  check(adopted.filter(x=>x.status==='fulfilled').length===1,'Two cross-realm adoption winners')
  check(JSON.stringify((await a.read(source.key))!.operations)===original,'Claim race changed source payload')
  const current=(await restoreSelectedWorkout(a,context))!, cancelTarget=legacyRecoveryDraft(context,'cancel-target');await a.compareAndSet(cancelTarget,null)
  const db=await req(indexedDB.open(name,3)), hold=db.transaction(['workouts-v2','selected-workout-v1','unbound-workout-realm-v1'],'readwrite');let release=false
  const holding=finish(hold);const keep=()=>{const request=hold.objectStore('workouts-v2').get(cancelTarget.key);request.onsuccess=()=>{if(!release)keep()}};keep()
  const controller=new AbortController(), pending=a.commitSelection({owner:authenticatedRecoveryOwner(context),scope:cancelTarget.scope,id:cancelTarget.id,expectedPointerGeneration:current.pointer.generation,expectedDocumentGeneration:0},controller.signal)
  await new Promise(resolve=>setTimeout(resolve,20));controller.abort();release=true
  const cancelled=await Promise.allSettled([pending]);await holding;db.close()
  check(cancelled[0].status==='rejected','Departed pointer transaction was accepted')
  check((await restoreSelectedWorkout(a,context))!.pointer.documentKey===current.pointer.documentKey,'Cancelled transaction changed selected pointer')
  await a.close();await b.close();return {pointerCasWinners:1,realmAdoptionWinners:1,sourceBytesPreserved:true,queuedTransactionCancelled:true}
 },
 async tamper() {
  const s=new IndexedDBWorkoutStore(indexedDB,'wp09-tampered-pointer-v5'),context=ctx(), d=legacyRecoveryDraft(context)
  await s.compareAndSet(d,null);const owner=authenticatedRecoveryOwner(context);await s.commitSelection({owner,scope:d.scope,id:d.id,expectedDocumentGeneration:0,expectedPointerGeneration:null},context.signal)
  const db=await req(indexedDB.open('wp09-tampered-pointer-v5',3));const transaction=db.transaction('workouts-v2','readwrite');transaction.objectStore('workouts-v2').delete(d.key);await finish(transaction)
  let refused=false;try{await restoreSelectedWorkout(s,context)}catch{refused=true}check(refused,'Missing document produced a fake selection')
  const preserved=await req(db.transaction('selected-workout-v1').objectStore('selected-workout-v1').get(recoveryOwnerKey(owner)));check(preserved.id===d.id,'Missing document pointer was silently erased')
  const update=db.transaction('selected-workout-v1','readwrite');update.objectStore('selected-workout-v1').put({...preserved,owner:{...owner,accountId:'foreign'}},recoveryOwnerKey(owner));await finish(update)
  refused=false;try{await restoreSelectedWorkout(s,context)}catch{refused=true}check(refused,'Tampered owner pointer disclosed a document')
  db.close();await s.close();return {missingRecordRejected:true,pointerPreserved:true,tamperedOwnerRejected:true}
 },
 async mountChoice() {
  const context=ctx(),s=new IndexedDBWorkoutStore(indexedDB,'wp09-choice-ui-v5');let old=legacyRecoveryDraft(context,'previous-session');old=await queueWorkout(old,1,'previous-operation',now);await s.compareAndSet(old,null)
  Object.assign(window,{choiceState:{selected:[] as string[],oldKey:old.key,oldOperations:JSON.stringify(old.operations)}})
  mount(<StrictMode><LegacyWorkoutEntryChoice store={s} context={context} assignment={legacyAssignment} routine={routine} onCancel={()=>{}} onSelected={document=>{(window as any).choiceState.selected.push(document.id)}} /></StrictMode>)
 },
 async choiceResult() {
  const state=(window as any).choiceState,s=new IndexedDBWorkoutStore(indexedDB,'wp09-choice-ui-v5'),selected=await restoreSelectedWorkout(s,ctx())
  check(JSON.stringify((await s.read(state.oldKey))!.operations)===state.oldOperations,'New choice mutated previous operation')
  await s.close();return {callbacks:state.selected.length,id:selected?.document.id,status:selected?.document.content.status,operations:selected?.document.operations.length,previousPreserved:true}
 },
 async mountRecoveryView() {
  const s=store();let update:(context:ReturnType<typeof ctx>)=>void
  function View(){const [context,setContext]=useState(ctx());update=setContext;const recovery=useSelectedWorkoutRecovery(s,context);return <div><span data-testid="selected">{recovery.selected?.document.id??''}</span><span data-testid="resume">{String(recovery.canResume)}</span><span role="status">{recovery.error}</span></div>}
  mount(<StrictMode><View /></StrictMode>)
  Object.assign(window,{switchRecovery:(other:boolean)=>{const next=ctx();if(other){next.bootstrap.user.id='other';next.access.userId='other'}else Object.assign(next,inactive());flushSync(()=>update(next));return document.querySelector('[data-testid=selected]')?.textContent}})
 }
}})
