const { test } = require('node:test');
const assert = require('node:assert/strict');
const status = require('../center/public/device-status');
const errors = require('../public/errors');

test('connection diagnostics distinguish heartbeat, tunnel authentication and application failures', () => {
  const cases = [
    [{ heartbeat: false, online: false }, 'device heartbeat offline'],
    [{ heartbeat: true, online: false, tunnel: { state: 'blocked' } }, 'device tunnel blocked'],
    [{ heartbeat: true, online: false, tunnel: { state: 'unavailable' } }, 'device tunnel unavailable'],
    [{ heartbeat: true, online: true }, null],
  ];
  for (const [device, key] of cases) {
    assert.equal(status.describe(device).key, key);
    if (key) assert.match(errors.format(key), /TD-CONNECT-00[1-3]/);
  }
  assert.equal(status.application(undefined), 'application disabled');
  for (const state of ['disabled', 'credentials', 'unavailable']) {
    assert.match(errors.format(status.application({ health: { state } })), /TD-CONNECT-00[4-6]/);
  }
  assert.equal(status.application({ health: { state: 'ready' } }), null);
});
