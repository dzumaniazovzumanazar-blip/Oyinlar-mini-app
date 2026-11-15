'use strict';
/* Minimal RFC 6455 WebSocket serveri (tashqi paketsiz). Faqat matnli kadrlar, ping/pong, close. */
const crypto = require('crypto');
const { EventEmitter } = require('events');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', MAX = 64 * 1024;

class Conn extends EventEmitter {
  constructor(socket) {
    super(); this.s = socket; this.buf = Buffer.alloc(0); this.frag = []; this.fragLen = 0;
    this.open = true; this.alive = true; this._ended = false;
    socket.setNoDelay(true);
    socket.on('data', d => this._data(d));
    socket.on('close', () => this._end());
    socket.on('error', () => this._end());
  }
  _data(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    while (this.open) { const f = this._frame(); if (!f) break; this._handle(f); }
  }
  _frame() {
    const b = this.buf; if (b.length < 2) return null;
    const fin = !!(b[0] & 128), op = b[0] & 15, masked = !!(b[1] & 128);
    let len = b[1] & 127, off = 2;
    if (len === 126) { if (b.length < 4) return null; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return null; if (b.readUInt32BE(2)) return this.close(1009), null; len = b.readUInt32BE(6); off = 10; }
    if (len > MAX) return this.close(1009), null;
    if (!masked) return this.close(1002), null;
    if (b.length < off + 4 + len) return null;
    const mask = b.subarray(off, off + 4), payload = Buffer.from(b.subarray(off + 4, off + 4 + len));
    for (let i = 0; i < len; i++) payload[i] ^= mask[i & 3];
    this.buf = b.subarray(off + 4 + len);
    return { fin, op, payload };
  }
  _handle({ fin, op, payload }) {
    if (op === 8) return this.close(1000);
    if (op === 9) return this._write(10, payload);
    if (op === 10) { this.alive = true; return; }
    if (op === 1 || op === 2 || op === 0) {
      this.fragLen += payload.length; if (this.fragLen > MAX) return this.close(1009);
      this.frag.push(payload);
      if (fin) { const m = Buffer.concat(this.frag).toString('utf8'); this.frag = []; this.fragLen = 0; this.emit('message', m); }
    }
  }
  _write(op, p) {
    const n = p.length; let h;
    if (n < 126) h = Buffer.from([128 | op, n]);
    else if (n < 65536) { h = Buffer.alloc(4); h[0] = 128 | op; h[1] = 126; h.writeUInt16BE(n, 2); }
    else { h = Buffer.alloc(10); h[0] = 128 | op; h[1] = 127; h.writeUInt32BE(n, 6); }
    try { this.s.write(Buffer.concat([h, p])); } catch (e) { /* yopilgan */ }
  }
  send(str) { if (this.open) this._write(1, Buffer.from(str)); }
  ping() { if (this.open) this._write(9, Buffer.alloc(0)); }
  close(code = 1000) {
    if (this.open) { const p = Buffer.alloc(2); p.writeUInt16BE(code); this._write(8, p); }
    this.open = false;
    try { this.s.end(); } catch (e) {}
    setTimeout(() => { try { this.s.destroy(); } catch (e) {} }, 500).unref();
    this._end();
  }
  _end() { this.open = false; if (this._ended) return; this._ended = true; this.emit('close'); }
}

/* http 'upgrade' hodisasidan chaqiriladi; muvaffaqiyatli bo‘lsa Conn qaytaradi */
function accept(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key || String(req.headers.upgrade || '').toLowerCase() !== 'websocket') { socket.destroy(); return null; }
  const acc = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  return new Conn(socket);
}
module.exports = { accept };
