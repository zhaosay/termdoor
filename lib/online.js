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
let phase = settings ? 'preparing' : 'idle';
let terminalReady = false;
let binding = false;
let generation = 0;
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
  terminalReady = false;
  if (child) { child.kill(); child = null; }
}
async function heartbeat() {
  if (!settings || stopped) return;
  const current = settings;
  try {
    const result = await request(current.center, '/api/device/heartbeat', { token: TOKEN, key: key(), name: loadName() }, current.secret);
    if (settings !== current || stopped) return;
    lastHeartbeat = Date.now(); lastError = '';
    terminalReady = result.online === true && running;
    phase = terminalReady ? 'online' : 'verifying';
  } catch (err) {
    if (settings !== current || stopped) return;
    terminalReady = false;
    lastError = err.message;
    phase = 'error';
    if (err.status === 401) stop();
  }
}
async function start() {
  if (!settings || !startListener) return;
  stopped = false;
  const current = settings;
  try {
    phase = 'preparing'; terminalReady = false;
    const binary = await frpcBinary();
    if (settings !== current || stopped) return;
    phase = 'connecting';
    const port = await startListener();
    if (settings !== current || stopped) return;
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
    const spawned = child;
    child.on('error', (err) => { if (child !== spawned) return; lastError = err.message; terminalReady = false; phase = 'error'; });
    child.on('exit', () => {
      if (child !== spawned) return;
      running = false; child = null; terminalReady = false;
      if (!stopped) phase = 'reconnecting';
      if (!stopped) retry = setTimeout(() => start(), 10000);
    });
    running = true;
    await heartbeat();
    clearInterval(timer);
    if (!stopped) timer = setInterval(heartbeat, 15000);
  } catch (err) {
    if (settings !== current || stopped) return;
    lastError = err.message; running = false; terminalReady = false; phase = 'error';
    if (!stopped) retry = setTimeout(() => start(), 30000);
  }
}
function configure(callback) { startListener = callback; if (settings) start(); }
function status() {
  return { configured: !!settings, center: settings?.center || '', deviceId: settings?.id || '', deviceName: loadName(), running, lastHeartbeat, phase, ready: terminalReady && running && Date.now() - lastHeartbeat < 45000, error: lastError };
}
async function bind(input) {
  const url = new URL(input.center);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('中心地址必须是 HTTPS 域名，例如 https://center.example.com');
  if (!/^[a-f0-9]{16}$/.test(input.code || '')) throw new Error('设备接入码应为 16 位字符，请在线上中心的「设备接入」页面生成');
  if (settings) throw new Error('请先断开当前线上连接，再绑定新的中心');
  if (binding) throw new Error('正在接入设备，请等待当前操作完成');
  binding = true; lastError = ''; phase = 'preparing';
  const attempt = generation;
  try {
    await frpcBinary();
    if (generation !== attempt) throw new Error('接入已取消');
    phase = 'registering';
    const result = await request(url.origin, '/api/device/register', { code: input.code, token: TOKEN, key: key(), name: loadName() });
    if (generation !== attempt) throw new Error('接入已取消，请在中心检查并清理刚登记的设备');
    if (!/^[a-f0-9]{24}$/.test(result.id) || !/^[a-f0-9]{64}$/.test(result.secret) || !Number.isInteger(result.port) || result.port < 16000 || result.port > 16999 || result.serverAddr !== url.hostname || result.serverPort !== 443) throw new Error('中心返回了无效的设备配置');
    settings = { ...result, center: url.origin };
    writePrivate(settingsFile, JSON.stringify(settings, null, 2));
    await start(); return status();
  } catch (err) {
    if (generation === attempt) { lastError = err.message; phase = 'error'; }
    throw err;
  } finally { binding = false; }
}
function disconnect() {
  generation++;
  stop(); settings = null; lastHeartbeat = 0; lastError = '';
  phase = 'idle';
  for (const file of [settingsFile, configFile]) { try { fs.unlinkSync(file); } catch {} }
  return status();
}
module.exports = { configure, status, bind, disconnect, stop };
