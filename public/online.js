function initOnline({ authQuery, closeAllDropdowns, onState = () => {}, onError = () => {} }) {
  const row = document.getElementById('online-row');
  const dialog = document.getElementById('online-dialog');
  const info = document.getElementById('online-info');
  const center = document.getElementById('online-center');
  const code = document.getElementById('online-code');
  const button = document.getElementById('online-bind');
  const disconnect = document.getElementById('online-disconnect');
  const form = document.getElementById('online-form');
  const opener = document.getElementById('online-button');
  if (row) row.hidden = false;
  if (!form) {
    if (opener) opener.onclick = () => {
      closeAllDropdowns();
      if (TERMDoorBase) { alert(TermDoorErrors.format('local only')); return; }
      try { sessionStorage.setItem('webcli-enrollment-auth', typeof authQuery === 'function' ? authQuery() : authQuery); } catch {}
      location.assign('/online.html');
    };
    return {};
  }
  let busy = false;
  async function call(method = 'GET', body) {
    const endpoint = `/api/online?${typeof authQuery === 'function' ? authQuery() : authQuery}`;
    const response = await terminalFetch(endpoint, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(TermDoorErrors.format(result, response.status));
      error.status = response.status;
      throw error;
    }
    return result;
  }
  function fill(state) {
    if (state.center) center.value = state.center;
    form.hidden = !!state.configured;
    center.disabled = state.configured || busy; code.disabled = state.configured || busy; button.disabled = state.configured || busy;
    disconnect.hidden = !state.configured;
    info.textContent = (state.error ? TermDoorErrors.format(state) : '') || (state.ready ? '接入成功：中心已验证终端通路。' : state.configured ? '设备已登记，正在等待中心验证终端通路。' : '本机权限已验证。请填写中心地址和设备接入码。');
    onState(state);
  }
  function showError(err) {
    center.disabled = true; code.disabled = true; button.disabled = true; disconnect.hidden = true;
    if (err.status === 403) info.textContent = '请在目标电脑自己的浏览器中打开 localhost 主端口的 /online.html 页面；局域网地址和远程代理不能修改线上接入。';
    else if (err.status === 401) info.textContent = '请先填写本机 TermDoor 的访问令牌和二次密钥（若已启用），再点击验证。';
    else if (err.status === 404) info.textContent = '当前服务缺少线上接入接口，请更新并重启 TermDoor，然后刷新本页。';
    else info.textContent = `无法读取线上接入状态：${err.message}。请检查本机服务后重试。`;
    info.textContent = TermDoorErrors.format(err, err.status) + '\n' + info.textContent;
    onError(err);
  }
  async function refresh() {
    closeAllDropdowns();
    if (dialog && !dialog.open) dialog.showModal();
    try { fill(await call()); return true; } catch (err) { showError(err); return false; }
  }
  if (opener) opener.onclick = refresh;
  call().then(fill).catch(showError);
  form.onsubmit = async (event) => {
    event.preventDefault(); if (busy) return;
    const input = { center: center.value.trim(), code: code.value.trim() };
    busy = true; button.disabled = true; center.disabled = true; code.disabled = true; info.textContent = '正在准备连接组件并登记设备，请稍候…';
    try { const state = await call('POST', input); busy = false; fill(state); code.value = ''; }
    catch (err) { info.textContent = TermDoorErrors.format(err); button.disabled = false; if (err.status === 401 || err.status === 403) onError(err); }
    finally { busy = false; if (!form.hidden) { button.disabled = false; center.disabled = false; code.disabled = false; } }
  };
  disconnect.onclick = async () => {
    if (!confirm('断开设备接入？局域网功能继续可用，中心的设备记录需在中心网站中解除。')) return;
    try { fill(await call('DELETE')); } catch (err) { info.textContent = TermDoorErrors.format(err); }
  };
  return { refresh };
}
