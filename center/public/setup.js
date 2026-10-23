const setupEl = (id) => document.getElementById(id);
let loggedIn = false;
let invite;
let refreshing = false;
setupEl('setup-center').value = location.origin;
function updateLocalLink() {
  try {
    const url = new URL(setupEl('local-address').value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
    url.pathname = '/online.html'; url.searchParams.set('center', location.origin);
    setupEl('open-local').href = url.href;
    setupEl('open-local').removeAttribute('aria-disabled');
    setupEl('local-address-error').textContent = '';
  } catch {
    setupEl('open-local').removeAttribute('href'); setupEl('open-local').setAttribute('aria-disabled', 'true');
    setupEl('local-address-error').textContent = TermDoorErrors.format('invalid local address');
  }
}
setupEl('local-address').addEventListener('input', updateLocalLink);
updateLocalLink();
function showLoggedOut() {
  loggedIn = false; invite = null;
  setupEl('setup-login').hidden = false; setupEl('setup-account').hidden = true;
  setupEl('code-panel').hidden = true; setupEl('setup-code').value = '';
  setupEl('setup-devices').replaceChildren(); setupEl('setup-result-status').textContent = '请先登录';
}
async function setupApi(url, method = 'GET', body) {
  const response = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (response.status === 401 && url !== '/api/login') showLoggedOut();
  if (!response.ok) {
    const error = new Error(TermDoorErrors.format(data, response.status));
    error.status = response.status;
    throw error;
  }
  return data;
}
async function showAccount(user) {
  loggedIn = true; setupEl('setup-login').hidden = true; setupEl('setup-account').hidden = false;
  setupEl('setup-account-name').textContent = `已登录中心账号：${user.username}`;
  setupEl('setup-message').textContent = '';
  setupEl('nav-code').setAttribute('aria-current', 'step'); setupEl('nav-prepare').removeAttribute('aria-current');
  await refreshDevices();
}
function countdown() {
  if (!invite) return;
  const seconds = Math.max(0, Math.ceil((invite.expiresAt - Date.now()) / 1000));
  setupEl('copy-setup-code').disabled = !seconds || invite.used;
  setupEl('code-countdown').textContent = invite.used ? '设备接入码已使用。请等待终端通路验证，无需重新生成。' : seconds ? `剩余 ${Math.floor(seconds / 60)} 分 ${String(seconds % 60).padStart(2, '0')} 秒 · 只能使用一次` : '设备接入码已过期。点击「生成设备接入码」获取新的接入码。';
}
async function refreshDevices() {
  if (!loggedIn || refreshing) return;
  refreshing = true;
  try {
    const { devices } = await setupApi('/api/devices');
    const current = invite && devices.find((device) => device.enrollmentId === invite.enrollmentId);
    if (current) invite.used = true;
    countdown();
    setupEl('setup-devices').replaceChildren(...devices.map((device, index) => {
      const row = document.createElement('li'); row.className = 'setup-device';
      const number = document.createElement('span'); number.textContent = String(index + 1);
      const name = document.createElement('span'); name.textContent = device.name;
      const status = document.createElement('span'); status.textContent = device.online ? '在线' : '尚未连通';
      const action = document.createElement('span');
      if (device.online) {
        const link = document.createElement('a'); link.textContent = '打开终端'; link.href = `/d/${device.id}/?token=center`; link.target = '_blank'; link.rel = 'noopener'; action.append(link);
      }
      row.append(number, name, status, action);
      return row;
    }));
    const success = current?.online;
    setupEl('setup-result-status').textContent = success ? '接入成功' : current ? '正在连接' : devices.length ? '已有设备' : '等待接入';
    setupEl('setup-result-status').dataset.state = success ? 'success' : '';
    setupEl('setup-result').textContent = success ? `${current.name} 的终端通路已验证，可以打开终端。` : current ? `${current.name} 已登记，正在等待加密连接和终端通路验证。请在本机页面查看进度。` : invite ? '设备接入码已生成。请到本机页面填写接入码并确认接入，此处会自动更新结果。' : '下面是已登记设备。接入另一台电脑时，生成新的设备接入码即可。';
    if (current) { setupEl('nav-result').setAttribute('aria-current', 'step'); setupEl('nav-code').removeAttribute('aria-current'); }
  } catch (error) { setupEl('setup-message').textContent = TermDoorErrors.format(error); }
  finally { refreshing = false; }
}
setupEl('setup-login-form').onsubmit = async (event) => {
  event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true;
  try { await showAccount(await setupApi('/api/login', 'POST', Object.fromEntries(new FormData(event.target)))); event.target.reset(); }
  catch (error) { setupEl('setup-message').textContent = TermDoorErrors.format(error); } finally { button.disabled = false; }
};
setupEl('generate-code').onclick = async () => {
  setupEl('generate-code').disabled = true;
  try {
    const result = await setupApi('/api/invites', 'POST');
    invite = { ...result, expiresAt: result.expiresAt || Date.now() + result.expiresIn * 1000, used: false };
    setupEl('setup-code').value = invite.code; setupEl('code-panel').hidden = false;
    setupEl('copy-setup-code').textContent = '复制设备接入码'; setupEl('setup-message').textContent = '';
    setupEl('nav-code').setAttribute('aria-current', 'step'); setupEl('nav-result').removeAttribute('aria-current');
    countdown(); await refreshDevices();
  } catch (error) { setupEl('setup-message').textContent = TermDoorErrors.format(error); }
  finally { setupEl('generate-code').disabled = false; }
};
setupEl('copy-setup-code').onclick = async () => {
  countdown(); if (!invite || invite.used || Date.now() >= invite.expiresAt) return;
  try { await navigator.clipboard.writeText(invite.code); setupEl('copy-setup-code').textContent = '设备接入码已复制'; }
  catch { setupEl('setup-code').select(); setupEl('setup-message').textContent = TermDoorErrors.format('clipboard failed'); }
};
setupApi('/api/me').then(showAccount).catch((error) => { showLoggedOut(); if (error.status !== 401) setupEl('setup-message').textContent = TermDoorErrors.format(error); });
const countdownTimer = setInterval(countdown, 1000);
const devicesTimer = setInterval(() => { if (!document.hidden) refreshDevices(); }, 5000);
window.addEventListener('pagehide', () => { clearInterval(countdownTimer); clearInterval(devicesTimer); }, { once: true });
