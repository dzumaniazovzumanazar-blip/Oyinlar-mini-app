/* GAME HUB — o‘yin xonasi (lobby) va o‘yin ekrani. Barcha qoidalar SERVERda; bu yerda faqat ko‘rsatish va harakat so‘rash.
   Yangi o‘yin interfeysi: GameUI.<id> = { head(room), role(room), main(room), bind(el, room) } */
const Room = (() => {
  const A = App, I = A.I, esc = A.esc, sleep = ms => new Promise(r => setTimeout(r, ms));
  let cur = null, chat = [], page = null, tick = null, skew = 0, phaseKey = '', phaseTotal = 1, roleBuilt = false, lastPhase = '';
  const meId = () => A.st.me && A.st.me.id;
  const nick = (r, id) => { const p = r.players.find(x => x.id === id); return p ? p.nick : '?'; };
  const fmt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const call = async (m, p) => { try { return await Net.rpc(m, p); } catch (e) { A.toast(A.errMsg(e), 1); throw e; } };
  const gameName = id => (A.G(id) || { name: id }).name;

  /* ---------- kirish nuqtalari ---------- */
  async function create(game) { open(await Net.rpc('room.create', { game })); }
  async function join(code) { open(await Net.rpc('room.join', { code })); }
  async function resume() { try { const d = await Net.rpc('room.get'); if (d) open(d); } catch (e) {} }

  async function open(d) {
    cur = d.room; chat = d.chat || []; skew = cur.now - Date.now();
    if (A.has('room')) { render(); return; }
    if (A.closeSheets()) await sleep(310);
    const mk = () => A.push({
      key: 'room', title: gameName(cur.game), cls: 'rm', html: '<div class="rm-tint"></div><div id="rm-top"></div><div id="rm-role"></div><div id="rm-main"></div><div id="rm-chat"></div>',
      onBack: () => { askLeave(); return false; },
      mount(el, e) { page = el; roleBuilt = false; e.onClose = cleanup; buildChat(); render(); startTick(); }
    });
    if (!mk()) { await sleep(360); mk(); }
  }
  function cleanup() { clearInterval(tick); tick = null; page = null; cur = null; chat = []; roleBuilt = false; try { A.tg && A.tg.disableClosingConfirmation(); } catch (e) {} }
  function askLeave() {
    if (!cur) return A.pop(true);
    const playing = cur.status === 'playing';
    A.sheet({ key: 'leave', title: 'Xonadan chiqasizmi?', html: `<p class="sub" style="margin:0 4px 6px">${playing ? 'O‘yin davom etmoqda. Chiqsangiz mag‘lubiyat hisoblanadi.' : 'Xonadan chiqib ketasiz.'}</p><div class="row2"><button class="btn glass" data-x="no">Qolish</button><button class="btn danger" data-x="yes">Chiqish</button></div>`,
      mount(el) { $('[data-x=no]', el).onclick = () => A.pop(); $('[data-x=yes]', el).onclick = async () => { try { await Net.rpc('room.leave'); } catch (e) {} const c = cur; cur = null; while (A.has('leave')) A.pop(true); while (A.has('room')) A.pop(true); A.refresh.profile(); }; } });
  }

  /* ---------- server hodisalari ---------- */
  Net.on('room', m => {
    if (!cur || m.room.code !== cur.code) return;
    const old = cur; cur = m.room; skew = cur.now - Date.now();
    if (cur.g && old.g && cur.g.phase !== old.g.phase) { A.sfx(cur.g.phase === 'night' ? 300 : cur.g.phase === 'over' ? 880 : 560, .14); A.buzz(); }
    if (cur.status === 'over' && old.status !== 'over') { A.buzz('ok'); A.refresh.profile(); }
    render();
  });
  Net.on('chat', m => { if (cur && m.code === cur.code) { chat.push(m.m); addMsg(m.m); if (m.m.uid !== meId()) A.sfx(520, .05); } });
  Net.on('status', s => { if (s === 'offline' && cur) A.toast('Aloqa uzildi. Qayta ulanilmoqda…', 1); });

  /* ---------- umumiy render ---------- */
  function render() {
    if (!page || !cur) return;
    const r = cur, g = r.g, ph = r.status === 'lobby' ? 'lobby' : g ? g.phase : 'lobby';
    page.dataset.ph = ph;
    try { A.tg && (r.status === 'playing' ? A.tg.enableClosingConfirmation() : A.tg.disableClosingConfirmation()); } catch (e) {}
    const ui = GameUI[r.game];
    $('#rm-top', page).innerHTML = r.status === 'lobby' || !ui ? '' : ui.head(r);
    if (r.status === 'lobby') { $('#rm-role', page).innerHTML = ''; roleBuilt = false; $('#rm-main', page).innerHTML = lobby(r); bindLobby(); }
    else if (ui) {
      if (!roleBuilt && g.me) { $('#rm-role', page).innerHTML = ui.role(r); bindRole(); roleBuilt = true; }
      $('#rm-main', page).innerHTML = ui.main(r); ui.bind($('#rm-main', page), r);
    } else $('#rm-main', page).innerHTML = '<div class="glass card empty"><b>Bu o‘yin interfeysi yo‘q</b></div>';
    updChat(); startTick(); tickOnce();
  }

  /* ---------- Lobby ---------- */
  function lobby(r) {
    const me = r.players.find(p => p.id === meId()), own = r.owner === meId(), n = r.players.length;
    const hint = n < r.min ? `Kamida ${r.min} o‘yinchi kerak (hozir ${n})` : !r.canStart ? 'Hamma o‘yinchi tayyor bo‘lishi kerak' : '';
    return `<div class="glass rm-code rim"><span class="c"><small>Xona kodi</small><b>${esc(r.code)}</b></span><button class="ibtn glass press" data-r="copy" aria-label="Kodni nusxalash">${I.copy}</button><button class="ibtn glass press" data-r="share" aria-label="Telegram orqali ulashish">${I.send}</button></div>
<div class="cnt">O‘yinchilar <span>${n} / ${r.max} · kamida ${r.min}</span></div>
<div class="glass list">${r.players.map(p => `<div class="pl"><span class="av">${A.avatar(p, 44)}<i class="dot ${p.connected ? 'on' : ''}"></i></span><span class="t"><b>${esc(p.nick)}${p.id === meId() ? ' (siz)' : ''}</b><small>${p.connected ? 'Onlayn' : 'Aloqa yo‘q'}</small></span>${p.id === r.owner ? '<span class="bdg own">Ega</span>' : p.ready ? '<span class="bdg ok">Tayyor</span>' : '<span class="bdg wait">Kutmoqda</span>'}</div>`).join('')}</div>
<button class="btn glass" data-r="invite" style="margin-bottom:10px">${I.plus} Lobbiga chaqirish</button>
${own ? `<button class="btn ${r.canStart ? '' : 'off'}" data-r="start">O‘yinni boshlash</button>${hint ? `<p class="sub" style="text-align:center;margin-top:8px">${hint}</p>` : ''}`
        : `<button class="btn ${me && me.ready ? 'glass' : ''}" data-r="ready">${me && me.ready ? 'Tayyor emasman' : 'Tayyorman'}</button><p class="sub" style="text-align:center;margin-top:8px">Xona egasi o‘yinni boshlashini kuting</p>`}
<button class="btn glass" data-r="leave" style="margin-top:12px">Xonadan chiqish</button>`;
  }
  function bindLobby() {
    $('#rm-main', page).onclick = async e => {
      const b = e.target.closest('[data-r]'); if (!b || !cur) return; const k = b.dataset.r;
      if (k === 'copy') A.copyText(cur.code);
      else if (k === 'share') share();
      else if (k === 'invite') inviteSheet();
      else if (k === 'leave') askLeave();
      else if (k === 'ready') { const me = cur.players.find(p => p.id === meId()); call('room.ready', { ready: !(me && me.ready) }).catch(() => {}); }
      else if (k === 'start') { if (!cur.canStart) return A.toast(cur.players.length < cur.min ? `Kamida ${cur.min} o‘yinchi kerak` : 'Hamma tayyor bo‘lishi kerak', 1); b.disabled = true; call('room.start').catch(() => {}).finally(() => { b.disabled = false; }); }
    };
  }
  function link(code) { const c = A.st.cfg; if (!c.botUsername) return ''; return c.miniapp ? `https://t.me/${c.botUsername}/${c.miniapp}?startapp=${code}` : `https://t.me/${c.botUsername}?startapp=${code}`; }
  function share() {
    const l = link(cur.code), text = `GAME HUB — ${gameName(cur.game)} xonasiga qo‘shil! Kod: ${cur.code}`;
    if (l && A.tg && A.tg.openTelegramLink) A.tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(l) + '&text=' + encodeURIComponent(text));
    else { A.copyText(text); A.toast(l ? 'Matn nusxalandi' : 'Havola sozlanmagan (BOT_USERNAME). Kod nusxalandi', 0); }
  }
  async function inviteSheet() {
    let d = null; try { d = await Net.rpc('friends.list'); } catch (e) { return A.toast(A.errMsg(e), 1); }
    const inRoom = new Set(cur.players.map(p => p.id)), fr = d.friends.filter(f => !inRoom.has(f.id));
    A.sheet({ key: 'invite', title: 'Lobbiga chaqirish', html: `${fr.length ? fr.map(f => `<div class="fl">${A.avatar(f, 42)}<span class="t"><b>${esc(f.nick)}</b><small>${f.online ? 'Onlayn' : 'Oflayn'}</small></span>${f.online ? `<button class="mini-btn ok press" data-id="${f.id}">Chaqirish</button>` : '<span class="sub">Oflayn</span>'}</div>`).join('') : '<p class="sub" style="padding:6px 4px 10px">Chaqirish uchun do‘stlaringiz yo‘q yoki hammasi xonada. Do‘st qo‘shish: Do‘stlar bo‘limi.</p>'}
<button class="btn glass" data-x="share" style="margin-top:10px">${I.send} Telegram orqali ulashish</button>`,
      mount(el) { el.onclick = async e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.x === 'share') return share(); if (!b.dataset.id) return; b.disabled = true; try { await Net.rpc('room.invite', { id: b.dataset.id }); b.outerHTML = '<span class="sub">Yuborildi</span>'; } catch (x) { A.toast(A.errMsg(x), 1); b.disabled = false; } }; } });
  }

  /* ---------- Chat ---------- */
  function buildChat() {
    $('#rm-chat', page).innerHTML = `<div class="glass chat" id="chatbox"><div class="msgs" id="ms"></div><div class="cin" id="cin"><input class="input" id="ci" maxlength="200" placeholder="Xabar yozing…" autocomplete="off"><button class="ibtn press" id="cs" aria-label="Yuborish">${I.send}</button></div><p class="lockmsg" id="clock" hidden></p></div>`;
    const send = async () => { const i = $('#ci', page), t = i.value.trim(); if (!t) return; i.value = ''; try { await Net.rpc('chat.send', { text: t }); } catch (e) { A.toast(A.errMsg(e), 1); i.value = t; } };
    $('#cs', page).onclick = send; $('#ci', page).onkeydown = e => { if (e.key === 'Enter') send(); };
    chat.forEach(addMsg);
  }
  function addMsg(m) { const ms = page && $('#ms', page); if (!ms) return; const d = document.createElement('div'); d.className = 'msg' + (m.uid === meId() ? ' mine' : ''); d.innerHTML = `<small>${esc(m.nick)}</small>${esc(m.text)}`; ms.appendChild(d); while (ms.children.length > 60) ms.firstChild.remove(); ms.scrollTop = ms.scrollHeight; }
  function canChat() { const r = cur; if (!r) return false; if (r.status !== 'playing') return true; const g = r.g; return !!(g && g.me && g.me.alive && (g.phase === 'day' || g.phase === 'vote')); }
  function updChat() {
    const ok = canChat(), c = $('#cin', page), l = $('#clock', page), r = cur;
    c.classList.toggle('off', !ok); $('#ci', page).disabled = !ok; l.hidden = ok;
    l.textContent = r.g && r.g.me && !r.g.me.alive ? 'Siz o‘yindan chiqqansiz — yozib bo‘lmaydi' : r.g && r.g.phase === 'night' ? 'Tunda hamma jim. Chat kunduzi ochiladi.' : 'Hozir yozib bo‘lmaydi';
  }

  /* ---------- Taymer (sekundiga bir marta, faqat xona ochiqligida) ---------- */
  function startTick() { if (tick || !page) return; tick = setInterval(tickOnce, 1000); }
  function tickOnce() {
    const g = cur && cur.g, tm = page && $('#tm', page); if (!g || !tm || !g.endsAt) return;
    const key = g.phase + ':' + g.day + ':' + g.endsAt; if (key !== phaseKey) { phaseKey = key; phaseTotal = Math.max(1, g.endsAt - (Date.now() + skew)); }
    const rem = (g.endsAt - (Date.now() + skew)) / 1000; tm.textContent = fmt(rem);
    const b = $('#tbar i', page); if (b) b.style.transform = `scaleX(${Math.max(0, Math.min(1, rem * 1000 / phaseTotal))})`;
  }

  /* ---------- Rol kartasi: bosib turganda ko‘rinadi (yelka orqasidan ko‘rinmasligi uchun) ---------- */
  function bindRole() {
    const el = $('.role', page); if (!el) return;
    const on = () => el.classList.add('show'), off = () => el.classList.remove('show');
    el.addEventListener('pointerdown', e => { on(); try { el.setPointerCapture(e.pointerId); } catch (x) {} });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => el.addEventListener(n, off));
    el.addEventListener('contextmenu', e => e.preventDefault());
  }

  /* ==========================================================================
     MAFIA interfeysi
     ========================================================================== */
  const RU = ROLE_UI, mp = (r, id) => r.g.players.find(p => p.id === id) || {};
  const GameUI = {
    mafia: {
      head(r) {
        const g = r.g, me = g.me || {}, role = me.role, dead = me.alive === false;
        const T = {
          reveal: ['eye', 'Rollar taqsimlandi', 'Rolingizni ko‘ring va hech kimga ko‘rsatmang'],
          night: ['moon', `${g.day}-tun`, dead ? 'Siz o‘yindan chiqqansiz' : role === 'mafia' ? 'Qurbonni tanlang' : role === 'doctor' ? 'Kimni davolaysiz?' : role === 'commissar' ? 'Kimni tekshirasiz?' : 'Shahar uxlamoqda…'],
          day: ['sun', `${g.day}-kun · muhokama`, 'Gaplashing, shubhalaringizni ayting'],
          vote: ['vote', 'Ovoz berish', 'Kim mafia deb o‘ylaysiz?'],
          over: ['shield', 'O‘yin tugadi', g.winner === 'mafia' ? 'Mafia g‘alaba qozondi' : 'Tinch aholi g‘alaba qozondi']
        }[g.phase] || ['info', '', ''];
        return `<div class="glass ph rim"><span class="pi">${I[T[0]]}</span><span class="t"><b>${T[1]}</b><small>${T[2]}</small></span>${g.endsAt ? '<span class="tm" id="tm">0:00</span>' : ''}</div>${g.endsAt ? '<div class="tbar" id="tbar"><i></i></div>' : ''}`;
      },
      role(r) {
        const g = r.g, rl = RU[g.me.role] || RU.civilian, mates = g.me.role === 'mafia' ? g.players.filter(p => p.role === 'mafia' && p.id !== meId()).map(p => nick(r, p.id)) : [];
        return `<div class="glass role rim" style="--rc:${rl.hue}"><div class="lock"><div class="q">?</div><b>Maxfiy rolingiz</b><small>Ko‘rish uchun bosib turing</small></div><div class="face"><h3>${rl.name}</h3><p>${rl.brief}</p>${mates.length ? `<div class="team">Sheriklaringiz: ${mates.map(esc).join(', ')}</div>` : ''}</div></div>`;
      },
      main(r) {
        const g = r.g, me = g.me || {}, role = me.role, alive = me.alive, ph = g.phase, mine = meId();
        const votes = g.votes || {}, tally = {}; Object.values(votes).forEach(t => { if (t !== 'skip') tally[t] = (tally[t] || 0) + 1; });
        const picks = ph === 'night' && g.night && g.night.kind ? g.night : null, tg = new Set(picks ? picks.targets : []);
        const canVote = ph === 'vote' && alive;
        const sel = picks ? picks.choice : canVote ? votes[mine] : null;
        const grid = r.players.map(p => {
          const gp = mp(r, p.id), dead = gp.alive === false, rl = gp.role ? RU[gp.role] : null, pickable = (picks && tg.has(p.id)) || (canVote && p.id !== mine && !dead);
          const mate = role === 'mafia' && gp.role === 'mafia' && p.id !== mine;
          const sub = gp.left ? 'Chiqib ketgan' : rl ? (dead ? '✕ ' : '') + rl.name : dead ? 'Chiqarilgan' : '';
          return `<button class="pk glass press ${dead ? 'dead' : ''} ${p.id === mine ? 'me' : ''} ${mate ? 'tm' : ''} ${sel === p.id ? 'sel' : ''}" ${pickable ? `data-pick="${p.id}"` : 'disabled style="pointer-events:none"'}>${tally[p.id] ? `<i class="vb">${tally[p.id]}</i>` : ''}${A.avatar(p, 46)}<b>${esc(p.nick)}</b><small>${sub}</small></button>`;
        }).join('');
        let act = '';
        if (ph === 'reveal') act = `<div class="glass act"><h3>Tayyorlaning</h3><p>Rolingizni yuqoridagi kartani bosib turib ko‘ring. Tez orada birinchi tun boshlanadi.</p></div>`;
        else if (ph === 'night') {
          if (!alive) act = `<div class="glass act"><h3>Siz o‘yindan chiqqansiz</h3><p>Natijalarni kuzating. Chat kunduzi ham yopiq.</p></div>`;
          else if (!picks) act = `<div class="glass act"><h3>Shahar uxlamoqda</h3><p>Sizning rolingiz tunda harakat qilmaydi. Tong otishini kuting…</p></div>`;
          else {
            const ttl = { kill: 'Kimni yo‘q qilasiz?', heal: 'Kimni davolaysiz?', check: 'Kimni tekshirasiz?' }[picks.kind];
            const last = g.checks && g.checks.find(c => c.day === g.day);
            act = `<div class="glass act"><h3>${ttl}</h3><p>${picks.choice ? `Tanlovingiz: <b>${esc(nick(r, picks.choice))}</b>${picks.kind === 'check' ? '' : ' (o‘zgartirish mumkin)'}` : 'Pastdagi o‘yinchilardan birini bosing.'}</p>
${picks.kind === 'kill' && picks.picks ? Object.entries(picks.picks).filter(([k]) => +k !== mine).map(([k, v]) => `<div class="chk bad">${I.skull.replace('<svg', '<svg width="18" height="18"')}${esc(nick(r, +k))} → ${esc(nick(r, v))}</div>`).join('') : ''}
${last ? `<div class="chk ${last.mafia ? 'bad' : 'good'}">${esc(nick(r, last.target))}: ${last.mafia ? 'MAFIA!' : 'mafia emas'}</div>` : ''}</div>`;
          }
        }
        else if (ph === 'day') act = `<div class="glass act"><h3>Muhokama</h3><p>${alive ? 'Chatda gaplashing. Hamma tayyor bo‘lsa, ovoz berish erta boshlanadi.' : 'Siz kuzatuvchisiz.'}</p>${alive ? `<button class="btn glass" data-skip="1" ${g.day_skips && g.day_skips.me ? 'disabled' : ''}>${g.day_skips && g.day_skips.me ? 'Kutilmoqda…' : 'Ovozga o‘tishga tayyorman'}${g.day_skips ? ` (${g.day_skips.n}/${g.aliveCount})` : ''}</button>` : ''}</div>`;
        else if (ph === 'vote') act = `<div class="glass act"><h3>Ovoz bering</h3><p>${alive ? (votes[mine] ? 'Ovozingiz qabul qilindi (o‘zgartirish mumkin).' : 'Mafia deb o‘ylagan odamingizga bosing.') : 'Siz ovoz bera olmaysiz.'} Ovoz berganlar: ${Object.keys(votes).length}/${g.aliveCount}</p>${alive ? `<button class="btn glass ${votes[mine] === 'skip' ? '' : ''}" data-vskip="1">${votes[mine] === 'skip' ? '✓ ' : ''}Hech kimni chiqarmayman</button>` : ''}</div>`;
        else if (ph === 'over') {
          const res = r.result, own = r.owner === mine, win = res && res.outcome === 'win';
          act = `<div class="glass win rim"><div class="big">${win ? '🏆' : res ? '🌙' : '🏁'}</div><h2>${res ? (win ? 'Siz g‘alaba qozondingiz!' : 'Mag‘lubiyat') : 'O‘yin tugadi'}</h2><p class="sub">${g.winner === 'mafia' ? 'Mafia g‘alaba qozondi' : 'Tinch aholi g‘alaba qozondi'}</p>${res ? `<div class="rs"><div><small>Reyting</small><b>${res.delta > 0 ? '+' : ''}${res.delta}</b></div><div><small>Jami ball</small><b>${res.points}</b></div><div><small>Daraja</small><b>${res.level}</b></div></div>${res.missions.length ? `<p style="margin-top:12px" class="gold">Missiya bajarildi: ${res.missions.map(m => esc(m.title) + ' +' + m.reward).join(', ')}</p>` : ''}${res.achievements.length ? `<p style="margin-top:6px" class="gold">Yangi yutuq: ${res.achievements.map(m => esc(m.title)).join(', ')}</p>` : ''}` : '<p class="sub" style="margin-top:10px">Natijalar hisoblanmoqda…</p>'}</div>${own ? '<button class="btn" data-again="1">Yana o‘ynash (lobbiga qaytish)</button>' : '<p class="sub" style="text-align:center">Xona egasi yangi o‘yin boshlashini kuting</p>'}`;
        }
        const chk = g.checks && g.checks.length && ph !== 'night' ? `<div class="glass act"><h3>Tekshiruvlaringiz</h3>${g.checks.map(c => `<div class="chk ${c.mafia ? 'bad' : 'good'}">${esc(nick(r, c.target))} — ${c.mafia ? 'mafia' : 'mafia emas'}</div>`).join('')}</div>` : '';
        const log = g.log.slice(-10).reverse();
        return `${act}<div class="cnt">O‘yinchilar <span>${g.aliveCount} tirik</span></div><div class="pg">${grid}</div>${chk}<div class="cnt">Voqealar</div><div class="glass log">${log.map(l => `<div class="lg ${l.k}"><i></i><span>${esc(l.text)}</span></div>`).join('')}</div><button class="btn glass" data-leave="1" style="margin-bottom:12px">Xonadan chiqish</button>`;
      },
      bind(el, r) {
        el.onclick = e => {
          const g = r.g, pk = e.target.closest('[data-pick]');
          if (pk) { const t = +pk.dataset.pick; call('game.act', { type: g.phase === 'night' ? 'night' : 'vote', target: t }).then(() => A.buzz()).catch(() => {}); return; }
          if (e.target.closest('[data-skip]')) call('game.act', { type: 'skip_day' }).catch(() => {});
          else if (e.target.closest('[data-vskip]')) call('game.act', { type: 'vote', target: 'skip' }).catch(() => {});
          else if (e.target.closest('[data-again]')) call('room.rematch').catch(() => {});
          else if (e.target.closest('[data-leave]')) askLeave();
        };
      }
    }
  };
  return { create, join, resume, GameUI };
})();
