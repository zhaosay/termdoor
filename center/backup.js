const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cli = require('../lib/cli-ui');
const digest = (text) => crypto.createHash('sha256').update(text).digest('hex');

function validate(store) {
  if (!store || !['users', 'devices', 'invites'].every((key) => Array.isArray(store[key]))) throw new Error('backup invalid');
  if (!store.users.every((user) => typeof user.id === 'string' && typeof user.username === 'string' && /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(user.password))) throw new Error('backup invalid');
  if (!store.devices.every((device) => typeof device.id === 'string' && typeof device.owner === 'string' && Number.isInteger(device.port))) throw new Error('backup invalid');
  return store;
}
function read(file) {
  if (fs.statSync(file).size > 32 * 1024 * 1024) throw new Error('backup invalid');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function backup(dataDir, destination) {
  const store = validate(read(path.join(dataDir, 'store.json')));
  const payload = JSON.stringify(store);
  const snapshot = { format: 'termdoor-center-backup', version: 1, createdAt: new Date().toISOString(), sha256: digest(payload), store };
  fs.writeFileSync(destination, JSON.stringify(snapshot), { flag: 'wx', mode: 0o600 });
  return { users: store.users.length, devices: store.devices.length, invites: store.invites.length };
}
function restore(source, destination) {
  const snapshot = read(source);
  if (snapshot.format !== 'termdoor-center-backup' || snapshot.version !== 1 || snapshot.sha256 !== digest(JSON.stringify(snapshot.store))) throw new Error('backup invalid');
  validate(snapshot.store);
  // Restore into a new data directory; never overwrite a running center's store.
  fs.mkdirSync(destination, { mode: 0o700 });
  try { fs.writeFileSync(path.join(destination, 'store.json'), JSON.stringify(snapshot.store, null, 2), { flag: 'wx', mode: 0o600 }); }
  catch (error) { fs.rmdirSync(destination); throw error; }
  return { users: snapshot.store.users.length, devices: snapshot.store.devices.length, invites: snapshot.store.invites.length };
}
if (require.main === module) {
  try {
    const [action, source, destination] = process.argv.slice(2);
    if (!['backup', 'restore'].includes(action) || !source || !destination) throw new Error('backup usage');
    const counts = action === 'backup' ? backup(path.resolve(source), path.resolve(destination)) : restore(path.resolve(source), path.resolve(destination));
    cli.line(action === 'backup' ? 'Backup' : 'Restore', `完成 / Complete (${counts.users} accounts, ${counts.devices} devices)`);
  } catch (error) {
    cli.report(['backup invalid', 'backup usage'].includes(error.message) ? error : new Error('backup failed'));
    process.exitCode = 1;
  }
}
module.exports = { backup, restore };
