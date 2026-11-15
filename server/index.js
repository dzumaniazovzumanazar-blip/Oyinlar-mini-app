'use strict';
/* GAME HUB server: statik frontend + WebSocket (/ws). Ishga tushirish: node --no-warnings server/index.js */
const http = require('http'), fs = require('fs'), path = require('path');
const CFG = require('./config');
const { DB } = require('./db');
const { Hub } = require('./hub');
const ws = require('./ws-lite');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json' };
const PUBLIC = /^\/(index\.html|css\/[\w.-]+|js\/[\w.-]+|assets\/[\w.-]+)?$/;

function createServer(opts = {}) {
  const db = new DB(opts.dbPath || CFG.DB_PATH), hub = new Hub(db);
  const server = http.createServer((req, res) => {
    const url = (req.url || '/').split('?')[0];
    if (url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, online: hub.conns.size })); }
    if (!PUBLIC.test(url)) { res.writeHead(404); return res.end('Not found'); }
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (e, buf) => {
      if (e) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(buf);
    });
  });
  const conns = new Set();
  server.on('upgrade', (req, socket) => {
    if ((req.url || '').split('?')[0] !== '/ws') return socket.destroy();
    const o = req.headers.origin;
    if (CFG.ALLOWED_ORIGINS.length && o && !CFG.ALLOWED_ORIGINS.includes(o)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); return socket.destroy(); }
    const c = ws.accept(req, socket); if (!c) return;
    conns.add(c); c.on('close', () => conns.delete(c)); hub.attach(c);
  });
  const hb = setInterval(() => { for (const c of conns) { if (!c.alive) { c.close(1001); continue; } c.alive = false; c.ping(); } }, 25000); hb.unref();
  const stop = () => { clearInterval(hb); hub.shutdown(); for (const c of conns) c.close(1001); server.close(); setTimeout(() => db.close(), 200); };
  return { server, hub, db, stop };
}

if (require.main === module) {
  if (!CFG.BOT_TOKEN && !CFG.DEV_AUTH) console.warn('[!] BOT_TOKEN ham, DEV_AUTH ham sozlanmagan: hech kim kira olmaydi. README.md ni ko‘ring.');
  if (CFG.DEV_AUTH) console.warn('[!] DEV_AUTH=1 — Telegramsiz kirish YOQILGAN. Faqat lokal sinov uchun!');
  const app = createServer();
  app.server.listen(CFG.PORT, () => console.log(`GAME HUB server: http://localhost:${CFG.PORT}  (ws: /ws)`));
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { app.stop(); setTimeout(() => process.exit(0), 300); });
}
module.exports = { createServer };
