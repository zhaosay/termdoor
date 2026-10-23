const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const errors = require('../public/errors');
const cli = require('../lib/cli-ui');

test('error catalog has unique stable codes and bilingual actionable messages', () => {
  const codes = new Set();
  const keys = new Set();
  for (const entry of errors.catalog) {
    assert.match(entry.code, /^TD-[A-Z]+-\d{3}$/);
    assert.ok(!codes.has(entry.code), entry.code);
    assert.ok(!keys.has(entry.key), entry.key);
    codes.add(entry.code); keys.add(entry.key);
    assert.match(entry.zh, /[\u4e00-\u9fff]/);
    assert.match(entry.en, /[a-zA-Z]/);
    assert.ok(entry.hint.includes(' / '));
  }
  for (const file of ['lib/routes.js', 'center/server.js']) {
    const source = fs.readFileSync(file, 'utf8');
    for (const [, key] of source.matchAll(/\{ error: '([^']+)'/g)) {
      assert.ok(keys.has(key), `${file}: missing catalog entry for ${key}`);
    }
  }
});

test('API enrichment preserves legacy keys and provides safe bilingual presentation', () => {
  const data = errors.enrich({ error: 'invalid key' }, 401);
  assert.equal(data.error, 'invalid key');
  assert.equal(data.errorCode, 'TD-AUTH-002');
  assert.match(data.errorText, /本机二次密钥.*Invalid local secondary key/);
  assert.equal(errors.format(new Error(data.errorText)), data.errorText);
  assert.equal(errors.enrich({ ok: true }, 200).errorCode, undefined);
  assert.doesNotMatch(errors.format(new Error('private-token-secret')), /private-token-secret/);
  assert.equal(errors.describe({ code: 'EADDRINUSE' }).errorCode, 'TD-SYS-001');
});

test('CLI colors respect NO_COLOR and redirected logs remain plain', () => {
  const run = (env) => {
    const config = { ...process.env, TERM: 'xterm-256color', ...env };
    if (env.NO_COLOR === null) delete config.NO_COLOR;
    return spawnSync(process.execPath, ['lib/cli-ui.js', 'error', 'EADDRINUSE'], {
      cwd: process.cwd(), env: config, encoding: 'utf8',
    });
  };
  const plain = run({ NO_COLOR: '1', FORCE_COLOR: '1' });
  assert.equal(plain.status, 0);
  assert.doesNotMatch(plain.stderr, /\x1b\[/);
  assert.match(plain.stderr, /TD-SYS-001/);
  assert.match(plain.stderr, /Port is already in use/);
  assert.match(plain.stderr, /端口已被占用/);
  const colored = run({ FORCE_COLOR: '1', NO_COLOR: null });
  assert.match(colored.stderr, /\x1b\[/);
});

test('access address selection excludes loopback, link-local and duplicates', () => {
  assert.deepEqual(cli.lanAddresses({
    lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
    ethernet: [{ family: 'IPv4', internal: false, address: '169.254.8.39' }],
    wifi: [{ family: 'IPv4', internal: false, address: '192.168.1.5' }],
    duplicate: [{ family: 'IPv4', internal: false, address: '192.168.1.5' }],
  }), ['192.168.1.5']);
});
