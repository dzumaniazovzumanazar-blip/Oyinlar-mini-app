'use strict';
/* Ma'lumotlar bazasi qatlami (SQLite, node:sqlite). Boshqa bazaga (Postgres) o‘tish uchun faqat shu fayl almashtiriladi. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const CFG = require('./config');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ext_id TEXT UNIQUE NOT NULL, gh_id TEXT UNIQUE NOT NULL,
  first_name TEXT, nickname TEXT NOT NULL, photo_url TEXT,
  points INTEGER NOT NULL DEFAULT 0, games INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0, draws INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0, best_streak INTEGER NOT NULL DEFAULT 0, friend_games INTEGER NOT NULL DEFAULT 0,
  show_online INTEGER NOT NULL DEFAULT 1, is_public INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL, last_seen INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_rank ON users(points DESC, wins DESC, id);
CREATE TABLE IF NOT EXISTS friendships(
  a INTEGER NOT NULL, b INTEGER NOT NULL, status TEXT NOT NULL, requester INTEGER NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY(a,b)
);
CREATE TABLE IF NOT EXISTS matches(
  id INTEGER PRIMARY KEY AUTOINCREMENT, game TEXT NOT NULL, room_code TEXT, started_at INTEGER, ended_at INTEGER NOT NULL, winner TEXT
);
CREATE TABLE IF NOT EXISTS match_players(
  match_id INTEGER NOT NULL, user_id INTEGER NOT NULL, role TEXT, outcome TEXT NOT NULL, delta INTEGER NOT NULL, with_friend INTEGER NOT NULL,
  PRIMARY KEY(match_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_mp_user ON match_players(user_id, match_id DESC);
CREATE TABLE IF NOT EXISTS mission_rewards(
  user_id INTEGER NOT NULL, mission_id TEXT NOT NULL, points INTEGER NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, mission_id)            -- bir missiya mukofoti ikki marta berilmasligi KAFOLATI
);
CREATE TABLE IF NOT EXISTS achievements(
  user_id INTEGER NOT NULL, ach_id TEXT NOT NULL, unlocked_at INTEGER NOT NULL, PRIMARY KEY(user_id, ach_id)
);`;

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rnd = n => Array.from({ length: n }, () => ALPHA[crypto.randomInt(ALPHA.length)]).join('');
const cleanNick = s => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
const httpsUrl = u => (typeof u === 'string' && /^https:\/\//.test(u) && u.length < 400 ? u : null);

class DB {
  constructor(file) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.d = new DatabaseSync(file);
    this.d.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;');
    this.d.exec(SCHEMA);
    this.q = {}; // prepared statement keshi
  }
  p(sql) { return this.q[sql] || (this.q[sql] = this.d.prepare(sql)); }
  tx(fn) { this.d.exec('BEGIN IMMEDIATE'); try { const r = fn(); this.d.exec('COMMIT'); return r; } catch (e) { this.d.exec('ROLLBACK'); throw e; } }

  /* ---- foydalanuvchilar ---- */
  user(id) { return this.p('SELECT * FROM users WHERE id=?').get(id) || null; }
  userByGh(gh) { return this.p('SELECT * FROM users WHERE gh_id=?').get(String(gh || '').toUpperCase().trim()) || null; }
  upsertUser(extId, { first_name, photo_url }) {
    const fn = cleanNick(first_name), ph = httpsUrl(photo_url), now = Date.now();
    let u = this.p('SELECT * FROM users WHERE ext_id=?').get(extId);
    if (u) {
      this.p('UPDATE users SET first_name=?, photo_url=?, last_seen=? WHERE id=?').run(fn || u.first_name, ph, now, u.id);
      return this.user(u.id);
    }
    for (let i = 0; i < 8; i++) {
      try {
        const r = this.p('INSERT INTO users(ext_id,gh_id,first_name,nickname,photo_url,created_at,last_seen) VALUES(?,?,?,?,?,?,?)')
          .run(extId, 'GH-' + rnd(6), fn, fn || 'O‘yinchi', ph, now, now);
        return this.user(r.lastInsertRowid);
      } catch (e) { if (!/UNIQUE/.test(String(e.message))) throw e; if (this.p('SELECT 1 FROM users WHERE ext_id=?').get(extId)) return this.p('SELECT * FROM users WHERE ext_id=?').get(extId); }
    }
    throw new Error('GAME HUB ID yaratib bo‘lmadi');
  }
  updateSettings(id, { nickname, show_online, is_public }) {
    const u = this.user(id); if (!u) return null;
    let nick = u.nickname;
    if (nickname !== undefined) { nick = cleanNick(nickname); if (nick.length < 2) throw Object.assign(new Error('Nickname kamida 2 belgi bo‘lsin'), { code: 'bad_nick' }); }
    this.p('UPDATE users SET nickname=?, show_online=?, is_public=? WHERE id=?')
      .run(nick, show_online === undefined ? u.show_online : (show_online ? 1 : 0), is_public === undefined ? u.is_public : (is_public ? 1 : 0), id);
    return this.user(id);
  }
  favGame(id) {
    const r = this.p('SELECT m.game g, COUNT(*) c FROM match_players mp JOIN matches m ON m.id=mp.match_id WHERE mp.user_id=? GROUP BY m.game ORDER BY c DESC, m.game LIMIT 1').get(id);
    return r ? r.g : null;
  }
  level(points) { return 1 + Math.floor(points / CFG.rating.levelStep); }
  /* Klientga yuboriladigan profil (self=true bo‘lsa sozlamalar ham) */
  view(u, self) {
    if (!u) return null;
    const o = {
      id: u.id, gh: u.gh_id, nick: u.nickname, photo: u.photo_url, points: u.points, level: this.level(u.points),
      games: u.games, wins: u.wins, losses: u.losses, draws: u.draws,
      winRate: u.games ? Math.round((u.wins / u.games) * 100) : null, streak: u.streak, bestStreak: u.best_streak, fav: this.favGame(u.id)
    };
    if (self) { o.show_online = !!u.show_online; o.is_public = !!u.is_public; }
    return o;
  }
  basic(u) { return { id: u.id, gh: u.gh_id, nick: u.nickname, photo: u.photo_url }; }

  /* ---- reyting ---- */
  top(limit = 50) {
    return this.p('SELECT * FROM users WHERE games>0 ORDER BY points DESC, wins DESC, id ASC LIMIT ?').all(limit)
      .map((u, i) => ({ rank: i + 1, id: u.id, gh: u.gh_id, nick: u.nickname, photo: u.photo_url, points: u.points, wins: u.wins, losses: u.losses }));
  }
  rankOf(u) {
    if (!u.games) return null;
    return this.p('SELECT COUNT(*)+1 n FROM users WHERE games>0 AND (points>? OR (points=? AND wins>?) OR (points=? AND wins=? AND id<?))')
      .get(u.points, u.points, u.wins, u.points, u.wins, u.id).n;
  }

  /* ---- do‘stlar ---- */
  pair(x, y) { return x < y ? [x, y] : [y, x]; }
  friendship(x, y) { const [a, b] = this.pair(x, y); return this.p('SELECT * FROM friendships WHERE a=? AND b=?').get(a, b) || null; }
  areFriends(x, y) { const f = this.friendship(x, y); return !!f && f.status === 'accepted'; }
  friendIds(id) {
    return this.p("SELECT CASE WHEN a=? THEN b ELSE a END f FROM friendships WHERE (a=? OR b=?) AND status='accepted'").all(id, id, id).map(r => r.f);
  }
  request(from, to) {
    if (from === to) throw Object.assign(new Error('O‘zingni qo‘sha olmaysan'), { code: 'self' });
    if (!this.user(to)) throw Object.assign(new Error('Foydalanuvchi topilmadi'), { code: 'no_user' });
    const f = this.friendship(from, to);
    if (f) {
      if (f.status === 'accepted') throw Object.assign(new Error('Allaqachon do‘st'), { code: 'already' });
      if (f.requester === from) throw Object.assign(new Error('So‘rov allaqachon yuborilgan'), { code: 'pending' });
      this.setStatus(from, to, 'accepted'); return 'accepted'; // ikkala tomon ham so‘ragan
    }
    const [a, b] = this.pair(from, to);
    this.p("INSERT INTO friendships(a,b,status,requester,created_at) VALUES(?,?,'pending',?,?)").run(a, b, from, Date.now());
    return 'pending';
  }
  setStatus(x, y, st) { const [a, b] = this.pair(x, y); this.p('UPDATE friendships SET status=? WHERE a=? AND b=?').run(st, a, b); }
  respond(me, other, accept) {
    const f = this.friendship(me, other);
    if (!f || f.status !== 'pending' || f.requester === me) throw Object.assign(new Error('So‘rov topilmadi'), { code: 'no_request' });
    if (accept) this.setStatus(me, other, 'accepted'); else this.removeFriend(me, other);
  }
  removeFriend(x, y) { const [a, b] = this.pair(x, y); this.p('DELETE FROM friendships WHERE a=? AND b=?').run(a, b); }
  friendLists(id) {
    const rows = this.p('SELECT f.status, f.requester, u.* FROM friendships f JOIN users u ON u.id = CASE WHEN f.a=? THEN f.b ELSE f.a END WHERE f.a=? OR f.b=?').all(id, id, id);
    return {
      friends: rows.filter(r => r.status === 'accepted'),
      incoming: rows.filter(r => r.status === 'pending' && r.requester !== id),
      outgoing: rows.filter(r => r.status === 'pending' && r.requester === id)
    };
  }
  search(me, q) {
    q = String(q || '').trim().slice(0, 30); if (q.length < 2) return [];
    const like = q.replace(/[%_\\]/g, m => '\\' + m) + '%';
    return this.p("SELECT * FROM users WHERE id<>? AND is_public=1 AND (gh_id=? OR nickname LIKE ? ESCAPE '\\') ORDER BY points DESC LIMIT 15")
      .all(me, q.toUpperCase(), like);
  }

  /* ---- tarix, missiyalar, yutuqlar ---- */
  history(id, n = 20) {
    return this.p('SELECT m.game, m.ended_at, mp.outcome, mp.delta, mp.role FROM match_players mp JOIN matches m ON m.id=mp.match_id WHERE mp.user_id=? ORDER BY m.id DESC LIMIT ?').all(id, n);
  }
  metrics(u) {
    const mw = this.p("SELECT COUNT(*) n FROM match_players mp JOIN matches m ON m.id=mp.match_id WHERE mp.user_id=? AND m.game='mafia' AND mp.outcome='win'").get(u.id).n;
    return { games: u.games, wins: u.wins, best_streak: u.best_streak, friend_games: u.friend_games, mafia_wins: mw };
  }
  missionList(id) {
    const u = this.user(id), m = this.metrics(u);
    const got = new Map(this.p('SELECT mission_id, created_at FROM mission_rewards WHERE user_id=?').all(id).map(r => [r.mission_id, r.created_at]));
    return CFG.missions.map(d => ({ id: d.id, title: d.title, desc: d.desc, goal: d.goal, reward: d.reward, progress: Math.min(d.goal, m[d.metric] || 0), done: got.has(d.id), at: got.get(d.id) || null }));
  }
  achievementList(id) {
    const u = this.user(id), m = this.metrics(u);
    const got = new Map(this.p('SELECT ach_id, unlocked_at FROM achievements WHERE user_id=?').all(id).map(r => [r.ach_id, r.unlocked_at]));
    return CFG.achievements.map(d => ({ id: d.id, title: d.title, desc: d.desc, goal: d.goal, progress: d.metric ? Math.min(d.goal, m[d.metric] || 0) : 0, unlocked: got.has(d.id), hidden: !d.metric }));
  }
  /* Missiya mukofotlari va yutuqlar. Tranzaksiya ichida chaqiriladi. PRIMARY KEY tufayli mukofot faqat bir marta yoziladi. */
  settle(userId) {
    const u = this.user(userId), m = this.metrics(u), now = Date.now(), newMissions = [], newAchs = [];
    for (const d of CFG.missions) {
      if ((m[d.metric] || 0) < d.goal) continue;
      const r = this.p('INSERT OR IGNORE INTO mission_rewards(user_id,mission_id,points,created_at) VALUES(?,?,?,?)').run(userId, d.id, d.reward, now);
      if (r.changes === 1) { this.p('UPDATE users SET points=points+? WHERE id=?').run(d.reward, userId); newMissions.push({ id: d.id, title: d.title, reward: d.reward }); }
    }
    for (const d of CFG.achievements) {
      if (!d.metric || (m[d.metric] || 0) < d.goal) continue;
      const r = this.p('INSERT OR IGNORE INTO achievements(user_id,ach_id,unlocked_at) VALUES(?,?,?)').run(userId, d.id, now);
      if (r.changes === 1) newAchs.push({ id: d.id, title: d.title });
    }
    return { newMissions, newAchs };
  }

  /* ---- o‘yin natijasini yozish (FAQAT server chaqiradi) ----
     players: [{userId, role, outcome:'win'|'loss'|'draw', withFriend}] */
  recordMatch({ game, code, startedAt, winner, players }) {
    const R = CFG.rating;
    return this.tx(() => {
      const mid = this.p('INSERT INTO matches(game,room_code,started_at,ended_at,winner) VALUES(?,?,?,?,?)').run(game, code, startedAt || null, Date.now(), winner || null).lastInsertRowid;
      const out = {};
      for (const pl of players) {
        const u = this.user(pl.userId); if (!u) continue;
        const delta = pl.outcome === 'win' ? R.win : pl.outcome === 'draw' ? R.draw : R.loss;
        const pts = Math.max(R.floor, u.points + delta), real = pts - u.points;
        const streak = pl.outcome === 'win' ? u.streak + 1 : 0;
        this.p('UPDATE users SET points=?, games=games+1, wins=wins+?, losses=losses+?, draws=draws+?, streak=?, best_streak=MAX(best_streak,?), friend_games=friend_games+? WHERE id=?')
          .run(pts, pl.outcome === 'win' ? 1 : 0, pl.outcome === 'loss' ? 1 : 0, pl.outcome === 'draw' ? 1 : 0, streak, streak, pl.withFriend ? 1 : 0, u.id);
        this.p('INSERT INTO match_players(match_id,user_id,role,outcome,delta,with_friend) VALUES(?,?,?,?,?,?)').run(mid, u.id, pl.role || null, pl.outcome, real, pl.withFriend ? 1 : 0);
        const s = this.settle(u.id), after = this.user(u.id);
        out[u.id] = { outcome: pl.outcome, delta: real, points: after.points, level: this.level(after.points), missions: s.newMissions, achievements: s.newAchs };
      }
      return out;
    });
  }
  close() { try { this.d.close(); } catch (e) {} }
}
module.exports = { DB, cleanNick };
