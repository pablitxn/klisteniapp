import http from 'node:http';
import { EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { ProductEventHub, serveProductEvents } from './apps/b2b-api/src/product-events.ts';
const db=Object.assign(new EventEmitter(),{query:async()=>({rows:[{schema:'synthetic'}]}),release(){}});
const hub=new ProductEventHub({connect:async()=>db});
let enteredResolve;const entered=new Promise(r=>enteredResolve=r);let observed;
const api=http.createServer(async(request,response)=>{
 enteredResolve();await delay(100);
 observed={requestAborted:request.aborted,responseDestroyed:response.destroyed};
 try { await serveProductEvents(hub,request,response,{actorId:'owner',organizationId:'gym',sessionId:'session'},async()=>{}); } catch {}
});
await new Promise(r=>api.listen(0,'127.0.0.1',r));
const client=http.get({hostname:'127.0.0.1',port:api.address().port,path:'/api/b2b/orgs/gym/product/v2/events',agent:false});
client.on('error',()=>{});await entered;client.destroy();await delay(250);
console.log(JSON.stringify({mode:'abort-before-serveProductEvents',...observed,remainingHubListeners:hub.listeners.size}));
hub.close();api.closeAllConnections();await new Promise(r=>api.close(r));
