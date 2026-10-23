const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

for (const status of [200, 401, 403, 404]) {
  test(`online entry remains visible and explains HTTP ${status}`, async () => {
    const elements = new Map();
    const element = (id) => {
      if (!elements.has(id)) elements.set(id, { hidden: true, disabled: false, value: '', textContent: '', open: false, showModal() { this.open = true; } });
      return elements.get(id);
    };
    const context = vm.createContext({
      document: { getElementById: element },
      terminalFetch: async () => ({ status, ok: status === 200, json: async () => ({ configured: false }) }),
    });
    vm.runInContext(fs.readFileSync('public/online.js', 'utf8'), context);
    vm.runInContext('initOnline({ authQuery: "token=test", closeAllDropdowns: () => {} })', context);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(element('online-row').hidden, false);
    assert.equal(typeof element('online-button').onclick, 'function');
    await element('online-button').onclick();
    assert.equal(element('online-dialog').open, true);
    assert.equal(element('online-bind').disabled, status !== 200);
    const expected = { 200: /设备接入码/, 401: /访问令牌/, 403: /localhost/, 404: /更新并重启/ };
    assert.match(element('online-info').textContent, expected[status]);
  });
}

test('terminal opens the dedicated page with credentials in session storage, not its URL', () => {
  const row = {}, opener = {};
  let transferred, destination;
  const context = vm.createContext({
    document: { getElementById: (id) => ({ 'online-row': row, 'online-button': opener }[id] || null) },
    TERMDoorBase: '', sessionStorage: { setItem: (key, value) => { transferred = { key, value }; } },
    location: { assign: (url) => { destination = url; } },
  });
  vm.runInContext(fs.readFileSync('public/online.js', 'utf8'), context);
  vm.runInContext('initOnline({authQuery: "token=local-test&key=secondary-test", closeAllDropdowns: () => {}})', context);
  opener.onclick();
  assert.equal(destination, '/online.html');
  assert.equal(transferred.key, 'webcli-enrollment-auth');
  assert.equal(transferred.value, 'token=local-test&key=secondary-test');
  assert.equal(row.hidden, false);
});
