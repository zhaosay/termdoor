const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { proxyApp, configuredApps } = require('../lib/app-proxy');

test('application gateway confines targets and keeps credentials on the device', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'td-app-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const keyFile = path.join(dir, 'key'); fs.writeFileSync(keyFile, 'private-hub-key');
  let observed;
  const hub = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    observed = { headers: req.headers, url: req.url, body };
    res.setHeader('Set-Cookie', 'aimini_session=private');
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<script src="/static/app.js"></script>'); }
    else if (req.url === '/static/app.js') { res.setHeader('Content-Type', 'application/javascript'); res.end('console.log("application")'); }
    else { res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}'); }
  });
  await new Promise((r) => hub.listen(0, '127.0.0.1', r));
  t.after(() => hub.close());
  const apps = [{ id: 'aimini', enabled: true, type: 'aimini', port: hub.address().port, keyFile }];
  const configFile = path.join(dir, 'apps.json'); fs.writeFileSync(configFile, JSON.stringify(apps));
  assert.equal(configuredApps(configFile).length, 1);
  fs.writeFileSync(configFile, JSON.stringify([{ ...apps[0], enabled: false }, { ...apps[0], port: 999999 }]));
  assert.deepEqual(configuredApps(configFile), []);
  const gateway = http.createServer((req, res) => proxyApp(req, res, new URL(req.url, 'http://gateway'), apps));
  await new Promise((r) => gateway.listen(0, '127.0.0.1', r));
  t.after(() => gateway.close());
  const base = `http://127.0.0.1:${gateway.address().port}`;
  const page = await fetch(base + '/apps/aimini/?token=terminal-secret&key=secondary-secret');
  assert.match(await page.text(), /src="\/apps\/aimini\/static\/app.js"/);
  assert.equal(page.headers.get('set-cookie'), null);
  assert.equal(observed.url, '/');
  assert.equal(observed.headers.host, 'aimini.gateway.invalid', 'remote access must never look like local auto-login');
  const cookie = observed.headers.cookie.match(/^aimini_session=(\d+)\.([a-f0-9]+)$/);
  assert.equal(cookie[2], crypto.createHmac('sha256', 'private-hub-key').update(cookie[1]).digest('hex'));
  const action = await fetch(base + '/apps/aimini/api/tasks?token=secret', { method: 'POST', headers: { Cookie: 'td_session=browser-secret', Authorization: 'Bearer browser-secret', Origin: 'https://center.test', 'X-Aimini-Request': '1', 'Content-Type': 'application/json' }, body: '{"template":"project_check"}' });
  assert.equal(action.status, 200);
  assert.equal(action.headers.get('content-encoding'), 'gzip');
  assert.deepEqual(await action.json(), { ok: true });
  assert.equal(action.headers.get('cache-control'), 'no-store');
  assert.equal(observed.url, '/api/tasks');
  assert.equal(observed.body, '{"template":"project_check"}');
  assert.equal(observed.headers.origin, 'http://aimini.gateway.invalid');
  assert.equal(observed.headers['x-aimini-request'], '1');
  assert.equal(observed.headers.authorization, undefined);
  assert.ok(!JSON.stringify(observed).includes('browser-secret'));
  const asset = await fetch(base + '/apps/aimini/static/app.js');
  assert.equal(asset.headers.get('cache-control'), 'private, max-age=300');
  assert.equal(asset.headers.get('content-encoding'), 'gzip');
  assert.match(await asset.text(), /application/);
  assert.equal((await fetch(base + '/apps/unconfigured/')).status, 404);
  fs.unlinkSync(keyFile);
  assert.equal((await fetch(base + '/apps/aimini/')).status, 503);
});
