'use strict';
/* Xona (lobby) va o‘yin sessiyasi. O‘yin turlari server/games/*.js da ro‘yxatdan o‘tadi. */
const crypto = require('crypto');
const CFG = require('./config');
const GAMES = { mafia: require('./games/mafia') };
const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const err = (code, msg) => Object.assign(new Error(msg), { code });

class Room {
  constructor(hub, game, owner) {
    this.hub = hub; this.game = game; this.impl = GAMES[game];
    this.code = hub.freeCode(); this.ownerId = owner.id;
    this.players = []; this.status = 'lobby'; // lobby | playing | over
    this.g = null; this.chat = []; this.chatSeq = 0; this.results = {}; this.startedAt = 0; this.touched = Date.now();
    this.add(owner);
  }
  nick(id) { const p = this.players.find(x => x.id === id); return p ? p.nick : '?'; }
  has(id) { return this.players.some(p => p.id === id); }
  add(u) { this.players.push({ id: u.id, nick: u.nickname, photo: u.photo_url, gh: u.gh_id, ready: false, connected: true, dc: null }); this.touched = Date.now(); }
  get min() { return this.impl.min; } get max() { return this.impl.max; }
  connectedCount() { return this.players.filter(p => p.connected).length; }

  snapshot(uid) {
    const canStart = this.status === 'lobby' && this.players.length >= this.min && this.players.every(p => p.id === this.ownerId || p.ready);
    const o = {
      code: this.code, game: this.game, owner: this.ownerId, status: this.status, min: this.min, max: this.max, canStart, now: Date.now(),
      players: this.players.map(p => ({ id: p.id, nick: p.nick, photo: p.photo, gh: p.gh, ready: p.ready, connected: p.connected })),
      result: this.results[uid] || null
    };
    if (this.g) o.g = this.impl.snapshot(this, uid);
    return o;
  }
  emit() { for (const p of this.players) if (!p.left) this.hub.send(p.id, { t: 'room', room: this.snapshot(p.id) }); }

  setReady(uid, v) { if (this.status !== 'lobby') throw err('status', 'O‘yin allaqachon boshlangan'); this.players.find(p => p.id === uid).ready = !!v; this.emit(); }
  start(uid) {
    if (uid !== this.ownerId) throw err('owner', 'Faqat xona egasi boshlay oladi');
    if (this.status !== 'lobby') throw err('status', 'O‘yin allaqachon boshlangan');
    if (this.players.length < this.min) throw err('few', `Kamida ${this.min} o‘yinchi kerak`);
    if (!this.players.every(p => p.id === this.ownerId || p.ready)) throw err('ready', 'Hamma o‘yinchi tayyor bo‘lishi kerak');
    this.status = 'playing'; this.startedAt = Date.now(); this.results = {};
    this.impl.start(this);
  }
  finish(winner, outcomes) {
    this.status = 'over';
    const ids = this.players.map(p => p.id), pl = outcomes.map(o => ({ ...o, withFriend: ids.some(x => x !== o.userId && this.hub.db.areFriends(o.userId, x)) }));
    try { this.results = this.hub.db.recordMatch({ game: this.game, code: this.code, startedAt: this.startedAt, winner, players: pl }); }
    catch (e) { console.error('[recordMatch]', e); this.results = {}; }
    this.emit(); this.hub.broadcastHubStats();
  }
  rematch(uid) {
    if (uid !== this.ownerId) throw err('owner', 'Faqat xona egasi');
    if (this.status !== 'over') throw err('status', 'O‘yin tugamagan');
    this.impl.stop(this); this.g = null; this.status = 'lobby'; this.results = {};
    this.players = this.players.filter(p => !p.left); this.players.forEach(p => { p.ready = false; }); this.emit();
  }
  /* Chiqish: lobbida o‘chadi; o‘yin paytida "tark etdi" deb belgilanadi (mag‘lubiyat) */
  remove(uid) {
    const p = this.players.find(x => x.id === uid); if (!p) return;
    clearTimeout(p.dc);
    if (this.status === 'playing') {
      this.impl.leave(this, uid); p.connected = false; p.left = true; this.hub.userRoom.delete(uid);
      if (uid === this.ownerId) this.pickOwner();
      return this.emit();
    }
    this.players = this.players.filter(x => x.id !== uid); this.hub.userRoom.delete(uid);
    if (!this.players.length) return this.hub.destroyRoom(this);
    if (uid === this.ownerId) this.pickOwner();
    this.emit();
  }
  pickOwner() { const n = this.players.find(p => !p.left && p.connected) || this.players.find(p => !p.left); if (n) this.ownerId = n.id; }
  addChat(uid, text) {
    text = String(text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
    if (!text) throw err('empty', 'Xabar bo‘sh');
    if (!this.impl.canChat(this, uid)) throw err('chat', 'Hozir yozib bo‘lmaydi');
    const m = { id: ++this.chatSeq, uid, nick: this.nick(uid), text, ts: Date.now() };
    this.chat.push(m); if (this.chat.length > 60) this.chat.shift();
    for (const p of this.players) if (!p.left) this.hub.send(p.id, { t: 'chat', code: this.code, m });
  }
  destroy() { this.impl.stop(this); for (const p of this.players) { clearTimeout(p.dc); if (this.hub.userRoom.get(p.id) === this.code) this.hub.userRoom.delete(p.id); } }
}
module.exports = { Room, GAMES, err };
