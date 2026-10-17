import http from 'node:http';
import { EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { ProductEventHub, serveProductEvents } from './apps/b2b-api/src/product-events.ts';
import { createGateway } from './scripts/b2b-gateway.mjs';
import { createProductTestProxy } from './scripts/b2b-product-test-proxy.mjs';
const listen = async (server) => { await new Promise(r => server.listen(0, '127.0.0.1', r)); return server.address().port; };
for (const mode of ['direct-api', 'gateway', 'http-test-proxy']) {
  const db = Object.assign(new EventEmitter(), { query: async () => ({ rows: [{ schema: 'synthetic' }] }), release() {} });
  const hub = new ProductEventHub({ connect: async () => db });
  const servers = [];
  const api = http.createServer((request,response) => void serveProductEvents(hub,request,response,{actorId:'synthetic-owner',organizationId:'gym',sessionId:'synthetic-session'},async()=>{}).catch(e=>{ if (!response.destroyed) {response.writeHead(e.status??500, {'content-type':'application/json'});response.end(JSON.stringify({code:e.code}));} }));
  servers.push(api);
  let port = await listen(api);
  let path = '/api/b2b/orgs/gym/product/v2/events';
  if(mode==='gateway') { const gateway=createGateway({apiPort:port,whiteLabel:false});servers.push(gateway);port=await listen(gateway); }
  if(mode==='http-test-proxy') { const proxy=createProductTestProxy(port,'http');servers.push(proxy);port=await listen(proxy);path='http://atlas.b2b.test'+path; }
  const statuses=[];
  try {
    for(let i=0;i<10;i++) {
      statuses.push(await new Promise((resolve,reject)=>{
        const client=http.get({hostname:'127.0.0.1',port,path,agent:false},response=>{
          if(response.statusCode!==200){response.resume();resolve(response.statusCode);return;}
          response.once('data',()=>{client.destroy();resolve(response.statusCode);});
        });
        client.on('error',reject);
        client.setTimeout(2000,()=>client.destroy(new Error('probe timeout')));
      }));
      await delay(50);
    }
    console.log(JSON.stringify({mode,statuses,remainingHubListeners:hub.listeners.size}));
  } finally {
    hub.close();
    for(const server of servers.reverse()) {server.closeAllConnections();await new Promise(r=>server.close(r));}
  }
}
