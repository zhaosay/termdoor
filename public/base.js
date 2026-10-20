// Each proxied device keeps its assets, API calls and browser storage isolated.
const TERMDoorBase = /^\/d\/[a-f0-9]{24}(?=\/)/.exec(location.pathname)?.[0] || '';
function terminalFetch(url, options) {
  return fetch(typeof url === 'string' && url.startsWith('/') ? TERMDoorBase + url : url, options).then((response) => {
    if (TERMDoorBase && response.status === 401) location.assign('/');
    return response;
  });
}
