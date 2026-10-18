import http from 'node:http'
import {readFile} from 'node:fs/promises'
import {webkit} from '/runtime/driver-playwright-core/index.mjs'
const server=http.createServer(async(req,res)=>{if(req.url==='/probe.js'||req.url==='/probe.css'){res.setHeader('content-type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(await readFile('/harness/dist'+req.url));return}res.setHeader('content-type','text/html');res.end('<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/probe.css"><body><div id="root"></div><script src="/probe.js"></script></body></html>')})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
let browser
try{
 browser=await webkit.launch({headless:true})
 console.log(JSON.stringify({runtime:{driver:'1.63.0',webkit:browser.version(),uid:process.getuid()},actualComponents:['PeriodImpactEditor','GoalProgramEditor','StageScheduleEditor'],nativeMobile:true,serviceCalls:false}))
 const variants={
 'field-min-only':'.programming .field{min-width:0}',
 'grid-child-min-only':'.programming-grid>*{min-width:0}',
 'field-max-only':'.programming .field{max-width:100%}',
 'grid-child-max-only':'.programming-grid>*{max-width:100%}',
 'grid-child-min-max':'.programming-grid>*{min-width:0;max-width:100%}'
 }
 for(const invalid of [false,true])for(const [variant,css]of Object.entries(variants)){
  const page=await browser.newPage({viewport:{width:320,height:740},isMobile:true,hasTouch:true,deviceScaleFactor:1})
  await page.goto(`http://127.0.0.1:${server.address().port}/${invalid?'?invalid=1':''}`)
  await page.getByLabel('Rutina publicada · etapa 1, sesión 1',{exact:true}).waitFor()
  if(css)await page.addStyleTag({content:css})
  if(variant==='selected-short')await page.evaluate(()=>{for(const s of document.querySelectorAll('select'))s.selectedOptions[0].textContent='Short'})
  await page.waitForTimeout(80)
  const result=await page.evaluate(()=>{
   const description=e=>({tag:e.tagName,id:e.id,classes:e.className,label:e.labels?.[0]?.textContent||null,value:e.matches('input,select')?e.value:null,text:e.matches('select')?e.selectedOptions[0]?.textContent:null,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,rectWidth:e.getBoundingClientRect().width,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,minWidth:getComputedStyle(e).minWidth,overflowX:getComputedStyle(e).overflowX,textOverflow:getComputedStyle(e).textOverflow})
   const result={innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,overflowing:[...document.querySelectorAll('body *')].filter(e=>e.scrollWidth>e.clientWidth+1&&e.clientWidth>0).map(description),controls:[...document.querySelectorAll('input,select')].map(description)}
   window.scrollTo(1000,0);result.actualScrollRange=scrollX;window.scrollTo(0,0);return result
  })
  console.log(JSON.stringify({case:invalid?'goal-invalid-two-stage':'period',variant,...result}));await page.close()
 }
}finally{await browser?.close();await new Promise(r=>server.close(r))}
