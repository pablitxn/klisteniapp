import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
const root=process.env.WP09_VALIDATION_ROOT??'/workspace/wp09-validation'
const moduleAt=path=>import(pathToFileURL(`${root}/${path}`).href)
const {withLedger,routine,now}=await moduleAt('apps/b2b-api/tests/fixtures/wp03-ledger.ts')
const {createRecordsServices}=await moduleAt('apps/b2b-api/src/schedule/index.ts')
const {createWorkoutDocument}=await moduleAt('apps/b2b-web/src/features/training/sync/workoutEdit.ts')
const {queueWorkout,WorkoutSync}=await moduleAt('apps/b2b-web/src/features/training/sync/workoutSync.ts')
const {MemoryWorkoutStore}=await moduleAt('apps/b2b-web/tests/fixtures/workout.ts')
const services=createRecordsServices(now)
await withLedger(async ledger=>{
 const [occurrence]=await ledger.run(ctx=>services.occurrences(ctx,{memberId:'member',weekStart:'2026-10-19',timeZone:'America/New_York'}))
 const scope={origin:'http://synthetic.example',accountId:'member',actorId:'member',organizationId:'atlas',branchId:'atlas-principal'}
 const access={schemaVersion:2,organizationId:'atlas',userId:'member',role:'member',accessMode:'active',accessRevision:1,branches:[{branchId:'atlas-principal',role:'member'}],capabilities:['edit-own-sessions']}
 const store=new MemoryWorkoutStore()
 const d=createWorkoutDocument(scope,'wp09-api-session',{kind:'occurrence',occurrenceId:occurrence.id,routine:occurrence.routine},routine,()=> 'source-segment','2026-10-22T14:00:00Z')
 await store.compareAndSet(d,null)
 const queued=await queueWorkout(d,1,'wp09-api-operation',now().toISOString());await store.compareAndSet({...queued,generation:1},0)
 const first=structuredClone(queued.operations[0].payload)
 let lost=true
 const transport={access:async()=>access,save:async input=>{const response=await ledger.run(ctx=>services.saveSession(ctx,input));if(lost){lost=false;throw new TypeError('Synthetic response loss after commit')}return response}}
 await assert.rejects(new WorkoutSync(store,scope,transport,true).replay(d.key),/response loss/)
 await new WorkoutSync(store,scope,transport,true).replay(d.key)
 let local=await store.read(d.key);assert.equal(local.accepted.revision,1);assert.equal(local.accepted.content.status,'draft')
 local.content.notes='Follow-up edit after exact replay';await store.compareAndSet({...local,generation:local.generation+1},local.generation)
 local=await store.read(d.key)
 const successor=await queueWorkout(local,1,'wp09-api-successor',now().toISOString());assert.equal(successor.operations[1].payload.expectedRevision,1)
 await store.compareAndSet({...successor,generation:local.generation+1},local.generation)
 await new WorkoutSync(store,scope,transport,true).replay(d.key)
 local=await store.read(d.key);assert.equal(local.accepted.revision,2);assert.equal(local.accepted.content.status,'draft')
 const old=await ledger.run(ctx=>services.saveSession(ctx,first));assert.equal(old.session.revision,1);assert.equal(old.session.content.notes,'')
 const stale={...first,operationId:'wp09-stale',expectedRevision:0,content:{...first.content,notes:'other device'}}
 await assert.rejects(ledger.run(ctx=>services.saveSession(ctx,stale)),{code:'REVISION_CONFLICT'})
 local.content.notes='Retained after membership suspension';await store.compareAndSet({...local,generation:local.generation+1},local.generation);local=await store.read(d.key)
 const revoked=await queueWorkout(local,1,'wp09-revoked',now().toISOString());await store.compareAndSet({...revoked,generation:local.generation+1},local.generation)
 await ledger.pool.query("UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='member'")
 await new WorkoutSync(store,scope,transport,true).replay(d.key)
 const blocked=await store.read(d.key);assert.equal(blocked.problem.kind,'blocked');assert.equal(blocked.operations.at(-1).state,'access-revoked');assert.equal(blocked.content.notes,'Retained after membership suspension')
 const counts=await ledger.pool.query("SELECT (SELECT count(*) FROM b2b_session_revision WHERE session_id='wp09-api-session') AS revisions,(SELECT count(*) FROM b2b_operation_receipt WHERE resource_id='wp09-api-session') AS receipts")
 assert.equal(Number(counts.rows[0].revisions),2);assert.equal(Number(counts.rows[0].receipts),2)
 console.log(JSON.stringify({passed:7,failed:0,skipped:0,cases:['zero-set draft save','committed response loss and exact replay','accepted-revision successor','old immutable receipt after successor','other-device stale CAS','server suspension blocks replay','two revisions/two receipts without duplicate writes'],limits:['Injected access discovery; WP06 integrated authorization still pending','Direct authorized service adapter, not HTTP/browser acceptance']},null,2))
})
