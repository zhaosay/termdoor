// Remembers the access token in this browser, so opening the bare address goes
// straight in instead of asking for it every time. Classic script, loaded
// before app.js. The token is only stored after the server has accepted it.
const TOKEN_STORAGE = 'webcli-token' + TERMDoorBase;

function loadSavedToken() {
  try { return localStorage.getItem(TOKEN_STORAGE) || null; } catch { return null; }
}

function rememberToken(token) {
  try { localStorage.setItem(TOKEN_STORAGE, token); } catch {}
}

function forgetToken() {
  try { localStorage.removeItem(TOKEN_STORAGE); } catch {}
}

// Reload this page with the saved token in the query string, which is where
// app.js reads it from.
function openWithToken(token) {
  const url = new URL(location.href);
  url.searchParams.set('token', token);
  location.replace(url.toString());
}
