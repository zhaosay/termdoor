const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');
const tls = require('tls');

test('a fresh device binds, writes usable tunnel files and restores after restart', async (t) => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'termdoor-bind-test-'));
  t.after(() => fs.rmSync(data, { recursive: true, force: true }));
  const source = fs.readFileSync(path.resolve('lib/online.js'), 'utf8');
  const requests = [];
  const processes = [];
  const heartbeats = [];
  let tunnelOnline = false;
  function load() {
    const module = { exports: {} };
    const context = vm.createContext({
      module, process, Buffer, URL, AbortSignal, console,
      setTimeout, clearTimeout, setInterval: (callback, ms) => { heartbeats.push(callback); return setInterval(callback, ms); }, clearInterval,
      fetch: async (url, options) => {
        requests.push({ url, body: JSON.parse(options.body), headers: options.headers });
        return { ok: true, json: async () => url.endsWith('/register')
          ? { id: 'c'.repeat(24), secret: 'd'.repeat(64), port: 16000, serverAddr: 'center.example.com', serverPort: 443 }
          : { ok: true, online: tunnelOnline } };
      },
      require: (id) => {
        if (id === './config') return { DATA_DIR: data, SECONDARY_KEY_FILE: path.join(data, 'secondary-key.txt') };
        if (id === './auth') return { TOKEN: 'a'.repeat(32), loadName: () => 'new computer' };
        if (id === './app-proxy') return { listApps: () => [{ id: 'aimini', name: 'aimini' }] };
        if (id === 'child_process') return {
          execFile: (file, args, callback) => callback(null, '0.71.0'),
          spawn: () => {
            const child = new EventEmitter();
            child.kill = () => { child.killed = true; child.emit('exit', 0); };
            processes.push(child); return child;
          },
        };
        return require(id);
      },
    });
    vm.runInContext(source, context, { filename: 'lib/online.js' });
    t.after(() => module.exports.stop());
    return module.exports;
  }
  const online = load();
  online.configure(async () => 19001);
  await assert.rejects(online.bind({ center: 'http://center.example.com', code: 'b'.repeat(16) }), /HTTPS/);
  const state = await online.bind({ center: 'https://center.example.com', code: 'b'.repeat(16) });
  assert.equal(state.configured, true);
  assert.equal(state.running, true);
  assert.ok(state.lastHeartbeat > 0);
  assert.equal(state.ready, false, 'a running process and heartbeat do not prove terminal reachability');
  assert.equal(state.phase, 'verifying');
  tunnelOnline = true;
  await heartbeats.at(-1)();
  assert.equal(online.status().ready, true);
  assert.equal(online.status().phase, 'online');
  const config = fs.readFileSync(path.join(data, 'online-frpc.toml'), 'utf8');
  assert.match(config, /\n\[\[proxies\]\]\n/);
  assert.match(config, /\nlocalPort = 19001\nremotePort = 16000\n/);
  assert.equal(fs.readFileSync(path.join(data, 'online-ca.pem'), 'utf8'), tls.rootCertificates.join('\n'));
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(data, 'online.json')).mode & 0o777, 0o600);
  assert.equal(requests[0].url, 'https://center.example.com/api/device/register');
  assert.equal(requests[1].headers.Authorization, `Bearer ${'d'.repeat(64)}`);
  assert.equal(requests[1].body.apps[0].id, 'aimini');
  assert.equal(JSON.stringify(state).includes('d'.repeat(64)), false);
  online.stop();
  const restored = load();
  restored.configure(async () => 19002);
  for (let i = 0; i < 100 && !restored.status().lastHeartbeat; i++) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(restored.status().lastHeartbeat > 0);
  assert.match(fs.readFileSync(path.join(data, 'online-frpc.toml'), 'utf8'), /\nlocalPort = 19002\n/);
  restored.disconnect();
  assert.equal(restored.status().ready, false);
  assert.equal(restored.status().configured, false);
  assert.ok(processes.every((child) => child.killed));
  assert.equal(fs.existsSync(path.join(data, 'online.json')), false);
  assert.equal(fs.existsSync(path.join(data, 'online-frpc.toml')), false);
});
