import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { createHash, createPublicKey } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function whiteLabelTLS() {
  const directory = fileURLToPath(new URL('../.cache/wl/tls/', import.meta.url));
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const ca = join(directory, 'ca.crt'), certificate = join(directory, 'server.crt'), key = join(directory, 'server.key');
  if (!existsSync(certificate) || !existsSync(key) || !existsSync(ca)) {
    const run = args => execFileSync('openssl', args, { stdio: 'pipe' });
    run(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '7', '-keyout', join(directory, 'ca.key'),
      '-out', ca, '-subj', '/CN=Klisteni disposable white-label test CA', '-addext', 'basicConstraints=critical,CA:TRUE']);
    run(['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', join(directory, 'server.csr'), '-subj', '/CN=atlas.b2b.test']);
    const extensions = join(directory, 'extensions.cnf');
    writeFileSync(extensions, 'basicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:atlas.b2b.test,DNS:sur.b2b.test,DNS:alias.b2b.test,DNS:unknown.b2b.test,DNS:localhost,IP:127.0.0.1\n');
    run(['x509', '-req', '-in', join(directory, 'server.csr'), '-CA', ca, '-CAkey', join(directory, 'ca.key'),
      '-CAcreateserial', '-out', certificate, '-days', '7', '-extfile', extensions]);
    chmodSync(key, 0o600); chmodSync(join(directory, 'ca.key'), 0o600);
  }
  const cert = readFileSync(certificate);
  // Fail instead of silently regenerating a certificate whose CA may be trusted by a running browser.
  execFileSync('openssl', ['x509', '-checkend', '300', '-noout', '-in', certificate], { stdio: 'pipe' });
  const publicKey = createPublicKey(cert).export({ type: 'spki', format: 'der' });
  return { directory, ca, certificate, key, spki: createHash('sha256').update(publicKey).digest('base64'),
    tls: { key: readFileSync(key), cert } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { ca, certificate } = whiteLabelTLS();
  console.log(JSON.stringify({ ca, certificate }));
}
