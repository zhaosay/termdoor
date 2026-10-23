const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { DATA_DIR } = require('./config');

const FILE = path.join(DATA_DIR, 'apps.json');
function validate(app) {
  if (!app || !/^[a-z][a-z0-9-]{0,31}$/.test(app.id || '')
      || app.type !== 'aimini' || typeof app.name !== 'string' || !app.name.trim() || app.name.length > 40
      || !Number.isInteger(app.port) || app.port < 1 || app.port > 65535
      || typeof app.enabled !== 'boolean' || typeof app.keyFile !== 'string' || !path.isAbsolute(app.keyFile)) {
    throw new Error('invalid app configuration');
  }
  return { id: app.id, name: app.name.trim(), type: app.type, enabled: app.enabled, port: app.port, keyFile: app.keyFile };
}
function read(file = FILE) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(value)) throw new Error('invalid app configuration');
    return value;
  } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
function save(app, file = FILE) {
  const value = validate(app);
  const items = read(file);
  const index = items.findIndex((item) => item.id === value.id);
  if (index < 0) { if (items.length >= 10) throw new Error('application limit'); items.push(value); }
  else items[index] = value;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(items, null, 2) + '\n', { mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, file);
  return value;
}
async function probe(app) {
  if (!app.enabled) return { id: app.id, state: 'disabled' };
  let key;
  try { key = fs.readFileSync(app.keyFile, 'utf8').trim(); if (!key) throw new Error(); }
  catch { return { id: app.id, state: 'credentials', errorCode: 'TD-APP-002' }; }
  const started = Date.now();
  try {
    const stamp = String(Math.floor(Date.now() / 1000) + 60);
    const cookie = `aimini_session=${stamp}.${crypto.createHmac('sha256', key).update(stamp).digest('hex')}`;
    const authenticated = await new Promise((resolve, reject) => {
      const request = http.get({ host: '127.0.0.1', port: app.port, path: '/api/session', headers: { Host: 'aimini.gateway.invalid', Cookie: cookie } }, (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk; if (body.length > 4096) request.destroy(new Error('oversize')); });
        response.on('end', () => { try { resolve(response.statusCode === 200 && JSON.parse(body).authenticated === true); } catch { reject(new Error('invalid response')); } });
        response.on('error', reject);
      });
      request.setTimeout(3000, () => request.destroy(new Error('timeout')));
      request.on('error', reject);
    });
    return { id: app.id, state: authenticated ? 'ready' : 'credentials', latencyMs: Date.now() - started };
  } catch { return { id: app.id, state: 'unavailable', errorCode: 'TD-APP-003' }; }
}
module.exports = { read, save, validate, probe };
