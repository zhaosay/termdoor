// Each proxied device keeps its assets, API calls and browser storage isolated.
const TERMDoorBase = /^\/d\/[a-f0-9]{24}(?=\/)/.exec(location.pathname)?.[0] || '';
function terminalFetch(url, options) {
  return fetch(typeof url === 'string' && url.startsWith('/') ? TERMDoorBase + url : url, options).then((response) => {
    if (TERMDoorBase && response.status === 401) location.assign('/');
    return response;
  }).catch((error) => { throw new Error(TermDoorErrors.format(error)); });
}

async function terminalJson(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(TermDoorErrors.format(data, response.status));
  return data;
}
function showTermDoorError(error) {
  let banner = document.getElementById('termdoor-error');
  if (!banner) {
    banner = document.createElement('div'); banner.id = 'termdoor-error'; banner.setAttribute('role', 'alert');
    const text = document.createElement('span'); text.className = 'termdoor-error-text';
    const close = document.createElement('button'); close.type = 'button'; close.textContent = '关闭 / Close';
    close.onclick = () => { banner.hidden = true; };
    banner.append(text, close); document.body.append(banner);
  }
  banner.querySelector('span').textContent = TermDoorErrors.format(error); banner.hidden = false;
}
