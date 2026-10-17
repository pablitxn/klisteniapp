import '/workspace/wp09-qa-a1/packages/b2b-ui/src/styles.css'
import '/workspace/wp09-qa-a1/packages/b2b-ui/src/white-label.css'
import { createRoot } from 'react-dom/client'
import { Shell } from '/workspace/wp09-qa-a1/packages/b2b-ui/src/index.tsx'
import { ProductTrainingSession } from '/workspace/wp09-qa-a1/apps/b2b-web/src/features/training/sync/ProductTrainingSession'
import { IndexedDBWorkoutStore, type WorkoutStore, type WorkoutDocument, type SaveWorkout } from '/workspace/wp09-qa-a1/apps/b2b-web/src/features/training/storage/workoutStore'
import { createWorkoutDocument, changeWorkoutActual, selectWorkoutAlternative } from '/workspace/wp09-qa-a1/apps/b2b-web/src/features/training/sync/workoutEdit'
import { emptyPerformedSet } from '/workspace/wp09-qa-a1/packages/b2b-domain/src/alternatives.ts'
import { routine, relation, environment, access, scope as template, now, receipt } from '/workspace/wp09-qa-a1/apps/b2b-web/tests/fixtures/workout'
import type { ProductTrainingSessionProps } from '/workspace/wp09-qa-a1/apps/b2b-web/src/features/training/sync/ProductTrainingSession'
let root:ReturnType<typeof createRoot>|null=null, store:IndexedDBWorkoutStore, key='', dbName='', sequence=0, quota=false, calls:SaveWorkout[]=[], closed=0, controller=new AbortController(), held=false, gate:Promise<void>, releaseGate=()=>{}, holdNext=false
const oldBytes='{unreadable-old-draft: preserve these exact synthetic bytes'
async function opaque(name:string){await new Promise<void>((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('wp12-v1-opaque');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction('wp12-v1-opaque','readwrite');t.objectStore('wp12-v1-opaque').put(oldBytes,'old');t.oncomplete=()=>{db.close();resolve()};t.onerror=()=>reject(t.error)}})}
async function mount(kind:'partial-target'|'quota'|'empty'='partial-target',brand=false){
 root?.unmount();sequence++;quota=false;held=false;holdNext=false;calls=[];closed=0;controller=new AbortController();gate=new Promise<void>(resolve=>{releaseGate=resolve})
 dbName=`feedback-${location.pathname.includes('before')?'before':'after'}-${sequence}`;if(kind==='quota')await opaque(dbName)
 store=new IndexedDBWorkoutStore(indexedDB,dbName)
 let n=0;const scope={...template,origin:location.origin},id=`feedback-${sequence}`
 // Existing synthetic reviewed fixture is used only for the owned producer's per-side behavior.
 const targetRelation={...relation,target:{...relation.target,equipment:'none'},targetDose:{...routine.steps[0].dose,sets:{kind:'fixed' as const,value:1},load:{mode:'bodyweight' as const},laterality:'per-side' as const}}
 const prescribed={...routine,name:kind==='quota'?'WP12 8f6a9400-3f2b-4421-8b6e-89b41b084ff4':'Routine',relations:[targetRelation]}
 let initial=createWorkoutDocument(scope,id,{kind:'occurrence',occurrenceId:'occurrence',routine:{programId:'routine',version:1,schemaVersion:2}},prescribed,()=>`segment-${++n}`,now)
 if(kind==='partial-target'){
  const source=initial.content.segments[0];initial.content=changeWorkoutActual(initial.content,{...emptyPerformedSet(source,'original-actual',1,'both'),repetitions:3,loadKg:20})
  initial.content=selectWorkoutAlternative(initial.content,prescribed,'step',targetRelation.id,targetRelation.conditions,environment,'target-segment',now)
  const target=initial.content.segments.find(s=>s.segmentId==='target-segment')!;initial.content=changeWorkoutActual(initial.content,{...emptyPerformedSet(target,'target-left',1,'left'),repetitions:1})
 }
 key=initial.key
 const storage:WorkoutStore={read:k=>store.read(k),preserveLegacy:(k,b)=>store.preserveLegacy(k,b),compareAndSet:async(d,expected,signal)=>{if(quota)throw new DOMException('WP12 synthetic quota fault','QuotaExceededError');await store.compareAndSet(d,expected,signal)}}
 const transport={access:async()=>access,save:async(input:SaveWorkout)=>{calls.push(structuredClone(input));if(holdNext){holdNext=false;held=true;await gate}return receipt(input)}}
 const props:ProductTrainingSessionProps={initial,routine:prescribed,store:storage,access,transport,integrationAccepted:true,environment,contextSignal:controller.signal,onDocumentReady:async()=>{},onClose:()=>{closed++;root?.unmount();root=null},loadRemote:async()=>{throw Error('Not used')}}
 root=createRoot(document.getElementById('root')!);root.render(<div className={brand?'brand-theme':undefined}><Shell eyebrow="TU GIMNASIO" name="Atlas Demo" actions={<button className="text-button">Salir</button>}><ProductTrainingSession {...props}/></Shell></div>)
}
Object.assign(window,{feedbackProbe:{mount,read:()=>store.read(key),state:()=>({calls,closed,held}),failStorage:()=>{quota=true},repairStorage:()=>{quota=false},holdNext:()=>{holdNext=true},release:()=>releaseGate(),revoke:()=>controller.abort(),oldBytes,async opaque(){return new Promise((resolve,reject)=>{const r=indexedDB.open(dbName);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('wp12-v1-opaque').objectStore('wp12-v1-opaque').get('old');q.onsuccess=()=>{resolve(q.result);db.close()};q.onerror=()=>reject(q.error)}})},measure(){return {requested:innerWidth<500?320:innerWidth,inner:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,buttons:[...document.querySelectorAll<HTMLButtonElement>('.workout-session button')].map(el=>({text:el.textContent,whiteSpace:getComputedStyle(el).whiteSpace,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right,scroll:el.scrollWidth}))}}}})
