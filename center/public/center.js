const $ = (id) => document.getElementById(id);
async function api(url, method = 'GET', body) {
  const response = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && url !== '/api/login' && url !== '/api/password') showLogin();
    const error = new Error(TermDoorErrors.format(data, response.status));
    error.status = response.status;
    throw error;
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
let refreshing = false;
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
  const { devices } = await api('/api/devices');
  $('summary').textContent = `${devices.filter((d) => d.online).length} 台在线 · 共 ${devices.length} 台设备`;
  $('empty').hidden = devices.length > 0;
  const rows = devices.map((device, index) => {
    const row = document.createElement('article'); row.className = 'device';
    const number = document.createElement('span'); number.className = 'device-number'; number.textContent = String(index + 1); number.setAttribute('aria-label', `第 ${index + 1} 台设备`);
    const info = document.createElement('div');
    const title = document.createElement('h2'); title.textContent = device.name;
    const status = document.createElement('p'); status.className = device.online ? 'online' : 'offline';
    const diagnosis = TermDoorDeviceStatus.describe(device);
    status.textContent = diagnosis.label;
    status.title = diagnosis.key ? TermDoorErrors.format(diagnosis.key) : '';
    const layers = document.createElement('p'); layers.className = 'device-layers';
    layers.textContent = `设备 ${device.heartbeat ? '已通信' : '未通信'} · 通路 ${device.online ? '可用' : '待恢复'}${device.tunnel?.latencyMs != null ? ` · ${device.tunnel.latencyMs} ms` : ''}`;
    info.append(title, status, layers);
    const roleLabel = { owner: '所有者', viewer: '只读查看', operator: '应用操作', terminal: '终端控制' };
    const permission = document.createElement('p'); permission.className = 'device-layers'; permission.textContent = roleLabel[device.role] || ''; info.append(permission);
    const actions = document.createElement('div'); actions.className = 'device-actions';
    const openSlot = document.createElement('span'); openSlot.className = 'device-open-slot';
    if (device.online && ['owner', 'terminal'].includes(device.role)) {
      const open = document.createElement('a'); open.className = 'open'; open.href = `/d/${device.id}/?token=center`; open.textContent = '打开终端'; open.target = '_blank'; open.rel = 'noopener'; openSlot.append(open);
    }
    if (device.online) for (const app of device.apps || []) {
      const open = document.createElement('a'); open.className = 'open';
      open.href = `/launch?device=${device.id}&app=${encodeURIComponent(app.id)}`;
      open.textContent = `${app.health?.state === 'ready' ? '打开' : '检查'} ${app.name}`; open.target = '_blank'; open.rel = 'noopener';
      openSlot.append(open);
    }
    const remove = document.createElement('button'); remove.textContent = '解除设备接入';
    remove.onclick = async () => {
      if (!confirm(`解除「${device.name}」的设备接入？线上访问将立即停止，局域网功能继续可用。`)) return;
      try { await api(`/api/devices/${device.id}`, 'DELETE'); await refresh(); } catch (err) { message(TermDoorErrors.format(err)); }
    };
    const grants = document.createElement('button'); grants.textContent = '访问权限'; grants.onclick = () => openGrants(device).catch((error) => message(TermDoorErrors.format(error)));
    actions.append(openSlot); if (device.role === 'owner') actions.append(grants, remove); row.append(number, info, actions); return row;
  });
  $('devices').replaceChildren(...rows);
  } finally { refreshing = false; }
}
$('login-form').onsubmit = async (event) => {
  event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true;
  try { await showDashboard(await api('/api/login', 'POST', Object.fromEntries(new FormData(event.target)))); event.target.reset(); }
  catch (err) { message(TermDoorErrors.format(err)); } finally { button.disabled = false; }
};
$('logout').onclick = async () => { try { await api('/api/logout', 'POST'); showLogin(); } catch (err) { message(TermDoorErrors.format(err)); } };
$('bind').onclick = () => location.assign('/setup');
$('password-button').onclick = () => { $('password-form').reset(); $('password-message').textContent = ''; $('password-dialog').showModal(); };
$('password-form').onsubmit = async (event) => {
  event.preventDefault();
  try { await api('/api/password', 'POST', Object.fromEntries(new FormData(event.target))); $('password-dialog').close(); showLogin(); message('密码已修改，请重新登录'); }
  catch (err) { $('password-message').textContent = TermDoorErrors.format(err); }
};
api('/api/me').then(showDashboard).catch((err) => { showLogin(); if (err.status !== 401) message(TermDoorErrors.format(err)); });
setInterval(() => { if (!$('dashboard').hidden) refresh().catch((err) => message(TermDoorErrors.format(err))); }, 15000);

let grantedDevice;
async function openGrants(device) {
  grantedDevice = device;
  $('grant-title').textContent = `${device.name} · 访问权限`;
  $('grant-form').reset();
  $('grant-message').textContent = '';
  await refreshGrants();
  $('grant-dialog').showModal();
}
async function refreshGrants() {
  const { grants } = await api(`/api/devices/${grantedDevice.id}/grants`);
  $('grants').replaceChildren(...grants.map((grant, index) => {
    const row = document.createElement('li');
    row.textContent = `${index + 1}. ${grant.username} · ${{ viewer: '只读查看', operator: '应用操作', terminal: '终端控制' }[grant.role]}`;
    const revoke = document.createElement('button'); revoke.textContent = '撤销';
    revoke.onclick = async () => { try { await api(`/api/devices/${grantedDevice.id}/grants`, 'POST', { username: grant.username, role: 'revoke' }); await refreshGrants(); } catch (error) { $('grant-message').textContent = TermDoorErrors.format(error); } };
    row.append(revoke); return row;
  }));
}
$('grant-form').onsubmit = async (event) => {
  event.preventDefault();
  if ($('grant-role').value === 'terminal' && !confirm('终端控制允许执行这台电脑上的命令。确认授予？')) return;
  try { await api(`/api/devices/${grantedDevice.id}/grants`, 'POST', Object.fromEntries(new FormData(event.target))); await refreshGrants(); $('grant-message').textContent = '权限已生效'; }
  catch (error) { $('grant-message').textContent = TermDoorErrors.format(error); }
};
$('refresh-devices').onclick = () => refresh().catch((error) => message(TermDoorErrors.format(error)));
