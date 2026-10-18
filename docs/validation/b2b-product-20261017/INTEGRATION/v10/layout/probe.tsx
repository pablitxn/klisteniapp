import '@klisteniapp/b2b-ui/styles.css'
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import { ProductViews } from '/workspace/klisteniapp/apps/b2b-web/src/app/ProductWorkspace'
import { navigate, useLocation } from '/workspace/klisteniapp/apps/b2b-web/src/app/navigation'
import { followApplicationLink } from '/workspace/klisteniapp/apps/b2b-web/src/app/navigationLinks'
import { Invitation } from '/workspace/klisteniapp/apps/b2b-web/src/features/invitations/Invitation'
import { Shell } from '@klisteniapp/b2b-ui'
import { createProductV2Client } from '@klisteniapp/b2b-client'
import { IndexedDBWorkoutStore, LocalWorkoutConflict } from '/workspace/klisteniapp/apps/b2b-web/src/features/training/storage/workoutStore'
import { createBoundWorkoutDocument } from '/workspace/klisteniapp/apps/b2b-web/src/features/training/sync/sessionWorkoutBinding'
import { rememberSelectedWorkout, recoveryWorkoutScope, authenticatedRecoveryOwner } from '/workspace/klisteniapp/apps/b2b-web/src/features/training/storage/selectedWorkoutRecovery'
import { recoveryContext } from '/workspace/klisteniapp/apps/b2b-web/tests/fixtures/workoutRecovery'
import { legacyBinding, legacyOrigin, ids } from '/workspace/klisteniapp/apps/b2b-web/tests/fixtures/legacyWorkout'
import { now } from '/workspace/klisteniapp/apps/b2b-web/tests/fixtures/workout'

const config = JSON.parse(new URL(location.href).searchParams.get('config') || '{}')
const controller = new AbortController()
const recovery = {...recoveryContext('route-realm'), origin: location.origin, signal: controller.signal}
const context = {accountId:'member',organizationId:'gym',branchId:'east',hostBinding:'route-realm',generation:'route-owner-1',access:recovery.access,signal:controller.signal}
const dbName='route-v9-'+crypto.getRandomValues(new Uint32Array(2)).join('-')
const actual = new IndexedDBWorkoutStore(indexedDB,dbName)
const initial=createBoundWorkoutDocument({scope:recoveryWorkoutScope(recovery),id:'original-execution',origin:legacyOrigin},legacyBinding(),ids(),now)
let held=false,pointerHeld=false,ready=false,failure=Boolean(config.failure),bindingOffline=Boolean(config.offline),bindingFailure=false,releaseWrite=()=>{},releasePointer=()=>{},revoked=false,forceRender=()=>{}
const events:any[]=[], calls:string[]=[]
const gate=new Promise<void>(r=>releaseWrite=r),pointerGate=new Promise<void>(r=>releasePointer=r)
const record=(event:string,extra:any={})=>events.push({event,...extra})
const store=new Proxy(actual,{get(target,key){
 if(key==='compareAndSet')return async(doc:any,expected:any,signal:any)=>{
  record('write-start',{generation:doc.generation,notes:doc.content.notes,reason:doc.content.correctionReason})
  if(!held&&doc.generation===(config.hold==='final'?2:1)){held=true;record('write-held');await gate}
  signal?.throwIfAborted()
  if(failure&&config.failure==='quota'&&doc.generation===2)throw new DOMException('Synthetic quota failure','QuotaExceededError')
  if(failure&&config.failure==='conflict'&&doc.generation===2){failure=false;const current=(await actual.read(initial.key))!;await actual.compareAndSet({...current,generation:current.generation+1,content:{...current.content,notes:'Other-tab actuals'}},current.generation);throw new LocalWorkoutConflict()}
  await target.compareAndSet(doc,expected,signal);record('write-committed',{generation:doc.generation})
 }
 const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value
}})
const onSelected=async(selection:any)=>{
 const document=(await actual.read(initial.key))!;record('pointer-start',{generation:document.generation})
 if(config.pointer&&document.generation>=2&&!pointerHeld){pointerHeld=true;record('pointer-held');await pointerGate}
 controller.signal.throwIfAborted()
 if(failure&&config.failure==='pointer'&&document.generation>=2)throw new Error('Synthetic pointer failure')
 await rememberSelectedWorkout(actual,recovery,selection);ready=true;record('pointer-committed',{generation:document.generation})
}
const createClient=(signal?:AbortSignal)=>createProductV2Client('member','gym',{branchId:'east',role:'member',signal,contextSignal:controller.signal,fetch:async(input:any)=>{
 const path=String(input);calls.push(path)
 if(path.endsWith('/binding')){if(bindingFailure)return Response.json({code:'INVALID_BINDING',error:'Synthetic failed reload'},{status:409});if(bindingOffline)throw new TypeError('Synthetic disconnected binding read');return Response.json(legacyBinding())}
 if(path.endsWith('/workout-equipment'))return Response.json({activeMachineIds:[]})
 if(path.includes('/continuity'))return Response.json({schemaVersion:2,scope:{organizationId:'gym',branchId:'east',memberId:'member'},current:[],past:[],future:[],unscheduledLegacyAssignmentIds:[]})
 if(path.includes('/legacy-assignments')||path.includes('/sessions'))return Response.json([])
 if(path.endsWith('/access'))return await new Promise<Response>(()=>{})
 throw new Error('Unexpected fixture read: '+path)
}})
function Probe(){
 const href=useLocation(),[,rerender]=useState(0)
 forceRender=()=>rerender(x=>x+1)
 useEffect(()=>{record('accepted-route',{href})},[href])
 return <div onClick={event=>followApplicationLink(event,href)}>
  <Shell name="Route Gym" eyebrow="SYNTHETIC LOCAL TEST">



   {revoked?<h1>Context revoked</h1>:href.startsWith('/app/invite')?<Invitation onAuthenticated={()=>navigate('/app')} replaceLocation={href=>navigate(href,true)}/>:href.startsWith('/g/')?<h1>Synthetic public page</h1>:<ProductViews createClient={createClient} accessKey="route-owner-1" context={context} organizationName="Gym" branchName="East" href={href} navigate={navigate} store={store} onSelected={onSelected} recoveryContext={recovery} recoverable={initial}/>}
  </Shell>
 </div>
}
async function start(){
 await actual.compareAndSet(initial,null)
 // Seed real same-document history before mounting the production router.
 history.replaceState({retained:'public',klisteniNavigationIndex:0},'','/g/synthetic')
 history.pushState({retained:'workout',klisteniNavigationIndex:1},'',config.invitation?'/app/invite'+(config.invitation==='fragment'?'#':'?')+'token=synthetic-invitation-token-0000000000000001':'/app?view=history')
 if(config.forward){history.pushState({retained:'health',klisteniNavigationIndex:2},'','/app?view=health');await new Promise<void>(r=>{window.addEventListener('popstate',()=>r(),{once:true});history.back()})}
 createRoot(document.getElementById('root')!).render(<Probe/>)
}
Object.assign(window,{routeProof:{start,release:()=>{record('release-write');releaseWrite()},releasePointer:()=>{record('release-pointer');releasePointer()},disableFailure:()=>failure=false,online:()=>bindingOffline=false,failBinding:()=>bindingFailure=true,navigate,state:()=>({held,pointerHeld,ready,revoked,events,calls,href:location.pathname+location.search+location.hash,historyState:history.state}),read:()=>actual.read(initial.key),reopen:()=>new IndexedDBWorkoutStore(indexedDB,dbName).read(initial.key),selected:()=>actual.selected(authenticatedRecoveryOwner(recovery),controller.signal)}})
