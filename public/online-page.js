const onlineParams = new URLSearchParams(location.search);
const el = (id) => document.getElementById(id);
let transferred = new URLSearchParams();
try { transferred = new URLSearchParams(sessionStorage.getItem('webcli-enrollment-auth') || ''); sessionStorage.removeItem('webcli-enrollment-auth'); } catch {}
el('online-token').value = transferred.get('token') || onlineParams.get('token') || loadSavedToken() || '';
try { el('online-key').value = transferred.get('key') || localStorage.getItem('webcli-secondary-key') || ''; } catch { el('online-key').value = transferred.get('key') || ''; }
// Credentials arriving in an old access link must not remain in browser history.
if (onlineParams.has('token') || onlineParams.has('key')) {
  if (!el('online-key').value) el('online-key').value = onlineParams.get('key') || '';
  const clean = new URL(location.href); clean.searchParams.delete('token'); clean.searchParams.delete('key'); history.replaceState(null, '', clean);
}
function centerOrigin(value) {
  try { const url = new URL(value); if (url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) return url.origin; } catch {}
  return '';
}
el('online-center').value = centerOrigin(onlineParams.get('center'));
function updateCenterLink() {
  const origin = centerOrigin(el('online-center').value.trim());
  el('get-code-link').hidden = !origin;
  if (origin) el('get-code-link').href = origin + '/setup';
}
el('online-center').addEventListener('input', updateCenterLink);
updateCenterLink();
let authorized = false;
const phases = ['preparing', 'registering', 'connecting', 'verifying'];
function renderState(state) {
  if (!authorized) el('auth-details').open = false;
  authorized = true;
  el('auth-status').textContent = '已验证'; el('auth-status').dataset.state = 'success';
  el('machine-info').textContent = `${state.deviceName || '当前电脑'}${state.version ? ' · TermDoor ' + state.version : ''} · 本机权限已验证，无需重复填写令牌和密钥。`;
  el('configured-note').hidden = !state.configured;
  el('connection-details').hidden = !state.configured;
  el('device-name').textContent = state.deviceName || '当前电脑';
  el('saved-center').textContent = state.center || '尚未接入';
  el('last-heartbeat').textContent = state.lastHeartbeat ? new Date(state.lastHeartbeat).toLocaleString() : '尚未成功通信';
  el('result-status').textContent = state.ready ? '接入成功' : state.error ? '需要处理' : state.configured ? '正在连接' : '等待接入';
  el('result-status').dataset.state = state.ready ? 'success' : state.error ? 'error' : '';
  const step = state.configured || (state.phase && !['idle', 'error'].includes(state.phase)) ? 2 : 1;
  ['nav-prepare', 'nav-code', 'nav-result'].forEach((id, index) => { if (index === step) el(id).setAttribute('aria-current', 'step'); else el(id).removeAttribute('aria-current'); });
  const active = phases.indexOf(state.phase);
  phases.forEach((phase, index) => { el('phase-' + phase).dataset.state = state.ready || index < active ? 'done' : index === active ? 'current' : ''; });
  const origin = centerOrigin(state.center);
  el('center-dashboard').hidden = !origin;
  if (origin) el('center-dashboard').href = origin;
  updateCenterLink();
}
const onlinePage = initOnline({
  authQuery: () => new URLSearchParams({ token: el('online-token').value.trim(), key: el('online-key').value.trim() }).toString(),
  closeAllDropdowns: () => {}, onState: renderState,
  onError: (error) => {
    if (error.status === 401) { authorized = false; el('auth-details').open = true; el('auth-status').textContent = '需要验证'; }
    else { el('auth-status').textContent = '检查失败'; el('auth-status').dataset.state = 'error'; }
    el('machine-info').textContent = error.status === 403 ? '当前地址不允许管理本机，请改用目标电脑的 localhost 主端口。' : '请按下方提示处理，然后重新检查。';
  },
});
el('online-auth-form').onsubmit = async (event) => { event.preventDefault(); if (await onlinePage.refresh()) rememberToken(el('online-token').value.trim()); };
el('refresh-status').onclick = onlinePage.refresh;
el('online-code').addEventListener('input', () => { el('online-code').value = el('online-code').value.replace(/\s/g, '').toLowerCase(); });
const statusTimer = setInterval(() => { if (authorized && !document.hidden && !el('auth-details').open) onlinePage.refresh(); }, 3000);
window.addEventListener('pagehide', () => clearInterval(statusTimer), { once: true });
