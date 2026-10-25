import assert from 'node:assert/strict';
import process from 'node:process';
import console from 'node:console';
import { URL } from 'node:url';

const { fetch, AbortSignal } = globalThis;

const frontend = process.env.FRONTEND_URL ?? 'https://typesync.darshmahadevia.tech';
const backend = process.env.BACKEND_URL ?? 'https://api.typesync.darshmahadevia.tech';
const clientOrigin = process.env.CLIENT_ORIGIN ?? frontend;
const timeout = () => AbortSignal.timeout(90_000);

for (const path of ['/', '/auth/signin']) {
  const response = await fetch(new URL(path, frontend), { signal: timeout() });
  assert.equal(response.status, 200, `Frontend ${path}`);
  assert.match(await response.text(), /<div id="root"><\/div>/);
  console.log(`PASS frontend ${path}`);
}

const ready = await fetch(`${backend}/api/ready`, { signal: timeout() });
assert.equal(ready.status, 200, 'Database readiness');
assert.equal((await ready.json()).status, 'ready');
console.log('PASS backend and database readiness');

const preflight = await fetch(`${backend}/api/documents`, {
  method: 'OPTIONS',
  headers: { Origin: clientOrigin, 'Access-Control-Request-Method': 'POST' },
  signal: timeout(),
});
assert.equal(preflight.headers.get('access-control-allow-origin'), clientOrigin);
assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
console.log('PASS credentialed CORS');

const session = await fetch(`${backend}/api/auth/get-session`, { signal: timeout() });
assert.equal(session.status, 200, 'Auth endpoint');
assert.equal(await session.json(), null);
console.log('PASS anonymous auth session');

const socket = await fetch(`${backend}/socket.io/?EIO=4&transport=polling`, {
  headers: { Origin: clientOrigin },
  signal: timeout(),
});
assert.equal(socket.status, 200, 'Socket.IO handshake');
assert.match(await socket.text(), /^0\{"sid":/);
console.log('PASS Socket.IO handshake');
