const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const registry = require('../lib/app-registry');

test('local application registry validates, preserves disabled apps and probes without secrets', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'td-registry-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'apps.json'), keyFile = path.join(dir, 'access.key');
  fs.writeFileSync(keyFile, 'private-value');
  const app = { id: 'hub', name: 'Hub', type: 'aimini', port: 8317, enabled: true, keyFile };
  for (const invalid of [{ ...app, port: 0 }, { ...app, port: 65536 }, { ...app, keyFile: '../key' }, { ...app, id: '../other' }, { ...app, type: 'http' }]) assert.throws(() => registry.save(invalid, file));
  registry.save(app, file); registry.save({ ...app, enabled: false }, file);
  assert.equal(registry.read(file).length, 1);
  assert.equal((await registry.probe(registry.read(file)[0])).state, 'disabled');
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal((await registry.probe({ ...app, keyFile: path.join(dir, 'missing') })).state, 'credentials');
  let authenticated = true;
  const server = http.createServer((req, res) => {
    assert.equal(req.url, '/api/session'); assert.match(req.headers.cookie, /^aimini_session=/);
    assert.equal(req.headers.host, 'aimini.gateway.invalid');
    res.end(JSON.stringify({ authenticated }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const result = await registry.probe({ ...app, port: server.address().port });
  assert.equal(result.state, 'ready'); assert.ok(!JSON.stringify(result).includes('private-value'));
  authenticated = false;
  assert.equal((await registry.probe({ ...app, port: server.address().port })).state, 'credentials');
  await new Promise((resolve) => server.close(resolve));
  assert.equal((await registry.probe({ ...app, port: server.address()?.port || 1 })).state, 'unavailable');
});
