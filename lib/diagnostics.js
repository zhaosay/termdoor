const crypto = require('crypto');
const { VERSION_INFO } = require('./version');
const { listSessions, listConnections } = require('./pty-sessions');
const online = require('./online');
function snapshot() {
  const sessions = listSessions();
  const connections = listConnections();
  return { sessions: sessions.length, connections: connections.length, instanceId: VERSION_INFO.instanceId,
    revision: crypto.createHash('sha256').update(JSON.stringify({ sessions: sessions.map((s) => s.sid).sort(), connections: connections.map((c) => `${c.sid}:${c.connectedAt}`).sort() })).digest('hex') };
}
function report() {
  const state = online.status();
  return { generatedAt: new Date().toISOString(), version: VERSION_INFO.version,
    node: process.version, platform: process.platform, arch: process.arch,
    uptimeSeconds: Math.floor(process.uptime()), ...snapshot(),
    online: { configured: state.configured, phase: state.phase, ready: state.ready,
      lastHeartbeat: state.lastHeartbeat, errorCode: state.errorCode || null } };
}
let cached;
async function versions() {
  if (cached && Date.now() - cached.checkedAt < 300000) return cached;
  const response = await fetch('https://raw.githubusercontent.com/zhaosay/termdoor/main/version.json', { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('version check failed');
  const data = await response.json();
  if (!/^\d+\.\d+\.\d+$/.test(data.version)) throw new Error('version check failed');
  const current = VERSION_INFO.version.split('.').map(Number), latest = data.version.split('.').map(Number);
  let updateAvailable = false;
  for (let i = 0; i < 3; i++) { if (latest[i] !== current[i]) { updateAvailable = latest[i] > current[i]; break; } }
  cached = { current: VERSION_INFO.version, latest: data.version, updateAvailable, checkedAt: Date.now() };
  return cached;
}
module.exports = { snapshot, report, versions };
