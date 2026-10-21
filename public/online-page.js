const onlineParams = new URLSearchParams(location.search);
const onlineToken = document.getElementById('online-token');
const onlineKey = document.getElementById('online-key');
onlineToken.value = onlineParams.get('token') || loadSavedToken() || '';
try { onlineKey.value = localStorage.getItem('webcli-secondary-key') || ''; } catch {}
const suggestedCenter = onlineParams.get('center');
if (suggestedCenter) {
  try {
    const url = new URL(suggestedCenter);
    if (url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) document.getElementById('online-center').value = url.origin;
  } catch {}
}
const onlinePage = initOnline({
  authQuery: () => new URLSearchParams({ token: onlineToken.value.trim(), key: onlineKey.value.trim() }).toString(),
  closeAllDropdowns: () => {},
});
document.getElementById('online-auth-form').onsubmit = async (event) => {
  event.preventDefault();
  if (await onlinePage.refresh()) rememberToken(onlineToken.value.trim());
};
