const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const zlib = require('zlib');
const { DATA_DIR } = require('./config');

function configuredApps(file = path.join(DATA_DIR, 'apps.json')) {
  try {
    const registry = require('./app-registry');
    return registry.read(file).flatMap((app) => {
      try { return app.enabled === true ? [registry.validate({ ...app, name: String(app.name || app.id).slice(0, 40) })] : []; }
      catch { return []; }
    });
  } catch { return []; }
}
function listApps() { return configuredApps().map(({ id, name }) => ({ id, name: String(name || id).slice(0, 40) })); }

// Only locally configured loopback services are reachable. Browser input never chooses a target.
function proxyApp(req, res, url, apps = configuredApps()) {
  const match = /^\/apps\/([a-z][a-z0-9-]{0,31})(\/.*)$/.exec(url.pathname);
  const app = match && apps.find((item) => item.id === match[1]);
  const fail = (status, errorCode, errorZh, errorEn) => {
    if (res.headersSent) return res.destroy();
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ errorCode, errorZh, errorEn, error: `${errorZh} / ${errorEn}` }));
  };
  if (!app) return fail(404, 'TD-APP-001', '应用未接入', 'Application is not configured');
  let key;
  try { key = fs.readFileSync(app.keyFile, 'utf8').trim(); } catch {}
  if (!key) return fail(503, 'TD-APP-002', '应用访问凭据不可用', 'Application credentials are unavailable');
  const stamp = String(Math.floor(Date.now() / 1000) + 60);
  const signature = crypto.createHmac('sha256', key).update(stamp).digest('hex');
  const target = new URL(match[2] + url.search, 'http://aimini.gateway.invalid');
  target.searchParams.delete('token'); target.searchParams.delete('key');
  const headers = { ...req.headers, host: 'aimini.gateway.invalid', cookie: `aimini_session=${stamp}.${signature}`, 'accept-encoding': 'identity' };
  for (const name of ['authorization', 'forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'connection', 'upgrade', 'referer']) delete headers[name];
  if (headers.origin) headers.origin = 'http://aimini.gateway.invalid';
  const base = `/apps/${app.id}`;
  const upstream = http.request({ host: '127.0.0.1', port: app.port, method: req.method, path: target.pathname + target.search, headers }, (response) => {
    const staticAsset = ['GET', 'HEAD'].includes(req.method) && match[2].startsWith('/static/') && /^(application\/(javascript|x-javascript)|text\/(css|javascript)|image\/|font\/)/.test(response.headers['content-type'] || '') && response.statusCode === 200;
    const outgoing = { ...response.headers, 'cache-control': staticAsset ? 'private, max-age=300' : 'no-store' };
    for (const name of ['set-cookie', 'content-length', 'content-encoding', 'etag']) delete outgoing[name];
    if (outgoing.location?.startsWith('/')) outgoing.location = base + outgoing.location;
    if ((outgoing['content-type'] || '').includes('text/html')) {
      const chunks = []; let size = 0;
      response.on('data', (chunk) => { size += chunk.length; if (size > 8 * 1024 * 1024) upstream.destroy(); else chunks.push(chunk); });
      response.on('end', () => {
        const html = Buffer.concat(chunks).toString().replace(/(src|href|action)="\/(?!\/)/g, `$1="${base}/`);
        res.writeHead(response.statusCode, outgoing); res.end(html);
      });
    } else if (/\bgzip\b/.test(req.headers['accept-encoding'] || '') && /^(application\/json|application\/javascript|text\/)/.test(outgoing['content-type'] || '')) {
      outgoing['content-encoding'] = 'gzip'; outgoing.vary = 'Accept-Encoding';
      delete outgoing['transfer-encoding'];
      res.writeHead(response.statusCode, outgoing);
      const compressed = zlib.createGzip();
      compressed.on('error', () => res.destroy());
      response.pipe(compressed).pipe(res);
    } else { res.writeHead(response.statusCode, outgoing); response.pipe(res); }
    response.on('error', () => res.destroy());
  });
  upstream.setTimeout(60000, () => upstream.destroy());
  upstream.on('error', () => fail(502, 'TD-APP-003', '中枢暂时无法连接', 'Hub is temporarily unavailable'));
  req.on('aborted', () => upstream.destroy());
  res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
  req.pipe(upstream);
}
module.exports = { configuredApps, listApps, proxyApp };
