const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');

test('LAN terminal and local-only management remain protected', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'termdoor-local-test-'));
  const app = path.join(temporary, 'app'); fs.mkdirSync(app);
  for (const name of ['lib', 'public', 'server.js', 'package.json', 'version.json']) fs.cpSync(path.resolve(name), path.join(app, name), { recursive: true });
  fs.symlinkSync(path.resolve('node_modules'), path.join(app, 'node_modules'));
  const data = path.join(temporary, 'data/webcli'); fs.mkdirSync(data, { recursive: true });
  fs.writeFileSync(path.join(data, 'secondary-key.txt'), 'b'.repeat(32));
  const child = spawn(process.execPath, ['server.js'], { cwd: app, env: { ...process.env, PROJECT_PORT: '17703', WEBCLI_REMOTE_PORT: '17704', WEBCLI_NO_OPEN: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let errors = '';
  child.stderr.on('data', (buf) => { errors += buf; });
  t.after(() => { child.kill(); fs.rmSync(temporary, { recursive: true, force: true }); });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (buf) => { if (buf.toString().includes('open:')) resolve(); });
    child.once('exit', (code) => reject(new Error(`Local exited ${code}: ${errors}`)));
  });
  const token = fs.readFileSync(path.join(data, 'token.txt'), 'utf8');
  const get = (pathname, opts) => fetch(`http://localhost:17703${pathname}`, opts);
  assert.equal((await get('/api/online')).status, 401);
  const forged = await new Promise((resolve, reject) => {
    http.get(`http://localhost:17703/api/online?token=${token}`, { headers: { Host: 'evil.test' } }, (res) => { res.resume(); resolve(res.statusCode); }).on('error', reject);
  });
  assert.equal(forged, 403);
  assert.equal((await get(`/api/online?token=${token}`, { headers: { Origin: 'https://evil.test' } })).status, 403);
  const local = await get(`/api/online?token=${token}`); assert.equal(local.status, 200); assert.equal((await local.json()).configured, false);
  const html = await (await get(`/?token=${token}`)).text();
  assert.match(html, /id="online-button"/);
  assert.ok(html.indexOf('src="/base.js"') < html.indexOf('src="/app.js"'));
  for (const file of ['base.js', 'online.js']) assert.equal((await get(`/${file}`)).status, 200);
  assert.equal((await fetch(`http://localhost:17704/api/online?token=${token}&key=${'b'.repeat(32)}`)).status, 403);
  assert.equal((await fetch(`http://localhost:17704/api/sessions?token=${token}`)).status, 401);
  assert.equal((await fetch(`http://localhost:17704/api/sessions?token=${token}&key=${'b'.repeat(32)}`)).status, 200);
  const frpEndpoint = `/api/frp?token=${token}`;
  for (const field of ['serverAddr', 'token', 'proxyName']) {
    const input = { serverAddr: 'frp.example.com', serverPort: 7000, remotePort: 6050, proxyName: 'test', token: 'abcdefgh12345678' };
    input[field] += '\n[[proxies]]\nname="bad"';
    assert.equal((await get(frpEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).status, 400);
    assert.equal(fs.existsSync(path.join(data, 'frpc.toml')), false);
  }
  const ws = new WebSocket(`ws://localhost:17703/?token=${token}`, { headers: { Origin: 'http://localhost:17703' } });
  t.after(() => ws.terminate());
  const received = new Promise((resolve, reject) => {
    let output = '';
    ws.on('message', (chunk, binary) => {
      if (binary) { output += chunk.toString(); if (output.includes('TERMDoor_TEST_OK')) resolve(); }
      else if (JSON.parse(chunk).type === 'hello') ws.send(JSON.stringify({ type: 'input', data: "printf 'TERMDoor_TEST_%s\\n' OK\r" }));
    });
    ws.once('error', reject);
  });
  await received;
});
