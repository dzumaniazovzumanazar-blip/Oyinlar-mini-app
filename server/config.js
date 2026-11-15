'use strict';
/* GAME HUB server — markaziy sozlamalar.
   Maxfiy qiymatlar (BOT_TOKEN) FAQAT muhit o‘zgaruvchilaridan olinadi, kodga yozilmaydi. */
const env = process.env;
const num = (v, d) => (v !== undefined && v !== '' && !isNaN(+v) ? +v : d);

module.exports = {
  PORT: num(env.PORT, 3000),
  DB_PATH: env.DB_PATH || require('path').join(__dirname, '..', 'data', 'gamehub.sqlite'),

  /* Telegram */
  BOT_TOKEN: env.BOT_TOKEN || '',            // @BotFather bergan token (initData tekshiruvi uchun SHART)
  BOT_USERNAME: env.BOT_USERNAME || '',      // masalan: GameHubBot (taklif havolasi uchun)
  MINIAPP_SHORT: env.MINIAPP_SHORT || '',    // BotFather’da yaratilgan Mini App short name (bo‘sh bo‘lsa ?startapp bot havolasi)
  AUTH_MAX_AGE_SEC: num(env.AUTH_MAX_AGE_SEC, 24 * 3600), // initData necha soniya yaroqli

  /* FAQAT lokal sinov uchun: Telegramsiz ?dev=ism bilan kirish. Productionda 0 bo‘lsin! */
  DEV_AUTH: env.DEV_AUTH === '1',
  ALLOWED_ORIGINS: (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),

  /* Reyting — TASDIQLANMAGAN vaqtinchalik qiymatlar. Frontend bu raqamlarni ko‘rsatmaydi.
     Yakuniy tizim tasdiqlangach faqat shu obyekt o‘zgaradi. */
  rating: { final: false, win: 25, draw: 10, loss: -10, floor: 0, levelStep: 100 },

  /* Missiyalar: metric — foydalanuvchi statistikasidan hisoblanadi (db.js → metrics) */
  missions: [
    { id: 'first_game', title: 'Birinchi o‘yin', desc: 'Bitta o‘yinni oxirigacha tugat', metric: 'games', goal: 1, reward: 20 },
    { id: 'first_win', title: 'Birinchi g‘alaba', desc: 'Istalgan o‘yinda g‘alaba qozon', metric: 'wins', goal: 1, reward: 50 },
    { id: 'ten_games', title: 'Faol o‘yinchi', desc: '10 ta o‘yin o‘yna', metric: 'games', goal: 10, reward: 100 },
    { id: 'friends_3', title: 'Do‘stlar bilan', desc: 'Do‘stlaring bilan 3 ta o‘yin o‘yna', metric: 'friend_games', goal: 3, reward: 60 },
    { id: 'streak_3', title: 'Ketma-ket g‘alaba', desc: 'Ketma-ket 3 marta g‘alaba qozon', metric: 'best_streak', goal: 3, reward: 150 }
  ],
  /* Yutuqlar: metric === null bo‘lsa — sharti hali belgilanmagan (yopiq) */
  achievements: [
    { id: 'newbie', title: 'Yangi kelgan', desc: 'Birinchi o‘yinni tugat', metric: 'games', goal: 1 },
    { id: 'winner', title: 'G‘olib', desc: '10 ta g‘alabaga erish', metric: 'wins', goal: 10 },
    { id: 'mafia_master', title: 'Mafia ustasi', desc: 'Mafiyada 5 marta yut', metric: 'mafia_wins', goal: 5 },
    { id: 'team_spirit', title: 'Jamoa ruhi', desc: 'Do‘stlar bilan 10 o‘yin o‘yna', metric: 'friend_games', goal: 10 },
    { id: 'secret', title: 'Sirli yutuq', desc: 'Sharti hali ochilmagan', metric: null, goal: 0 }
  ],

  rooms: { codeLen: 6, lobbyGraceMs: 45000, idleMs: 5 * 60000 },

  /* Mafia. Sinov uchun: MAFIA_MIN_PLAYERS=3 va GH_FAST=1 */
  mafia: {
    minPlayers: num(env.MAFIA_MIN_PLAYERS, 6),
    maxPlayers: 15,
    doctorNoRepeat: true,       // doktor ketma-ket ikki tun bir odamni davolay olmaydi
    revealRoleOnDeath: true,
    times: (() => {
      const k = env.GH_FAST === '1' ? 0.05 : 1;
      return { reveal: 12000 * k, night: 45000 * k, day: 90000 * k, vote: 45000 * k, early: env.GH_FAST === '1' ? 50 : 2500 };
    })()
  }
};
