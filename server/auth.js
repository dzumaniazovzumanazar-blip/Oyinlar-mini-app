'use strict';
/* Telegram Mini App initData tekshiruvi (HMAC-SHA256).
   https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app */
const crypto = require('crypto');

function verifyInitData(initData, botToken, maxAgeSec) {
  if (!botToken) return { ok: false, err: 'BOT_TOKEN serverda sozlanmagan' };
  if (typeof initData !== 'string' || !initData || initData.length > 4096) return { ok: false, err: 'initData yo‘q' };
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, err: 'hash yo‘q' };
  params.delete('hash');
  const dcs = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => k + '=' + v).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calc = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  const a = Buffer.from(calc, 'hex'), b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, err: 'imzo noto‘g‘ri' };
  const age = Math.floor(Date.now() / 1000) - (+params.get('auth_date') || 0);
  if (!(age >= -60 && age <= maxAgeSec)) return { ok: false, err: 'initData eskirgan' };
  let user; try { user = JSON.parse(params.get('user') || ''); } catch (e) { return { ok: false, err: 'user yo‘q' }; }
  if (!user || !Number.isSafeInteger(user.id)) return { ok: false, err: 'user noto‘g‘ri' };
  return { ok: true, user, startParam: params.get('start_param') || '' };
}
module.exports = { verifyInitData };
