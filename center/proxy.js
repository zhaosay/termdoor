const http = require('http');
const errors = require('../public/errors');
const zlib = require('zlib');

function targetRequest(req, device, pathname, publicOrigin) {
  const url = new URL(pathname, 'http://localhost');
  url.searchParams.set('token', device.token);
  url.searchParams.set('key', device.key);
  const headers = { ...req.headers, host: new URL(publicOrigin).host, 'accept-encoding': url.pathname.startsWith('/apps/') ? (req.headers['accept-encoding'] || 'identity') : 'identity' };
  delete headers.cookie;
  delete headers.authorization;
  if (!/\.(js|css|png|svg|woff2?)(?:\?|$)/.test(pathname)) delete headers['if-none-match'];
  delete headers['if-modified-since'];
  delete headers['x-forwarded-host'];
  return { host: '127.0.0.1', port: device.port, path: url.pathname + url.search, method: req.method, headers };
}

function proxyHttp(req, res, device, pathname, publicOrigin) {
  const base = `/d/${device.id}`;
  const options = targetRequest(req, device, pathname, publicOrigin);
  const upstream = http.request(options, (response) => {
    const staticAsset = ['GET', 'HEAD'].includes(req.method) && /\.(js|css|png|svg|woff2?)(?:\?|$)/.test(pathname) && [200, 304].includes(response.statusCode) && (response.statusCode === 304 || /^(application\/(javascript|x-javascript)|text\/(css|javascript)|image\/|font\/)/.test(response.headers['content-type'] || ''));
    const headers = { ...response.headers, 'cache-control': staticAsset ? 'private, max-age=300' : 'no-store' };
    delete headers['set-cookie'];
    if (!staticAsset) delete headers.etag;
    delete headers['content-length'];
    if ((response.headers['content-type'] || '').includes('text/html')) {
      delete headers['content-encoding'];
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const html = Buffer.concat(chunks).toString().replace(/(src|href)="\//g, `$1="${base}/`);
        res.writeHead(response.statusCode, headers);
        res.end(html);
      });
    } else {
      if (req.method !== 'HEAD' && response.statusCode !== 304 && !headers['content-encoding'] && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && /^(text\/|application\/(javascript|json))/.test(headers['content-type'] || '')) {
        headers['content-encoding'] = 'gzip'; headers.vary = 'Accept-Encoding';
        res.writeHead(response.statusCode, headers);
        const gzip = zlib.createGzip(); gzip.on('error', () => res.destroy()); response.pipe(gzip).pipe(res);
      } else { res.writeHead(response.statusCode, headers); response.pipe(res); }
    }
    response.on('error', () => res.destroy());
  });
  upstream.setTimeout(30000, () => upstream.destroy());
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(errors.format('Device unavailable'));
  });
  req.on('aborted', () => upstream.destroy());
  req.pipe(upstream);
}

function proxyUpgrade(req, socket, head, device, pathname, publicOrigin, onOpen) {
  const upstream = http.request(targetRequest(req, device, pathname, publicOrigin));
  upstream.setTimeout(10000, () => upstream.destroy());
  upstream.on('upgrade', (response, peer, peerHead) => {
    peer.setTimeout(0);
    const headers = Object.entries(response.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${headers}\r\n\r\n`);
    if (peerHead.length) socket.write(peerHead);
    if (head.length) peer.write(head);
    socket.pipe(peer).pipe(socket);
    socket.on('close', () => peer.destroy());
    peer.on('close', () => socket.destroy());
    peer.on('error', () => socket.destroy());
    onOpen(socket);
  });
  upstream.on('response', (response) => {
    response.resume();
    socket.end(`HTTP/1.1 ${response.statusCode} Connection Failed\r\nConnection: close\r\n\r\n`);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
  socket.on('close', () => upstream.destroy());
  upstream.end();
}
module.exports = { proxyHttp, proxyUpgrade };
