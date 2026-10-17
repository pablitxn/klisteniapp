import { readFile } from 'node:fs/promises';
import dns from 'node:dns/promises';
console.log('hostsProofLine', (await readFile('/etc/hosts','utf8')).split('\n').filter(l=>l.includes('route-proof.test')));
console.log('nssHosts', (await readFile('/etc/nsswitch.conf','utf8')).split('\n').filter(l=>l.startsWith('hosts:')));
try{console.log('nodeDns',await dns.lookup('route-proof.test'));}catch(e){console.log('nodeDnsError',e.code);}
console.log('proxyEnvKeys',Object.keys(process.env).filter(k=>/proxy/i.test(k)));
