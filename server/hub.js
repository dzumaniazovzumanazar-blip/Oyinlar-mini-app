'use strict';
/* Markaz: ulanishlar, autentifikatsiya, RPC va xonalar. */
const crypto = require('crypto');
const CFG = require('./config');
const { verifyInitData } = require('./auth');
const { Room, GAMES, err } = require('./rooms');

const RATE = { win: 5000, max: 40 };

class Hub {
  constructor(db) {
    this.db = db; this.conns = new Map(); this.rooms = new Map(); this.userRoom = new Map(); this.invites = new Map();
    this.H = this.handlers();
    this.sweeper = setInterval(() => this.sweep(), 60000); this.sweeper.unref();
  }
  /* ---------- yordamchilar ---------- */
  freeCode() { for (;;) { const c = Array.from({ length: CFG.rooms.codeLen }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[crypto.randomInt(32)]).join(''); if (!this.rooms.has(c)) return c; } }
  send(uid, msg) { const set = this.conns.get(uid); if (!set) return; const s = JSON.stringify(msg); for (const c of set) c.send(s); }
  online(uid) { return this.conns.has(uid); }
  roomOf(uid) { const c = this.userRoom.get(uid); return c ? this.rooms.get(c) : null; }
  destroyRoom(r) { r.destroy(); this.rooms.delete(r.code); this.broadcastHubStats(); }
  stats() { const rooms = {}; for (const r of this.rooms.values()) if (r.status === 'lobby') rooms[r.game] = (rooms[r.game] || 0) + 1; return { online: this.conns.size, rooms }; }
  broadcastHubStats() { /* onlayn soni so‘ralganda beriladi (hub.stats) — doimiy oqim yo‘q */ }
  sweep() {
    const now = Date.now();
    for (const r of [...this.rooms.values()]) if (!r.connectedCount() && now - r.touched > CFG.rooms.idleMs) this.destroyRoom(r);
    for (const [k, t] of this.invites) if (now - t > 30000) this.invites.delete(k);
  }
  cfgPublic() {
    return {
      botUsername: CFG.BOT_USERNAME, miniapp: CFG.MINIAPP_SHORT, ratingFinal: CFG.rating.final,
      games: Object.fromEntries(Object.values(GAMES).map(g => [g.id, { min: g.min, max: g.max }]))
    };
  }

  /* ---------- ulanish hayoti ---------- */
  attach(conn) {
    conn.user = null; conn.rl = { t: Date.now(), n: 0 };
    const authTimer = setTimeout(() => { if (!conn.user) conn.close(4001); }, 10000); authTimer.unref();
    conn.on('message', m => this.onMessage(conn, m));
    conn.on('close', () => { clearTimeout(authTimer); this.onClose(conn); });
  }
  onMessage(conn, raw) {
    const now = Date.now();
    if (now - conn.rl.t > RATE.win) conn.rl = { t: now, n: 0 };
    if (++conn.rl.n > RATE.max) return conn.send(JSON.stringify({ t: 'rate' }));
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'auth') return this.auth(conn, m);
    if (!conn.user) return conn.send(JSON.stringify({ id: m.id, ok: false, e: 'auth', msg: 'Avval kirish kerak' }));
    if (m.t !== 'rpc' || typeof m.m !== 'string') return;
    const h = this.H[m.m];
    if (!h) return conn.send(JSON.stringify({ id: m.id, ok: false, e: 'method', msg: 'Noma’lum so‘rov' }));
    try {
      const d = h.call(this, conn.user, m.p || {}, conn);
      conn.send(JSON.stringify({ id: m.id, ok: true, d: d === undefined ? null : d }));
    } catch (e) {
      if (!e.code) console.error('[rpc ' + m.m + ']', e);
      conn.send(JSON.stringify({ id: m.id, ok: false, e: e.code || 'server', msg: e.code ? e.message : 'Server xatosi' }));
    }
  }
  auth(conn, m) {
    if (conn.user) return;
    const fail = (msg) => { conn.send(JSON.stringify({ t: 'authfail', msg })); setTimeout(() => conn.close(4003), 100); };
    let ext, prof, start = '';
    if (typeof m.initData === 'string' && m.initData) {
      const r = verifyInitData(m.initData, CFG.BOT_TOKEN, CFG.AUTH_MAX_AGE_SEC);
      if (!r.ok) return fail('Telegram tasdiqlashi muvaffaqiyatsiz: ' + r.err);
      ext = 'tg:' + r.user.id; prof = { first_name: r.user.first_name || r.user.username || '', photo_url: r.user.photo_url }; start = r.startParam;
    } else if (typeof m.dev === 'string' && CFG.DEV_AUTH) {
      const name = m.dev.replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 20);
      if (!name) return fail('dev ism noto‘g‘ri');
      ext = 'dev:' + name.toLowerCase(); prof = { first_name: name };
    } else return fail('Telegram ichida oching (yoki serverda DEV_AUTH=1 yoqing)');
    const u = this.db.upsertUser(ext, prof);
    conn.user = u.id;
    let set = this.conns.get(u.id); if (!set) this.conns.set(u.id, (set = new Set()));
    set.add(conn);
    const r = this.roomOf(u.id);
    if (r) { const p = r.players.find(x => x.id === u.id); if (p) { p.connected = true; clearTimeout(p.dc); r.touched = Date.now(); } }
    conn.send(JSON.stringify({ t: 'authed', me: this.db.view(u, true), cfg: this.cfgPublic(), start, room: r ? r.code : null }));
    if (r) r.emit();
  }
  onClose(conn) {
    const uid = conn.user; if (!uid) return;
    const set = this.conns.get(uid); if (!set) return;
    set.delete(conn); if (set.size) return;
    this.conns.delete(uid);
    const r = this.roomOf(uid); if (!r) return;
    const p = r.players.find(x => x.id === uid); if (!p) return;
    p.connected = false; r.touched = Date.now(); r.emit();
    if (r.status !== 'playing') p.dc = setTimeout(() => { if (!this.online(uid)) r.remove(uid); }, CFG.rooms.lobbyGraceMs);
  }

  /* ---------- RPC usullari: (userId, params, conn) ---------- */
  handlers() {
    const db = this.db, need = (v, msg) => { if (!v) throw err('bad', msg); return v; };
    const card = (u) => ({ ...db.basic(u), level: db.level(u.points), points: u.points, games: u.games, wins: u.wins, online: this.online(u.id) && !!u.show_online });
    return {
      'me.get': uid => db.view(db.user(uid), true),
      'me.update': (uid, p) => {
        try { return db.view(db.updateSettings(uid, { nickname: p.nickname, show_online: p.show_online, is_public: p.is_public }), true); }
        catch (e) { if (e.code === 'bad_nick') throw e; throw e; }
      },
      'hub.stats': () => this.stats(),
      'rating.top': uid => { const me = db.user(uid); return { top: db.top(50), me: { rank: db.rankOf(me), points: me.points, wins: me.wins, losses: me.losses, games: me.games } }; },
      'profile.get': (uid, p) => {
        const u = need(db.user(+p.id), 'Foydalanuvchi topilmadi');
        const friend = db.areFriends(uid, u.id);
        if (u.id !== uid && !u.is_public && !friend) return { ...db.basic(u), private: true };
        return { ...db.view(u, false), friend, online: this.online(u.id) && !!u.show_online, history: u.id === uid || friend ? db.history(u.id, 10) : [] };
      },
      'friends.list': uid => {
        const L = db.friendLists(uid);
        return { friends: L.friends.map(card).sort((a, b) => b.online - a.online || a.nick.localeCompare(b.nick)), incoming: L.incoming.map(card), outgoing: L.outgoing.map(card) };
      },
      'friends.search': (uid, p) => db.search(uid, p.q).map(u => ({ ...db.basic(u), level: db.level(u.points), relation: (db.friendship(uid, u.id) || {}).status || null })),
      'friends.request': (uid, p) => {
        const t = p.id ? db.user(+p.id) : db.userByGh(p.gh); need(t, 'GAME HUB ID bo‘yicha foydalanuvchi topilmadi');
        const st = db.request(uid, t.id);
        this.send(t.id, { t: 'friends', ev: st === 'accepted' ? 'accepted' : 'request', from: db.basic(db.user(uid)) });
        return { status: st };
      },
      'friends.respond': (uid, p) => { db.respond(uid, +p.id, !!p.accept); this.send(+p.id, { t: 'friends', ev: p.accept ? 'accepted' : 'declined', from: db.basic(db.user(uid)) }); },
      'friends.remove': (uid, p) => { db.removeFriend(uid, +p.id); },
      'missions.list': uid => db.missionList(uid),
      'achievements.list': uid => db.achievementList(uid),
      'history.list': uid => db.history(uid, 20),

      /* ----- xonalar ----- */
      'room.create': (uid, p) => {
        const G = GAMES[p.game]; if (!G) throw err('game', 'Bu o‘yin hali mavjud emas');
        const cur = this.roomOf(uid);
        if (cur) { if (cur.status === 'playing') throw err('busy', 'Siz hozir o‘yindasiz'); cur.remove(uid); }
        const r = new Room(this, p.game, db.user(uid)); this.rooms.set(r.code, r); this.userRoom.set(uid, r.code);
        return { room: r.snapshot(uid), chat: r.chat };
      },
      'room.join': (uid, p) => {
        const code = String(p.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const r = this.rooms.get(code); if (!r) throw err('no_room', 'Xona topilmadi. Kodni tekshiring');
        if (r.has(uid)) { const pl = r.players.find(x => x.id === uid); if (!pl.left) { this.userRoom.set(uid, code); pl.connected = true; return { room: r.snapshot(uid), chat: r.chat }; } }
        if (r.status !== 'lobby') throw err('started', 'Bu xonada o‘yin boshlangan');
        if (r.players.length >= r.max) throw err('full', 'Xona to‘lgan');
        const cur = this.roomOf(uid);
        if (cur) { if (cur.status === 'playing') throw err('busy', 'Siz hozir o‘yindasiz'); cur.remove(uid); }
        r.add(db.user(uid)); this.userRoom.set(uid, code); r.emit();
        return { room: r.snapshot(uid), chat: r.chat };
      },
      'room.get': uid => { const r = this.roomOf(uid); return r ? { room: r.snapshot(uid), chat: r.chat } : null; },
      'room.leave': uid => { const r = this.roomOf(uid); if (r) r.remove(uid); },
      'room.ready': (uid, p) => { need(this.roomOf(uid), 'Xonada emassiz').setReady(uid, p.ready); },
      'room.start': uid => { need(this.roomOf(uid), 'Xonada emassiz').start(uid); },
      'room.rematch': uid => { need(this.roomOf(uid), 'Xonada emassiz').rematch(uid); },
      'room.invite': (uid, p) => {
        const r = need(this.roomOf(uid), 'Xonada emassiz'), fid = +p.id;
        if (r.status !== 'lobby') throw err('status', 'Faqat lobbida chaqirish mumkin');
        if (!db.areFriends(uid, fid)) throw err('not_friend', 'Bu foydalanuvchi sizning do‘stingiz emas');
        if (r.has(fid)) throw err('in_room', 'U allaqachon xonada');
        if (!this.online(fid)) throw err('offline', 'Do‘st hozir onlayn emas. Xona havolasini Telegram orqali yuboring');
        const key = uid + ':' + fid + ':' + r.code, last = this.invites.get(key);
        if (last && Date.now() - last < 15000) throw err('wait', 'Yaqinda chaqirgansiz');
        this.invites.set(key, Date.now());
        this.send(fid, { t: 'invite', code: r.code, game: r.game, from: db.basic(db.user(uid)) });
      },
      'game.act': (uid, p) => { const r = need(this.roomOf(uid), 'Xonada emassiz'); if (r.status !== 'playing') throw err('status', 'O‘yin faol emas'); r.impl.act(r, uid, p); },
      'chat.send': (uid, p) => {
        const r = need(this.roomOf(uid), 'Xonada emassiz'), now = Date.now(), pl = r.players.find(x => x.id === uid);
        if (pl._chat && now - pl._chat < 800) throw err('wait', 'Sekinroq yozing'); pl._chat = now; r.addChat(uid, p.text);
      }
    };
  }
  shutdown() { clearInterval(this.sweeper); for (const r of this.rooms.values()) r.destroy(); }
}
module.exports = { Hub };
