const errors = require('../public/errors');

function useColor(stream = process.stdout) {
  return !('NO_COLOR' in process.env) && process.env.TERM !== 'dumb' && (process.env.FORCE_COLOR === '1' || !!stream.isTTY);
}
function paint(text, color, stream) { return useColor(stream) ? `\x1b[${color}m${text}\x1b[0m` : text; }
function heading(title, subtitle = '') {
  console.log('');
  console.log(paint('  +-- TermDoor ------------------------------------', '36;1'));
  console.log(`  |  ${paint(title, '1')}`);
  if (subtitle) console.log(`  |  ${paint(subtitle, '2')}`);
  console.log(paint('  +------------------------------------------------', '36'));
}
function displayWidth(text) {
  return [...text.replace(/\x1b\[[0-9;]*m/g, '')].reduce((width, char) => width + (/[^\x00-\xff]/.test(char) ? 2 : 1), 0);
}
function line(label, text, color = '36') {
  const width = label.length > 3 ? 24 : 3;
  console.log(`  ${paint(label, color)}${' '.repeat(Math.max(2, width - displayWidth(label)))}${text}`);
}
function notice(zh, en) { line('i', `${zh} / ${en}`, '33'); }
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
  line('01  本机 / Local', `${proto}://localhost:${port}/?token=${token}`, '32;1');
  line('02  局域网 / LAN', `${proto}://${mdns}:${port}/?token=${token}`);
  addresses.forEach((address, index) => line(`${String(index + 3).padStart(2, '0')}  备用 / LAN IP`, `${proto}://${address}:${port}/?token=${token}`));
  line('    设备接入 / Setup', `${proto}://localhost:${port}/online.html`, '35');
  console.log('');
  notice('同一服务的不同入口，并非已连接设备', 'These are access options, not active connections.');
  notice('访问链接含本机令牌，请勿公开', 'Access links contain your local token; keep them private.');
}
module.exports = { useColor, paint, heading, line, notice, report, lanAddresses, access };
if (require.main === module) {
  const [action, value] = process.argv.slice(2);
  if (action === 'error') { report(value); }
  else if (action === 'heading') heading(value || '控制面板 / Control room', 'Pick a number. Make something lovely.');
}
