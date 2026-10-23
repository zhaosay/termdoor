const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');
const WebSocket = require('ws');

test('center login, binding, private proxy, authorization and revocation', async (t) => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'termdoor-center-test-'));
  const env = { ...process.env, TERMDOOR_CENTER_DATA: data, TERMDOOR_CENTER_PORT: '17701', TERMDOOR_PLUGIN_PORT: '17702', TERMDOOR_CENTER_URL: 'https://center.test' };
  execFileSync(process.execPath, ['center/admin.js', 'create-user', 'tester'], { env });
  execFileSync(process.execPath, ['center/admin.js', 'create-user', 'other'], { env });
  const password = fs.readFileSync(path.join(data, 'tester-credentials.txt'), 'utf8').match(/Password: (.*)/)[1];
  const otherPassword = fs.readFileSync(path.join(data, 'other-credentials.txt'), 'utf8').match(/Password: (.*)/)[1];
  const child = spawn(process.execPath, ['center/server.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { child.kill(); fs.rmSync(data, { recursive: true, force: true }); });
  await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('exit', (code) => reject(new Error(`Center exited ${code}`))); });
  let cookie = '';
  for (const asset of ['/setup', '/setup.js', '/setup.css']) {
    const response = await fetch(`http://127.0.0.1:17701${asset}`);
    assert.equal(response.status, 200);
    if (asset === '/setup') assert.match(await response.text(), /设备接入码/);
  }
  async function call(endpoint, method = 'GET', input, custom = {}) {
    const response = await fetch(`http://127.0.0.1:17701${endpoint}`, { method, headers: { Origin: 'https://center.test', Cookie: cookie, 'Content-Type': 'application/json', ...custom }, body: input ? JSON.stringify(input) : undefined, redirect: 'manual' });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  assert.equal((await call('/api/devices')).status, 401);
  assert.equal((await call('/api/login', 'POST', { username: 'tester', password }, { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await call('/api/login', 'POST', { username: 'tester', password: 'bad' })).status, 401);
  const login = await call('/api/login', 'POST', { username: 'tester', password });
  assert.equal(login.status, 200); assert.match(login.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
  cookie = login.headers.get('set-cookie').split(';')[0];
  const { code, enrollmentId, expiresAt } = (await call('/api/invites', 'POST')).data;
  assert.match(enrollmentId, /^[a-f0-9]{24}$/);
  assert.ok(expiresAt > Date.now());
  const creds = { code, name: 'test machine', token: 'a'.repeat(32), key: 'b'.repeat(32) };
  const device = (await call('/api/device/register', 'POST', creds)).data;
  assert.ok(device.secret); assert.equal((await call('/api/device/register', 'POST', creds)).status, 401);
  const mock = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://test');
    assert.equal(url.searchParams.get('token'), creds.token); assert.equal(url.searchParams.get('key'), creds.key);
    assert.equal(req.headers.cookie, undefined);
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<script src="/app.js"></script>'); }
    else { res.setHeader('Content-Type', 'application/json'); res.end('{"sessions":[]}'); }
  });
  const wss = new WebSocket.Server({ server: mock }); wss.on('connection', (ws) => ws.on('message', (message) => ws.send(message)));
  await new Promise((resolve) => mock.listen(device.port, '127.0.0.1', resolve));
  t.after(() => { wss.close(); mock.close(); });
  assert.equal((await call('/api/device/heartbeat', 'POST', { ...creds, apps: [{ id: 'aimini', name: 'aimini' }] }, { Authorization: `Bearer ${device.secret}` })).data.online, true);
  const list = await call('/api/devices');
  assert.equal(list.data.devices[0].online, true); assert.ok(!JSON.stringify(list.data).includes(device.secret)); assert.ok(!JSON.stringify(list.data).includes(creds.token));
  assert.equal(list.data.devices[0].enrollmentId, enrollmentId);
  assert.equal(list.data.devices[0].apps[0].id, 'aimini');
  assert.equal((await call(`/d/${device.id}/apps/aimini/api/state`)).status, 200);
  const proxied = await fetch(`http://127.0.0.1:17701/d/${device.id}/?token=center`, { headers: { Cookie: cookie } });
  assert.match(await proxied.text(), new RegExp(`/d/${device.id}/app.js`));
  assert.equal((await call(`/d/${device.id}/api/frp`)).status, 403);
  async function plugin(op, content) {
    return (await fetch('http://127.0.0.1:17702/', { method: 'POST', body: JSON.stringify({ op, content }) })).json();
  }
  const info = { user: device.id, metas: { secret: device.secret } };
  assert.equal((await plugin('Login', info)).unchange, true);
  assert.equal((await plugin('Login', { ...info, metas: { secret: 'wrong' } })).reject, true);
  const proxy = { user: info, proxy_type: 'tcp', proxy_name: `${device.id}.terminal`, remote_port: device.port };
  assert.equal((await plugin('NewProxy', proxy)).unchange, true);
  assert.equal((await plugin('NewProxy', { ...proxy, remote_port: device.port + 1 })).reject, true);
  const other = await call('/api/login', 'POST', { username: 'other', password: otherPassword });
  assert.equal((await call(`/d/${device.id}/api/sessions`, 'GET', null, { Cookie: other.headers.get('set-cookie').split(';')[0] })).status, 404);
  assert.equal((await call(`/d/${device.id}/apps/aimini/api/state`, 'GET', null, { Cookie: other.headers.get('set-cookie').split(';')[0] })).status, 404);
  assert.equal((await call(`/d/${device.id}/apps/aimini/api/tasks`, 'POST', {}, { Origin: 'https://evil.test' })).status, 403);
  const ws = new WebSocket(`ws://127.0.0.1:17701/d/${device.id}/?token=center`, { headers: { Cookie: cookie, Origin: 'https://center.test' } });
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  const echoed = new Promise((resolve) => ws.once('message', (message) => resolve(message.toString())));
  ws.send('terminal input'); assert.equal(await echoed, 'terminal input');
  const closed = new Promise((resolve) => ws.once('close', resolve));
  assert.equal((await call(`/api/devices/${device.id}`, 'DELETE')).status, 200);
  await closed;
  assert.equal((await plugin('Login', info)).reject, true);
  assert.equal((await call('/api/device/heartbeat', 'POST', creds, { Authorization: `Bearer ${device.secret}` })).status, 401);
  assert.equal((await call('/api/logout', 'POST')).status, 200);
  assert.equal((await call('/api/devices')).status, 401);
});
