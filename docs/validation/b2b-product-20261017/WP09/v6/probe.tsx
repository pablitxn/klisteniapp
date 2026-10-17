import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createProductV2Client } from '/workspace/wp09-correction-efbed/packages/b2b-client/src/index.ts'
import { createWorkoutClient } from '/workspace/wp09-correction-efbed/apps/b2b-web/src/features/training/sync/workoutClient.ts'
import { IndexedDBWorkoutStore } from '/workspace/wp09-correction-efbed/apps/b2b-web/src/features/training/storage/workoutStore.ts'
import { ProductTrainingSession } from '/workspace/wp09-correction-efbed/apps/b2b-web/src/features/training/Session.tsx'
import { createWorkoutDocument } from '/workspace/wp09-correction-efbed/apps/b2b-web/src/features/training/sync/workoutEdit.ts'
import { newWorkoutId } from '/workspace/wp09-correction-efbed/apps/b2b-web/src/features/training/sync/workoutCrypto.ts'
import { createBoundWorkoutDocument } from '/workspace/wp09-correction-efbed/apps/b2b-web/src/features/training/sync/sessionWorkoutBinding.ts'
import { access, scope as template, routine, environment, now } from '/workspace/wp09-correction-efbed/apps/b2b-web/tests/fixtures/workout.ts'
import { legacySelection, legacyBinding } from '/workspace/wp09-correction-efbed/apps/b2b-web/tests/fixtures/legacyWorkout.ts'
let root: ReturnType<typeof createRoot>|null=null, key='', store:IndexedDBWorkoutStore
const io = createWorkoutClient(signal => createProductV2Client('member','gym',{branchId:'east',role:'member',signal}))
const mount=(element:React.ReactNode)=>{ root?.unmount();root=createRoot(document.getElementById('root')!);root.render(<StrictMode>{element}</StrictMode>) }
Object.assign(window,{correctionProbe:{
 async mountCompletedFlow(){
  store=new IndexedDBWorkoutStore(indexedDB,'correction-form-v6')
  const scope={...template,origin:location.origin},initial=createWorkoutDocument(scope,'controlled-form',{kind:'occurrence',occurrenceId:'occurrence',routine:{programId:'routine',version:1,schemaVersion:2}},routine,newWorkoutId,now)
  key=initial.key
  mount(<ProductTrainingSession initial={initial} routine={routine} store={store} access={access} transport={io.transport} integrationAccepted environment={environment} onClose={()=>{}} loadRemote={()=>io.latestRevision(initial.id,new AbortController().signal)}/>);
 },
 async mountLegacy(){
  store=new IndexedDBWorkoutStore(indexedDB,'legacy-correction-v6')
  const initial=createBoundWorkoutDocument({...legacySelection,scope:{...template,origin:location.origin}},legacyBinding(true),newWorkoutId,now);key=initial.key
  mount(<ProductTrainingSession initial={initial} prescription={initial.binding!.prescription} store={store} access={access} transport={io.transport} integrationAccepted environment={environment} onClose={()=>{}} loadRemote={()=>io.latestRevision(initial.id,new AbortController().signal)} loadRemoteBinding={()=>io.sessionBinding(initial.id,new AbortController().signal)}/>);
 },
 read(){return store.read(key)},
 async reloadLegacy(){
  const db=new IndexedDBWorkoutStore(indexedDB,'legacy-correction-v6');const d=await db.read(key);return {original:d?.binding?.original,accepted:d?.accepted,operations:d?.operations}
 }
}})
