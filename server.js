const cli = require('./lib/cli-ui');
// Dependency and asset loading can fail before normal teardown is available.
function startupError(err) { cli.report(err, { fatal: true }); process.exit(1); }
process.on('uncaughtException', startupError);
const http = require('http');
const https = require('https');
const os = require('os');
const fs = require('fs');
const { execFileSync, execFile } = require('child_process');
const WebSocket = require('ws');
const {
  PORT, REMOTE_PORT, DATA_DIR, PID_FILE, USE_TLS, TLS_KEY_FILE, TLS_CERT_FILE,
} = require('./lib/config');
const { TOKEN, registerRemotePort } = require('./lib/auth');
const online = require('./lib/online');
const { createRequestHandler, cleanupOldUploads } = require('./lib/routes');
const {
  handleUpgrade, shutdownAll, startHeartbeat, startTitlePoll,
} = require('./lib/pty-sessions');
const { VERSION_INFO } = require('./lib/version');
const { cleanupOldLogs } = require('./lib/session-log');
const qr = require('./lib/qr');

// Self-signed TLS is opt-in. It is not only about encrypting the LAN traffic:
// navigator.clipboard, service workers and installable PWAs all require a
// secure context, so several features only fully work under https.
function loadTlsOptions() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(TLS_KEY_FILE) && fs.existsSync(TLS_CERT_FILE)) {
    return { key: fs.readFileSync(TLS_KEY_FILE), cert: fs.readFileSync(TLS_CERT_FILE) };
  }
  const hostname = os.hostname();
  const mdns = hostname.endsWith('.local') ? hostname : `${hostname}.local`;
  const alt = ['DNS:localhost', `DNS:${hostname}`, `DNS:${mdns}`, 'IP:127.0.0.1'];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) alt.push(`IP:${net.address}`);
    }
  }
  cli.notice('正在准备 HTTPS 证书', 'Preparing an HTTPS certificate...');
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '3650',
    '-keyout', TLS_KEY_FILE, '-out', TLS_CERT_FILE,
    '-subj', `/CN=${mdns}`,
    '-addext', `subjectAltName=${alt.join(',')}`,
  ], { stdio: 'ignore' });
  fs.chmodSync(TLS_KEY_FILE, 0o600);
  return { key: fs.readFileSync(TLS_KEY_FILE), cert: fs.readFileSync(TLS_CERT_FILE) };
}

// Opt-out for headless boxes (launchd/systemd/SSH sessions with no display)
// where popping a browser would just fail or make no sense.
function openBrowser(url) {
  if (process.env.WEBCLI_NO_OPEN === '1') return;
  const [cmd, args] = os.platform() === 'darwin' ? ['open', [url]]
    : os.platform() === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
    : ['xdg-open', [url]];
  execFile(cmd, args, () => {}); // best-effort: no display / no browser is not fatal
}

const handler = createRequestHandler();
let tlsActive = USE_TLS;

// One factory for every listener, so the main port and the optional remote
// port (see lib/config.js) serve exactly the same app.
const wss = new WebSocket.Server({ noServer: true });
function createListener(plainHttp = false) {
  let srv;
  if (tlsActive && !plainHttp) {
    try {
      srv = https.createServer(loadTlsOptions(), handler);
    } catch (err) {
      cli.report('TLS setup failed');
      tlsActive = false;
    }
  }
  if (!srv) srv = http.createServer(handler);
  srv.on('error', (err) => {
    cli.report(err);
    if (srv === server) shutdown(1);
  });
  srv.on('upgrade', (req, socket, head) => {
    handleUpgrade(req, socket, head, wss);
  });
  return srv;
}
const server = createListener();
let onlineListener;
online.configure(async () => {
  if (onlineListener) return onlineListener.address().port;
  onlineListener = createListener(true);
  await new Promise((resolve, reject) => {
    onlineListener.once('error', reject);
    onlineListener.listen(0, '127.0.0.1', resolve);
  });
  const port = onlineListener.address().port;
  registerRemotePort(port);
  return port;
});

const heartbeat = startHeartbeat(wss);
startTitlePoll();

function shutdown(code = 0) {
  cli.line('Bye :)', code === 0 ? '已安全退出 / Shut down safely.' : '服务已停止，请检查错误码 / Service stopped; check the error code.', code === 0 ? '32' : '31');
  online.stop();
  clearInterval(heartbeat);
  shutdownAll();
  try {
    if (fs.readFileSync(PID_FILE, 'utf8').trim() === String(process.pid)) fs.unlinkSync(PID_FILE);
  } catch {}
  process.exit(code);
}
process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));

// Route handlers already guard against throwing (createRequestHandler wraps
// its dispatch in try/catch), but anything that still slips through — a bug
// in a future route, an async callback with no .catch — must not leave the
// process in Node's documented-as-unsafe "resume after uncaughtException"
// state. Log it and go through the same clean pty/pid-file teardown as a
// normal shutdown, rather than either a silent resume or a raw crash.
process.removeListener('uncaughtException', startupError);
process.on('uncaughtException', (err) => {
  cli.report(Object.assign(new Error('uncaught exception'), { stack: err?.stack }), { fatal: true });
  shutdown(1);
});
process.on('unhandledRejection', (err) => {
  cli.report(Object.assign(new Error('unhandled rejection'), { stack: err?.stack }), { fatal: true });
  shutdown(1);
});

server.listen(PORT, '0.0.0.0', () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));

  const proto = tlsActive ? 'https' : 'http';
  const hostname = os.hostname();
  const mdnsHost = hostname.endsWith('.local') ? hostname : `${hostname}.local`;
  const primary = `${proto}://${mdnsHost}:${PORT}/?token=${TOKEN}`;

  const commitLabel = VERSION_INFO.commit ? ` (${VERSION_INFO.commit})` : '';
  const removedLogs = cleanupOldLogs();
  const removedUploads = cleanupOldUploads();
  if (removedLogs || removedUploads) cli.notice('过期临时文件已清理', 'Expired temporary files were cleaned up.');
  setInterval(() => { cleanupOldLogs(); cleanupOldUploads(); }, 24 * 60 * 60 * 1000).unref();
  cli.access({ proto, port: PORT, token: TOKEN, mdns: mdnsHost, addresses: cli.lanAddresses(os.networkInterfaces()), version: VERSION_INFO.version + commitLabel });
  // Keep readiness markers stable for restart scripts and existing integrations.
  console.log(`[termdoor] listening on 0.0.0.0:${PORT}${tlsActive ? ' (TLS)' : ''}`);
  if (REMOTE_PORT) {
    // for a tunnel client (frp etc.): loopback only, secondary key always required
    const remote = createListener();
    remote.listen(REMOTE_PORT, '127.0.0.1', () => {
      cli.line('远程转发 / Tunnel', `127.0.0.1:${REMOTE_PORT}`);
      cli.notice('此端口仅供本机转发程序使用，始终需要本机二次密钥', 'Local tunnel programs only; secondary key always required.');
    });
  }
  console.log('');
  console.log(qr.toTerminal(primary));
  console.log('');
  console.log(`[termdoor] open: ${primary}`);
  openBrowser(primary);
  if (tlsActive) cli.notice('使用自签名证书，浏览器可能提示证书不受信任', 'Self-signed certificate: browsers may show a trust warning.');
});
