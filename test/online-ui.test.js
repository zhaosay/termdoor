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
    const expected = { 200: /可选功能/, 401: /访问令牌/, 403: /localhost/, 404: /更新并重启/ };
    assert.match(element('online-info').textContent, expected[status]);
  });
}
