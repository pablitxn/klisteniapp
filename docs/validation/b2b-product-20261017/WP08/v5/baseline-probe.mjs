import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const repo='/task/candidate';
const require=createRequire(`${repo}/apps/b2c-web/package.json`);
const {chromium,webkit,expect}=require('@playwright/test');
const {startProductHarness}=await import(`${repo}/scripts/b2b-product-e2e-server.mjs`);
const {principal,login,newPage,prescribe,record,showWeek,api}=await import(`${repo}/apps/b2c-web/e2e/fixtures/b2b-product/app-fixture.ts`);
const phase=process.argv[2]??'before';
const dir=`/task/output/${phase}`; mkdirSync(dir,{recursive:true});
const reports=[]; const harness=await startProductHarness({source:process.env.B2B_TEST_DATABASE_URL,mode:'white-label-http',projectCount:1,env:{...process.env,B2B_PRODUCT_TEST_ACTIVATE:'1'}});
let browser;
async function measure(page,width){
 return page.evaluate((width)=>{
  const box=(el)=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);const range=document.createRange();range.selectNodeContents(el);const t=range.getBoundingClientRect();return {tag:el.tagName,id:el.id,classes:el.className,text:el.textContent?.slice(0,130),left:r.left,right:r.right,width:r.width,textRight:t.right,textWidth:t.width,minWidth:s.minWidth,overflowWrap:s.overflowWrap,whiteSpace:s.whiteSpace,overflowX:s.overflowX}};
  return {requestedWidth:width,innerWidth:innerWidth,clientWidth:document.documentElement.clientWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,zoom:window.visualViewport?.scale,offenders:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>width+1).map(box).slice(-40),headings:[...document.querySelectorAll('[id^="scheduled-occurrence-"] h4')].map(box),controls:[...document.querySelectorAll('[aria-label="Calendario semanal"] button,[aria-label="Calendario semanal"] select')].map(box)};
 },width);
}
try{
 browser=await chromium.launch({chromiumSandbox:true});
 const use={viewport:{width:320,height:740},hasTouch:true,isMobile:true,proxy:{server:`http://127.0.0.1:${harness.layout.projects[0].proxyPort}`},baseURL:'http://atlas.b2b.test'};
 const info={project:{use,outputDir:`/tmp/wp08-overflow-${phase}`,metadata:{b2bProduct:{mode:'white-label-http'}}},annotations:[]};
 const initial=await browser.newContext({...use,locale:'es-AR',timezoneId:'UTC',ignoreHTTPSErrors:false});
 const staff=await newPage(initial,info),memberPage=await newPage(initial,info);
 const product=harness.fixtures[0],staffWho=principal(product,'superadmin'),member=principal(product);
 await login(staff.page,staffWho,info);
 const plan=await prescribe(staff.page,staffWho,member,{weekStart:'2026-09-07'});
 await login(memberPage.page,member,info);
 for(const o of plan.occurrences.slice(0,3)) await record(memberPage.page,member,plan.routine,o);
 await record(memberPage.page,member,plan.routine,plan.occurrences[3],'partial');
 await showWeek(memberPage.page,product,info,plan.weekStart);
 const calendar=memberPage.page.getByRole('region',{name:'Calendario semanal'});
 await expect(calendar.getByText('Parcial al cierre: incluida entre las ausentes.')).toBeVisible();
 for(const width of [320,430,1440]){
  await memberPage.page.setViewportSize({width,height:width===1440?1000:932});
  const data=await measure(memberPage.page,width);
  reports.push({engine:'chromium',width,...data});
  await memberPage.page.screenshot({path:`${dir}/chromium-${width}-history.png`,fullPage:true});
  console.log(phase,'chromium',width,JSON.stringify({innerWidth:data.innerWidth,documentWidth:data.documentWidth,bodyWidth:data.bodyWidth}));
 }
 writeFileSync(`${dir}/measurements.json`,JSON.stringify(reports,null,2));
 if(phase==='before'){
  await memberPage.page.setViewportSize({width:320,height:740});
  await memberPage.page.locator('[id^="scheduled-occurrence-"] h4').evaluateAll(nodes=>nodes.forEach(el=>el.style.overflowWrap='anywhere'));
  const diagnostic=await measure(memberPage.page,320);
  writeFileSync(`${dir}/heading-wrap-diagnostic.json`,JSON.stringify(diagnostic,null,2));
  console.log('diagnostic heading wrap',JSON.stringify({innerWidth:diagnostic.innerWidth,documentWidth:diagnostic.documentWidth,bodyWidth:diagnostic.bodyWidth}));
 }
 await staff.context.close();await memberPage.context.close();await initial.close();
}finally{await browser?.close();await harness.close();}
