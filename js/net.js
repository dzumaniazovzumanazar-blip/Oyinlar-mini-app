/* GAME HUB — server bilan aloqa (WebSocket + RPC). Frontend hech qachon ball/g‘alabani o‘zi belgilamaydi. */
const Net = (() => {
  const ev = {}, pend = new Map(); let ws = null, seq = 0, retry = 0, timer = null, st = 'idle', wantAuth = null, hbT = null;
  const emit = (n, d) => (ev[n] || []).slice().forEach(f => { try { f(d); } catch (e) { console.error(e); } });
  const on = (n, f) => { (ev[n] = ev[n] || []).push(f); return () => { ev[n] = ev[n].filter(x => x !== f); }; };
  const setSt = s => { if (s !== st) { st = s; emit('status', s); } };
  const url = () => { const c = (window.GH_CONFIG || {}).WS_URL; if (c) return c; return /^https?:$/.test(location.protocol) ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws' : ''; };
  const failAll = msg => { pend.forEach(p => { clearTimeout(p.t); p.rej(Object.assign(new Error(msg), { code: 'offline' })); }); pend.clear(); };

  /* auth: {initData} yoki {dev}. Boshqa holatda ulanmaydi (oflayn rejim). */
  function connect(auth) {
    wantAuth = auth || wantAuth;
    if (!wantAuth) return setSt('noauth');
    const u = url(); if (!u) return setSt('nourl');
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    clearTimeout(timer); setSt('connecting');
    try { ws = new WebSocket(u); } catch (e) { return later(); }
    const w = ws;
    w.onopen = () => w.send(JSON.stringify({ t: 'auth', ...wantAuth }));
    w.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.t === 'authed') { retry = 0; setSt('online'); emit('authed', m); }
      else if (m.t === 'authfail') { wantAuth = null; setSt('authfail'); emit('authfail', m.msg); }
      else if (m.t) emit(m.t, m);
      else if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); clearTimeout(p.t); m.ok ? p.res(m.d) : p.rej(Object.assign(new Error(m.msg || 'Xato'), { code: m.e })); }
    };
    w.onclose = () => { if (ws !== w) return; ws = null; failAll('Aloqa uzildi'); if (st !== 'authfail') { setSt('offline'); later(); } };
    w.onerror = () => {};
  }
  function later() { clearTimeout(timer); if (!wantAuth || document.hidden) return; timer = setTimeout(() => connect(), Math.min(15000, 800 * 2 ** retry++)); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && wantAuth && st === 'offline') { retry = 0; connect(); } });

  const rpc = (m, p) => new Promise((res, rej) => {
    if (!ws || ws.readyState !== 1 || st !== 'online') return rej(Object.assign(new Error('Server bilan aloqa yo‘q'), { code: 'offline' }));
    const id = ++seq, t = setTimeout(() => { pend.delete(id); rej(Object.assign(new Error('Server javob bermadi'), { code: 'timeout' })); }, 10000);
    pend.set(id, { res, rej, t }); ws.send(JSON.stringify({ t: 'rpc', id, m, p: p || {} }));
  });
  return { on, connect, rpc, get status() { return st; }, get online() { return st === 'online'; } };
})();
