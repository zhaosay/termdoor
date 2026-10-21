const $ = (id) => document.getElementById(id);
const localSetup = new URL('http://localhost:3050/online.html');
localSetup.searchParams.set('center', location.origin);
for (const id of ['local-setup-link', 'bind-setup-link']) $(id).href = localSetup.href;
async function api(url, method = 'GET', body) {
  const response = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && url !== '/api/login' && url !== '/api/password') showLogin();
    throw new Error(data.error || '请求失败');
  }
  return data;
}
function message(text) { $('message').textContent = text; }
function showLogin() { $('login').hidden = false; $('dashboard').hidden = true; $('account').hidden = true; }
async function showDashboard(user) {
  $('login').hidden = true; $('dashboard').hidden = false; $('account').hidden = false;
  $('username').textContent = user.username; message('');
  await refresh();
}
async function refresh() {
  const { devices } = await api('/api/devices');
  $('summary').textContent = `${devices.filter((d) => d.online).length} 台在线 · 共 ${devices.length} 台设备`;
  $('empty').hidden = devices.length > 0;
  const rows = devices.map((device, index) => {
    const row = document.createElement('article'); row.className = 'device';
    const number = document.createElement('span'); number.className = 'device-number'; number.textContent = String(index + 1); number.setAttribute('aria-label', `第 ${index + 1} 台设备`);
    const info = document.createElement('div');
    const title = document.createElement('h2'); title.textContent = device.name;
    const status = document.createElement('p'); status.className = device.online ? 'online' : 'offline';
    status.textContent = device.online ? '在线' : device.lastSeen ? `离线 · 最近连接 ${new Date(device.lastSeen).toLocaleString()}` : '等待设备连接';
    info.append(title, status);
    const actions = document.createElement('div'); actions.className = 'device-actions';
    const openSlot = document.createElement('span'); openSlot.className = 'device-open-slot';
    if (device.online) {
      const open = document.createElement('a'); open.className = 'open'; open.href = `/d/${device.id}/?token=center`; open.textContent = '打开终端'; open.target = '_blank'; open.rel = 'noopener'; openSlot.append(open);
    }
    const remove = document.createElement('button'); remove.textContent = '解绑';
    remove.onclick = async () => {
      if (!confirm(`解绑「${device.name}」？线上访问将立即停止，局域网功能继续可用。`)) return;
      try { await api(`/api/devices/${device.id}`, 'DELETE'); await refresh(); } catch (err) { message(err.message); }
    };
    actions.append(openSlot, remove); row.append(number, info, actions); return row;
  });
  $('devices').replaceChildren(...rows);
}
$('login-form').onsubmit = async (event) => {
  event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true;
  try { await showDashboard(await api('/api/login', 'POST', Object.fromEntries(new FormData(event.target)))); event.target.reset(); }
  catch (err) { message(err.message); } finally { button.disabled = false; }
};
$('logout').onclick = async () => { try { await api('/api/logout', 'POST'); showLogin(); } catch (err) { message(err.message); } };
$('bind').onclick = async () => {
  try {
    const { code } = await api('/api/invites', 'POST');
    $('center-url').value = location.origin; $('bind-code').value = code; $('copy-code').textContent = '复制绑定码'; $('bind-dialog').showModal();
  } catch (err) { message(err.message); }
};
$('copy-code').onclick = async () => { try { await navigator.clipboard.writeText($('bind-code').value); $('copy-code').textContent = '已复制'; } catch { $('bind-code').select(); } };
$('password-button').onclick = () => { $('password-form').reset(); $('password-message').textContent = ''; $('password-dialog').showModal(); };
$('password-form').onsubmit = async (event) => {
  event.preventDefault();
  try { await api('/api/password', 'POST', Object.fromEntries(new FormData(event.target))); $('password-dialog').close(); showLogin(); message('密码已修改，请重新登录'); }
  catch (err) { $('password-message').textContent = err.message; }
};
api('/api/me').then(showDashboard).catch((err) => { showLogin(); if (err.message !== '请先登录') message(err.message); });
setInterval(() => { if (!$('dashboard').hidden) refresh().catch((err) => message(err.message)); }, 15000);
