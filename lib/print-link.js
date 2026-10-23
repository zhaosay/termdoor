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
const cli = require('./cli-ui');

function main() {
  let token;
  try {
    token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  } catch {
    cli.report('token missing');
    process.exit(1);
  }
  if (!token) {
    cli.report('token empty');
    process.exit(1);
  }

  const proto = USE_TLS ? 'https' : 'http';
  const hostname = os.hostname();
  const mdns = hostname.endsWith('.local') ? hostname : `${hostname}.local`;

  const addresses = cli.lanAddresses(os.networkInterfaces());

  // mDNS (.local) is the nicest link on macOS but often does not resolve from
  // Windows clients, so prefer a raw IP there.
  const primaryHost = process.platform === 'win32' && addresses.length
    ? addresses[0]
    : mdns;
  const primary = `${proto}://${primaryHost}:${PORT}/?token=${token}`;

  cli.access({ proto, port: PORT, token, mdns, addresses });
  cli.scanCode(qr.toTerminal(primary));
}

main();
