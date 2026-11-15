'use strict';
/* Mafia o‘yin mexanikasi. Barcha qoidalar, rollar va g‘olibni aniqlash SERVERda.
   Klient faqat harakat so‘raydi (game.act); rollar snapshot() orqali faqat huquqi borlarga yuboriladi. */
const crypto = require('crypto');
const CFG = require('../config');

const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ROLE_NAME = { civilian: 'Tinch aholi', mafia: 'Mafia', doctor: 'Doktor', commissar: 'Komissar' };
const team = role => (role === 'mafia' ? 'mafia' : 'civilians');
const err = (code, msg) => Object.assign(new Error(msg), { code });

/* Rol taqsimoti: mafia = n/3 (kamida 1); 5+ o‘yinchida doktor va komissar ham bor */
function plan(n) {
  const mafia = Math.max(1, Math.floor(n / 3)), special = n >= 5 ? 2 : 0;
  return { mafia, doctor: special ? 1 : 0, commissar: special ? 1 : 0, civilian: n - mafia - special };
}
const alive = g => Object.keys(g.p).map(Number).filter(id => g.p[id].alive);
const pub = (g, text, k = 'info') => { g.log.push({ t: Date.now(), k, text }); if (g.log.length > 80) g.log.shift(); };

function setPhase(room, ph, ms) {
  const g = room.g; clearTimeout(g.timer); clearTimeout(g.early);
  g.phase = ph; g.endsAt = Date.now() + ms;
  if (ph === 'night') { g.day++; g.night = { kills: {}, heal: null }; g.checkedTonight = {}; pub(g, `${g.day}-tun boshlandi. Shahar uxlaydi…`, 'night'); }
  if (ph === 'day') { g.skips = new Set(); pub(g, `${g.day}-kun. Muhokama boshlandi.`, 'day'); }
  if (ph === 'vote') { g.votes = {}; pub(g, 'Ovoz berish boshlandi.', 'vote'); }
  g.timer = setTimeout(() => advance(room), ms);
  room.emit();
}
function schedule(room, fn) { const g = room.g, day = g.day, ph = g.phase; clearTimeout(g.early); g.early = setTimeout(() => { if (g.phase === ph && g.day === day) fn(); }, CFG.mafia.times.early); }

function advance(room) {
  const g = room.g, T = CFG.mafia.times;
  if (!g || g.phase === 'over') return;
  if (g.phase === 'reveal') return setPhase(room, 'night', T.night);
  if (g.phase === 'night') return resolveNight(room);
  if (g.phase === 'day') return setPhase(room, 'vote', T.vote);
  if (g.phase === 'vote') return resolveVote(room);
}
function kill(room, id) {
  const g = room.g, p = g.p[id]; p.alive = false;
  return CFG.mafia.revealRoleOnDeath ? ` Roli: ${ROLE_NAME[p.role]}.` : '';
}
function resolveNight(room) {
  const g = room.g, n = g.night, T = CFG.mafia.times, tally = new Map();
  for (const m of alive(g).filter(id => g.p[id].role === 'mafia')) {
    const t = n.kills[m]; if (t && g.p[t] && g.p[t].alive) tally.set(t, (tally.get(t) || 0) + 1);
  }
  let victim = null;
  if (tally.size) { const mx = Math.max(...tally.values()), top = [...tally].filter(([, c]) => c === mx).map(([id]) => id); victim = top[crypto.randomInt(top.length)]; }
  g.lastHeal = n.heal;
  if (victim && victim !== n.heal) pub(g, `Tunda ${room.nick(victim)} o‘ldirildi.${kill(room, victim)}`, 'death');
  else pub(g, 'Bu tun hech kim o‘lmadi.', 'night');
  if (checkEnd(room)) return;
  setPhase(room, 'day', T.day);
}
function resolveVote(room) {
  const g = room.g, T = CFG.mafia.times, tally = new Map(); let skip = 0;
  for (const [v, t] of Object.entries(g.votes)) { if (!g.p[v] || !g.p[v].alive) continue; if (t === 'skip') skip++; else tally.set(+t, (tally.get(+t) || 0) + 1); }
  let out = null;
  if (tally.size) { const mx = Math.max(...tally.values()), top = [...tally].filter(([, c]) => c === mx); if (top.length === 1 && mx > skip) out = top[0][0]; }
  if (out) pub(g, `Ovoz berish natijasi: ${room.nick(out)} o‘yindan chiqarildi.${kill(room, out)}`, 'death');
  else pub(g, 'Ovoz berish natijasiz tugadi — hech kim chiqarilmadi.', 'vote');
  if (checkEnd(room)) return;
  setPhase(room, 'night', T.night);
}
function checkEnd(room) {
  const g = room.g, a = alive(g), m = a.filter(id => g.p[id].role === 'mafia').length, rest = a.length - m;
  let w = null;
  if (m === 0) w = 'civilians'; else if (m >= rest) w = 'mafia';
  if (!w) return false;
  clearTimeout(g.timer); clearTimeout(g.early);
  g.phase = 'over'; g.winner = w; g.endsAt = 0;
  pub(g, w === 'mafia' ? 'O‘yin tugadi: MAFIA g‘alaba qozondi!' : 'O‘yin tugadi: TINCH AHOLI g‘alaba qozondi!', 'end');
  const outcomes = Object.keys(g.p).map(Number).map(id => ({ userId: id, role: g.p[id].role, outcome: !g.p[id].left && team(g.p[id].role) === w ? 'win' : 'loss' }));
  room.finish(w, outcomes);
  return true;
}
function nightDone(g) {
  const a = alive(g);
  const mafia = a.filter(id => g.p[id].role === 'mafia'), doc = a.filter(id => g.p[id].role === 'doctor'), com = a.filter(id => g.p[id].role === 'commissar');
  return mafia.every(id => g.night.kills[id]) && doc.every(id => g.night.heal) && com.every(id => g.checkedTonight && g.checkedTonight[id]);
}

module.exports = {
  id: 'mafia',
  get min() { return CFG.mafia.minPlayers; },
  get max() { return CFG.mafia.maxPlayers; },
  roleName: ROLE_NAME,

  start(room) {
    const ids = room.players.map(p => p.id), pl = plan(ids.length), roles = [];
    for (const [r, c] of Object.entries(pl)) for (let i = 0; i < c; i++) roles.push(r);
    const sh = shuffle(roles), g = (room.g = { day: 0, phase: 'reveal', endsAt: 0, p: {}, night: null, votes: {}, skips: new Set(), log: [], winner: null, lastHeal: null, checks: {}, checkedTonight: {}, timer: null, early: null });
    ids.forEach((id, i) => { g.p[id] = { role: sh[i], alive: true, left: false }; });
    pub(g, `O‘yin boshlandi. Ishtirokchilar: ${ids.length}. Rollar maxfiy taqsimlandi.`, 'info');
    setPhase(room, 'reveal', CFG.mafia.times.reveal);
  },

  canChat(room, uid) {
    const g = room.g; if (!g) return true;
    if (g.phase === 'over') return true;
    return (g.phase === 'day' || g.phase === 'vote') && !!g.p[uid] && g.p[uid].alive;
  },

  act(room, uid, m) {
    const g = room.g, me = g && g.p[uid];
    if (!me || g.phase === 'over') throw err('no_game', 'O‘yin faol emas');
    if (!me.alive) throw err('dead', 'Siz o‘yindan chiqqansiz');
    const target = Number(m.target);
    if (m.type === 'night') {
      if (g.phase !== 'night') throw err('phase', 'Hozir tun emas');
      if (me.role === 'civilian') throw err('role', 'Sizning rolingiz tunda harakat qilmaydi');
      if (!g.p[target] || !g.p[target].alive) throw err('target', 'Noto‘g‘ri tanlov');
      if (me.role === 'mafia') {
        if (g.p[target].role === 'mafia') throw err('target', 'Mafia a’zosini tanlab bo‘lmaydi');
        g.night.kills[uid] = target;
      } else if (me.role === 'doctor') {
        if (CFG.mafia.doctorNoRepeat && g.lastHeal === target) throw err('target', 'Bu odamni ketma-ket ikki tun davolab bo‘lmaydi');
        g.night.heal = target;
      } else if (me.role === 'commissar') {
        if (g.checkedTonight[uid]) throw err('done', 'Bu tun tekshiruv bajarilgan');
        if (target === uid) throw err('target', 'O‘zingizni tekshirib bo‘lmaydi');
        g.checkedTonight[uid] = target;
        (g.checks[uid] = g.checks[uid] || []).push({ day: g.day, target, mafia: g.p[target].role === 'mafia' });
      }
      if (nightDone(g)) schedule(room, () => advance(room));
      return room.emit();
    }
    if (m.type === 'vote') {
      if (g.phase !== 'vote') throw err('phase', 'Hozir ovoz berish emas');
      if (m.target === 'skip') g.votes[uid] = 'skip';
      else { if (!g.p[target] || !g.p[target].alive || target === uid) throw err('target', 'Noto‘g‘ri tanlov'); g.votes[uid] = target; }
      if (alive(g).every(id => g.votes[id])) schedule(room, () => advance(room));
      return room.emit();
    }
    if (m.type === 'skip_day') {
      if (g.phase !== 'day') throw err('phase', 'Hozir muhokama emas');
      g.skips.add(uid);
      if (alive(g).every(id => g.skips.has(id))) return advance(room);
      return room.emit();
    }
    throw err('bad_action', 'Noma’lum harakat');
  },

  leave(room, uid) {
    const g = room.g, p = g && g.p[uid]; if (!p || p.left) return;
    p.left = true;
    if (p.alive) { p.alive = false; pub(g, `${room.nick(uid)} o‘yinni tark etdi.${CFG.mafia.revealRoleOnDeath ? ' Roli: ' + ROLE_NAME[p.role] + '.' : ''}`, 'death'); }
    if (g.phase === 'over') return;
    if (checkEnd(room)) return;
    if (g.phase === 'night' && nightDone(g)) schedule(room, () => advance(room));
    if (g.phase === 'vote' && alive(g).every(id => g.votes[id])) schedule(room, () => advance(room));
    room.emit();
  },

  stop(room) { const g = room.g; if (g) { clearTimeout(g.timer); clearTimeout(g.early); } },

  /* Har bir ko‘ruvchi uchun alohida ko‘rinish: begona rollar HECH QACHON yuborilmaydi */
  snapshot(room, uid) {
    const g = room.g, me = g.p[uid], over = g.phase === 'over', amMafia = me && me.role === 'mafia';
    const players = room.players.map(rp => {
      const p = g.p[rp.id]; if (!p) return { id: rp.id, alive: false };
      const seeRole = rp.id === uid || over || (!p.alive && CFG.mafia.revealRoleOnDeath) || (amMafia && p.role === 'mafia');
      return { id: rp.id, alive: p.alive, left: p.left, role: seeRole ? p.role : undefined };
    });
    const o = { phase: g.phase, day: g.day, endsAt: g.endsAt, winner: g.winner, players, log: g.log.slice(-40), aliveCount: alive(g).length };
    if (me) {
      o.me = { role: me.role, alive: me.alive };
      if (me.alive && g.phase === 'night') {
        const targets = alive(g).filter(id => id !== uid && !(me.role === 'mafia' && g.p[id].role === 'mafia') && !(me.role === 'doctor' && CFG.mafia.doctorNoRepeat && g.lastHeal === id));
        const kind = { mafia: 'kill', doctor: 'heal', commissar: 'check' }[me.role] || null;
        o.night = { kind, targets: kind ? targets : [], choice: kind === 'kill' ? g.night.kills[uid] || null : kind === 'heal' ? g.night.heal || null : kind === 'check' ? g.checkedTonight[uid] || null : null };
        if (kind === 'kill') o.night.picks = Object.fromEntries(Object.entries(g.night.kills).filter(([k]) => g.p[k] && g.p[k].role === 'mafia'));
      }
      if (me.role === 'commissar') o.checks = g.checks[uid] || [];
      if (g.phase === 'day') o.day_skips = { me: g.skips.has(uid), n: g.skips.size };
    }
    if (g.phase === 'vote') o.votes = g.votes;
    return o;
  }
};
