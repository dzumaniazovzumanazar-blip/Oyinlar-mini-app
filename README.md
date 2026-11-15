# GAME HUB v0.7 — Telegram Mini App

Apple **Liquid Glass** + premium gaming dizayni. Frontend (`index.html`, `css/`, `js/`) va **tayyor Node.js backend** (`server/`).
Backend tashqi paket talab qilmaydi (`npm install` shart emas) — faqat **Node.js 22.13+**.

## Nima ishlaydi, nima yo‘q (ochiq aytamiz)

| Imkoniyat | Holat |
|---|---|
| 5 ta bo‘lim, Liquid Glass UI, 5 xil fon, mavzu, navigatsiya, katalog, o‘yin tafsilotlari | ✅ frontendda ishlaydi (serversiz ham) |
| Mafia: xona, kod, lobby, tayyorlik, rollar, kun/tun/ovoz, g‘olib, natija | ✅ serverda ishlaydi, **avtomatik sinovdan o‘tgan** (`npm test`, 55 tekshiruv) |
| Reyting, missiyalar (mukofot bir marta), yutuqlar, do‘stlar, profil statistikasi | ✅ serverda (SQLite) |
| initData tekshiruvi (HMAC) | ✅ kodi yozilgan va sinalgan; **haqiqiy bot tokeni bilan Telegram ichida sinash sizdan** |
| Telegram orqali havola ulashish (`startapp`) | ⚠️ BOT_USERNAME / MINIAPP_SHORT sozlansa ishlaydi; Telegramda sinalmagan |
| Space Traitor, Kingdom, Detective, Survival Island | ⏳ «Tez orada» — faqat katalogda, o‘yin yo‘q |
| Til (ru/en), tashqi push-bildirishnoma (bot orqali) | ⏳ yo‘q. Til faqat o‘zbekcha; bildirishnoma faqat ilova ichida |
| Offlayn do‘stni chaqirish | ❌ faqat onlayn do‘stga; offlayn bo‘lsa «Telegram orqali ulashish» |
| Ball tizimi | ⚠️ **tasdiqlanmagan**: `server/config.js → rating` da vaqtinchalik qiymatlar. Frontend raqamlarni ko‘rsatmaydi |

Server ulanmagan holatda (oddiy brauzer) ilova **soxta ma’lumot ko‘rsatmaydi**: statistika «—», reyting/do‘stlar bo‘sh holat bilan, o‘yin tugmalari «Server kerak» deb o‘chirilgan.

## Fayllar
```
index.html  css/style.css  css/game.css
js/config.js   backend manzili (WS_URL)
js/games.js    katalog, artwork, bannerlar, fonlar — yangi o‘yin shu yerga
js/net.js      WebSocket + RPC
js/app.js      navigatsiya, tablar, sozlamalar, sahifalar
js/room.js     xona/lobby va Mafia ekrani (GameUI.<id> orqali yangi o‘yin interfeysi)
server/        index.js hub.js rooms.js db.js auth.js config.js ws-lite.js games/mafia.js test/e2e.js
```

## 1) Lokal sinash (Telegramsiz) — eng oson
```
DEV_AUTH=1 MAFIA_MIN_PLAYERS=3 node --no-warnings server/index.js
```
Brauzerda 3 ta oyna (yoki inkognito) oching:
`http://localhost:3000/?dev=Ali`, `...?dev=Vali`, `...?dev=Sardor`
Ali: O‘yinlar → Mafia → Xona yaratish. Boshqalar: O‘yinlar → «Kod bilan» → kod → Tayyorman. Ali boshlaydi.
`DEV_AUTH` faqat sinov uchun — productionda **ishlatmang**.

Telefonda (Termux): `pkg install nodejs`, papkaga kirib yuqoridagi buyruq. Preview — `http://localhost:3000/?dev=Ali`.

## 2) Telegram Mini App sifatida ishga tushirish
1. @BotFather → `/newbot` → **token** oling. `/newapp` (yoki Bot Settings → Menu Button) orqali Mini App URL ni **HTTPS** manzilga qo‘ying.
2. Serverni HTTPS hostingga joylang (Render, Railway, Fly.io, VPS). Backend frontendni ham o‘zi beradi, shuning uchun bitta manzil yetadi.
3. Muhit o‘zgaruvchilari:
   - `BOT_TOKEN` — majburiy (initData tekshiruvi)
   - `BOT_USERNAME`, `MINIAPP_SHORT` — ixtiyoriy (taklif havolasi)
   - `DB_PATH` — SQLite fayl yo‘li (doimiy disk kerak!)
   - `ALLOWED_ORIGINS` — ixtiyoriy
4. Boshlash buyrug‘i: `npm start`. Tekshirish: `/health`.

**Hosting haqida:** SQLite faylga yozadi — bepul hostinglarning ko‘pida disk vaqtinchalik, qayta ishga tushganda ma’lumot yo‘qoladi. Doimiy disk (Fly volume, Render paid disk, VPS) tanlang yoki `server/db.js` ni Postgresga almashtiring (faqat shu fayl). Server **bitta jarayon** uchun yozilgan (xonalar xotirada); ko‘p serverga kengaytirish uchun Redis kerak bo‘ladi.

Frontend alohida joyda (GitHub Pages) bo‘lsa, `js/config.js` da `WS_URL: 'wss://sizning-server/ws'` yozing.

## Brauzer preview vs haqiqiy Telegram testi
- **Brauzer / `?dev=`**: dizayn, navigatsiya, o‘yin mexanikasi tekshiriladi. Telegram SDK, haptika, BackButton, theme, `startapp` bu yerda yo‘q.
- **Telegram ichida**: faqat shu yerda initData imzosi, BackButton, mavzu, safe-area, havola orqali kirish va Note 20 Ultra unumdorligi haqiqiy tekshiriladi. Bu sinovni **men qila olmadim** — iltimos, o‘zingiz sinab, xatolarni yuboring.

## Xavfsizlik
- Foydalanuvchi faqat serverda tekshirilgan `initData` orqali aniqlanadi; `initDataUnsafe` faqat ko‘rsatish uchun.
- Rollar, g‘olib, ball, mukofot — faqat serverda. Begona rollar klientga umuman yuborilmaydi (sinovda tekshirilgan). Mukofot ikki marta berilmasligi DB `PRIMARY KEY` bilan kafolatlangan.

## Yangi o‘yin qo‘shish
`js/games.js` (GAMES + ART) → `server/games/<id>.js` (start, act, leave, snapshot, canChat, stop, min/max) va `server/rooms.js` GAMES ga ulash → `js/room.js` da `GameUI.<id>` (head, role, main, bind).

## Unumdorlik
Doimiy animatsiya yo‘q (faqat bosish/almashtirish paytida). `backdrop-filter` faqat tabbar, yuqori sarlavha, sheet, banner yozuvi va toastda; kartalar yengil «shisha» qatlamlar bilan chiziladi. Taymer — sekundiga bir marta, faqat xona ochiqligida. `prefers-reduced-motion` qo‘llab-quvvatlanadi.
