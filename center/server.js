const errors = require('../public/errors');
const cli = require('../lib/cli-ui');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { db, save, digest, random, passwordMatches, secretMatches } = require('./store');
const { proxyHttp, proxyUpgrade } = require('./proxy');

const centerUrl = new URL(process.env.TERMDOOR_CENTER_URL || 'https://center.example.com');
if (centerUrl.protocol !== 'https:' || centerUrl.username || centerUrl.password || centerUrl.pathname !== '/' || centerUrl.search || centerUrl.hash || centerUrl.port) {
  cli.report('TERMDOOR_CENTER_URL must be an HTTPS origin on port 443', { fatal: true });
  process.exit(1);
}
const origin = centerUrl.origin;
const sessions = new Map();
const failures = new Map();
const liveSockets = new Map();
const TTL = 12 * 60 * 60 * 1000;
const headers = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};
function json(res, status, data, extra = {}) {
  res.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(errors.enrich(data, status)));
}
async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) throw new Error('Body too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}
function session(req) {
  const match = /(?:^|;\s*)td_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '');
  const hash = match && digest(match[1]);
  const item = sessions.get(hash);
  if (!item || item.expires < Date.now()) return null;
  return { ...item, hash };
}
function deviceAuth(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  return db.devices.find((d) => secretMatches(token, d.secretHash));
}
function sameOrigin(req) { return req.headers.origin === origin; }
function closeDevice(id) {
  for (const [socket, meta] of liveSockets) if (meta.device === id) socket.destroy();
}
function active(device) { return Date.now() - (device.lastSeen || 0) < 45000; }
async function available(device) {
  if (!active(device)) return false;
  try {
    const url = new URL(`http://127.0.0.1:${device.port}/api/sessions`);
    url.searchParams.set('token', device.token);
    url.searchParams.set('key', device.key);
    const result = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return result.ok;
  } catch { return false; }
}
function terminalRoute(req, user) {
  const match = /^\/d\/([a-f0-9]{24})(\/.*)$/.exec(req.url);
  if (!match) return null;
  const device = db.devices.find((d) => d.id === match[1] && d.owner === user.userId);
  return device ? { device, pathname: match[2] } : null;
}
const permitted = new Set(['/', '/index.html', '/app.js', '/token.js', '/helpers.js', '/upload.js', '/frp.js', '/online.js', '/base.js', '/termdoor.css', '/theme-init.js', '/icon-192.png', '/icon-512.png', '/api/name', '/api/version', '/api/sessions', '/api/connections', '/api/quick-commands', '/api/upload']);
function allowed(pathname) {
  return permitted.has(pathname) || /^\/vendor\/[a-zA-Z0-9.-]+$/.test(pathname);
}

async function handle(req, res) {
  const url = new URL(req.url, origin);
  if (url.pathname === '/api/device/register' && req.method === 'POST') {
    const input = await body(req);
    const invite = db.invites.find((i) => i.hash === digest(input.code) && i.expires > Date.now());
    if (!invite) return json(res, 401, { error: '设备接入码无效、已使用或已过期，请在「设备接入」页面重新生成' });
    if (db.devices.filter((d) => d.owner === invite.owner).length >= 100) return json(res, 409, { error: '设备数量已达上限' });
    if (!/^[a-f0-9]{32}$/.test(input.token || '') || !/^[A-Za-z0-9_-]{8,128}$/.test(input.key || '')) return json(res, 400, { error: '设备凭证无效' });
    let port = 16000;
    while (db.devices.some((d) => d.port === port)) port++;
    if (port > 16999) return json(res, 409, { error: '无可用端口' });
    const secret = random();
    const device = { id: random().slice(0, 24), owner: invite.owner, enrollmentId: invite.id, name: String(input.name || 'TermDoor').slice(0, 40), port, token: input.token, key: input.key, secretHash: digest(secret), lastSeen: 0 };
    db.devices.push(device);
    db.invites = db.invites.filter((i) => i !== invite && i.expires > Date.now());
    save();
    return json(res, 201, { id: device.id, secret, port, serverAddr: new URL(origin).hostname, serverPort: 443 });
  }
  if (url.pathname === '/api/device/heartbeat' && req.method === 'POST') {
    const device = deviceAuth(req);
    if (!device) return json(res, 401, { error: '设备已解绑' });
    const input = await body(req);
    device.lastSeen = Date.now();
    if (/^[a-f0-9]{32}$/.test(input.token || '') && /^[A-Za-z0-9_-]{8,128}$/.test(input.key || '')) {
      device.token = input.token;
      device.key = input.key;
      device.name = String(input.name || device.name).slice(0, 40);
    }
    save();
    return json(res, 200, { ok: true, online: await available(device) });
  }
  if (url.pathname === '/api/login' && req.method === 'POST') {
    if (!sameOrigin(req)) return json(res, 403, { error: '请求来源无效' });
    const ip = req.headers['x-real-ip'] || req.socket.remoteAddress;
    const now = Date.now();
    const rec = failures.get(ip);
    if (rec && rec.until > now && rec.count >= 10) return json(res, 429, { error: '尝试次数过多，请 5 分钟后重试' });
    // Count before scrypt so concurrent attempts cannot bypass throttling.
    failures.set(ip, { count: rec && rec.until > now ? rec.count + 1 : 1, until: now + 300000 });
    const input = await body(req);
    const user = db.users.find((u) => u.username === input.username);
    const candidate = typeof input.password === 'string' && input.password.length <= 256 ? input.password : '';
    const hash = user ? user.password : db.users[0]?.password;
    const matches = hash ? await passwordMatches(candidate, hash) : false;
    if (!user || !matches) return json(res, 401, { error: '用户名或密码错误' });
    failures.delete(ip);
    const token = random();
    sessions.set(digest(token), { userId: user.id, username: user.username, expires: now + TTL });
    return json(res, 200, { username: user.username }, { 'Set-Cookie': `td_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL / 1000}` });
  }
  if (['/', '/setup', '/setup.html', '/setup.js', '/setup.css', '/errors.js', '/center.js', '/center.css', '/vendor/zhaoui.css'].includes(url.pathname) && req.method === 'GET') {
    const filename = url.pathname === '/' ? 'index.html' : ['/setup', '/setup.html'].includes(url.pathname) ? 'setup.html' : url.pathname.slice(1);
    const target = filename === 'errors.js' ? path.join(__dirname, '../public/errors.js') : filename === 'vendor/zhaoui.css' ? path.join(__dirname, '../public/vendor/zhaoui.css') : filename === 'setup.css' ? path.join(__dirname, '../public/online-page.css') : path.join(__dirname, 'public', filename);
    const type = filename.endsWith('.html') ? 'text/html' : filename.endsWith('.css') ? 'text/css' : 'application/javascript';
    res.writeHead(200, { ...headers, 'Content-Type': `${type}; charset=utf-8` });
    return res.end(fs.readFileSync(target));
  }
  const user = session(req);
  if (!user) {
    if (url.pathname.startsWith('/d/') && req.method === 'GET' && !req.headers.upgrade) {
      res.writeHead(302, { ...headers, Location: '/' }); return res.end();
    }
    return json(res, 401, { error: '请先登录' });
  }
  if (!['GET', 'HEAD'].includes(req.method) && !sameOrigin(req)) return json(res, 403, { error: '请求来源无效' });
  if (url.pathname === '/api/me' && req.method === 'GET') return json(res, 200, { username: user.username });
  if (url.pathname === '/api/logout' && req.method === 'POST') {
    sessions.delete(user.hash);
    for (const [socket, meta] of liveSockets) if (meta.session === user.hash) socket.destroy();
    return json(res, 200, { ok: true }, { 'Set-Cookie': 'td_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });
  }
  if (url.pathname === '/api/password' && req.method === 'POST') {
    const input = await body(req);
    const account = db.users.find((u) => u.id === user.userId);
    if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 256) return json(res, 400, { error: '新密码需要 12 到 256 个字符' });
    if (!await passwordMatches(String(input.current || '').slice(0, 256), account.password)) return json(res, 401, { error: '当前密码错误' });
    account.password = await require('./store').passwordHash(input.password);
    save();
    for (const [hash, item] of sessions) if (item.userId === user.userId) sessions.delete(hash);
    for (const [socket, meta] of liveSockets) if (meta.owner === user.userId) socket.destroy();
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/api/devices' && req.method === 'GET') {
    const devices = await Promise.all(db.devices.filter((d) => d.owner === user.userId).map(async (d) => ({ id: d.id, name: d.name, enrollmentId: d.enrollmentId, lastSeen: d.lastSeen, online: await available(d) })));
    return json(res, 200, { devices });
  }
  if (url.pathname === '/api/invites' && req.method === 'POST') {
    db.invites = db.invites.filter((i) => i.expires > Date.now());
    if (db.invites.filter((i) => i.owner === user.userId).length >= 10) return json(res, 429, { error: '有效设备接入码过多，请使用已有接入码或等待过期后再生成' });
    const code = random().slice(0, 16);
    const id = random().slice(0, 24);
    const expires = Date.now() + 600000;
    db.invites.push({ id, hash: digest(code), owner: user.userId, expires });
    save(); return json(res, 201, { code, enrollmentId: id, expiresIn: 600, expiresAt: expires });
  }
  const removal = /^\/api\/devices\/([a-f0-9]{24})$/.exec(url.pathname);
  if (removal && req.method === 'DELETE') {
    const device = db.devices.find((d) => d.id === removal[1] && d.owner === user.userId);
    if (!device) return json(res, 404, { error: '设备不存在' });
    closeDevice(device.id);
    db.devices = db.devices.filter((d) => d !== device); save();
    return json(res, 200, { ok: true });
  }
  const terminal = terminalRoute(req, user);
  if (terminal) {
    const endpoint = new URL(terminal.pathname, origin).pathname;
    if (endpoint === '/api/auth-status') return json(res, 200, { enabled: false });
    if (endpoint === '/api/share') {
      const link = `${origin}/d/${terminal.device.id}/?token=center`;
      return json(res, 200, { url: link, qr: require('../lib/qr').toSvg(link) });
    }
    if (!allowed(endpoint)) return json(res, 403, { error: '此操作仅可在本机执行' });
    return proxyHttp(req, res, terminal.device, terminal.pathname, origin);
  }
  json(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(() => { if (!res.headersSent) json(res, 400, { error: '请求处理失败' }); else res.destroy(); });
});
server.on('upgrade', (req, socket, head) => {
  const user = session(req);
  const terminal = user && terminalRoute(req, user);
  if (!terminal || !sameOrigin(req) || new URL(terminal.pathname, origin).pathname !== '/') {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
  }
  proxyUpgrade(req, socket, head, terminal.device, terminal.pathname, origin, (connection) => {
    liveSockets.set(connection, { session: user.hash, owner: user.userId, device: terminal.device.id });
    connection.on('close', () => liveSockets.delete(connection));
  });
});

// Dedicated loopback-only frps plugin: every device may publish only its assigned port.
const plugin = http.createServer(async (req, res) => {
  try {
    const input = await body(req);
    const content = input.content || {};
    const info = input.op === 'Login' ? content : content.user || {};
    const device = db.devices.find((d) => d.id === info.user && secretMatches(info.metas?.secret, d.secretHash));
    let accepted = !!device;
    if (input.op === 'NewProxy') accepted = accepted && content.proxy_type === 'tcp' && content.remote_port === device.port && content.proxy_name === `${device.id}.terminal`;
    if (!['Login', 'NewProxy', 'Ping', 'NewWorkConn'].includes(input.op)) accepted = false;
    json(res, 200, accepted ? { unchange: true } : { reject: true, reject_reason: 'device not authorized' });
  } catch { json(res, 200, { reject: true, reject_reason: 'invalid request' }); }
});
setInterval(() => {
  for (const [hash, item] of sessions) if (item.expires < Date.now()) sessions.delete(hash);
  for (const [ip, item] of failures) if (item.until < Date.now()) failures.delete(ip);
  for (const [socket, meta] of liveSockets) if (!sessions.has(meta.session) || !db.devices.some((d) => d.id === meta.device)) socket.destroy();
}, 5000).unref();
server.listen(Number(process.env.TERMDOOR_CENTER_PORT || 17001), '127.0.0.1', () => { cli.heading('线上中心已就绪 / Center is ready'); cli.line('Center', origin); });
plugin.listen(Number(process.env.TERMDOOR_PLUGIN_PORT || 17002), '127.0.0.1');
