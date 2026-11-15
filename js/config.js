/* GAME HUB — ulanish sozlamalari. Frontend alohida hostingda bo‘lsa, WS_URL ni o‘zgartiring.
   WS_URL = ''  → sahifa qaysi serverdan ochilgan bo‘lsa, o‘sha serverdagi /ws ga ulanadi (README: 1-variant).
   WS_URL = 'wss://sening-serving.onrender.com/ws' → alohida backend. */
window.GH_CONFIG = {
  WS_URL: '',
  VERSION: '0.7'
};
