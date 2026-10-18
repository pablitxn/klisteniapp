import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { IndexedDBWorkoutStore } from '/workspace/wp09-validation/apps/b2b-web/src/features/training/storage/workoutStore.ts'
import { queueWorkout } from '/workspace/wp09-validation/apps/b2b-web/src/features/training/sync/workoutSync.ts'
import { ProductTrainingSession } from '/workspace/wp09-validation/apps/b2b-web/src/features/training/Session.tsx'
import { draft, access, scope, routine, environment, receipt, now } from '/workspace/wp09-validation/apps/b2b-web/tests/fixtures/workout.ts'
import { workoutKey } from '/workspace/wp09-validation/apps/b2b-web/src/features/training/storage/workoutStore.ts'
const request = <T,>(req: IDBRequest<T>) => new Promise<T>((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})
Object.assign(window, { probe: {
  async storage() {
    const dbname = 'wp09-native-upgrade'
    const legacy = indexedDB.open(dbname,1)
    legacy.onupgradeneeded=()=>legacy.result.createObjectStore('drafts')
    const old=await request(legacy)
    await new Promise<void>((resolve,reject)=>{const tx=old.transaction('drafts','readwrite');tx.objectStore('drafts').put('{exact legacy bytes}','source');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})
    old.close()
    const store=new IndexedDBWorkoutStore(indexedDB,dbname)
    const d=draft(); await store.compareAndSet(d,null)
    const left={...d,generation:1,content:{...d.content,notes:'left'}}
    const right={...d,generation:1,content:{...d.content,notes:'right'}}
    const race=await Promise.allSettled([store.compareAndSet(left,0),store.compareAndSet(right,0)])
    if(race.filter(r=>r.status==='fulfilled').length!==1) throw Error('CAS race lost')
    const saved=(await store.read(d.key))!
    if(saved.generation!==1) throw Error('Generation mismatch')
    await store.preserveLegacy('legacy-key','{raw retry bytes}')
    const raw=await request(indexedDB.open(dbname,2))
    if(await request(raw.transaction('drafts').objectStore('drafts').get('source'))!=='{exact legacy bytes}') throw Error('Upgrade deleted old bytes')
    const backup=await request(raw.transaction('legacy-recovery').objectStore('legacy-recovery').getAll())
    if(backup[0]!=='{raw retry bytes}')throw Error('Legacy backup changed')
    raw.close(); await store.close()
    const reopened=new IndexedDBWorkoutStore(indexedDB,dbname)
    const loaded=(await reopened.read(d.key))!
    if(loaded.content.notes!==saved.content.notes)throw Error('Reload lost data')
    const queued=await queueWorkout(loaded,1,'native-operation',now)
    await reopened.compareAndSet({...queued,generation:2},1)
    const altered=structuredClone(queued);altered.operations[0].payload.content.notes='rewritten'
    let rejected=false
    try { await reopened.compareAndSet({...altered,generation:3},2) }catch {rejected=true}
    if(!rejected)throw Error('Immutable operation was overwritten')
    await reopened.close()
    return {upgradeRetained:true,exactBackup:true,reload:true,casWinners:1,immutableOperationProtected:true}
  },
  mount() {
    const store=new IndexedDBWorkoutStore(indexedDB,'wp09-native-ui')
    const initial=draft();initial.id='native-ui-session';initial.key=workoutKey(scope,initial.id)
    const transport={access:async()=>access,save:async(payload:any)=>receipt(payload)}
    const root=createRoot(document.getElementById('root')!)
    root.render(<StrictMode><ProductTrainingSession initial={initial} routine={routine} store={store} access={access} transport={transport} integrationAccepted={true} environment={environment} loadRemote={async()=>{throw Error('No remote fixture')}} onClose={()=>{}} /></StrictMode>)
  }
}})
