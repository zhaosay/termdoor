// Prints the access link plus a scannable QR code.
//
// Used by the control panels on both platforms. It derives everything from the
// token file rather than scraping the server log, because on Windows the server
// logs straight to its console window and there is no log file to scrape.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TOKEN_FILE, PORT, USE_TLS } = require('./config');
const qr = require('./qr');

function main() {
  let token;
  try {
    token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  } catch {
    console.error('[termdoor] 还没有 token —— 先启动一次服务会自动生成');
    process.exit(1);
  }
  if (!token) {
    console.error('[termdoor] token 文件是空的');
    process.exit(1);
  }

  const proto = USE_TLS ? 'https' : 'http';
  const hostname = os.hostname();
  const mdns = hostname.endsWith('.local') ? hostname : `${hostname}.local`;

  const addresses = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) addresses.push(net.address);
    }
  }

  // mDNS (.local) is the nicest link on macOS but often does not resolve from
  // Windows clients, so prefer a raw IP there.
  const primaryHost = process.platform === 'win32' && addresses.length
    ? addresses[0]
    : mdns;
  const primary = `${proto}://${primaryHost}:${PORT}/?token=${token}`;

  console.log('');
  console.log(qr.toTerminal(primary));
  console.log('');
  console.log(`[termdoor] open: ${primary}`);
  for (const addr of addresses) {
    const url = `${proto}://${addr}:${PORT}/?token=${token}`;
    if (url !== primary) console.log(`[termdoor] fallback: ${url}`);
  }
  if (primaryHost !== mdns) console.log(`[termdoor] mDNS: ${proto}://${mdns}:${PORT}/?token=${token}`);
  console.log('');
  console.log('[termdoor] 手机扫上面的二维码即可连接；链接含 token，不要公开分享。');
}

main();
