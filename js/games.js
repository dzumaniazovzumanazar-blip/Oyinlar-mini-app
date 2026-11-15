/* GAME HUB — sozlanadigan ma'lumotlar. Yangi o‘yin / banner / kategoriya / fon shu yerga qo‘shiladi.
   Yangi o‘yin qo‘shish: 1) GAMES ga yozuv, 2) ART ga rasm (ixtiyoriy), 3) server/games/<id>.js, 4) js/room.js da GameUI.register(<id>, …) */
const CATS = ['Strategiya', 'Sirli o‘yinlar', 'Omon qolish', 'Jamoaviy', 'Mantiqiy'];

const GAMES = [
  { id: 'mafia', name: 'Mafia', cats: ['Jamoaviy', 'Sirli o‘yinlar'], desc: 'Shahar uxlaydi, mafia uyg‘onadi. Kim yolg‘on aytyapti?', min: 6, max: 15, time: '15–30 daqiqa', status: 'ready', pop: 1, isNew: 0, art: ['#5b2bd9', '#e0407a'],
    about: 'Mafia — yashirin rollarga asoslangan jamoaviy o‘yin. Tinch aholi mafiyani topishi, mafia esa sezdirmay aholidan ko‘payib olishi kerak. Rollar serverda maxfiy taqsimlanadi: har kim faqat o‘z rolini ko‘radi.',
    how: ['Xona yarating va 6 belgili kodni do‘stlaringizga yuboring.', 'Hamma tayyor bo‘lgach, xona egasi o‘yinni boshlaydi. Har kim maxfiy rol oladi: Tinch aholi, Mafia, Doktor yoki Komissar.', 'Tun: mafia bir kishini tanlaydi, doktor birovni davolaydi, komissar birovni tekshiradi.', 'Kun: tun natijasi e’lon qilinadi, hamma birga muhokama qiladi.', 'Ovoz berish: eng ko‘p ovoz olgan o‘yinchi o‘yindan chiqadi. G‘olib aniqlanmaguncha tun va kun almashib turadi.'],
    rules: ['Mafia soni qolgan o‘yinchilarga teng bo‘lsa, mafia yutadi.', 'Barcha mafia chiqarilsa, tinch aholi yutadi.', 'O‘yindan chiqqan o‘yinchi gaplashmaydi va ovoz bermaydi.', 'Rolingni boshqalarga ko‘rsatish yoki skrinshot yuborish mumkin emas.', 'O‘yin o‘rtasida chiqib ketsang, mag‘lubiyat hisoblanadi.'],
    tips: ['Birinchi kunda faol gapir: jim o‘tirish shubha uyg‘otadi.', 'Kimning gapi o‘zgarganini kuzat.', 'Komissar bo‘lsang, rolingni erta ochma.', 'Mafia bo‘lsang, sherigingni himoya qilmay, shubhani boshqaga yo‘nalt.'] },
  { id: 'space', name: 'Space Traitor', cats: ['Jamoaviy', 'Sirli o‘yinlar'], desc: 'Kosmik kemada yashirin xoinni toping.', min: 5, max: 10, time: '10–20 daqiqa', status: 'soon', pop: 1, isNew: 1, art: ['#2b3dd9', '#8b3dff'],
    about: 'Ekipaj vazifalarni bajaradi, xoin esa buzg‘unchilik qiladi. Muhokama orqali xoinni aniqlang.' },
  { id: 'kingdom', name: 'Kingdom', cats: ['Strategiya'], desc: 'Qirollik, resurslar va qiyin qarorlar.', min: 3, max: 8, time: '20–40 daqiqa', status: 'soon', pop: 0, isNew: 1, art: ['#b8741a', '#e0b040'],
    about: 'Resurslarni boshqaring, ittifoq tuzing va qirolligingizni eng kuchli qiling.' },
  { id: 'detective', name: 'Detective', cats: ['Sirli o‘yinlar', 'Mantiqiy'], desc: 'Dalillarni yig‘ib jinoyatni oching.', min: 2, max: 6, time: '15–25 daqiqa', status: 'soon', pop: 1, isNew: 1, art: ['#0f6e8c', '#3ad0c4'],
    about: 'Dalillarni solishtiring, guvohlarni tinglang va jinoyatchini toping.' },
  { id: 'island', name: 'Survival Island', cats: ['Omon qolish', 'Jamoaviy'], desc: 'Orolda resurs yig‘ib omon qol.', min: 2, max: 8, time: '20–35 daqiqa', status: 'soon', pop: 0, isNew: 0, art: ['#0b7a5a', '#7bd34a'],
    about: 'Resurs yig‘ing, boshpana quring va tunlarni omon o‘tkazing.' }
];

/* Katta artwork (SVG sahna). Gradientlar index.html ichidagi <defs> da (id: sk-<o‘yin>). */
const ART = {
  mafia: '<rect width="400" height="260" fill="url(#sk-mafia)"/><circle cx="292" cy="70" r="74" fill="#ffd9ec" opacity=".14"/><circle cx="292" cy="70" r="40" fill="#fff1f8" opacity=".94"/><circle cx="278" cy="60" r="7" fill="#e9c3d8" opacity=".6"/><circle cx="305" cy="84" r="5" fill="#e9c3d8" opacity=".5"/>' +
    '<g fill="#1b0f33" opacity=".92"><rect x="0" y="150" width="46" height="110"/><rect x="40" y="120" width="38" height="140"/><rect x="72" y="162" width="52" height="98"/><rect x="118" y="132" width="34" height="128"/><rect x="250" y="146" width="44" height="114"/><rect x="288" y="112" width="40" height="148"/><rect x="322" y="158" width="48" height="102"/><rect x="364" y="138" width="40" height="122"/></g>' +
    '<g fill="#ffd27a" opacity=".85"><rect x="48" y="132" width="5" height="7"/><rect x="60" y="148" width="5" height="7"/><rect x="124" y="146" width="5" height="7"/><rect x="296" y="126" width="5" height="7"/><rect x="306" y="150" width="5" height="7"/><rect x="332" y="174" width="5" height="7"/><rect x="12" y="170" width="5" height="7"/></g>' +
    '<ellipse cx="190" cy="186" rx="104" ry="17" fill="#0e0820"/><path d="M118 184c2-44 20-76 72-76s70 32 72 76z" fill="#150a2b"/><path d="M122 168c40 12 98 12 136 0v14c-40 12-96 12-136 0z" fill="#e0407a"/><path d="M130 124c14-10 28-14 44-15" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<rect y="206" width="400" height="54" fill="#2a1450" opacity=".55"/><rect y="230" width="400" height="30" fill="#0e0820" opacity=".6"/>',
  space: '<rect width="400" height="260" fill="url(#sk-space)"/><g fill="#fff"><circle cx="40" cy="36" r="1.6" opacity=".9"/><circle cx="96" cy="84" r="1.2" opacity=".7"/><circle cx="168" cy="30" r="1.8" opacity=".85"/><circle cx="238" cy="62" r="1.2" opacity=".6"/><circle cx="352" cy="38" r="1.7" opacity=".9"/><circle cx="378" cy="120" r="1.2" opacity=".6"/><circle cx="24" cy="150" r="1.3" opacity=".6"/><circle cx="130" cy="150" r="1" opacity=".5"/></g>' +
    '<circle cx="296" cy="96" r="62" fill="#9a6bff"/><circle cx="296" cy="96" r="62" fill="url(#sh-ball)"/><ellipse cx="296" cy="100" rx="104" ry="20" fill="none" stroke="#dcd0ff" stroke-opacity=".75" stroke-width="5" transform="rotate(-18 296 100)"/>' +
    '<path d="M-10 262c30-72 110-112 214-112 46 0 84 8 118 24v88z" fill="#10163e"/><path d="M-10 262c30-72 110-112 214-112" fill="none" stroke="#7aa2ff" stroke-opacity=".55" stroke-width="2"/>' +
    '<circle cx="132" cy="196" r="30" fill="#0a0f2c" stroke="#7aa2ff" stroke-opacity=".8" stroke-width="4"/><path d="M110 200c4-18 16-26 22-26s18 8 22 26c-6 10-14 14-22 14s-16-4-22-14z" fill="#e9eeff" opacity=".92"/><rect x="118" y="194" width="28" height="11" rx="5.5" fill="#1a2250"/><circle cx="139" cy="199" r="2.6" fill="#ff4d6d"/>' +
    '<rect x="210" y="188" width="120" height="8" rx="4" fill="#7aa2ff" opacity=".25"/><rect x="226" y="204" width="84" height="8" rx="4" fill="#7aa2ff" opacity=".18"/>',
  kingdom: '<rect width="400" height="260" fill="url(#sk-kingdom)"/><circle cx="96" cy="86" r="58" fill="#fff0b8" opacity=".3"/><circle cx="96" cy="86" r="34" fill="#fff6d6"/>' +
    '<path d="M-10 214c70-34 150-42 220-20 70 22 140 12 200-14v90H-10z" fill="#5a2f0a" opacity=".75"/>' +
    '<g fill="#2a1304"><rect x="150" y="128" width="100" height="92"/><rect x="132" y="102" width="34" height="118"/><rect x="234" y="102" width="34" height="118"/><path d="M128 104l21-30 21 30z"/><path d="M230 104l21-30 21 30z"/><rect x="186" y="96" width="28" height="32"/><path d="M182 98l18-28 18 28z"/><path d="M178 220v-34a22 22 0 0 1 44 0v34z" fill="#ffb23d" opacity=".9"/></g>' +
    '<path d="M200 70V50m0 0l18 5-18 7z" stroke="#ffd480" stroke-width="2.4" fill="#ff5a4f"/><path d="M280 60l10 18 14-12 14 12 10-18v26h-48z" fill="#ffd36b"/><rect x="280" y="86" width="48" height="6" rx="3" fill="#e0a02a"/><circle cx="293" cy="72" r="3" fill="#ff5a4f"/><circle cx="304" cy="68" r="3" fill="#5ab0ff"/><circle cx="315" cy="72" r="3" fill="#ff5a4f"/>' +
    '<g fill="#fff" opacity=".6"><circle cx="352" cy="40" r="1.4"/><circle cx="30" cy="30" r="1.2"/><circle cx="240" cy="30" r="1.3"/></g>',
  detective: '<rect width="400" height="260" fill="url(#sk-detective)"/><g opacity=".5"><rect x="0" y="150" width="400" height="22" fill="#c8fff6" opacity=".16"/><rect x="0" y="186" width="400" height="26" fill="#c8fff6" opacity=".12"/></g>' +
    '<g fill="#07323d"><rect x="14" y="94" width="58" height="170"/><rect x="304" y="70" width="64" height="194"/><rect x="368" y="110" width="40" height="154"/></g><g fill="#ffe08a" opacity=".85"><rect x="24" y="108" width="8" height="10"/><rect x="44" y="132" width="8" height="10"/><rect x="316" y="88" width="8" height="10"/><rect x="340" y="120" width="8" height="10"/></g>' +
    '<rect x="228" y="108" width="6" height="110" fill="#06242c"/><circle cx="231" cy="104" r="18" fill="#ffe9a8" opacity=".25"/><circle cx="231" cy="104" r="8" fill="#fff6d0"/>' +
    '<circle cx="168" cy="118" r="62" fill="#baf5ee" opacity=".13"/><circle cx="168" cy="118" r="62" fill="none" stroke="#e4fffb" stroke-width="10"/><circle cx="168" cy="118" r="62" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2" transform="scale(.9) translate(18 13)"/><path d="M212 162l60 62" stroke="#e4fffb" stroke-width="16" stroke-linecap="round"/><path d="M214 164l56 58" stroke="#0a4a58" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M138 98c10-14 28-18 42-12" stroke="#fff" stroke-opacity=".8" stroke-width="5" fill="none" stroke-linecap="round"/><g fill="#06242c" opacity=".7"><ellipse cx="60" cy="226" rx="6" ry="9" transform="rotate(-14 60 226)"/><ellipse cx="86" cy="214" rx="6" ry="9" transform="rotate(-14 86 214)"/><ellipse cx="108" cy="232" rx="6" ry="9" transform="rotate(-14 108 232)"/></g>',
  island: '<rect width="400" height="260" fill="url(#sk-island)"/><circle cx="318" cy="64" r="44" fill="#fff4b0" opacity=".5"/><circle cx="318" cy="64" r="26" fill="#fff9d4"/>' +
    '<path d="M0 178c40-12 80 8 120-2s80-14 130-2 100 8 150-6v92H0z" fill="#0d7aa0" opacity=".7"/><path d="M0 204c50-14 90 8 140-2s100-12 140 0 80 6 120-4v62H0z" fill="#075c80" opacity=".85"/>' +
    '<path d="M96 206c10-42 52-66 104-66s96 24 108 66z" fill="#e7c883"/><path d="M96 206c10-42 52-66 104-66 20 0 36 4 50 10-24 6-46 22-60 56z" fill="#f4dc9e" opacity=".8"/><path d="M168 150c-4-30-2-56 8-86" stroke="#6b4a1f" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M232 154c6-28 14-46 30-64" stroke="#6b4a1f" stroke-width="6" fill="none" stroke-linecap="round"/>' +
    '<g fill="#2fb86a"><path d="M176 66c-26-4-44 4-56 20 22-8 38-10 56-6z"/><path d="M176 66c22-12 42-10 58 4-22-2-38 0-58 6z"/><path d="M176 66c-8-20-4-34 8-44 2 16 0 32-8 44z"/><path d="M262 90c-20-2-34 6-42 18 16-6 30-8 42-4z"/><path d="M262 90c16-10 32-8 44 2-16 0-28 2-44 6z"/></g><g fill="#7be38e" opacity=".6"><path d="M176 66c22-12 42-10 58 4-22-2-38 0-58 6z"/></g>' +
    '<path d="M0 224c40-8 80 4 120-4s90-8 130 2 100 6 150-4v42H0z" fill="#fff" opacity=".12"/>'
};
const artSvg = id => (ART[id] ? `<svg class="scene" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${ART[id]}</svg>` : '');

const BANNERS = [
  { game: 'mafia', tag: 'HAFTANING O‘YINI', text: 'Shahar uxlaydi, mafia uyg‘onadi. Rollarni ol va haqiqatni top.', btn: 'Batafsil ko‘rish' },
  { game: 'space', tag: 'TEZ ORADA', text: 'Kosmik kemada xoin bor. Uni birinchi bo‘lib topasanmi?', btn: 'Batafsil' },
  { game: 'detective', tag: 'TEZ ORADA', text: 'Dalillar gapiradi. Sen eshita olasanmi?', btn: 'Batafsil' }
];

const BGS = [{ id: 'aurora', name: 'Aurora' }, { id: 'okean', name: 'Okean' }, { id: 'shafaq', name: 'Shafaq' }, { id: 'zumrad', name: 'Zumrad' }, { id: 'binafsha', name: 'Binafsha' }];

/* Server bilan ulanmagan holatda ko‘rsatiladigan missiya/yutuq nomlari (haqiqiy ro‘yxat va mukofotlar serverdan keladi) */
const MISSIONS_OFFLINE = [['Birinchi o‘yin', 'Bitta o‘yinni oxirigacha tugat', 1], ['Birinchi g‘alaba', 'Istalgan o‘yinda g‘alaba qozon', 1], ['Faol o‘yinchi', '10 ta o‘yin o‘yna', 10], ['Do‘stlar bilan', 'Do‘stlaring bilan 3 ta o‘yin o‘yna', 3], ['Ketma-ket g‘alaba', 'Ketma-ket 3 marta g‘alaba qozon', 3]];
const ACHS_OFFLINE = [['Yangi kelgan', 'Birinchi o‘yinni tugat'], ['G‘olib', '10 ta g‘alabaga erish'], ['Mafia ustasi', 'Mafiyada 5 marta yut'], ['Jamoa ruhi', 'Do‘st bilan 10 o‘yin o‘yna'], ['Sirli yutuq', 'Sharti hali ochilmagan']];

/* Mafia rollari (faqat ko‘rsatish uchun; rollarni SERVER belgilaydi) */
const ROLE_UI = {
  civilian: { name: 'Tinch aholi', hue: '#4fa3ff', brief: 'Kunduzi muhokama qil va mafiyani topib ovoz ber.' },
  mafia: { name: 'Mafia', hue: '#ff4d7d', brief: 'Tunda bir kishini tanla. Sezdirmasdan aholidan ko‘payib ol.' },
  doctor: { name: 'Doktor', hue: '#3ad0a0', brief: 'Tunda bir kishini davola. Ketma-ket ikki tun bir odamni emas.' },
  commissar: { name: 'Komissar', hue: '#ffc247', brief: 'Tunda bir kishini tekshir: mafiyami yoki yo‘q.' }
};
