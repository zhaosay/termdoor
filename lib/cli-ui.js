const errors = require('../public/errors');

function useColor(stream = process.stdout) {
  return !('NO_COLOR' in process.env) && process.env.TERM !== 'dumb' && (process.env.FORCE_COLOR === '1' || !!stream.isTTY);
}
function paint(text, color, stream) { return useColor(stream) ? `\x1b[${color}m${text}\x1b[0m` : text; }
function hyperlink(url) {
  if (!useColor() || !/^https?:\/\/[^\x00-\x20\x7f]+$/.test(url)) return url;
  return `\x1b]8;;${url}\x1b\\${url}\x1b]8;;\x1b\\`;
}
function heading(title, subtitle = '') {
  console.log('');
  const brand = [
    String.raw` _____                   ____                   `,
    String.raw`|_   _|__ _ __ _ __ ___ |  _ \  ___   ___  _ __ `,
    "  | |/ _ \\ '__| '_ ` _ \\| | | |/ _ \\ / _ \\| '__|",
    String.raw`  | |  __/ |  | | | | | | |_| | (_) | (_) | |   `,
    String.raw`  |_|\___|_|  |_| |_| |_|____/ \___/ \___/|_|   `,
  ];
  if ((process.stdout.columns || 80) >= 64) {
    for (const row of brand) console.log(paint('  ' + row, '96;1'));
  } else console.log(paint('  T E R M D O O R', '96;1'));
  console.log('');
  console.log(`  ${paint(title, '1')}`);
  if (subtitle) console.log(`  ${paint(subtitle, '96;1')}`);
  console.log('');
}
function displayWidth(text) {
  return [...text.replace(/\x1b\[[0-9;]*m/g, '')].reduce((width, char) => width + (/[^\x00-\xff]/.test(char) ? 2 : 1), 0);
}
function line(label, text, color = '96;1') {
  const width = label.length > 3 ? 24 : 3;
  console.log(`  ${paint(label, color)}${' '.repeat(Math.max(2, width - displayWidth(label)))}${text}`);
}
function notice(zh, en) { line('i', `${zh} / ${en}`, '33'); }
function section(title) {
  const width = Math.max(24, Math.min(68, (process.stdout.columns || 80) - 4));
  console.log(paint(`  + ${title} ${'-'.repeat(Math.max(2, width - displayWidth(title) - 4))}`, '96;1'));
}
function scanCode(rendered) {
  section('SCAN + PLAY / 扫码进入');
  console.log('');
  for (const row of rendered.split('\n')) console.log('    ' + row);
  console.log('');
  line('[>]', paint('手机扫码 / Scan with your phone', '1'));
  line('[i]', '同一局域网 / Same local network');
  console.log('');
}
function report(value, { fatal = false } = {}) {
  const detail = errors.describe(value);
  console.error(`\n  ${paint(fatal ? '[!]' : '[~]', '31;1', process.stderr)} ${paint(detail.errorCode, '31;1', process.stderr)}`);
  console.error(`      ${detail.errorZh}`);
  console.error(`      ${detail.errorEn}`);
  console.error(`      > ${detail.hint}`);
  // Technical details stay opt-in: arbitrary exception messages may contain secrets.
  if (process.env.TERMDOOR_DEBUG === '1' && value?.stack) console.error(value.stack);
}
function lanAddresses(interfaces) {
  return [...new Set(Object.values(interfaces).flatMap((list) => (list || [])
    .filter((net) => net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.'))
    .map((net) => net.address)))];
}
function access({ proto, port, token, mdns, addresses, version }) {
  heading('叮！终端之门已打开 / Your terminal is ready', version ? `v${version}  |  Hello, little terminal :)` : 'Hello, little terminal :)');
  section('READY / 选择入口');
  console.log('');
  line('01  本机 / Local', hyperlink(`${proto}://localhost:${port}/?token=${token}`), '92;1');
  console.log('');
  line('02  局域网 / LAN', hyperlink(`${proto}://${mdns}:${port}/?token=${token}`));
  console.log('');
  addresses.forEach((address, index) => {
    line(`${String(index + 3).padStart(2, '0')}  备用 / LAN IP`, hyperlink(`${proto}://${address}:${port}/?token=${token}`));
    console.log('');
  });
  line(`${String(addresses.length + 3).padStart(2, '0')}  设备接入 / Setup`, hyperlink(`${proto}://localhost:${port}/online.html`), '93;1');
  console.log('');
  notice('同一服务的不同入口，并非已连接设备', 'These are access options, not active connections.');
  notice('访问链接含本机令牌，请勿公开', 'Access links contain your local token; keep them private.');
}
module.exports = { useColor, paint, hyperlink, heading, line, notice, section, scanCode, report, lanAddresses, access };
if (require.main === module) {
  const [action, value] = process.argv.slice(2);
  if (action === 'error') { report(value); }
  else if (action === 'heading') heading(value || '控制面板 / Control room', 'Pick a number. Make something lovely.');
}
