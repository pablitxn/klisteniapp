import {writeFileSync,mkdirSync,readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const repo='/task/candidate',require=createRequire(`${repo}/apps/b2c-web/package.json`);
const {chromium,webkit,expect}=require('@playwright/test');
const {startProductHarness}=await import(`${repo}/scripts/b2b-product-e2e-server.mjs`);
const {principal,login,newPage,prescribe,record,showWeek,api}=await import(`${repo}/apps/b2c-web/e2e/fixtures/b2b-product/app-fixture.ts`);
const dir='/task/output/after';mkdirSync(dir,{recursive:true});
const results=[];let harness,browser,staff;
async function measure(page,width){return page.evaluate(width=>{
 const box=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el),t=document.createRange();t.selectNodeContents(el);const text=t.getBoundingClientRect();return {tag:el.tagName,id:el.id,classes:el.className,text:el.textContent?.slice(0,140),left:r.left,right:r.right,width:r.width,height:r.height,textRight:text.right,textLeft:text.left,whiteSpace:s.whiteSpace,overflowWrap:s.overflowWrap,overflowX:s.overflowX}};
 return {requestedWidth:width,innerWidth,clientWidth:document.documentElement.clientWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>width+1).map(box),buttons:[...document.querySelectorAll('.routine-history button')].map(box),occurrences:[...document.querySelectorAll('[id^="scheduled-occurrence-"]')].map(box)};
},width);}
try{
 harness=await startProductHarness({source:process.env.B2B_TEST_DATABASE_URL,mode:'white-label-http',projectCount:6,env:{...process.env,B2B_PRODUCT_TEST_ACTIVATE:'1'}});

 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  browser=await engine.launch(name==='chromium'?{chromiumSandbox:true}:{});
  for(const width of [320,430,1440]){
   const index=(name==='chromium'?0:3)+[320,430,1440].indexOf(width);
   const product=harness.fixtures[index],member=principal(product),staffWho=principal(product,'superadmin');
   const proxy={server:`http://127.0.0.1:${harness.layout.projects[index].proxyPort}`};
   let plan;
   const use={viewport:{width,height:width===320?740:width===430?932:1000},hasTouch:width!==1440,isMobile:width!==1440,proxy,baseURL:'http://atlas.b2b.test'};
   const info={project:{use,outputDir:`/tmp/wp08-layout-auth-pace-${index}`,metadata:{b2bProduct:{mode:'white-label-http'}}},annotations:[]};
   const context=await browser.newContext({...use,locale:'es-AR',timezoneId:'UTC',ignoreHTTPSErrors:false});
   const target=await newPage(context,info);
   try{
    if(!plan){
     staff=await newPage(context,info);await login(staff.page,staffWho,info);
     plan=await prescribe(staff.page,staffWho,member,{weekStart:'2026-09-07'});
    }
    await login(target.page,member,info);
    {
     for(const o of plan.occurrences.slice(0,3))await record(target.page,member,plan.routine,o);
     await record(target.page,member,plan.routine,plan.occurrences[3],'partial');
     await staff.context.close();staff=null;
    }
    await showWeek(target.page,product,info,plan.weekStart);
    const calendar=target.page.getByRole('region',{name:'Calendario semanal'});
    await expect(calendar.getByText('Parcial al cierre: incluida entre las ausentes.')).toBeVisible();
    for(const [label,count] of [['Prescritas',4],['Completadas',3],['Parciales',1],['Ausentes',1],['Pendientes',0]]) await expect(calendar.locator('dt').filter({hasText:new RegExp(`^${label}$`)}).locator('..').locator('dd')).toHaveText(String(count));
    assert.deepEqual((await calendar.locator('[id^="scheduled-occurrence-"]').evaluateAll(nodes=>nodes.map(n=>n.id))).sort(),plan.occurrences.map(o=>`scheduled-occurrence-${o.id}`).sort());
    const legacy=target.page.getByRole('region',{name:'Asignaciones anteriores sin calendario'});
    await expect(legacy.getByRole('button',{name:/Abrir registro de/}).first()).toBeVisible();
    await expect(target.page.getByRole('button',{name:'Ver registro original y correcciones'}).first()).toBeVisible();
    const form=calendar.getByRole('form').first();await expect(form).toBeVisible();await expect(form.getByRole('combobox').locator('option')).toHaveCount(7);await expect(form.getByRole('button',{name:'Confirmar cambio de día'})).toBeVisible();
    const period=calendar.getByRole('button',{name:'Ver período original emitido r1'}).first();await period.click();await expect(calendar.getByRole('region',{name:'Período registrado r1'})).toBeVisible();
    const data=await measure(target.page,width);
    assert.equal(data.innerWidth,width);assert.equal(data.documentWidth,width);assert.equal(data.bodyWidth,width);assert.deepEqual(data.offenders,[]);
    for(const button of data.buttons){assert.ok(button.right<=width+1);assert.ok(button.left>=0);assert.ok(button.height>=1);assert.ok(button.textRight<=button.right+1,button.text);}
    await target.page.screenshot({path:`${dir}/${name}-${width}-history.png`,fullPage:true});
    const checks={viewportExact:true,fourThreeOne:true,stableOccurrenceIds:true,legacyControlVisible:true,revisionsControlVisible:true,sevenDayMoveControlVisible:true,issuedPeriodExpanded:true,allButtonTextWithinBounds:true};
    if(name==='chromium'&&width===320){
     const moved=plan.occurrences[3],card=target.page.locator(`[id="scheduled-occurrence-${moved.id}"]`),select=card.getByLabel('Mover dentro de esta semana');
     await select.focus();await target.page.keyboard.press('End');assert.equal(await select.inputValue(),'2026-09-13');
     const response=target.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes(`/occurrences/${moved.id}/move`));
     await card.getByRole('button',{name:'Confirmar cambio de día'}).press('Enter');
     const accepted=await response;assert.equal(accepted.status(),200);const value=await accepted.json();assert.equal(value.id,moved.id);assert.deepEqual(value.routine,moved.routine);assert.equal(value.scheduledDate,'2026-09-13');
     await expect(card).toBeFocused();const after=await api(target.page,member,'week',{memberId:member.actor.id,weekStart:plan.weekStart,timeZone:'UTC'});assert.equal(after.required,4);assert.equal(after.completed,3);assert.equal(after.missed,1);checks.keyboardMoveAcceptedAndFocusRestored=true;
    }
    results.push({engine:name,engineVersion:browser.version(),width,checks,measurements:data});writeFileSync(`${dir}/results.json`,JSON.stringify(results,null,2));
    console.log('PASS',name,width,JSON.stringify(checks));
   }catch(error){await target.page.screenshot({path:`${dir}/failure-${name}-${width}.png`,fullPage:true});writeFileSync(`${dir}/failure-${name}-${width}.txt`,await target.page.locator('body').innerText());throw error;}finally{await target.context.close();await context.close();}
  }
  await browser.close();browser=null;
 }
 writeFileSync(`${dir}/runtime.json`,JSON.stringify({node:process.version,playwright:require('@playwright/test/package.json').version,uid:process.getuid(),securityStatus:readFileSync('/proc/self/status','utf8').split('\n').filter(l=>/^(CapEff|NoNewPrivs):/.test(l)),browserCount:results.length,failures:0,skips:0,chromiumSandbox:true,ignoreHTTPSErrors:false},null,2));
}catch(error){writeFileSync(`${dir}/error.txt`,String(error.stack??error));throw error;}
finally{await staff?.context.close();await browser?.close();await harness?.close();}
