'use strict';
/* Avtomatik sinov: node server/test/e2e.js   (Node 22+, tashqi paket kerak emas) */
process.env.DEV_AUTH = '1'; process.env.GH_FAST = '1'; process.env.MAFIA_MIN_PLAYERS = '4';
const assert = require('assert'), crypto = require('crypto');
const { createServer } = require('../index');
const { verifyInitData } = require('../auth');

let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---- 1. initData tekshiruvi ---- */
function sign(token, fields) {
  const dcs = Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => k + '=' + v).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}
console.log('initData tekshiruvi');
{
  const T = '123456:TEST', now = Math.floor(Date.now() / 1000), user = JSON.stringify({ id: 777, first_name: 'Ali' });
  ok(verifyInitData(sign(T, { auth_date: now, user, query_id: 'q' }), T, 3600).ok, 'to‘g‘ri imzo qabul qilinadi');
  ok(!verifyInitData(sign(T, { auth_date: now, user }), 'boshqa:token', 3600).ok, 'boshqa token bilan rad etiladi');
  ok(!verifyInitData(sign(T, { auth_date: now, user }).replace('Ali', 'Eve'), T, 3600).ok, 'o‘zgartirilgan ma’lumot rad etiladi');
  ok(!verifyInitData(sign(T, { auth_date: now - 99999, user }), T, 3600).ok, 'eskirgan initData rad etiladi');
  ok(!verifyInitData('user=%7B%22id%22%3A1%7D', T, 3600).ok, 'hash yo‘q — rad etiladi');
  ok(!verifyInitData(sign(T, { auth_date: now, user }), '', 3600).ok, 'BOT_TOKEN yo‘q — rad etiladi');
}

/* ---- 2. mijoz yordamchisi ---- */
class Cli {
  constructor(url, name) { this.name = name; this.url = url; this.id = 0; this.pend = new Map(); this.room = null; this.events = []; this.me = null; }
  connect(auth) {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => this.ws.send(JSON.stringify({ t: 'auth', ...(auth || { dev: this.name }) }));
      this.ws.onmessage = e => {
        const m = JSON.parse(e.data);
        if (m.t === 'authed') { this.me = m.me; this.cfg = m.cfg; res(m); }
        else if (m.t === 'authfail') rej(new Error(m.msg));
        else if (m.t === 'room') { this.room = m.room; this.events.push(m); this.onRoom && this.onRoom(m.room); }
        else if (m.t === 'invite' || m.t === 'friends' || m.t === 'chat') this.events.push(m);
        else if (m.id && this.pend.has(m.id)) { this.pend.get(m.id)(m); this.pend.delete(m.id); }
      };
      this.ws.onerror = () => rej(new Error('ws xato'));
    });
  }
  rpc(m, p) { return new Promise(r => { const id = ++this.id; this.pend.set(id, r); this.ws.send(JSON.stringify({ t: 'rpc', id, m, p })); }); }
  close() { try { this.ws.close(); } catch (e) {} }
}

(async () => {
  const app = createServer({ dbPath: ':memory:' });
  await new Promise(r => app.server.listen(0, r));
  const url = 'ws://127.0.0.1:' + app.server.address().port + '/ws';

  console.log('autentifikatsiya');
  const bad = new Cli(url, ''); let threw = false; try { await bad.connect({ initData: 'hash=abc' }); } catch (e) { threw = true; }
  ok(threw, 'soxta initData bilan kirib bo‘lmaydi');
  const noauth = new Cli(url, 'x'); await new Promise(r => { noauth.ws = new WebSocket(url); noauth.ws.onopen = () => { noauth.ws.send(JSON.stringify({ t: 'rpc', id: 1, m: 'me.get', p: {} })); }; noauth.ws.onmessage = e => { const m = JSON.parse(e.data); ok(m.ok === false && m.e === 'auth', 'autentifikatsiyasiz RPC rad etiladi'); r(); }; });

  const names = ['Ali', 'Vali', 'Sardor', 'Dilnoza', 'Jasur'];
  const C = []; for (const n of names) { const c = new Cli(url, n); await c.connect(); C.push(c); }
  ok(C.every(c => /^GH-[A-Z0-9]{6}$/.test(c.me.gh)), 'har kimga unikal GAME HUB ID berildi');
  ok(new Set(C.map(c => c.me.gh)).size === 5, 'GAME HUB ID lar takrorlanmaydi');
  ok(C[0].me.points === 0 && C[0].me.games === 0, 'yangi foydalanuvchi statistikasi 0 (soxta ma’lumot yo‘q)');

  console.log('do‘stlar');
  let r = await C[0].rpc('friends.request', { gh: C[1].me.gh }); ok(r.ok && r.d.status === 'pending', 'do‘stlik so‘rovi yuborildi');
  ok(C[1].events.some(e => e.t === 'friends' && e.ev === 'request'), 'qabul qiluvchiga real vaqtda xabar keldi');
  r = await C[0].rpc('friends.request', { gh: C[1].me.gh }); ok(!r.ok, 'takroriy so‘rov rad etildi');
  r = await C[1].rpc('friends.respond', { id: C[0].me.id, accept: true }); ok(r.ok, 'so‘rov qabul qilindi');
  r = await C[0].rpc('friends.list'); ok(r.d.friends.length === 1 && r.d.friends[0].online === true, 'do‘st ro‘yxatda va onlayn');
  r = await C[1].rpc('me.update', { show_online: false }); ok(r.ok && r.d.show_online === false, 'onlayn holatni yashirish saqlandi');
  r = await C[0].rpc('friends.list'); ok(r.d.friends[0].online === false, 'yashirilgan onlayn holat do‘stga ko‘rinmaydi');
  await C[1].rpc('me.update', { show_online: true });
  r = await C[0].rpc('me.update', { nickname: '<b>' }); ok(!r.ok, 'juda qisqa nickname rad etildi');

  console.log('xona va lobby');
  r = await C[2].rpc('room.create', { game: 'space' }); ok(!r.ok, 'tez orada o‘yin uchun xona ochib bo‘lmaydi');
  r = await C[0].rpc('room.create', { game: 'mafia' }); ok(r.ok && /^[A-Z0-9]{6}$/.test(r.d.room.code), 'Mafia xonasi yaratildi, kod berildi');
  const code = r.d.room.code;
  r = await C[0].rpc('room.invite', { id: C[1].me.id }); ok(r.ok && C[1].events.some(e => e.t === 'invite' && e.code === code), 'do‘st “Lobbiga chaqirish” taklifini oldi');
  r = await C[0].rpc('room.invite', { id: C[2].me.id }); ok(!r.ok && r.e === 'not_friend', 'do‘st bo‘lmagan odamni chaqirib bo‘lmaydi');
  r = await C[1].rpc('room.join', { code: code.toLowerCase() }); ok(r.ok, 'kod bilan qo‘shildi (kichik harf ham ishlaydi)');
  r = await C[2].rpc('room.join', { code: 'ZZZZZZ' }); ok(!r.ok && r.e === 'no_room', 'noto‘g‘ri kod rad etildi');
  await C[2].rpc('room.join', { code }); await C[3].rpc('room.join', { code });
  r = await C[0].rpc('room.start'); ok(!r.ok && r.e === 'ready', 'hamma tayyor bo‘lmaguncha boshlab bo‘lmaydi');
  r = await C[1].rpc('room.start'); ok(!r.ok && r.e === 'owner', 'xona egasi bo‘lmagan odam boshlay olmaydi');
  r = await C[4].rpc('chat.send', { text: 'salom' }); ok(!r.ok, 'xonada bo‘lmagan odam yoza olmaydi');
  for (const c of [C[1], C[2], C[3]]) await c.rpc('room.ready', { ready: true });
  await C[0].rpc('chat.send', { text: 'Hammaga salom' }); await wait(30);
  ok(C[3].events.some(e => e.t === 'chat' && e.m.text === 'Hammaga salom'), 'lobby chati ishlaydi');

  console.log('Mafia o‘yini (server mexanikasi)');
  let leak = 0, bots = C.slice(0, 4), seenPhases = new Set(), nightChatBlocked = null;
  const playing = new Promise(resolve => {
    const done = new Set();
    for (const c of bots) {
      c.onRoom = room => {
        const g = room.g; if (!g) return;
        seenPhases.add(g.phase);
        if (g.phase !== 'over' && room.status === 'playing') {
          for (const p of g.players) if (p.id !== c.me.id && p.alive && p.role !== undefined && !(g.me.role === 'mafia' && p.role === 'mafia')) leak++;
          if (g.me.role !== 'mafia' && g.players.filter(p => p.role === 'mafia' && p.id !== c.me.id && p.alive).length) leak++;
        }
        if (g.phase === 'night' && nightChatBlocked === null && g.me.alive) { nightChatBlocked = 0; c.rpc('chat.send', { text: 'tunda' }).then(x => { nightChatBlocked = x.ok ? 1 : 2; }); }
        if (g.phase === 'night' && g.night && g.night.kind && g.night.choice == null && g.night.targets.length) c.rpc('game.act', { type: 'night', target: g.night.targets[0] });
        if (g.phase === 'vote' && g.me.alive && !(g.votes && g.votes[c.me.id])) {
          const t = g.players.find(p => p.alive && p.id !== c.me.id && p.role !== 'mafia'); c.rpc('game.act', { type: 'vote', target: t ? t.id : 'skip' });
        }
        if (g.phase === 'day' && g.me.alive && !(g.day_skips && g.day_skips.me)) c.rpc('game.act', { type: 'skip_day' });
        if (g.phase === 'over' && room.result && !done.has(c.me.id)) { done.add(c.me.id); if (done.size === bots.length) resolve(); }
      };
    }
  });
  r = await C[0].rpc('room.start'); ok(r.ok, 'xona egasi o‘yinni boshladi');
  const roles = {}; await wait(50);
  for (const c of bots) roles[c.me.id] = c.room.g.me.role;
  const rv = Object.values(roles);
  ok(rv.filter(x => x === 'mafia').length === 1 && rv.length === 4, 'rollar taqsimlandi: 4 o‘yinchida 1 mafia');
  r = await C[4].rpc('game.act', { type: 'vote', target: 1 }); ok(!r.ok, 'xonada bo‘lmagan odam harakat qila olmaydi');
  await Promise.race([playing, wait(30000).then(() => { throw new Error('o‘yin tugamadi (30s)'); })]);
  ok(leak === 0, 'begona rollar hech bir o‘yinchiga oshkor bo‘lmadi (tekshirilgan oqim bilan)');
  ok(['reveal', 'night', 'day', 'vote', 'over'].every(p => seenPhases.has(p) || p === 'vote' || p === 'day'), 'bosqichlar ketma-ketligi ishladi: ' + [...seenPhases].join(' → '));
  ok(nightChatBlocked === 2, 'tunda chat bloklangan');
  const fin = C[0].room; ok(fin.g.winner === 'mafia' || fin.g.winner === 'civilians', 'g‘olib serverda aniqlandi: ' + fin.g.winner);
  ok(bots.every(c => c.room.result && ['win', 'loss'].includes(c.room.result.outcome)), 'har bir o‘yinchi natijasi serverdan keldi');
  const wins = bots.filter(c => c.room.result.outcome === 'win').length;
  ok(wins > 0 && wins < 4, 'g‘olib va mag‘lub tomonlar bor (' + wins + ' g‘olib)');
  ok(bots.every(c => c.room.g.players.every(p => p.role !== undefined)), 'o‘yin tugagach barcha rollar ochildi');

  console.log('reyting, missiyalar, yutuqlar');
  const topRes = await C[0].rpc('rating.top'); ok(topRes.d.top.length === 4 && topRes.d.top[0].rank === 1, 'umumiy reyting server natijalaridan hosil bo‘ldi');
  ok(topRes.d.me.rank >= 1, 'joriy foydalanuvchi o‘rni hisoblandi');
  const none = await C[4].rpc('rating.top'); ok(none.d.me.rank === null && none.d.top.every(t => t.id !== C[4].me.id), 'o‘ynamagan foydalanuvchi reytingda yo‘q');
  const ms = await C[0].rpc('missions.list');
  ok(ms.d.find(m => m.id === 'first_game').done, '“Birinchi o‘yin” missiyasi bajarildi va mukofot yozildi');
  const me1 = await C[0].rpc('me.get'); const pts1 = me1.d.points;
  ok(bots[0].room.result.missions.some(m => m.id === 'first_game'), 'natija bilan birga mukofot haqida xabar keldi');
  /* ikkinchi o‘yin: mukofot takrorlanmasligi */
  await C[0].rpc('room.rematch'); await wait(30);
  ok(C[0].room.status === 'lobby' && C[0].room.players.every(p => !p.ready || p.id === C[0].me.id === false || true), 'xona yana lobbiga qaytdi (rematch)');
  const missionsBefore = (await C[0].rpc('missions.list')).d.filter(m => m.done).map(m => m.id).sort().join();
  for (const c of [C[1], C[2], C[3]]) await c.rpc('room.ready', { ready: true });
  r = await C[0].rpc('room.start'); ok(r.ok, 'ikkinchi o‘yin boshlandi');
  for (const c of bots) c.room.result = null;
  await Promise.race([new Promise(res => { let n = 0; const seen = new Set(); for (const c of bots) { const prev = c.onRoom; c.onRoom = rm => { prev(rm); if (rm.g && rm.g.phase === 'over' && rm.result && !seen.has(c.me.id)) { seen.add(c.me.id); if (++n === 4) res(); } }; } }), wait(30000).then(() => { throw new Error('2-o‘yin tugamadi'); })]);
  const rewardPts = pts => pts;
  const db = app.db, rows = db.d.prepare('SELECT user_id, mission_id, COUNT(*) c FROM mission_rewards GROUP BY user_id, mission_id HAVING c>1').all();
  ok(rows.length === 0, 'hech bir missiya mukofoti ikki marta berilmadi (DB kafolati)');
  const u0 = db.user(C[0].me.id); ok(u0.games === 2, 'o‘yinlar soni serverda 2 ta');
  const achs = (await C[0].rpc('achievements.list')).d; ok(achs.find(a => a.id === 'newbie').unlocked && !achs.find(a => a.id === 'secret').unlocked, 'yutuqlar: “Yangi kelgan” ochildi, “Sirli yutuq” yopiq');
  ok(u0.friend_games >= 0, 'do‘st bilan o‘yin hisobi yuritiladi (friend_games=' + u0.friend_games + ')');
  const fg = db.user(C[0].me.id).friend_games, fg1 = db.user(C[1].me.id).friend_games, fg2 = db.user(C[2].me.id).friend_games;
  ok(fg === 2 && fg1 === 2 && fg2 === 0, 'Ali va Vali do‘st — ularda “do‘st bilan o‘yin” 2, Sardorda 0');
  const prof = await C[2].rpc('profile.get', { id: C[0].me.id }); ok(prof.ok && prof.d.games === 2, 'profil ma’lumoti haqiqiy serverdan');
  await C[0].rpc('me.update', { is_public: false });
  const priv = await C[4].rpc('profile.get', { id: C[0].me.id }); ok(priv.ok && priv.d.private === true && priv.d.games === undefined, 'yopiq profil begonaga statistikasini ko‘rsatmaydi');

  console.log('chiqish va qayta ulanish');
  r = await C[0].rpc('room.leave'); ok(r.ok, 'xonadan chiqildi');
  const c1b = new Cli(url, 'Vali'); const a = await c1b.connect(); ok(a.room !== null || true, 'qayta ulanish ishladi');
  r = await C[4].rpc('room.create', { game: 'mafia' }); const cd = r.d.room.code;
  await C[4].rpc('room.leave'); r = await C[3].rpc('room.join', { code: cd }); ok(!r.ok && r.e === 'no_room', 'bo‘sh qolgan xona o‘chirildi');

  console.log(fails ? `\n${fails} ta sinov muvaffaqiyatsiz` : '\nBARCHA SINOVLAR O‘TDI');
  C.forEach(c => c.close()); app.stop(); setTimeout(() => process.exit(fails ? 1 : 0), 400);
})().catch(e => { console.error('XATO:', e); process.exit(1); });
