function initOnline({ authQuery, closeAllDropdowns }) {
  const row = document.getElementById('online-row');
  const dialog = document.getElementById('online-dialog');
  const info = document.getElementById('online-info');
  const center = document.getElementById('online-center');
  const code = document.getElementById('online-code');
  const button = document.getElementById('online-bind');
  const disconnect = document.getElementById('online-disconnect');
  const endpoint = `/api/online?${authQuery}`;
  async function call(method = 'GET', body) {
    const response = await terminalFetch(endpoint, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '连接失败');
    return result;
  }
  function fill(state) {
    center.value = state.center || '';
    center.disabled = state.configured; code.disabled = state.configured; button.disabled = state.configured;
    disconnect.hidden = !state.configured;
    info.textContent = state.error || (state.configured ? state.running && state.lastHeartbeat ? '已接入线上中心。请在中心设备列表确认终端通路。' : '已绑定，正在连接…' : '可选功能。绑定后可从线上访问，原有局域网功能继续可用。');
  }
  call().then(() => {
    row.hidden = false;
    document.getElementById('online-button').onclick = async () => {
      closeAllDropdowns(); dialog.showModal();
      try { fill(await call()); } catch (err) { info.textContent = err.message; }
    };
  }).catch(() => {});
  document.getElementById('online-form').onsubmit = async (event) => {
    event.preventDefault(); button.disabled = true; info.textContent = '正在准备客户端并绑定设备…';
    try { fill(await call('POST', { center: center.value.trim(), code: code.value.trim() })); code.value = ''; }
    catch (err) { info.textContent = err.message; button.disabled = false; }
  };
  disconnect.onclick = async () => {
    if (!confirm('断开线上连接？局域网功能继续可用，中心设备记录可在网站中解绑。')) return;
    try { fill(await call('DELETE')); } catch (err) { info.textContent = err.message; }
  };
}
