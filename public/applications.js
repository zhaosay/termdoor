const $ = (id) => document.getElementById(id);
let transferred = new URLSearchParams();
try { transferred = new URLSearchParams(sessionStorage.getItem('webcli-enrollment-auth') || ''); sessionStorage.removeItem('webcli-enrollment-auth'); } catch {}
$('token').value = transferred.get('token') || loadSavedToken() || '';
try { $('key').value = transferred.get('key') || localStorage.getItem('webcli-secondary-key') || ''; } catch {}
async function api(url, body) {
  const query = new URLSearchParams({ token: $('token').value.trim(), key: $('key').value.trim() });
  const response = await fetch(url + '?' + query, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) { if (response.status === 401) $('auth').open = true; throw new Error(TermDoorErrors.format(data, response.status)); }
  return data;
}
const states = { ready: '可连接', disabled: '已停用', credentials: '检查密钥文件', unavailable: '服务未就绪' };
function input() { const form = new FormData($('app-form')); return { ...Object.fromEntries(form), port: Number(form.get('port')), enabled: form.has('enabled') }; }
function reset() { $('app-form').reset(); $('app-form').elements.id.readOnly = false; $('form-title').textContent = '添加应用'; $('test-result').textContent = ''; }
async function refresh() {
  const { apps, health } = await api('/api/apps');
  $('auth').open = false; $('empty').hidden = apps.length > 0;
  $('apps').replaceChildren(...apps.map((app, index) => {
    const row = document.createElement('tr');
    const number = document.createElement('td'); number.textContent = index + 1;
    const name = document.createElement('td'); name.textContent = app.name;
    const secondary = document.createElement('small'); secondary.textContent = `${app.id} · ${app.port}`; name.append(secondary);
    const status = document.createElement('td'); const state = health.find((h) => h.id === app.id); status.textContent = states[state?.state] || '待检查';
    const detail = document.createElement('small'); detail.textContent = state?.latencyMs != null ? `${state.latencyMs} ms` : state?.errorCode || ' '; status.append(detail);
    const actions = document.createElement('td');
    const edit = document.createElement('button'); edit.textContent = '编辑'; edit.onclick = () => { for (const [key, value] of Object.entries(app)) { const field = $('app-form').elements[key]; if (field) field.type === 'checkbox' ? field.checked = value : field.value = value; } $('app-form').elements.id.readOnly = true; $('form-title').textContent = '编辑应用'; $('app-form').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    const toggle = document.createElement('button'); toggle.textContent = app.enabled ? '停用' : '启用'; toggle.onclick = () => run(async () => { await api('/api/apps', { ...app, enabled: !app.enabled }); await refresh(); });
    actions.append(edit, toggle); row.append(number, name, status, actions); return row;
  }));
}
async function run(work) { $('message').textContent = ''; try { await work(); } catch (error) { $('message').textContent = TermDoorErrors.format(error); } }
$('auth-form').onsubmit = (event) => { event.preventDefault(); run(refresh); };
$('refresh').onclick = () => run(refresh);
$('new-app').onclick = reset;
$('app-form').onsubmit = (event) => { event.preventDefault(); run(async () => { await api('/api/apps', input()); $('message').textContent = '已保存，中心约 15 秒内同步。'; reset(); await refresh(); }); };
$('test').onclick = () => run(async () => { if (!$('app-form').reportValidity()) return; $('test-result').textContent = '正在测试…'; const state = await api('/api/apps/test', input()); $('test-result').textContent = `${states[state.state]} ${state.errorCode || ''}`; });
$('check-update').onclick = () => run(async () => { $('maintenance').textContent = '正在检查版本…'; const v = await api('/api/update-check'); $('maintenance').textContent = `当前 ${v.current} · GitHub ${v.latest} · ${v.updateAvailable ? '有更新可用' : '已是最新版本'}`; });
$('download').onclick = () => run(async () => { const report = await api('/api/diagnostics'); const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'termdoor-diagnostics.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
$('copy').onclick = () => run(async () => { const report = await api('/api/diagnostics'); await navigator.clipboard.writeText(JSON.stringify(report, null, 2)); $('maintenance').textContent = '诊断已复制'; });
run(refresh);
