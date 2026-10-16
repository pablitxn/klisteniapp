import http from 'node:http'
import net from 'node:net'
import {readFileSync,writeFileSync} from 'node:fs'
import {setTimeout as delay} from 'node:timers/promises'
const {gateway}=JSON.parse(readFileSync('/workspace/qa-20261016/relay-ready.json'))
async function get(target,localAddress) {
 return await new Promise((resolve,reject)=>{const r=http.request({host:gateway,port:4342,path:target,method:'GET',localAddress,timeout:3000},res=>{res.resume();resolve(res.statusCode)});r.on('error',reject);r.on('timeout',()=>r.destroy(new Error('timeout')));r.end()})
}
let ready=false
for(let i=0;i<200;i++){try{await fetch('http://127.0.0.1:4348/');ready=true;break}catch{await delay(200)}}
if(!ready)throw new Error('No live task fixture for controls')
const results=[]
for (const [target,expected] of [['http://atlas.b2b.test/',200],['http://outside.invalid/',403],['https://atlas.b2b.test/',403],['http://atlas.b2b.test:81/',403],['http://fake:fake@atlas.b2b.test/',403]]) {
 const status=await get(target);results.push({method:'GET',target,expected,actual:status,passed:status===expected})
}
for(const [target,expected] of [['atlas.b2b.test:80',200],['atlas.b2b.test:443',403],['outside.invalid:80',403],['atlas.b2b.test:81',403]]) {
 const actual=await new Promise((resolve,reject)=>{const s=net.connect(4342,gateway,()=>s.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`));s.once('data',b=>{resolve(Number(b.toString().split(' ')[1]));s.destroy()});s.on('error',reject);s.setTimeout(3000,()=>s.destroy(new Error('timeout')))})
 results.push({method:'CONNECT',target,expected,actual,passed:actual===expected})
}
let rejected=false
try{await get('http://atlas.b2b.test/','127.0.0.1')}catch(error){rejected=error.code==='ECONNRESET'}
results.push({method:'GET',source:'unlisted local IP 127.0.0.1',expected:'connection rejected',passed:rejected})
writeFileSync('/workspace/qa-20261016/relay-controls.json',JSON.stringify(results,null,2)+'\n')
console.log(JSON.stringify(results))
if(results.some(r=>!r.passed))process.exitCode=1
