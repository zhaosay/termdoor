const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { backup, restore } = require('../center/backup');

test('center snapshot restores accounts and devices without overwriting existing data', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'termdoor-backup-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const data = path.join(temp, 'data');
  execFileSync(process.execPath, ['center/admin.js', 'create-user', 'tester'], { env: { ...process.env, TERMDOOR_CENTER_DATA: data } });
  const storeFile = path.join(data, 'store.json');
  const store = JSON.parse(fs.readFileSync(storeFile));
  store.devices.push({ id: 'a'.repeat(24), owner: store.users[0].id, port: 16000, secretHash: 'b'.repeat(64), token: 'c'.repeat(32), key: 'd'.repeat(32) });
  fs.writeFileSync(storeFile, JSON.stringify(store));
  const snapshot = path.join(temp, 'backup.json');
  assert.deepEqual(backup(data, snapshot), { users: 1, devices: 1, invites: 0 });
  assert.throws(() => backup(data, snapshot), /EEXIST/);
  const restored = path.join(temp, 'restored');
  restore(snapshot, restored);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(restored, 'store.json'))), store);
  assert.throws(() => restore(snapshot, restored), /EEXIST/);
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(snapshot).mode & 0o777, 0o600);
    assert.equal(fs.statSync(restored).mode & 0o777, 0o700);
  }
  const password = fs.readFileSync(path.join(data, 'tester-credentials.txt'), 'utf8').match(/Password: (.*)/)[1];
  const verified = execFileSync(process.execPath, ['-e', "const s=require('./center/store');s.passwordMatches(process.env.TASK_BACKUP_PASSWORD,s.db.users[0].password).then(ok=>{if(!ok)process.exit(1)})"], { env: { ...process.env, TERMDOOR_CENTER_DATA: restored, TASK_BACKUP_PASSWORD: password } });
  assert.equal(verified.length, 0);
  const corrupt = JSON.parse(fs.readFileSync(snapshot)); corrupt.store.users[0].username = 'tampered';
  const corrupted = path.join(temp, 'corrupt.json'); fs.writeFileSync(corrupted, JSON.stringify(corrupt));
  assert.throws(() => restore(corrupted, path.join(temp, 'bad')), /backup invalid/);
  assert.equal(fs.existsSync(path.join(temp, 'bad')), false);
});
