import assert from 'node:assert/strict'
import http from 'node:http'
import {readFile} from 'node:fs/promises'
import {chromium} from '/runtime/driver-playwright-core/index.mjs'
const server=http.createServer(async(req,res)=>{
 try{
  if(req.url==='/api/b2b/invitations/accept'){res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true}));return}
  if(req.url.startsWith('/api/')){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:'Synthetic harness has no live API',code:'UNAVAILABLE'}));return}
  if(req.url==='/probe.js'||req.url==='/probe.css'){res.setHeader('content-type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(await readFile('/harness/dist'+req.url));return}
  res.setHeader('content-type','text/html');res.end('<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/probe.css"><body><div id="root"></div><script src="/probe.js"></script></body></html>')
 }catch(e){res.writeHead(500);res.end(String(e))}
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const url=`http://route-proof.test:${server.address().port}`,results=[],errors=[]
let browser
const wait=async(page,expression,label)=>{try{await page.waitForFunction(expression,{},{timeout:12000})}catch(e){console.error('FAILED WAIT',label,await page.evaluate(()=>({state:window.routeProof?.state(),text:document.body.textContent})));throw e}}
const state=page=>page.evaluate(()=>window.routeProof.state())
async function start(config={},width=320){
 const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true,ignoreHTTPSErrors:false});page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(url+'/?config='+encodeURIComponent(JSON.stringify(config)));await page.waitForFunction(()=>Boolean(window.routeProof));assert.equal(await page.evaluate(()=>isSecureContext),false)
 await page.evaluate(()=>window.routeProof.start());await page.getByRole('button',{name:'Retomar trabajo guardado en este dispositivo',exact:true}).click()
 await page.getByLabel('Notas de la sesión',{exact:true}).waitFor();await wait(page,()=>window.routeProof.state().ready,'initial selection')
 return page
}
async function edits(page){
 await page.getByLabel('Notas de la sesión',{exact:true}).fill('Root route notes')
 await wait(page,()=>window.routeProof.state().held,'first write held')
 await page.getByLabel('Motivo de corrección',{exact:true}).fill('Root final correction reason')
}
async function fresh(page,gen=2){
 const d=await page.evaluate(()=>window.routeProof.reopen());assert.equal(d.generation,gen);assert.equal(d.content.notes,'Root route notes');assert.equal(d.content.correctionReason,'Root final correction reason');assert.equal(d.content.explicitCompletion,false);assert.equal(d.content.status,'partial');assert.equal(d.binding.original.original.notes,'Original note');assert.equal(d.operations.length,0)
 const selected=await page.evaluate(()=>window.routeProof.selected());assert.equal(selected.document.generation,gen);return d
}
async function trigger(page,kind){
 if(kind==='section')await page.getByRole('link',{name:'Mi salud',exact:true}).click()
 else if(kind==='same-view')await page.getByRole('link',{name:'Mi rutina e historial',exact:true}).click()
 else if(kind==='brand')await page.locator('.brand-link').click()
 else if(kind==='public')await page.getByRole('link',{name:'Public gym page',exact:true}).click()
 else await page.evaluate(k=>history[k](),kind)
}
async function arrived(page,kind){
 if(kind==='section'||kind==='forward')await page.getByRole('heading',{name:'Mi salud y privacidad',exact:true}).waitFor()
 else if(kind==='public'||kind==='back')await page.getByRole('heading',{name:'Synthetic public page',exact:true}).waitFor()
 else await page.getByRole('heading',{name:'Mi rutina e historial',exact:true}).waitFor()
}
const record=r=>{results.push(r);console.log(JSON.stringify(r))}
try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true,args:['--enable-automation','--host-resolver-rules=MAP route-proof.test 127.0.0.1','--proxy-bypass-list=route-proof.test']})
 assert.equal(browser.version(),'153.0.8010.12')
 for(const [kind,width] of [['section',320],['section',1440],['same-view',320],['brand',320],['public',320],['back',320],['forward',1440]]){
  const page=await start({forward:kind==='forward'},width);await edits(page);await trigger(page,kind)
  await wait(page,()=>document.querySelector('textarea[aria-label="not-present"]')===null&&document.querySelector('textarea')?.disabled,'flush freezes form')
  assert.equal(await page.getByTestId('accepted-route').textContent(),'/app?view=history')
  await page.evaluate(()=>window.routeProof.release());await arrived(page,kind);await fresh(page)
  const s=await state(page),lastPointer=s.events.findLastIndex(e=>e.event==='pointer-committed'&&e.generation===2),route=s.events.findLastIndex(e=>e.event==='accepted-route')
  assert.ok(lastPointer>=0);if(kind!=='same-view')assert.ok(route>lastPointer)
  assert.equal(await page.getByLabel('Notas de la sesión',{exact:true}).count(),0)
  record({case:'composed-'+kind,width,storedGeneration:2,selectionBeforeDeparture:true,accepted:await page.getByTestId('accepted-route').textContent(),browser:s.href,events:s.events});await page.close()
 }
 // Pure no-op/hash actions preserve the live editor and do not initiate a flush.
 {
  const page=await start();await edits(page);await page.evaluate(()=>window.routeProof.navigate('/app?view=history'));await page.getByRole('link',{name:'Native hash anchor',exact:true}).click()
  await wait(page,()=>location.hash==='#main','native hash');assert.equal(await page.getByLabel('Motivo de corrección',{exact:true}).isDisabled(),false)
  assert.equal((await state(page)).historyState.klisteniNavigationIndex,2);await page.evaluate(()=>history.back());await wait(page,()=>location.hash==='','hash back');assert.equal(await page.getByLabel('Motivo de corrección',{exact:true}).isDisabled(),false)
  await trigger(page,'section');await page.evaluate(()=>window.routeProof.release());await arrived(page,'section');await fresh(page);record({case:'native-hash-and-noop',editorRemainedLive:true,hashEntryIndexed:true});await page.close()
 }
 // Rapid navigation uses one local flush; the final native target matches the rendered route.
 {
  const page=await start({forward:true});await edits(page);await page.evaluate(()=>history.back());await wait(page,()=>location.pathname.startsWith('/g/'),'first back URL');await page.evaluate(()=>history.forward());await wait(page,()=>location.pathname==='/app','forward URL');await page.evaluate(()=>history.forward());await wait(page,()=>location.search.includes('health'),'second forward URL');await page.evaluate(()=>window.routeProof.release());await arrived(page,'forward');await fresh(page);assert.equal((await state(page)).events.filter(e=>e.event==='pointer-committed'&&e.generation===2).length,1);record({case:'rapid-native-back-forward',oneFinalSelection:true,acceptedMatchesBrowser:true});await page.close()
 }
 for(const kind of ['section','back','forward']){
  const page=await start({failure:'quota',forward:kind==='forward'});await edits(page);await trigger(page,kind);await page.evaluate(()=>window.routeProof.release());await page.getByRole('button',{name:'Reintentar guardado local y volver',exact:true}).waitFor()
  await wait(page,()=>location.pathname+location.search==='/app?view=history','failure history restored');assert.equal(await page.getByTestId('accepted-route').textContent(),'/app?view=history');assert.equal(await page.getByLabel('Motivo de corrección',{exact:true}).inputValue(),'Root final correction reason');assert.equal((await state(page)).historyState.retained,'workout')
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar trabajo local sin confirmar',exact:true}).click();const file=await download;const exported=JSON.parse(await readFile(await file.path(),'utf8'));assert.equal(exported.workout.content.correctionReason,'Root final correction reason')
  await page.evaluate(()=>window.routeProof.disableFailure());await page.getByRole('button',{name:'Reintentar guardado local y volver',exact:true}).click();await arrived(page,'same-view');await fresh(page);await trigger(page,kind);await arrived(page,kind)
  record({case:'failed-'+kind+'-then-explicit-retry',capturedValuesExportable:true,historyEntriesPreserved:true});await page.close()
 }
 for(const failure of [false,true]){
  const page=await start({pointer:true,...(failure?{failure:'pointer'}:{})});await edits(page);await trigger(page,'section');await page.evaluate(()=>window.routeProof.release());await wait(page,()=>window.routeProof.state().pointerHeld,'final pointer held');assert.equal(await page.getByTestId('accepted-route').textContent(),'/app?view=history');assert.equal((await page.evaluate(()=>window.routeProof.reopen())).generation,2)
  await page.evaluate(()=>window.routeProof.releasePointer());if(failure){await page.getByRole('button',{name:'Reintentar guardado local y volver',exact:true}).waitFor();await page.evaluate(()=>window.routeProof.disableFailure());await page.getByRole('button',{name:'Reintentar guardado local y volver',exact:true}).click();await arrived(page,'same-view');await trigger(page,'section')}
  await arrived(page,'section');await fresh(page);record({case:failure?'failed-durable-pointer-route':'slow-durable-pointer-route',noEarlyDeparture:true});await page.close()
 }
 {
  const page=await start({failure:'conflict'});await edits(page);await trigger(page,'section');await page.evaluate(()=>window.routeProof.release());await page.getByRole('button',{name:'Reintentar guardado local y volver',exact:true}).waitFor();assert.equal(await page.getByTestId('accepted-route').textContent(),'/app?view=history');assert.equal((await page.evaluate(()=>window.routeProof.reopen())).content.notes,'Other-tab actuals');assert.equal(await page.getByLabel('Motivo de corrección',{exact:true}).inputValue(),'Root final correction reason');record({case:'composed-CAS-conflict',noOverwrite:true,noDeparture:true});await page.close()
 }
 for(const kind of ['section','back']){
  const page=await start();await edits(page);await trigger(page,kind);await page.getByRole('button',{name:'Revoke context',exact:true}).click();await page.getByRole('heading',{name:'Context revoked',exact:true}).waitFor();await page.evaluate(()=>window.routeProof.release());await page.waitForTimeout(100);assert.equal((await page.evaluate(()=>window.routeProof.reopen())).generation,0);assert.equal(await page.getByLabel('Notas de la sesión',{exact:true}).count(),0);assert.equal(await page.getByTestId('accepted-route').textContent(),'/app?view=history');record({case:'context-revocation-during-'+kind,staleWrites:0,privateUIHidden:true,noStaleNavigation:true});await page.close()
 }
 for(const failed of [false,true]){
  const page=await start({offline:true});await edits(page);await page.evaluate(f=>{window.routeProof.online();if(f)window.routeProof.failBinding()},failed);await page.getByRole('button',{name:'Volver a validar la conexión',exact:true}).click();await wait(page,()=>document.querySelector('textarea')?.disabled,'reconnect local flush');await page.evaluate(()=>window.routeProof.release())
  if(failed){await page.getByRole('button',{name:'Volver al historial',exact:true}).waitFor();await page.getByRole('button',{name:'Volver al historial',exact:true}).click();await arrived(page,'same-view')}
  else{await wait(page,()=>document.querySelector('textarea')&&!document.querySelector('textarea').disabled,'reconnected fresh editor');assert.equal(await page.getByLabel('Motivo de corrección',{exact:true}).inputValue(),'Root final correction reason');await page.getByRole('button',{name:'Volver',exact:true}).click();await arrived(page,'same-view')}
  await fresh(page);record({case:failed?'failed-offline-revalidation-close':'offline-to-online-revalidation',capturedEditsPreserved:true,freshEditor:!failed});await page.close()
 }
 for(const tokenLocation of ['query','fragment']){
  const page=await browser.newPage({viewport:{width:320,height:900},ignoreHTTPSErrors:false});page.on('pageerror',e=>errors.push(String(e)));await page.goto(url+'/?config='+encodeURIComponent(JSON.stringify({invitation:tokenLocation,failure:'quota'})));await page.waitForFunction(()=>Boolean(window.routeProof));await page.evaluate(()=>window.routeProof.start());await page.getByLabel('Tu nombre',{exact:true}).fill('Synthetic member');await page.getByLabel('Nueva contraseña',{exact:true}).fill('Synthetic-local-passphrase');await page.getByRole('button',{name:'Activar mi cuenta',exact:true}).click();await page.getByRole('link',{name:'Iniciar sesión',exact:true}).waitFor();assert.equal(await page.getByTestId('accepted-route').textContent(),'/app/invite');assert.equal((await state(page)).href,'/app/invite');assert.equal((await state(page)).historyState.klisteniNavigationIndex,1);assert.equal((await state(page)).historyState.retained,'workout');await page.getByRole('link',{name:'Iniciar sesión',exact:true}).click();await page.getByRole('button',{name:'Retomar trabajo guardado en este dispositivo',exact:true}).click();await page.getByLabel('Notas de la sesión',{exact:true}).waitFor();await wait(page,()=>window.routeProof.state().ready,'invitation selected');await edits(page);assert.equal((await state(page)).historyState.klisteniNavigationIndex,2);await page.evaluate(()=>history.go(-2));await wait(page,()=>location.pathname.startsWith('/g/'),'multi-step back before flush');assert.equal(await page.getByTestId('accepted-route').textContent(),'/app');await page.evaluate(()=>window.routeProof.release());await page.getByRole('button',{name:'Reintentar guardado local y volver',exact:true}).waitFor();await wait(page,()=>location.pathname==='/app'&&!location.search&&!location.hash,'failed multi-step Back restored');assert.equal((await state(page)).historyState.klisteniNavigationIndex,2);assert.equal(await page.getByLabel('Motivo de corrección',{exact:true}).inputValue(),'Root final correction reason');await page.evaluate(()=>window.routeProof.disableFailure());await page.getByRole('button',{name:'Reintentar guardado local y volver',exact:true}).click();await arrived(page,'same-view');await fresh(page);await page.evaluate(()=>history.back());await page.getByLabel('Tu nombre',{exact:true}).waitFor();assert.equal((await state(page)).href,'/app/invite');assert.equal((await state(page)).historyState.klisteniNavigationIndex,1);await page.evaluate(()=>history.back());await arrived(page,'back');assert.equal((await state(page)).historyState.klisteniNavigationIndex,0);record({case:'invitation-'+tokenLocation+'-token-consumption-navigation',tokenRemoved:true,acceptedRouteSynchronized:true,historyIndexPreserved:true,doneStatePreserved:true,failedMultiStepBackRestored:true,allHistoryEntriesPreserved:true,syntheticAcceptanceResponse:true});await page.close()
 }
 const cdp=await browser.newBrowserCDPSession(),launch=await cdp.send('Browser.getBrowserCommandLine');assert.equal(launch.arguments.includes('--no-sandbox'),false);assert.deepEqual(errors,[])
 console.log(JSON.stringify({runtime:{driver:'1.63.0',chromium:browser.version(),nativeInsecureHTTP:true,nativeIndexedDB:true,sandbox:true,uid:process.getuid()},actualRootComponents:['ProductViews','ProductWorkoutHistory','SelectedWorkout','ProductTrainingSession','navigation','followApplicationLink','Shell'],readTransport:'synthetic typed DTOs; no live API/authentication',fullApplicationAuthorizationOrBrowserMatrix:false,results,errors},null,2))
}finally{await browser?.close();await new Promise(r=>server.close(r))}
