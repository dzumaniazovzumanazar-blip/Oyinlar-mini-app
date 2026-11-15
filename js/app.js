/* GAME HUB — asosiy ilova: sozlamalar, navigatsiya, tablar, ichki sahifalar.
   Xona/Mafia ekrani: js/room.js. Server bilan aloqa: js/net.js. */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const App = (() => {
  /* ---------- Telegram ---------- */
  const tg = window.Telegram && Telegram.WebApp;
  const inTg = !!(tg && tg.initData);                       // haqiqiy Telegram Mini App (initData bor)
  const TU = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || null; // FAQAT ko‘rsatish uchun. Autentifikatsiya emas!
  try { if (tg) { tg.ready(); tg.expand(); tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } } catch (e) {}
  const buzz = k => { try { k === 'tap' ? tg.HapticFeedback.impactOccurred('light') : k === 'ok' ? tg.HapticFeedback.notificationOccurred('success') : tg.HapticFeedback.selectionChanged(); } catch (e) {} };

  /* ---------- Sozlamalar (mahalliy). online/pub — serverda saqlanadi (me.show_online / me.is_public) ---------- */
  const S = Object.assign({ bg: 'aurora', theme: 'auto', lang: 'uz', sound: true, notif: true, tbOp: 1, lensOp: 1 }, (() => { try { return JSON.parse(localStorage.getItem('gh.s') || '{}'); } catch (e) { return {}; } })());
  if (!BGS.some(b => b.id === S.bg)) S.bg = 'aurora';
  const save = () => { try { localStorage.setItem('gh.s', JSON.stringify(S)); } catch (e) {} };
  const root = document.documentElement;
  const applyLook = () => { root.dataset.bg = S.bg; root.style.setProperty('--tb-op', S.tbOp); root.style.setProperty('--lens-op', S.lensOp); };
  const dq = matchMedia('(prefers-color-scheme: dark)'), lq = matchMedia('(prefers-color-scheme: light)');
  function mode() {
    /* Avto = TELEFON rejimi (tungi rejim yoqilgan → qora, o‘chiq → oq). Telegram rangi faqat telefon ma’lumot bermasa */
    let m = S.theme === 'dark' || S.theme === 'light' ? S.theme : dq.matches ? 'dark' : lq.matches ? 'light' : (inTg && tg.colorScheme) || 'dark';
    root.dataset.mode = m; const c = m === 'light' ? '#f2f4fb' : '#000000';
    try { $('meta[name=theme-color]').setAttribute('content', c); tg && tg.setHeaderColor && tg.setHeaderColor(c); tg && tg.setBackgroundColor && tg.setBackgroundColor(c); tg && tg.setBottomBarColor && tg.setBottomBarColor(c); } catch (e) {}
  }
  applyLook(); mode();
  try { dq.addEventListener('change', mode); tg && tg.onEvent('themeChanged', mode); } catch (e) {}

  /* ---------- Holat ---------- */
  const st = { me: null, cfg: { games: {} }, stats: null, top: null, friends: null, start: '' };
  const ready = () => Net.online && !!st.me;
  const name = () => (st.me && st.me.nick) || (TU && [TU.first_name, TU.last_name].filter(Boolean).join(' ')) || 'Mehmon';
  const errMsg = e => (e && e.code === 'offline' ? 'Server bilan aloqa yo‘q' : (e && e.message) || 'Xato yuz berdi');

  /* ---------- Ikonkalar ---------- */
  const P = d => `<svg viewBox="0 0 24 24">${d}</svg>`;
  const I = {
    home: P('<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    games: P('<rect x="3" y="3" width="7.5" height="7.5" rx="2.2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2.2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2.2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2.2"/>'),
    friends: P('<circle cx="9" cy="8" r="3.6"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M17 14.2c2.6.2 4.5 2 4.5 5"/>'),
    rating: P('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 21h8"/>'),
    profile: P('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>'),
    search: P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'), back: P('<path d="M15 5l-7 7 7 7"/>'), ch: P('<path d="M9 5l7 7-7 7"/>'),
    gear: P('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'),
    target: P('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>'), medal: P('<circle cx="12" cy="15" r="6"/><path d="M8 3l4 6 4-6"/>'),
    clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    copy: P('<rect x="9" y="9" width="11" height="11" rx="3"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'), send: P('<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>'),
    plus: P('<path d="M12 5v14M5 12h14"/>'), check: P('<path d="M5 12.5l4.5 4.5L19 7.5"/>'), x: P('<path d="M6 6l12 12M18 6L6 18"/>'),
    moon: P('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>'), sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2L19 19M19 5l-1.8 1.8M6.8 17.2L5 19"/>'),
    vote: P('<path d="M4 13l8-9 8 9M7 11v9h10v-9"/>'), eye: P('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    info: P('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'), user: P('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>'),
    mafia: P('<path d="M3 9c3-2 6-2 9 0 3-2 6-2 9 0v3c0 3-2.5 5-5 5-2 0-3-1-4-2-1 1-2 2-4 2-2.5 0-5-2-5-5z"/><circle cx="8" cy="12" r="1.3"/><circle cx="16" cy="12" r="1.3"/>'),
    space: P('<circle cx="12" cy="12" r="5"/><path d="M2 14c4 3 16-2 20-4"/>'), kingdom: P('<path d="M4 18h16M4 18l-1-10 5 4 4-7 4 7 5-4-1 10z"/>'),
    detective: P('<circle cx="10" cy="10" r="6"/><path d="M20 20l-5.5-5.5"/>'), island: P('<circle cx="12" cy="8" r="4"/><path d="M2 16c3-2 5-2 8 0s5 2 8 0 3-1 4-1M2 20c3-2 5-2 8 0s5 2 8 0"/>'),
    lock: P('<rect x="5" y="11" width="14" height="9" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'), shield: P('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'), skull: P('<path d="M12 3a8 8 0 0 0-5 14v3h10v-3a8 8 0 0 0-5-14z"/><circle cx="9" cy="11" r="1.4"/><circle cx="15" cy="11" r="1.4"/>')
  };
  const G = id => GAMES.find(g => g.id === id);
  const art = g => `style="--a:${g.art[0]};--b:${g.art[1]}"`;
  const artBox = (g, cls, tag = 'span') => `<${tag} class="art ${cls || ''}" ${art(g)}>${ART[g.id] ? artSvg(g.id) : `<span class="ico">${I[g.id] || ''}</span>`}</${tag}>`;
  const avatar = (u, s) => {
    const nm = u ? u.nick || '' : name(), ph = u ? u.photo : (st.me ? st.me.photo : TU && TU.photo_url);
    return `<span class="avatar" style="${s ? '--s:' + s + 'px' : ''}">${esc((nm || 'G')[0].toUpperCase())}${ph && /^https:\/\//.test(ph) ? `<img src="${esc(ph)}" alt="" referrerpolicy="no-referrer" loading="lazy" decoding="async">` : ''}</span>`;
  };
  document.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && t.closest('.avatar')) t.remove(); }, true);
  let toastT; const toast = (m, err) => { const t = $('#toast'); t.textContent = m; t.className = 'show' + (err ? ' err' : ''); clearTimeout(toastT); toastT = setTimeout(() => { t.className = ''; }, 2600); };
  async function copyText(s) { try { await navigator.clipboard.writeText(s); } catch (e) { const a = document.createElement('textarea'); a.value = s; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (x) {} a.remove(); } toast('Nusxalandi'); buzz('ok'); }
  /* Ovoz effektlari (WebAudio, faqat hodisa paytida; "Ovoz" sozlamasi o‘chiq bo‘lsa — jim) */
  let ac; const sfx = (f = 660, d = .09) => { if (!S.sound) return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; o.type = 'sine'; g.gain.value = .06; g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + d); o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + d); } catch (e) {} };

  /* ==========================================================================
     NAVIGATSIYA
     Tablar: pastki panel (bosish yoki surish) — sahifa SURILMAYDI, faqat yengil fade.
     Ichki sahifalar: o‘ngdan chapga ochiladi, orqaga chapdan o‘ngga. push/pop yagona `lock` bilan himoyalangan.
     Sheet ham stekning bir qismi, shuning uchun BackButton va ← har doim eng ustkisini yopadi.
     ========================================================================== */
  const TABS = ['home', 'games', 'friends', 'rating', 'profile'], NL = ['Bosh sahifa', 'O‘yinlar', 'Do‘stlar', 'Reyting', 'Profil'];
  let cur = 'home';
  const tb = $('#tb'), pagesEl = $('#pages'), appEl = $('#app');
  tb.innerHTML = `<div id="dent"><b></b></div><div class="items">${TABS.map((t, i) => `<button data-t="${t}" aria-label="${NL[i]}">${I[t]}<span>${NL[i]}</span></button>`).join('')}</div>`;
  /* Linza tabbar'dan TASHQARIDA turadi: backdrop-filter faqat shunda sahifa orqa fonini (refraksiya) ko‘ra oladi */
  const lbox = document.createElement('div'); lbox.id = 'lensbox'; lbox.setAttribute('aria-hidden', 'true'); lbox.innerHTML = '<div id="lens"><i><b></b></i></div>'; tb.after(lbox);
  const lensEl = $('#lens', lbox), lensI = $('i', lensEl), lensB = $('b', lensI), dentB = $('#dent b', tb), dentEl = $('#dent', tb);
  /* Suyuq shisha linza: gradient xarita + feDisplacementMap (R/G/B kanallari alohida siljiydi = chekka refraksiyasi va xromatik aberratsiya). Faqat Chromium (Android Telegram WebView) */
  (() => {
    const map = (c, v) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" y1="0" x2="${v ? 0 : 1}" y2="${v ? 1 : 0}"><stop offset="0" stop-color="${c.f}"/><stop offset=".14" stop-color="${c.a}"/><stop offset=".5" stop-color="${c.b}"/><stop offset=".86" stop-color="${c.d}"/><stop offset="1" stop-color="#000"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>`);
    const mx = map({ f: '#ff0000', a: '#cd0000', b: '#7f0000', d: '#310000' }, 0), my = map({ f: '#00ff00', a: '#00cd00', b: '#007f00', d: '#003100' }, 1);
    const ch = (s, m) => `<feDisplacementMap in="SourceGraphic" in2="map" scale="${s}" xChannelSelector="R" yChannelSelector="G"/><feColorMatrix type="matrix" values="${m}"/>`;
    document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><filter id="lensfx" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feImage href="${mx}" preserveAspectRatio="none" result="mx"/><feImage href="${my}" preserveAspectRatio="none" result="my"/><feComposite in="mx" in2="my" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="map"/>${ch(20, '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0').replace(/\/>$/, ' result="cr"/>')}${ch(18, '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0').replace(/\/>$/, ' result="cg"/>')}${ch(16, '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0').replace(/\/>$/, ' result="cb"/>')}<feComposite in="cr" in2="cg" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="rg"/><feComposite in="rg" in2="cb" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/></filter></defs></svg>`);
  })();
  const tabBtns = $$('button', tb), scrollPos = {};
  const markActive = i => tabBtns.forEach((b, k) => b.classList.toggle('active', k === i));

  /* ---------- YAGONA HARAKAT TIZIMI ----------
     Bitta rAF sikli: lens pozitsiyasi, suyuq deformatsiya (cho‘zilish/qiyshayish), katta kapsula siljishi,
     egilish yoylari va ikonka magnification — hammasi bir xil holatdan (pos, vel, hold) hisoblanadi.
     Barmoq ustida pozitsiya barmoqqa ergashadi; qo‘yib yuborilganda tezlik saqlanib, buloq (spring) bilan eng yaqin tabga snap bo‘ladi. */
  const nav = (() => {
    let pos = 0, vel = 0, tgt = 0, held = false, follow = false, hs = 0, hv = 0, ns = 0, nv = 0, pi = -1, ps = 0, pv = 0, raf = 0, last = 0, W = 70, slow = 0;
    const measure = () => { W = lensEl.offsetWidth || W; };
    const sp = (x, v, t, k, c, dt) => { v += (k * (t - x) - c * v) * dt; return [x + v * dt, v]; };
    function render() {
      const e = Math.min(.34, Math.abs(vel) * .05), lean = Math.max(-9, Math.min(9, vel * -1.1));
      const sx = 1 + e + .15 * hs, sy = 1 + .17 * hs - e * .5, X = 'translate3d(' + (pos * W).toFixed(2) + 'px,0,0)';
      lensEl.style.transform = X;
      const ax = (vel > 0 ? 1 : -1) * e * W * .5;
      lensI.style.transform = 'translate3d(' + ax.toFixed(2) + 'px,0,0) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ') skewX(' + lean.toFixed(2) + 'deg)';
      lensI.style.setProperty('--hl', (50 - Math.max(-34, Math.min(34, vel * 9))).toFixed(1) + '%');
      lensB.style.opacity = Math.min(1, hs * 1.15 + Math.min(.6, Math.abs(vel) * .15)).toFixed(2);
      dentB.style.transform = X; dentEl.style.opacity = Math.max(0, Math.min(1, hs)).toFixed(2);
      const B = 'translate3d(' + ns.toFixed(2) + 'px,0,0)'; tb.style.transform = B; lbox.style.transform = B;
      for (let k = 0; k < 5; k++) { const p = Math.max(0, 1 - Math.abs(k - pos) / (1 + .6 * hs)); tabBtns[k].firstElementChild.style.transform = 'scale(' + ((1 + (.14 + .1 * hs) * p) * (k === pi ? 1 - .1 * ps : 1)).toFixed(3) + ')'; }
    }
    function tick(t) {
      raf = 0; const raw = (t - last) / 1000 || .016, dt = Math.min(.034, raw); last = t;
      if (held) { slow = raw > .03 ? slow + 1 : Math.max(0, slow - 1); if (slow > 14) lbox.classList.add('lite'); }
      if (follow) { const p0 = pos; pos += (tgt - pos) * (1 - Math.exp(-dt * 45)); vel += ((pos - p0) / Math.max(dt, .008) - vel) * .35; }
      else [pos, vel] = sp(pos, vel, tgt, 170, 17, dt);
      [hs, hv] = sp(hs, hv, held ? 1 : 0, 260, 21, dt);
      [ps, pv] = sp(ps, pv, pi >= 0 ? 1 : 0, 420, 24, dt);
      [ns, nv] = sp(ns, nv, held ? (pos - 2) / 2 * 5 + Math.max(-2.5, Math.min(2.5, vel * .3)) : 0, 190, 17, dt);
      const rest = !follow && !held && Math.abs(tgt - pos) < .002 && Math.abs(vel) < .02 && Math.abs(hs) < .003 && Math.abs(hv) < .02 && Math.abs(ns) < .02 && Math.abs(nv) < .05 && pi < 0 && Math.abs(ps) < .004 && Math.abs(pv) < .05;
      if (rest) { pos = tgt; vel = 0; hs = hv = ns = nv = 0; }
      render(); if (!rest) raf = requestAnimationFrame(tick);
    }
    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    return {
      set(i) { pos = tgt = i; vel = 0; measure(); render(); },
      to(i, pulse) { tgt = i; if (pulse) hs = Math.max(hs, .7); kick(); },
      grab() { held = true; kick(); },
      press(i) { pi = i; kick(); },
      unpress() { pi = -1; kick(); },
      drag(f) { follow = true; held = true; tgt = f; kick(); },
      release(i) { follow = false; held = false; tgt = i; kick(); },
      resize() { measure(); render(); }
    };
  })();
  try { new ResizeObserver(() => nav.resize()).observe(tb); } catch (e) { addEventListener('resize', () => nav.resize()); }
  nav.set(0);

  function go(t, live) {
    if (!TABS.includes(t)) return;
    const changed = t !== cur, old = $('.tab.on');
    if (old) scrollPos[cur] = old.scrollTop;
    cur = t; $$('.tab').forEach(e => e.classList.toggle('on', e.dataset.t === t));
    const i = TABS.indexOf(t); markActive(i); if (!live) nav.to(i, changed);
    const el = $('.tab.on'); if (el) el.scrollTop = scrollPos[t] || 0;
    ctUpdate();
    if (changed) { if (!live) buzz(); (render[t] || (() => {}))(); (refresh[t] || (() => {}))(); }
  }
  /* Pastki panel: Pointer Events + setPointerCapture. Surish davomida bo‘lim real vaqtda almashadi, tap esa pointerup'da; click hodisasi ishlatilmaydi (ikki marta ishga tushmaydi). touch-action:none — gorizontal drag vertikal scrollga xalaqit bermaydi. */
  let drag = null;
  const idxAt = x => { const r = tb.getBoundingClientRect(), w = (r.width - 8) / 5; return Math.max(0, Math.min(4, (x - r.left - 4) / w - .5)); };
  const endDrag = (e, cancel) => {
    if (!drag || e.pointerId !== drag.id) return; const d = drag; drag = null;
    try { tb.releasePointerCapture(e.pointerId); } catch (x) {}
    tb.classList.remove('drag', 'hold'); nav.unpress();
    const i = cancel ? TABS.indexOf(cur) : (d.moved ? Math.round(d.f) : Math.round(idxAt(e.clientX)));
    nav.release(i); if (!cancel) go(TABS[i], d.moved); else markActive(i);
  };
  tb.addEventListener('pointerdown', e => {
    if (e.button > 0 || drag) return; try { tb.setPointerCapture(e.pointerId); } catch (x) {}
    const f = idxAt(e.clientX); drag = { id: e.pointerId, x: e.clientX, moved: false, f, n: Math.round(f) }; nav.press(drag.n);
    if (Math.abs(f - TABS.indexOf(cur)) < .6) { tb.classList.add('hold'); nav.grab(); }
  });
  tb.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) { if (Math.abs(e.clientX - drag.x) < 6) return; drag.moved = true; tb.classList.add('drag', 'hold'); nav.unpress(); }
    const f = idxAt(e.clientX); drag.f = f; nav.drag(f);
    const n = Math.round(f); if (n !== drag.n) { drag.n = n; markActive(n); buzz(); }
  });
  tb.addEventListener('pointerup', e => endDrag(e, false));
  tb.addEventListener('pointercancel', e => endDrag(e, true));
  tb.addEventListener('lostpointercapture', e => { if (drag && drag.moved) endDrag(e, true); });
  tb.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { const b = e.target.closest('button'); b && go(b.dataset.t); } });

  /* ----- Ichki sahifalar ----- */
  const stack = []; let lock = false;
  const syncBack = () => { try { if (tg) stack.length ? tg.BackButton.show() : tg.BackButton.hide(); } catch (e) {} };
  const lockFor = ms => { lock = true; setTimeout(() => { lock = false; }, ms); };
  const topEntry = () => stack[stack.length - 1];
  function layers() { // pastdagi sahifalar: parallaks va yashirish (GPU tejash)
    appEl.classList.toggle('under', stack.length > 0);
    stack.forEach((e, i) => { if (e.kind !== 'page') return; const under = i < stack.length - 1; e.el.classList.toggle('under', under); });
  }
  function push({ key, title, html, mount, onBack, cls }) {
    if (lock) return null;
    const t = topEntry(); if (key && t && t.key === key) return t;
    lockFor(340);
    const el = document.createElement('div'); el.className = 'page ' + (cls || '');
    el.innerHTML = `<div class="bar"><button class="back glass blur press" aria-label="Orqaga">${I.back}</button><span>${esc(title)}</span><i></i></div><div class="pc">${html}</div>`;
    pagesEl.appendChild(el); void el.offsetWidth; el.classList.add('in');
    const e = { key, el, kind: 'page', onBack }; stack.push(e); layers(); syncBack();
    $('.back', el).onclick = () => pop();
    setTimeout(() => { if (stack.includes(e) && topEntry() !== e) e.el.classList.add('hide'); if (stack.length > 1 || stack[0] !== e) appEl.classList.toggle('hide', !!stack.some(x => x.kind === 'page')); }, 420);
    mount && mount(el, e); return e;
  }
  function sheet({ key, title, html, mount }) {
    if (lock) return null;
    const t = topEntry(); if (key && t && t.key === key) return t;
    lockFor(300);
    const sc = document.createElement('div'), el = document.createElement('div');
    sc.className = 'scrim'; el.className = 'sheet'; el.setAttribute('role', 'dialog');
    el.innerHTML = `<div class="grab"></div><h3>${esc(title)}</h3>${html}`;
    pagesEl.append(sc, el); void el.offsetWidth; sc.classList.add('in'); el.classList.add('in');
    const e = { key, el, sc, kind: 'sheet' }; stack.push(e); syncBack();
    sc.onclick = () => pop(); mount && mount(el, e); return e;
  }
  function pop(force) {
    const e = topEntry(); if (!e || (lock && !force)) return false;
    if (e.onBack && !force && e.onBack() === false) return false;
    lockFor(e.kind === 'sheet' ? 280 : 340); stack.pop();
    if (e.kind === 'sheet') { e.el.classList.remove('in'); e.sc.classList.remove('in'); setTimeout(() => { e.el.remove(); e.sc.remove(); }, 380); }
    else {
      e.el.classList.remove('in');
      const under = [...stack].reverse().find(x => x.kind === 'page'); if (under) under.el.classList.remove('hide'); else appEl.classList.remove('hide');
      setTimeout(() => e.el.remove(), 400);
    }
    layers(); syncBack(); e.onClose && e.onClose(); return true;
  }
  function popTo(key) { let n = 0; while (topEntry() && topEntry().key !== key && n++ < 12) { lock = false; pop(true); } }
  const has = key => stack.some(e => e.key === key);
  const closeSheets = () => { let n = 0, c = 0; while (topEntry() && topEntry().kind === 'sheet' && n++ < 6) { pop(true); c++; } return c; };
  try { tg && tg.BackButton.onClick(() => pop()); } catch (e) {}
  addEventListener('keydown', e => { if (e.key === 'Escape') pop(); });

  /* Chap chetdan surib orqaga (faqat sahifalar). Vertikal scrollga xalaqit bermaydi: gorizontal niyat aniqlangandan keyingina ishlaydi. */
  let sw = null;
  addEventListener('touchstart', e => { const t = e.touches[0], top = topEntry(); sw = top && top.kind === 'page' && t.clientX <= 22 ? { x: t.clientX, y: t.clientY, e: top, d: 0, m: 0 } : null; }, { passive: true });
  addEventListener('touchmove', e => {
    if (!sw) return; const t = e.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
    if (!sw.m) { if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { sw = null; return; } if (dx > 10) { sw.m = 1; sw.e.el.style.transition = 'none'; } }
    if (sw.m) { sw.d = Math.max(0, dx); sw.e.el.style.transform = `translate3d(${sw.d}px,0,0)`; e.cancelable && e.preventDefault(); }
  }, { passive: false });
  const swEnd = () => { if (!sw) return; const { e, d, m } = sw; sw = null; if (!m) return; e.el.style.transition = ''; e.el.style.transform = ''; if (d > Math.min(110, innerWidth * .3) && topEntry() === e) pop(); };
  addEventListener('touchend', swEnd); addEventListener('touchcancel', swEnd);

  /* Tablar orasida ekranni surish: faqat aniq gorizontal, tez harakat; gorizontal skrollerlar va inputlar chetda */
  let ts = null;
  appEl.addEventListener('touchstart', e => { const t = e.touches[0]; ts = (stack.length || t.clientX <= 24 || t.clientX >= innerWidth - 6 || e.target.closest('.banners,.rail,.chips,input,textarea,#tb,.msgs')) ? null : { x: t.clientX, y: t.clientY, t: Date.now() }; }, { passive: true });
  appEl.addEventListener('touchend', e => {
    if (!ts) return; const t = e.changedTouches[0], dx = t.clientX - ts.x, dy = t.clientY - ts.y, dt = Date.now() - ts.t; ts = null;
    if (dt < 700 && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) { const i = TABS.indexOf(cur) + (dx < 0 ? 1 : -1); if (i >= 0 && i < TABS.length) go(TABS[i]); }
  }, { passive: true });
  appEl.addEventListener('touchcancel', () => { ts = null; }, { passive: true });

  /* Yig‘ilgan sarlavha (iOS uslubi) */
  const ct = $('#ct'); let lastS = -1;
  function ctUpdate() { const t = $('.tab.on'); if (!t) return; const h = $('h1.lt', t), s = h ? Math.min(1, Math.max(0, (t.scrollTop - 6) / 46)) : 0; if (Math.abs(s - lastS) < .03 && s !== 0 && s !== 1) return; lastS = s; ct.style.opacity = s; ct.firstChild.textContent = h ? h.textContent : ''; if (h) { h.style.transform = `scale(${1 - s * .14})`; h.style.opacity = 1 - s * 1.1; } }
  $$('.tab').forEach(t => t.addEventListener('scroll', ctUpdate, { passive: true }));

  /* ==========================================================================
     TABLAR
     ========================================================================== */
  const row = (ic, t, s, act, v = '', extra = '') => `<button class="row press" data-a="${act}" ${extra}>${I[ic]}<span class="t"><b>${t}</b><small>${s}</small></span><span class="v">${v}</span><span class="ch">${I.ch}</span></button>`;
  const empty = (ic, t, d) => `<div class="glass card empty">${I[ic]}<b>${t}</b><p>${d}</p></div>`;
  const statusNote = () => {
    if (ready()) return '';
    const s = Net.status, why = s === 'authfail' ? 'Server Telegram ma’lumotini tasdiqlamadi.' : s === 'connecting' ? 'Serverga ulanilmoqda…' : s === 'offline' ? 'Server bilan aloqa uzildi. Qayta urinilmoqda…' : inTg ? 'Backend manzili (js/config.js) sozlanmagan.' : 'Bu oddiy brauzer preview. Haqiqiy test uchun ilovani Telegram ichida oching (README).';
    return `<div class="glass note">${I.info}<span>${why} O‘yinlar, reyting, do‘stlar va statistika serverga ulangach ishlaydi.</span></div>`;
  };
  const gcard = g => { const live = st.stats && st.stats.rooms[g.id]; return `<button class="gc glass press" data-g="${g.id}">${artBox(g)}<span class="gi"><b>${g.name}</b><p>${g.desc}</p><span class="meta"><span>${g.cats[0]}</span><span>${playersTxt(g)}</span></span><span class="state ${g.status}"><i class="dot"></i>${g.status === 'ready' ? 'Mavjud' + (live ? ` · ${live} ta ochiq xona` : '') : 'Tez orada'}</span></span></button>`; };
  const mini = g => `<button class="mini press" data-g="${g.id}">${artBox(g)}<b>${g.name}</b><span>${g.status === 'ready' ? 'Mavjud' : 'Tez orada'}</span></button>`;
  function playersTxt(g) { const c = st.cfg.games[g.id], a = c ? c.min : g.min, b = c ? c.max : g.max; return `${a}–${b} o‘yinchi`; }

  const render = {};
  render.home = () => {
    const hot = GAMES.filter(g => g.pop), fresh = GAMES.filter(g => g.isNew);
    $('[data-t=home]').innerHTML = `<div class="top"><div class="brand"><svg class="logo"><use href="#logo"/></svg><span>GAME <b>HUB</b></span></div><button data-go="profile" class="press" aria-label="Profil" style="border-radius:50%">${avatar(null, 44)}</button></div>
<div class="hello"><h1>Salom, ${esc(name().split(' ')[0])}!</h1><p class="sub">${ready() ? `<span class="state ready"><i class="dot"></i>Serverga ulangan${st.stats ? ' · onlayn: ' + st.stats.online : ''}</span>` : 'Bugun qaysi o‘yinni o‘ynaymiz?'}</p></div>${statusNote()}
<div class="banners" id="bn">${BANNERS.map(b => { const g = G(b.game); return `<button class="ban art press" data-g="${g.id}" ${art(g)}>${artSvg(g.id)}<span class="cap"><small>${b.tag}</small><h3>${g.name}</h3><p>${b.text}</p><span class="go"><span>${b.btn}</span><span>${I.ch}</span></span></span></button>`; }).join('')}</div>
<div class="dots" id="bd">${BANNERS.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
<h2 class="sh">Ommabop <button data-go="games">Barchasi</button></h2><div class="rail">${hot.map(mini).join('')}</div>
<h2 class="sh">Yangi qo‘shilgan</h2>${fresh.map(gcard).join('')}
<button class="btn glass" style="margin-top:4px" data-go="games">Barcha o‘yinlar</button>`;
    bindBanners();
  };
  function bindBanners() {
    const bn = $('#bn'), dots = $$('#bd i'); if (!bn) return; let raf = 0;
    bn.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const w = bn.firstElementChild.offsetWidth + 12, i = Math.round(bn.scrollLeft / w); dots.forEach((d, k) => d.classList.toggle('on', k === i)); }); }, { passive: true });
    let touching = false; bn.addEventListener('touchstart', () => { touching = true; }, { passive: true }); bn.addEventListener('touchend', () => { setTimeout(() => { touching = false; }, 4000); }, { passive: true });
    clearInterval(bindBanners.t);
    bindBanners.t = setInterval(() => { if (cur !== 'home' || stack.length || document.hidden || touching || !$('#bn')) return; const el = $('#bn'), w = el.firstElementChild.offsetWidth + 12, n = BANNERS.length, i = (Math.round(el.scrollLeft / w) + 1) % n; el.scrollTo({ left: i * w, behavior: 'smooth' }); }, 6500);
  }

  let q = '', cat = 'Barchasi';
  render.games = () => {
    $('[data-t=games]').innerHTML = `<h1 class="lt">O‘yinlar</h1><label class="search glass"><span style="display:contents">${I.search}</span><input id="gq" placeholder="O‘yin qidirish" autocomplete="off" value="${esc(q)}"></label>
<div class="chips">${['Barchasi', ...CATS].map(c => `<button class="chip glass press ${c === cat ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}</div>
<button class="row glass press" style="border-radius:24px;margin-bottom:14px" data-a="join">${I.target}<span class="t"><b>Kod bilan xonaga qo‘shilish</b><small>Do‘stingdan olgan 6 belgili kodni kiriting</small></span><span class="ch">${I.ch}</span></button><div id="gl"></div>`;
    $('#gq').oninput = e => { q = e.target.value.toLowerCase(); list(); }; list();
  };
  function list() { const a = GAMES.filter(g => (cat === 'Barchasi' || g.cats.includes(cat)) && (g.name + g.desc + g.cats.join()).toLowerCase().includes(q)); const el = $('#gl'); if (el) el.innerHTML = a.length ? a.map(gcard).join('') : empty('search', 'Hech narsa topilmadi', 'Boshqa so‘z yoki kategoriyani sinab ko‘ring.'); }

  render.friends = () => {
    const D = st.friends, off = !ready();
    $('[data-t=friends]').innerHTML = `<h1 class="lt">Do‘stlar</h1>${statusNote()}
<div class="row2" style="margin-bottom:12px"><label class="search glass" style="margin:0;flex:1"><span style="display:contents">${I.search}</span><input id="fq" placeholder="Do‘stlar ichidan qidirish" autocomplete="off"></label><button class="ibtn glass blur press" data-a="addfriend" aria-label="Do‘st qo‘shish" ${off ? 'disabled style="opacity:.45;flex:none;width:48px;height:48px"' : 'style="flex:none;width:48px;height:48px"'}>${I.plus}</button></div>
<div id="fi">${friendInc(D)}</div><div id="fl">${friendList(D, '')}</div>
<div class="glass note" style="margin-top:6px">${I.info}<span>O‘yinga taklif qilish o‘yin xonasi ichida — «Lobbiga chaqirish» tugmasi orqali amalga oshiriladi.</span></div>`;
    $('#fq').oninput = e => { $('#fl').innerHTML = friendList(st.friends, e.target.value.trim().toLowerCase()); };
  };
  const frRow = (u, right = '') => `<div class="fr"><button class="av" data-a="fprofile" data-id="${u.id}" style="display:flex">${avatar(u, 46)}<i class="dot ${u.online ? 'on' : ''}"></i></button><button class="t" data-a="fprofile" data-id="${u.id}" style="text-align:left"><b>${esc(u.nick)}</b><small>${u.online ? 'Onlayn' : 'Oflayn'} · ${u.level}-daraja · ${u.games} o‘yin</small></button>${right}</div>`;
  function friendInc(D) { if (!D || !D.incoming.length) return ''; return `<h2 class="sh" style="margin-top:6px">So‘rovlar</h2><div class="glass list">${D.incoming.map(u => frRow(u, `<button class="mini-btn ok press" data-a="facc" data-id="${u.id}">Qabul</button><button class="mini-btn glass press" data-a="fdec" data-id="${u.id}">${I.x.replace('<svg', '<svg width="16" height="16"')}</button>`)).join('')}</div>`; }
  function friendList(D, f) {
    if (!ready()) return empty('friends', 'Do‘stlar ro‘yxati', 'Server ulangach do‘stlaringiz, onlayn holati va statistikasi shu yerda ko‘rinadi.');
    if (!D) return empty('friends', 'Yuklanmoqda…', 'Do‘stlar ro‘yxati olinmoqda.');
    const a = D.friends.filter(u => !f || u.nick.toLowerCase().includes(f));
    if (!D.friends.length) return empty('friends', 'Hali do‘st yo‘q', 'Yuqoridagi «+» tugmasi bilan GAME HUB ID orqali do‘st qo‘shing. Sizning ID’ingiz: Profil bo‘limida.');
    return a.length ? `<div class="glass list">${a.map(u => frRow(u)).join('')}</div>` : empty('search', 'Topilmadi', 'Bu nom bilan do‘st yo‘q.');
  }

  render.rating = () => {
    const D = st.top; let body;
    if (!ready()) body = empty('rating', 'Reyting', 'Reyting faqat server tasdiqlagan haqiqiy o‘yin natijalaridan hosil bo‘ladi. Server ulangach shu yerda ko‘rinadi.');
    else if (!D) body = empty('rating', 'Yuklanmoqda…', 'Reyting olinmoqda.');
    else if (!D.top.length) body = empty('rating', 'Reyting hali bo‘sh', 'Birinchi o‘yin tugagach o‘yinchilar shu yerda paydo bo‘ladi.');
    else {
      const t3 = D.top.slice(0, 3), o = [t3[1], t3[0], t3[2]].filter(Boolean);
      body = `<div class="podium">${o.map(u => `<div class="pod glass p${u.rank}"><span class="no">${u.rank}-o‘rin</span>${avatar(u, u.rank === 1 ? 64 : 52)}<b>${esc(u.nick)}</b><span>${u.points} ball</span></div>`).join('')}</div>
<div class="glass list">${D.top.slice(3).map(u => `<div class="rk ${st.me && u.id === st.me.id ? 'me' : ''}"><span class="n">${u.rank}</span>${avatar(u, 40)}<span class="t"><b>${esc(u.nick)}</b><small>${u.wins} g‘alaba · ${u.losses} mag‘lubiyat</small></span><span class="pt">${u.points}</span></div>`).join('') || `<div class="rk"><span class="t sub">Qolgan o‘yinchilar hozircha yo‘q</span></div>`}</div>`;
    }
    const m = D && D.me;
    $('[data-t=rating]').innerHTML = `<h1 class="lt">Reyting</h1><p class="sub" style="margin:-6px 2px 14px">Barcha o‘yinlar uchun bitta umumiy GAME HUB reytingi.</p>
${ready() && m ? `<div class="glass meCard rim">${avatar(null, 48)}<span class="t" style="flex:1"><b>Sening o‘ring</b><br><small class="sub">${m.games ? m.wins + ' g‘alaba · ' + m.losses + ' mag‘lubiyat' : 'Hali o‘ynamagansan'}</small></span><span class="big">${m.rank ? m.rank + '-o‘rin' : '—'}</span></div>` : ''}${body}
<div class="glass note" style="margin-top:12px">${I.info}<span>Ball hisoblash tizimi hali yakuniy tasdiqlanmagan. Ballarni faqat server hisoblaydi va yangilaydi.</span></div>`;
  };

  render.profile = () => {
    const m = st.me, ok = ready(), v = k => (ok && m ? m[k] : '—');
    $('[data-t=profile]').innerHTML = `<h1 class="lt">Profil</h1>${statusNote()}
<div class="glass hero rim">${avatar(null, 92)}<h2>${esc(name())}</h2>${ok && m ? `<button class="idchip glass press" data-a="copyid" aria-label="ID nusxalash">${I.copy}<span>${esc(m.gh)}</span></button><div class="lvl"><span class="pill glass">Daraja ${m.level}</span><span class="pill glass">${m.points} ball</span></div>` : `<p class="sub">GAME HUB ID: server beradi</p><p class="sub">Daraja: — · Umumiy ball: —</p>`}
<button class="btn sm glass press" data-a="edit" style="margin-top:6px" ${ok ? '' : 'disabled'}>Profilni tahrirlash</button></div>
<h2 class="sh">Statistika</h2><div class="stats">${[['Jami o‘yinlar', v('games')], ['G‘alabalar', v('wins')], ['Mag‘lubiyatlar', v('losses')], ['Duranglar', v('draws')], ['G‘alaba foizi', ok && m && m.winRate != null ? m.winRate + '%' : '—'], ['Reyting ballari', v('points')], ['Sevimli o‘yin', ok && m && m.fav ? (G(m.fav) || { name: m.fav }).name : '—'], ['Eng uzun seriya', v('bestStreak')]].map(([a, b]) => `<div class="glass stat"><small>${a}</small><b>${b}</b></div>`).join('')}</div>
${ok ? '' : '<p class="sub" style="margin:10px 2px 0">Statistika faqat server tasdiqlagan o‘yinlardan olinadi.</p>'}
<div class="glass list" style="margin-top:20px">${row('clock', 'O‘yinlar tarixi', 'Oxirgi o‘yinlar va natijalar', 'history')}${row('target', 'Missiyalar', 'Mukofotlar avtomatik beriladi', 'missions')}${row('medal', 'Yutuqlar', 'Shartlar bajarilganda ochiladi', 'achs')}${row('gear', 'Sozlamalar', 'Fon, mavzu, ovoz, maxfiylik', 'settings')}</div>`;
  };

  /* Ma’lumotni serverdan yangilash (tab ochilganda) */
  const refresh = {
    async home() { if (!ready()) return; try { st.stats = await Net.rpc('hub.stats'); if (cur === 'home' && !stack.length) { const s = $('.hello p'); if (s) s.innerHTML = `<span class="state ready"><i class="dot"></i>Serverga ulangan · onlayn: ${st.stats.online}</span>`; } } catch (e) {} },
    async games() { if (!ready()) return; try { st.stats = await Net.rpc('hub.stats'); if (cur === 'games') list(); } catch (e) {} },
    async friends() { if (!ready()) return; try { st.friends = await Net.rpc('friends.list'); if (cur === 'friends') { $('#fi').innerHTML = friendInc(st.friends); $('#fl').innerHTML = friendList(st.friends, ($('#fq') || {}).value || ''); } } catch (e) {} },
    async rating() { if (!ready()) return; try { st.top = await Net.rpc('rating.top'); if (cur === 'rating') render.rating(); } catch (e) {} },
    async profile() { if (!ready()) return; try { st.me = await Net.rpc('me.get'); if (cur === 'profile') render.profile(); } catch (e) {} }
  };

  /* ==========================================================================
     ICHKI SAHIFALAR
     ========================================================================== */
  const ol = a => a && a.length ? `<ol>${a.map(x => `<li>${x}</li>`).join('')}</ol>` : '', ul = a => a && a.length ? `<ul>${a.map(x => `<li>${x}</li>`).join('')}</ul>` : '';
  function openGame(id) {
    const g = G(id), live = st.stats && st.stats.rooms[id], can = g.status === 'ready' && ready();
    push({ key: 'game:' + id, title: g.name, html: `${artBox(g, 'cover', 'div')}<h1>${g.name}</h1><p class="sub">${g.cats.join(' · ')}</p>
<div class="facts"><div class="glass"><small>O‘yinchilar</small><b>${playersTxt(g).replace(' o‘yinchi', '')}</b></div><div class="glass"><small>Davomiyligi</small><b>${g.time.replace(' daqiqa', ' daq.')}</b></div><div class="glass"><small>Holat</small><b style="color:${g.status === 'ready' ? 'var(--good)' : 'var(--warn)'}">${g.status === 'ready' ? 'Mavjud' : 'Tez orada'}</b></div></div>
<div class="glass card"><h3>O‘yin haqida</h3><p>${g.about}</p></div>
${g.how ? `<div class="glass card"><h3>Qanday o‘ynaladi</h3>${ol(g.how)}</div><div class="glass card"><h3>Asosiy qoidalar</h3>${ul(g.rules)}</div><div class="glass card"><h3>Foydali maslahatlar</h3>${ul(g.tips)}</div>` : `<div class="glass card"><p class="sub">Batafsil qoidalar o‘yin qo‘shilganda shu yerda paydo bo‘ladi.</p></div>`}
${g.status === 'ready' && !ready() ? `<div class="glass note">${I.info}<span>Xona yaratish uchun server bilan aloqa kerak. ${inTg ? 'Backend manzili sozlanmagan yoki server ishlamayapti.' : 'Brauzer previewda Telegram yo‘q — README dagi dev rejimni ko‘ring.'}</span></div>` : ''}
<div class="row2"><button class="btn ${can ? '' : 'off'}" data-a="start" data-id="${id}">${g.status !== 'ready' ? 'Tez orada' : can ? 'Xona yaratish' : 'Server kerak'}</button>${g.status === 'ready' ? `<button class="btn glass ${ready() ? '' : 'off'}" data-a="join">Kod bilan</button>` : ''}</div>${live ? `<p class="sub" style="text-align:center;margin-top:10px">Hozir ${live} ta ochiq xona bor</p>` : ''}` });
  }
  function joinSheet(prefill) {
    sheet({ key: 'join', title: 'Xonaga qo‘shilish', html: `<p class="sub" style="margin:0 4px 12px">Do‘stingiz yuborgan 6 belgili kodni kiriting.</p><input class="input code" id="jc" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC123" value="${esc(prefill || '')}"><div class="row2"><button class="btn glass" data-x="no">Bekor</button><button class="btn" id="jb">Qo‘shilish</button></div>`,
      mount(el) { const inp = $('#jc', el); inp.oninput = () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); }; $('[data-x=no]', el).onclick = () => pop();
        $('#jb', el).onclick = async () => { if (inp.value.length < 4) return toast('Kodni to‘liq kiriting', 1); if (!ready()) return toast('Server bilan aloqa yo‘q', 1); const b = $('#jb', el); b.disabled = true; try { await Room.join(inp.value); } catch (e) { toast(errMsg(e), 1); b.disabled = false; } }; if (!prefill) setTimeout(() => inp.focus(), 350); } });
  }
  function addFriendSheet() {
    sheet({ key: 'addf', title: 'Do‘st qo‘shish', html: `<p class="sub" style="margin:0 4px 10px">Do‘stingizning GAME HUB ID sini (masalan GH-AB12CD) yoki nickname’ini kiriting. Sizning ID’ingiz: <b>${esc(st.me ? st.me.gh : '—')}</b></p><label class="search glass" style="margin-bottom:8px"><span style="display:contents">${I.search}</span><input id="af" placeholder="GH-… yoki nickname" autocomplete="off" autocapitalize="characters"></label><div id="afr"></div>`,
      mount(el) {
        const inp = $('#af', el), out = $('#afr', el); let tm;
        const show = a => { out.innerHTML = a.length ? a.map(u => `<div class="fl">${avatar(u, 42)}<span class="t"><b>${esc(u.nick)}</b><small>${esc(u.gh)} · ${u.level}-daraja</small></span>${u.relation === 'accepted' ? '<span class="sub">Do‘st</span>' : u.relation === 'pending' ? '<span class="sub">Kutilmoqda</span>' : `<button class="mini-btn ok press" data-id="${u.id}">Qo‘shish</button>`}</div>`).join('') : '<p class="sub" style="padding:8px 4px">Hech kim topilmadi.</p>'; };
        inp.oninput = () => { clearTimeout(tm); const v = inp.value.trim(); if (v.length < 2) { out.innerHTML = ''; return; } tm = setTimeout(async () => { try { show(await Net.rpc('friends.search', { q: v })); } catch (e) { out.innerHTML = `<p class="sub" style="padding:8px 4px">${esc(errMsg(e))}</p>`; } }, 350); };
        out.onclick = async e => { const b = e.target.closest('button[data-id]'); if (!b) return; b.disabled = true; try { const r = await Net.rpc('friends.request', { id: b.dataset.id }); b.outerHTML = `<span class="sub">${r.status === 'accepted' ? 'Do‘st bo‘ldi' : 'Yuborildi'}</span>`; refresh.friends(); } catch (x) { toast(errMsg(x), 1); b.disabled = false; } };
        setTimeout(() => inp.focus(), 350);
      } });
  }
  async function friendProfile(id) {
    if (!ready()) return;
    try {
      const u = await Net.rpc('profile.get', { id });
      push({ key: 'fp:' + id, title: 'Profil', html: `<div class="glass hero rim">${avatar(u, 92)}<h2>${esc(u.nick)}</h2>${u.private ? '<p class="sub">Bu profil yopiq.</p>' : `<div class="lvl"><span class="pill glass"><i class="dot ${u.online ? 'on' : ''}"></i>${u.online ? 'Onlayn' : 'Oflayn'}</span><span class="pill glass">Daraja ${u.level}</span><span class="pill glass">${u.points} ball</span></div><span class="idchip glass">${esc(u.gh)}</span>`}</div>
${u.private ? '' : `<h2 class="sh">Statistika</h2><div class="stats">${[['Jami o‘yinlar', u.games], ['G‘alabalar', u.wins], ['Mag‘lubiyatlar', u.losses], ['G‘alaba foizi', u.winRate != null ? u.winRate + '%' : '—'], ['Sevimli o‘yin', u.fav ? (G(u.fav) || { name: u.fav }).name : '—'], ['Eng uzun seriya', u.bestStreak]].map(([a, b]) => `<div class="glass stat"><small>${a}</small><b>${b}</b></div>`).join('')}</div>${u.history && u.history.length ? `<h2 class="sh">Oxirgi o‘yinlar</h2><div class="glass list">${u.history.map(histRow).join('')}</div>` : ''}`}
${u.friend ? `<button class="btn glass danger" style="margin-top:18px;color:#fff" data-a="fremove" data-id="${u.id}">Do‘stlikdan chiqarish</button>` : ''}` });
    } catch (e) { toast(errMsg(e), 1); }
  }
  const histRow = h => `<div class="row"><span class="t"><b>${(G(h.game) || { name: h.game }).name}</b><small>${new Date(h.ended_at).toLocaleString('uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span><span class="v" style="color:${h.outcome === 'win' ? 'var(--good)' : h.outcome === 'loss' ? 'var(--bad)' : 'var(--tx2)'};font-weight:800">${h.outcome === 'win' ? 'G‘alaba' : h.outcome === 'loss' ? 'Mag‘lubiyat' : 'Durang'}${h.delta ? ' · ' + (h.delta > 0 ? '+' : '') + h.delta : ''}</span></div>`;
  async function historyPage() {
    let h = null; if (ready()) try { h = await Net.rpc('history.list'); } catch (e) { toast(errMsg(e), 1); }
    push({ key: 'history', title: 'O‘yinlar tarixi', html: !ready() ? empty('clock', 'Tarix bo‘sh', 'O‘yinlar tarixi server ulangach ko‘rinadi.') : h && h.length ? `<div class="glass list">${h.map(histRow).join('')}</div>` : empty('clock', 'Hali o‘yin yo‘q', 'Birinchi o‘yiningizdan keyin natijalar shu yerda paydo bo‘ladi.') });
  }
  async function missionsPage() {
    let m = null; if (ready()) try { m = await Net.rpc('missions.list'); } catch (e) {}
    const body = m ? m.map(x => `<div class="glass card"><div class="mrow"><span class="t"><b>${esc(x.title)}</b><small>${esc(x.desc)}</small></span>${x.done ? `<span class="check">${I.check}</span>` : `<span class="gold">+${x.reward} ball</span>`}</div><div class="bar2"><i style="width:${Math.round(x.progress / x.goal * 100)}%"></i></div><small class="sub">${x.progress} / ${x.goal}${x.done ? ' · mukofot berilgan' : ' · mukofot: ' + x.reward + ' ball'}</small></div>`).join('')
      : MISSIONS_OFFLINE.map(x => `<div class="glass card"><div class="mrow"><span class="t"><b>${x[0]}</b><small>${x[1]}</small></span></div><div class="bar2"><i style="width:0"></i></div><small class="sub">0 / ${x[2]} · server ulanmagan</small></div>`).join('');
    push({ key: 'missions', title: 'Missiyalar', html: `<p class="sub" style="margin-bottom:12px">Missiya bajarilganda mukofot server tomonidan avtomatik hisobingizga yoziladi va faqat bir marta beriladi.</p>${body}` });
  }
  async function achsPage() {
    let a = null; if (ready()) try { a = await Net.rpc('achievements.list'); } catch (e) {}
    const body = a ? a.map(x => `<div class="glass card"><div class="mrow">${I.medal.replace('<svg', '<svg width="26" height="26" style="color:' + (x.unlocked ? 'var(--gold)' : 'var(--tx3)') + '"')}<span class="t"><b>${esc(x.title)}</b><small>${esc(x.desc)}</small></span>${x.unlocked ? `<span class="check">${I.check}</span>` : `<span class="sub">${x.hidden ? 'Yopiq' : x.progress + '/' + x.goal}</span>`}</div></div>`).join('')
      : ACHS_OFFLINE.map(x => `<div class="glass card"><div class="mrow">${I.medal.replace('<svg', '<svg width="26" height="26"')}<span class="t"><b>${x[0]}</b><small>${x[1]}</small></span><span class="sub">Yopiq</span></div></div>`).join('');
    push({ key: 'achs', title: 'Yutuqlar', html: body });
  }
  function editProfile() {
    if (!ready()) return;
    push({ key: 'edit', title: 'Profilni tahrirlash', html: `<div class="glass hero" style="margin-bottom:14px">${avatar(null, 84)}<p class="sub">Avatar Telegram profilingizdan olinadi.</p></div>
<label class="field"><span>Nickname (2–20 belgi)</span><input class="input" id="nk" maxlength="20" value="${esc(st.me.nick)}" autocomplete="off"></label>
<label class="field"><span>GAME HUB ID (o‘zgarmaydi)</span><input class="input" value="${esc(st.me.gh)}" readonly></label><button class="btn" id="sv">Saqlash</button>`,
      mount(el) { $('#sv', el).onclick = async () => { const b = $('#sv', el), v = $('#nk', el).value.trim(); if (v.length < 2) return toast('Nickname kamida 2 belgi', 1); b.disabled = true; try { st.me = await Net.rpc('me.update', { nickname: v }); toast('Saqlandi'); buzz('ok'); render.profile(); render.home(); pop(); } catch (e) { toast(errMsg(e), 1); b.disabled = false; } }; } });
  }
  function settings() {
    const m = st.me, ok = ready(), dis = ok ? '' : 'style="opacity:.45;pointer-events:none"';
    const sw = (k, on, extra = '') => `<button class="sw ${on ? 'on' : ''}" data-k="${k}" role="switch" aria-checked="${!!on}" ${extra}></button>`;
    push({ key: 'settings', title: 'Sozlamalar', html: `<div class="glass card"><h3>Ilova foni</h3><div class="prev" id="pv"><div class="glass blur">Oldindan ko‘rish</div></div><div class="swatches">${BGS.map(b => `<button class="swatch press ${b.id === S.bg ? 'on' : ''}" data-bg="${b.id}" aria-label="${b.name}" data-wall="${b.id}"></button>`).join('')}</div><p class="sub" id="bgn" style="margin-top:10px">${BGS.find(b => b.id === S.bg).name}</p></div>
<div class="glass card"><h3>Mavzu</h3><div class="seg">${[['auto', 'Avto'], ['dark', 'Qora'], ['light', 'Oq']].map(([k, t]) => `<button data-th="${k}" class="${S.theme === k ? 'on' : ''}">${t}</button>`).join('')}</div><p class="sub" style="margin-top:8px">Avto: telefonning tungi rejimiga moslashadi (yoqiq — qora, o‘chiq — oq).</p></div>
<div class="glass card"><h3>Shisha shaffofligi</h3><label class="sub" style="display:block;margin-top:4px">Pastki panel: <span id="v-tb">${Math.round(S.tbOp * 100)}%</span></label><input type="range" id="rg-tb" min="0.2" max="1" step="0.05" value="${S.tbOp}"><label class="sub" style="display:block;margin-top:8px">Faol tab linzasi: <span id="v-lens">${Math.round(S.lensOp * 100)}%</span></label><input type="range" id="rg-lens" min="0.2" max="1" step="0.05" value="${S.lensOp}"><div class="tbpv"><nav class="tabbar tbprev" aria-hidden="true"><div class="items">${TABS.map((t, i) => `<button tabindex="-1"${i === 1 ? ' class="active"' : ''}>${I[t]}<span>${NL[i]}</span></button>`).join('')}</div><div class="pvl" style="--i:1"><i></i></div></nav></div></div>
<div class="glass list"><div class="row"><span class="t"><b>Ovoz effektlari</b><small>O‘yin hodisalarida qisqa signal</small></span>${sw('sound', S.sound)}</div><div class="row"><span class="t"><b>Bildirishnomalar</b><small>Ilova ichida taklif va o‘yin xabarlari</small></span>${sw('notif', S.notif)}</div></div>
<div class="glass list" ${dis}><div class="row"><span class="t"><b>Onlayn holatni ko‘rsatish</b><small>${ok ? 'Do‘stlaringiz sizni onlayn deb ko‘radi' : 'Server ulangach o‘zgartiriladi'}</small></span>${sw('show_online', ok ? m.show_online : true)}</div><div class="row"><span class="t"><b>Ochiq profil</b><small>${ok ? 'Statistika va qidiruvda ko‘rinish' : 'Server ulangach o‘zgartiriladi'}</small></span>${sw('is_public', ok ? m.is_public : true)}</div></div>
<div class="glass list"><div class="row"><span class="t"><b>Til</b><small>Rus va ingliz tillari keyinroq qo‘shiladi</small></span><span class="v">O‘zbekcha</span></div><div class="row"><span class="t"><b>Ilova haqida</b><small>GAME HUB v${(window.GH_CONFIG || {}).VERSION || '0.7'} · ${inTg ? 'Telegram Mini App' : 'brauzer preview'} · server: ${ok ? 'ulangan' : 'ulanmagan'}</small></span></div></div>`,
      mount(p) {
        $$('.swatch', p).forEach(s => { const t = document.createElement('div'); t.dataset.bg = s.dataset.wall; t.style.display = 'none'; document.body.appendChild(t); s.style.background = getComputedStyle(t).getPropertyValue('--wall'); t.remove(); });
        const rt = $('#rg-tb', p), rl = $('#rg-lens', p);
        rt.oninput = e => { S.tbOp = +e.target.value; $('#v-tb', p).textContent = Math.round(S.tbOp * 100) + '%'; applyLook(); }; rt.onchange = save;
        rl.oninput = e => { S.lensOp = +e.target.value; $('#v-lens', p).textContent = Math.round(S.lensOp * 100) + '%'; applyLook(); }; rl.onchange = save;
        p.addEventListener('click', async e => {
          const b = e.target.closest('[data-bg]'), k = e.target.closest('[data-k]'), th = e.target.closest('[data-th]');
          if (b) { S.bg = b.dataset.bg; save(); applyLook(); $$('.swatch', p).forEach(x => x.classList.toggle('on', x === b)); $('#bgn', p).textContent = BGS.find(x => x.id === S.bg).name; buzz(); }
          if (th) { S.theme = th.dataset.th; save(); mode(); $$('[data-th]', p).forEach(x => x.classList.toggle('on', x === th)); }
          if (k) {
            const key = k.dataset.k, on = !k.classList.contains('on');
            if (key === 'sound' || key === 'notif') { S[key] = on; save(); k.classList.toggle('on', on); k.setAttribute('aria-checked', on); if (key === 'sound' && on) sfx(740); }
            else if (ready()) { k.classList.toggle('on', on); try { st.me = await Net.rpc('me.update', { [key]: on }); } catch (x) { k.classList.toggle('on', !on); toast(errMsg(x), 1); } }
          }
        });
      } });
  }

  /* ---------- Hodisalarni yagona joyda tinglash ---------- */
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-g]'), a = e.target.closest('[data-a]'), c = e.target.closest('[data-c]'), o = e.target.closest('[data-go]');
    if (e.target.closest('.press,.chip,.sw,.swatch,.row,.seg button,.btn,.mini-btn')) buzz('tap');
    if (g && !g.closest('.page,.sheet')) return void openGame(g.dataset.g);
    if (o) return void go(o.dataset.go);
    if (c) { cat = c.dataset.c; $$('.chip').forEach(x => x.classList.toggle('on', x === c)); return void list(); }
    if (!a) return;
    const k = a.dataset.a, id = a.dataset.id;
    if (k === 'settings') settings(); else if (k === 'missions') missionsPage(); else if (k === 'achs') achsPage(); else if (k === 'history') historyPage();
    else if (k === 'edit') editProfile(); else if (k === 'join') { if (ready()) joinSheet(); else toast('Server bilan aloqa yo‘q', 1); }
    else if (k === 'addfriend') ready() && addFriendSheet(); else if (k === 'fprofile') friendProfile(id);
    else if (k === 'copyid') copyText(st.me.gh);
    else if (k === 'start') { const gm = G(id); if (gm.status !== 'ready') return toast('Bu o‘yin tez orada qo‘shiladi'); if (!ready()) return toast('Server bilan aloqa yo‘q', 1); a.disabled = true; Room.create(id).catch(x => toast(errMsg(x), 1)).finally(() => { a.disabled = false; }); }
    else if (k === 'facc' || k === 'fdec') Net.rpc('friends.respond', { id, accept: k === 'facc' }).then(() => { toast(k === 'facc' ? 'Do‘st qo‘shildi' : 'Rad etildi'); refresh.friends(); }).catch(x => toast(errMsg(x), 1));
    else if (k === 'fremove') Net.rpc('friends.remove', { id }).then(() => { pop(); toast('Do‘stlikdan chiqarildi'); refresh.friends(); }).catch(x => toast(errMsg(x), 1));
  });

  /* ---------- Server hodisalari ---------- */
  function invitePrompt(m) {
    if (!S.notif) return; sfx(880, .12); buzz('ok');
    if (has('invite:' + m.code)) return;
    sheet({ key: 'invite:' + m.code, title: 'Lobbiga chaqiruv', html: `<div class="fl">${avatar(m.from, 46)}<span class="t"><b>${esc(m.from.nick)}</b><small>${(G(m.game) || { name: m.game }).name} xonasiga chaqirmoqda (kod ${esc(m.code)})</small></span></div><div class="row2"><button class="btn glass" data-x="no">Rad etish</button><button class="btn" id="ia">Qo‘shilish</button></div>`,
      mount(el) { $('[data-x=no]', el).onclick = () => pop(); $('#ia', el).onclick = async () => { $('#ia', el).disabled = true; try { await Room.join(m.code); } catch (x) { toast(errMsg(x), 1); pop(); } }; } });
  }
  Net.on('authed', m => {
    st.me = m.me; st.cfg = m.cfg || st.cfg; st.start = m.start || '';
    [render.home, render.games, render.friends, render.rating, render.profile].forEach(f => f());
    (refresh[cur] || (() => {}))();
    if (m.room) Room.resume(); else if (/^[A-Z0-9]{6}$/i.test(st.start)) setTimeout(() => { if (!has('join')) joinSheet(st.start.toUpperCase()); }, 400);
  });
  Net.on('status', s => { if (s !== 'online') { [render.home, render.games, render.friends, render.rating, render.profile].forEach(f => f()); } });
  Net.on('authfail', msg => { toast(msg, 1); render.home(); });
  Net.on('invite', invitePrompt);
  Net.on('friends', m => { if (S.notif) { toast(m.ev === 'request' ? `${m.from.nick} do‘stlik so‘rovini yubordi` : m.ev === 'accepted' ? `${m.from.nick} bilan endi do‘stsiz` : '', 0); sfx(620); } refresh.friends(); });
  Net.on('rate', () => toast('Juda tez bosyapsiz — sekinroq', 1));

  /* ---------- Ishga tushirish ---------- */
  function start() {
    [render.home, render.games, render.friends, render.rating, render.profile].forEach(f => f());
    go('home'); tb.classList.remove('pop');
    const dev = new URLSearchParams(location.search).get('dev');
    if (inTg) Net.connect({ initData: tg.initData });
    else if (dev) Net.connect({ dev });
    else Net.connect(null);
    render.home();
  }
  return { start, go, push, pop, popTo, has, closeSheets, sheet, toast, esc, I, G, art, artBox, avatar, st, S, tg, inTg, buzz, sfx, copyText, errMsg, ready, name, refresh, render, ol, ul };
})();
