import { createRoot } from 'react-dom/client'
import { ProductTrainingSession } from '/workspace/wp09-close00b/apps/b2b-web/src/features/training/sync/ProductTrainingSession'
import { IndexedDBWorkoutStore, LocalWorkoutConflict, type WorkoutDocument, type WorkoutStore } from '/workspace/wp09-close00b/apps/b2b-web/src/features/training/storage/workoutStore'
import { createWorkoutDocument } from '/workspace/wp09-close00b/apps/b2b-web/src/features/training/sync/workoutEdit'
import { queueWorkout } from '/workspace/wp09-close00b/apps/b2b-web/src/features/training/sync/workoutSync'
import { rememberSelectedWorkout, recoveryWorkoutScope } from '/workspace/wp09-close00b/apps/b2b-web/src/features/training/storage/selectedWorkoutRecovery'
import { recoveryContext } from '/workspace/wp09-close00b/apps/b2b-web/tests/fixtures/workoutRecovery'
import { routine, access, environment, now } from '/workspace/wp09-close00b/apps/b2b-web/tests/fixtures/workout'
import type { FlushLocalWorkout } from '/workspace/wp09-close00b/apps/b2b-web/src/features/training/sync/localWorkoutFlush'
let root:ReturnType<typeof createRoot>|null=null
let actual:IndexedDBWorkoutStore, key='', dbName='', releaseWrite=()=>{}, releasePointer=()=>{}, releaseNetwork=()=>{}, held=false, pointerHeld=false, ready=false, closed=0, failureEnabled=false, writeAttempts=0, networkRequests=0
let events: Record<string,unknown>[]=[], sequence=0, controller=new AbortController(), registered:FlushLocalWorkout|null=null, render=()=>{}
const first='Notes entered before slow storage',second='Final reason entered before close'
type Config={hold?:'first'|'final';failure?:'first'|'final'|'conflict'|'pointer';pointer?:'initial'|'final';network?:boolean}
async function mount(config:Config={}){
 root?.unmount();root=null;sequence++;held=pointerHeld=ready=false;closed=writeAttempts=networkRequests=0;events=[];failureEnabled=Boolean(config.failure);registered=null;controller=new AbortController()
 const context={...recoveryContext('close-realm'),origin:location.origin,signal:controller.signal}
 actual=new IndexedDBWorkoutStore(indexedDB,dbName=`close-v7-${location.pathname.includes('before')?'before':'after'}-${sequence}`)
 let id=0;let initial=createWorkoutDocument(recoveryWorkoutScope(context),`close-${sequence}`,{kind:'occurrence',occurrenceId:'occurrence',routine:{programId:'routine',version:1,schemaVersion:2}},routine,()=>`segment-${++id}`,now)
 initial=await queueWorkout(initial,1,`frozen-operation-${sequence}`,now);key=initial.key
 const writeGate=new Promise<void>(r=>{releaseWrite=r}),pointerGate=new Promise<void>(r=>{releasePointer=r}),networkGate=new Promise<void>(r=>{releaseNetwork=r})
 const store:WorkoutStore={read:k=>actual.read(k),preserveLegacy:(k,b)=>actual.preserveLegacy(k,b),compareAndSet:async(doc,expected,signal)=>{
  writeAttempts++;events.push({event:'write-start',generation:doc.generation,notes:doc.content.notes,reason:doc.content.correctionReason})
  const matching=config.hold==='first'?doc.generation===1:config.hold==='final'?doc.generation===2:false
  if(!held&&matching){held=true;events.push({event:'write-held'});await writeGate;events.push({event:'write-released'})}
  signal?.throwIfAborted()
  if(failureEnabled&&((config.failure==='first'&&doc.generation===1)||(config.failure==='final'&&doc.generation===2))) throw new DOMException('Synthetic local quota failure','QuotaExceededError')
  if(failureEnabled&&config.failure==='conflict'&&doc.generation===2){failureEnabled=false;const current=(await actual.read(key))!;await actual.compareAndSet({...current,generation:current.generation+1,content:{...current.content,notes:'Concurrent other-tab actuals'}},current.generation);events.push({event:'other-tab-commit'});throw new LocalWorkoutConflict()}
  await actual.compareAndSet(doc,expected,signal);events.push({event:'write-committed',generation:doc.generation,notes:doc.content.notes,reason:doc.content.correctionReason})
 }}
 const transport={access:async()=>{networkRequests++;await networkGate;return access},save:async()=>{networkRequests++;throw Error('No save expected in close proof')}}
 root=createRoot(document.getElementById('root')!)
 let liveAccess=access
 render=()=>root?.render(<ProductTrainingSession initial={initial} routine={routine} store={store} access={liveAccess} transport={transport} integrationAccepted={Boolean(config.network)} environment={environment} contextSignal={controller.signal}
  registerLocalFlush={flush=>{registered=flush;return()=>{if(registered===flush)registered=null}}}
  onDocumentReady={async(doc:WorkoutDocument)=>{
   events.push({event:'pointer-start',generation:doc.generation})
   if((config.pointer==='initial'&&doc.generation===0)||(config.pointer==='final'&&doc.generation>=2)){
    if(!pointerHeld){pointerHeld=true;events.push({event:'pointer-held'});await pointerGate}
   }
   controller.signal.throwIfAborted()
   if(failureEnabled&&config.failure==='pointer'&&doc.generation>=2) throw new Error('Synthetic durable selection failure')
   await rememberSelectedWorkout(actual,context,{scope:doc.scope,id:doc.id});ready=true;events.push({event:'pointer-committed',generation:doc.generation})
  }}
  onClose={()=>{closed++;events.push({event:'closed'});root?.unmount();root=null}}
  loadRemote={async()=>{throw Error('Unused remote loader')}}/>)
 render()
 Object.assign(window.closeProbe,{switchAccount:()=>{liveAccess={...access,userId:'other-account'};render()}})
 return {initialOperation:JSON.stringify(initial.operations[0]),id:initial.id}
}
Object.assign(window,{closeProbe:{mount,first,second,state:()=>({ready,held,pointerHeld,closed,events,writeAttempts,networkRequests}),release:()=>releaseWrite(),releaseSelection:()=>releasePointer(),releaseNetwork:()=>releaseNetwork(),disableFailure:()=>{failureEnabled=false},read:()=>actual.read(key),reopen:()=>new IndexedDBWorkoutStore(indexedDB,dbName).read(key),revoke:()=>controller.abort(),flush:()=>registered?.(),export:async()=>{const doc=await actual.read(key);return doc},switchAccount:()=>{},unmount:()=>{root?.unmount();root=null}}})
