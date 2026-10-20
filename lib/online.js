const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const { DATA_DIR, SECONDARY_KEY_FILE } = require('./config');
const { TOKEN, loadName } = require('./auth');

const settingsFile = path.join(DATA_DIR, 'online.json');
const configFile = path.join(DATA_DIR, 'online-frpc.toml');
let settings;
try { settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch {}
let child;
let timer;
let retry;
let startListener;
let running = false;
let lastError = '';
let lastHeartbeat = 0;
let stopped = false;
function writePrivate(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(`${file}.tmp`, content, { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);
}
function key() {
  if (!fs.existsSync(SECONDARY_KEY_FILE)) writePrivate(SECONDARY_KEY_FILE, crypto.randomBytes(16).toString('hex'));
  return fs.readFileSync(SECONDARY_KEY_FILE, 'utf8').trim();
}
async function request(center, endpoint, data, secret) {
  const res = await fetch(center + endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
    body: JSON.stringify(data), signal: AbortSignal.timeout(15000), redirect: 'error',
  });
  const result = await res.json();
  if (!res.ok) { const err = new Error(result.error || `HTTP ${res.status}`); err.status = res.status; throw err; }
  return result;
}
async function frpcBinary() {
  const exe = os.platform() === 'win32' ? 'frpc.exe' : 'frpc';
  const candidates = [process.env.WEBCLI_FRPC_PATH, path.join(DATA_DIR, 'bin', exe), path.join(os.homedir(), 'frp', exe), exe].filter(Boolean);
  for (const file of candidates) {
    try { await promisify(execFile)(file, ['--version']); return file; } catch {}
  }
  // GitHub's release digest is checked before extracting or executing the binary.
  const platform = { darwin: 'darwin', linux: 'linux', win32: 'windows' }[os.platform()];
  const arch = { arm64: 'arm64', x64: 'amd64' }[os.arch()];
  if (!platform || !arch) throw new Error('请安装 frpc，并通过 WEBCLI_FRPC_PATH 指定路径');
  const name = `frp_0.71.0_${platform}_${arch}`;
  const ext = platform === 'windows' ? '.zip' : '.tar.gz';
  const release = await fetch('https://api.github.com/repos/fatedier/frp/releases/tags/v0.71.0', { signal: AbortSignal.timeout(15000) });
  if (!release.ok) throw new Error('无法获取 frpc 下载信息，请先手动安装 frpc');
  const asset = (await release.json()).assets.find((item) => item.name === name + ext);
  if (!asset || !/^sha256:[a-f0-9]{64}$/.test(asset.digest || '')) throw new Error('frpc 下载缺少可信校验信息');
  const response = await fetch(asset.browser_download_url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error('frpc 下载失败');
  const archive = Buffer.from(await response.arrayBuffer());
  if (`sha256:${crypto.createHash('sha256').update(archive).digest('hex')}` !== asset.digest) throw new Error('frpc 校验失败');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'termdoor-frpc-'));
  try {
    const file = path.join(temporary, 'frp' + ext); fs.writeFileSync(file, archive);
    await promisify(execFile)('tar', ['-xf', file, '-C', temporary]);
    const target = path.join(DATA_DIR, 'bin', exe); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(temporary, name, exe), target); fs.chmodSync(target, 0o700); return target;
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
function stop() {
  stopped = true; clearInterval(timer); clearTimeout(retry); running = false;
  if (child) { child.kill(); child = null; }
}
async function heartbeat() {
  if (!settings || stopped) return;
  try {
    await request(settings.center, '/api/device/heartbeat', { token: TOKEN, key: key(), name: loadName() }, settings.secret);
    lastHeartbeat = Date.now(); lastError = '';
  } catch (err) {
    lastError = err.message;
    if (err.status === 401) stop();
  }
}
async function start() {
  if (!settings || !startListener) return;
  stopped = false;
  try {
    const binary = await frpcBinary();
    const port = await startListener();
    const caFile = path.join(DATA_DIR, 'online-ca.pem');
    writePrivate(caFile, require('tls').rootCertificates.join('\n'));
    const config = [
      `serverAddr = ${JSON.stringify(settings.serverAddr)}`, `serverPort = ${settings.serverPort}`,
      `user = ${JSON.stringify(settings.id)}`, `metadatas.secret = ${JSON.stringify(settings.secret)}`,
      'transport.protocol = "wss"', 'transport.tls.enable = true', 'loginFailExit = false',
      `transport.tls.trustedCaFile = ${JSON.stringify(caFile)}`,
      `log.to = ${JSON.stringify(path.join(DATA_DIR, 'online-frpc.log'))}`,
      'log.maxDays = 7', 'log.disablePrintColor = true',
      '[[proxies]]', 'name = "terminal"', 'type = "tcp"', 'localIP = "127.0.0.1"',
      `localPort = ${port}`, `remotePort = ${settings.port}`, '',
    ].join('\n');
    writePrivate(configFile, config);
    if (stopped) return;
    const output = fs.openSync(path.join(DATA_DIR, 'online-frpc.log'), 'a', 0o600);
    child = spawn(binary, ['-c', configFile], { windowsHide: true, stdio: ['ignore', output, output] });
    fs.closeSync(output);
    child.on('error', (err) => { lastError = err.message; });
    child.on('exit', () => {
      running = false; child = null;
      if (!stopped) retry = setTimeout(() => start(), 10000);
    });
    running = true;
    await heartbeat();
    clearInterval(timer); timer = setInterval(heartbeat, 15000);
  } catch (err) {
    lastError = err.message; running = false;
    if (!stopped) retry = setTimeout(() => start(), 30000);
  }
}
function configure(callback) { startListener = callback; if (settings) start(); }
function status() {
  return { configured: !!settings, center: settings?.center || '', deviceId: settings?.id || '', running, lastHeartbeat, error: lastError };
}
async function bind(input) {
  const url = new URL(input.center);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('中心地址必须是 HTTPS 域名，例如 https://center.example.com');
  if (!/^[a-f0-9]{16}$/.test(input.code || '')) throw new Error('请输入有效的绑定码');
  if (settings) throw new Error('请先断开当前线上连接，再绑定新的中心');
  await frpcBinary();
  const result = await request(url.origin, '/api/device/register', { code: input.code, token: TOKEN, key: key(), name: loadName() });
  if (!/^[a-f0-9]{24}$/.test(result.id) || !/^[a-f0-9]{64}$/.test(result.secret) || !Number.isInteger(result.port) || result.port < 16000 || result.port > 16999 || result.serverAddr !== url.hostname || result.serverPort !== 443) throw new Error('中心返回了无效的设备配置');
  settings = { ...result, center: url.origin };
  writePrivate(settingsFile, JSON.stringify(settings, null, 2));
  await start(); return status();
}
function disconnect() {
  stop(); settings = null; lastHeartbeat = 0; lastError = '';
  for (const file of [settingsFile, configFile]) { try { fs.unlinkSync(file); } catch {} }
  return status();
}
module.exports = { configure, status, bind, disconnect, stop };
