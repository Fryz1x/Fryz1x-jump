/* INK JUMP — чёрно-белый «дудл-джамп» для Telegram Mini Apps.
   Чистый JS + Canvas, без зависимостей. Все настройки баланса — в блоке CONFIG. */
(() => {
'use strict';

// ======================= CONFIG =======================
const W = 360;                 // логическая ширина мира (высота подстраивается под экран)
const GRAV = 0.36;             // чем меньше, тем медленнее падение (раньше было 0.45)
const MAX_FALL = 11;           // предельная скорость падения
const vFor = (hgt) => Math.sqrt(2 * GRAV * hgt);   // стартовая скорость для прыжка высотой hgt px
const JUMP = vFor(144);        // обычный прыжок (~144 px)
const JUMP_BOOTS = vFor(250);  // прыжок в ботинках (~250 px)
const JUMP_SPRING = vFor(420); // пружина (~420 px)
const STOMP_BOUNCE = vFor(125);// отскок от врага
const ROCKET_SPEED = 16.5;
const ROCKET_FRAMES = 110;     // ~1.8 c полёта
const BUFF_FRAMES = 600;       // 10 секунд при 60 шагах/с (ботинки и щит)
const MAX_DIFF_HEIGHT = 9000;  // на какой высоте (px) сложность достигает максимума (~900 очков)
const STAGE_SCORE = 300;       // каждые N очков меняется окружение

// ======================= TELEGRAM =======================
const tg = window.Telegram && window.Telegram.WebApp;
const tgOk = (v) => { try { return !!tg && tg.isVersionAtLeast(v); } catch (e) { return false; } };
if (tg) {
  try { tg.ready(); tg.expand(); } catch (e) {}
  if (tgOk('7.7')) { try { tg.disableVerticalSwipes(); } catch (e) {} }
  try { tg.setHeaderColor('#ffffff'); tg.setBackgroundColor('#ffffff'); } catch (e) {}
}
function haptic(kind) {
  if (!tgOk('6.1')) return;
  try {
    const h = tg.HapticFeedback;
    if (kind === 'error') h.notificationOccurred('error');
    else h.impactOccurred(kind || 'light');
  } catch (e) {}
}

// ======================= I18N =======================
const TEXT = {
  ru: { play: 'ИГРАТЬ', best: 'Рекорд', coins: 'Монеты', again: 'ЕЩЁ РАЗ', menu: 'МЕНЮ', resume: 'ДАЛЬШЕ',
        pauseT: 'ПАУЗА', over: 'КОНЕЦ', newRec: 'НОВЫЙ РЕКОРД!', runCoins: 'Монет за забег',
        hintTouch: 'Води пальцем влево-вправо', hintPc: 'Управление: A / D или ← →',
        sndOn: 'Звук: вкл', sndOff: 'Звук: выкл', combo: 'КОМБО',
        shopBtn: 'МАГАЗИН', shopT: 'СКИНЫ', back: 'НАЗАД', equip: 'ВЫБРАТЬ', equipped: 'НАДЕТО',
        notEnough: 'Не хватает монет: ', heightBonus: 'за высоту', full: 'НА ВЕСЬ ЭКРАН',
        ctlTitle: 'УПРАВЛЕНИЕ', ctlMove: 'движение', ctlMouse: 'или тяни мышью', ctlPause: 'пауза',
        ctlFull: 'полный экран', ctlStart: 'старт',
        buffTitle: 'УСИЛЕНИЯ', tipSpring: 'Пружина: мощный прыжок', tipBoots: 'Ботинки: прыжки выше, 10 с',
        tipShield: 'Щит: бессмертие 10 с (кроме пропасти)', tipRocket: 'Ракета: полёт высоко вверх',
        tipStomp: 'Врагов давят прыжком сверху. Комбо даёт больше очков', tipCoin: 'Монеты тратятся на скины',
        cloudOn: '☁ Прогресс сохранён в облаке Telegram' },
  en: { play: 'PLAY', best: 'Best', coins: 'Coins', again: 'AGAIN', menu: 'MENU', resume: 'RESUME',
        pauseT: 'PAUSED', over: 'GAME OVER', newRec: 'NEW RECORD!', runCoins: 'Coins this run',
        hintTouch: 'Drag your finger left and right', hintPc: 'Controls: A / D or ← →',
        sndOn: 'Sound: on', sndOff: 'Sound: off', combo: 'COMBO',
        shopBtn: 'SHOP', shopT: 'SKINS', back: 'BACK', equip: 'EQUIP', equipped: 'EQUIPPED',
        notEnough: 'Not enough coins: ', heightBonus: 'height bonus', full: 'FULLSCREEN',
        ctlTitle: 'CONTROLS', ctlMove: 'move', ctlMouse: 'or drag with the mouse', ctlPause: 'pause',
        ctlFull: 'fullscreen', ctlStart: 'start',
        buffTitle: 'POWER-UPS', tipSpring: 'Spring: big jump', tipBoots: 'Boots: higher jumps, 10 s',
        tipShield: 'Shield: invincible for 10 s (not vs. pits)', tipRocket: 'Rocket: fly way up',
        tipStomp: 'Stomp enemies from above. Combos give more points', tipCoin: 'Coins are spent on skins',
        cloudOn: '☁ Progress saved to Telegram cloud' }
};
let langCode = 'en';
try {
  const raw = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) ||
              navigator.language || 'en';
  const l = String(raw).slice(0, 2).toLowerCase();
  langCode = (l === 'ru' || l === 'uk' || l === 'be') ? 'ru' : 'en';
} catch (e) {}
const t = (k) => TEXT[langCode][k];

// ---- скины и цены ----
// Замер: на карте ~7 монет на каждые 100 очков высоты (дальше больше), игрок берёт примерно половину,
// плюс бонус 1 монета за каждые 50 очков. Забег на ~300 очков даёт ≈15 монет, короткий (50–150) — 4–8.
// Первый скин — за 3–5 забегов, «Череп» — за ~40 средних, «Katana» (1000) — главная цель. Только внутриигровая валюта.
const SKINS = [
  { id: 'classic', price: 0,    name: { ru: 'Классик',    en: 'Classic' } },
  { id: 'cat',     price: 40,   name: { ru: 'Кот',        en: 'Cat' } },
  { id: 'robot',   price: 80,   name: { ru: 'Робот',      en: 'Robot' } },
  { id: 'ninja',   price: 120,  name: { ru: 'Ниндзя',     en: 'Ninja' } },
  { id: 'astro',   price: 180,  name: { ru: 'Космонавт',  en: 'Astronaut' } },
  { id: 'ghost',   price: 250,  name: { ru: 'Призрак',    en: 'Ghost' } },
  { id: 'king',    price: 350,  name: { ru: 'Король',     en: 'King' } },
  { id: 'skull',   price: 600,  name: { ru: 'Череп',      en: 'Skull' } },
  { id: 'katana',  price: 1000, name: { ru: 'Katana',     en: 'Katana' } }
];
const SKIN_IDS = SKINS.map((k) => k.id);
const priceOf = (id) => { const k = SKINS.find((q) => q.id === id); return k ? k.price : 0; };

// ======================= SAVE (localStorage + облако Telegram) =======================
// Прогресс хранится в двух местах: localStorage (мгновенно, работает офлайн) и CloudStorage Telegram
// (привязано к аккаунту, переживает очистку кэша и переезд на другой телефон).
//
// Правила слияния (как у «счётчиков, которые только растут» — ничего не теряется):
//   • рекорд — максимум;
//   • заработанные монеты — у КАЖДОГО устройства свой счётчик, итог = сумма счётчиков;
//   • купленные скины — объединение;
//   • надетый скин и звук — как в более свежем сохранении.
// Баланс = заработано − цена купленных скинов.
// Перед каждой записью в облако игра сначала читает облако и объединяет (одно устройство не затирает другое).
// Всё, что приходит из хранилищ, считается недоверенным и проходит через cleanSave().
const SAVE_KEY = 'ij_save';      // ключ CloudStorage: только A-Z a-z 0-9 _ - ; значение до 4096 символов
const SAVE_MAX = 4096;
const ID_RE = /^[a-z0-9]{1,12}$/;
const cloud = (tg && tgOk('6.9') && tg.CloudStorage) ? tg.CloudStorage : null;

// случайный id этого устройства/установки (хранится локально)
const DEV = (() => {
  try {
    let d = localStorage.getItem('ij_dev');
    if (d && ID_RE.test(d)) return d;
    d = Math.random().toString(36).slice(2, 10) || 'x1';
    localStorage.setItem('ij_dev', d);
    return d;
  } catch (e) {}
  return Math.random().toString(36).slice(2, 10) || 'x2';
})();

function safeParse(str) {
  try { return (typeof str === 'string' && str.length > 0 && str.length <= SAVE_MAX) ? JSON.parse(str) : null; }
  catch (e) { return null; }
}
const num = (v, max) => (typeof v === 'number' && isFinite(v) && v > 0) ? Math.min(Math.floor(v), max) : 0;
function cleanSave(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const ids = [];
  if (Array.isArray(o.o)) {
    for (const id of o.o) if (typeof id === 'string' && SKIN_IDS.indexOf(id) >= 0 && ids.indexOf(id) < 0) ids.push(id);
  }
  if (ids.indexOf('classic') < 0) ids.unshift('classic');
  const e = Object.create(null);
  if (o.e && typeof o.e === 'object' && !Array.isArray(o.e)) {
    let n = 0;
    for (const k of Object.keys(o.e)) {
      if (n >= 60) break;
      if (!ID_RE.test(k)) continue;
      const v = num(o.e[k], 1e9);
      if (v > 0) { e[k] = v; n++; }
    }
  }
  return {
    b: num(o.b, 1e7),                       // рекорд
    e,                                      // заработано монет: { id устройства: счётчик }
    o: ids,                                 // купленные скины
    s: (typeof o.s === 'string' && ids.indexOf(o.s) >= 0) ? o.s : 'classic',   // надетый скин
    m: o.m === 0 ? 0 : 1,                   // звук
    t: num(o.t, 1e15)                       // время последнего сохранения
  };
}
function mergeSaves(a, c) {
  if (!a) return c;
  if (!c) return a;
  const o = a.o.slice();
  for (const id of c.o) if (o.indexOf(id) < 0) o.push(id);
  const e = Object.create(null);
  for (const k in a.e) e[k] = a.e[k];
  for (const k in c.e) e[k] = Math.max(e[k] || 0, c.e[k]);
  const newer = a.t >= c.t ? a : c;
  return { b: Math.max(a.b, c.b), e, o, s: o.indexOf(newer.s) >= 0 ? newer.s : 'classic', m: newer.m, t: Math.max(a.t, c.t) };
}
// сохранения старой версии игры (до облака): переносим один раз
function legacySave() {
  const g = (k) => { try { const v = localStorage.getItem(k); return v === null ? undefined : JSON.parse(v); } catch (e) { return undefined; } };
  const lb = g('ij_best'), lc = g('ij_coins'), lo = g('ij_owned'), ls = g('ij_skin'), lm = g('ij_sound');
  if (lb === undefined && lc === undefined && lo === undefined) return null;
  const sv = cleanSave({ b: lb, o: lo, s: ls, m: lm === false ? 0 : 1, t: 1 });
  const total = num(lc, 1e9) + sv.o.reduce((acc, id) => acc + priceOf(id), 0);   // заработано = баланс + потраченное
  if (total > 0) sv.e[DEV] = total;
  return sv;
}

let best = 0, ear = Object.create(null), owned = ['classic'], skin = 'classic', sound = true;
let saveT = 0, saveTs = 0, cloudOk = false, cloudBusy = false, cloudDirty = false;
const totalEarned = () => { let n = 0; for (const k in ear) n += ear[k]; return n; };
const spent = () => owned.reduce((acc, id) => acc + priceOf(id), 0);
const balance = () => Math.max(0, totalEarned() - spent());
function applySave(sv) {
  best = sv.b; ear = Object.create(null); for (const k in sv.e) ear[k] = sv.e[k];
  owned = sv.o.slice(); skin = sv.s; sound = sv.m !== 0; saveTs = sv.t;
}
function snapshot() {
  const e = {}; for (const k in ear) e[k] = ear[k];
  return { v: 1, b: best, e, o: owned.slice(), s: skin, m: sound ? 1 : 0, t: saveTs };
}

(function loadLocal() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) {}
  applySave(cleanSave(safeParse(raw)) || legacySave() || cleanSave({}));
})();

function writeLocal() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot())); } catch (e) {} }

// читаем облако → объединяем с тем, что в памяти → пишем объединённое обратно. tries — повторы при ошибке чтения.
function syncCloud(tries) {
  if (!cloud) return;
  if (cloudBusy) { cloudDirty = true; return; }
  cloudBusy = true;
  let fin = false;
  const finish = () => {
    if (fin) return; fin = true; clearTimeout(wd);
    cloudBusy = false;
    if (cloudDirty) { cloudDirty = false; syncCloud(0); }
  };
  const wd = setTimeout(finish, 8000);              // на случай, если Telegram так и не вызовет колбэк
  try {
    cloud.getItem(SAVE_KEY, (err, val) => {
      if (err) {
        cloudOk = false; finish();
        if (tries > 0) setTimeout(() => syncCloud(tries - 1), 2500);
        return;                                     // не смогли прочитать — не пишем вслепую, чтобы не затереть чужое
      }
      applySave(mergeSaves(snapshot(), cleanSave(safeParse(val))));
      writeLocal();
      refreshMenu();
      if (state === 'shop') renderShop();
      try {
        cloud.setItem(SAVE_KEY, JSON.stringify(snapshot()), (err2, ok) => {
          const was = cloudOk;
          cloudOk = !err2 && !!ok;
          if (cloudOk !== was) refreshMenu();
          finish();
        });
      } catch (e) { finish(); }
    });
  } catch (e) { finish(); }
}
function saveNow() {
  clearTimeout(saveT); saveT = 0;
  saveTs = Date.now();
  writeLocal();
  syncCloud(0);
}
// now=true — сразу (покупка, конец забега); иначе с небольшой задержкой, чтобы не частить
function save(now) { if (now) saveNow(); else if (!saveT) saveT = setTimeout(saveNow, 500); }

// ======================= DOM =======================
const $ = (s) => document.querySelector(s);
const wrap = $('#wrap'), stage = $('#stage'), cv = $('#cv');
let ctx = cv.getContext('2d');
const elMenu = $('#menu'), elOver = $('#over'), elPause = $('#pause'), elShop = $('#shop'), btnPause = $('#btnPause');
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
let coarse = false;
try { coarse = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches); } catch (e) {}
$('#hint').textContent = coarse ? t('hintTouch') : t('hintPc');
if (!coarse) show($('#btnFull'));
function refreshMenu() {
  $('#menuBest').textContent = best;
  $('#menuCoins').textContent = balance();
  $('#btnSound').textContent = sound ? t('sndOn') : t('sndOff');
  $('#cloudNote').textContent = cloudOk ? t('cloudOn') : '';
}

// ======================= RESIZE =======================
let H = 640, scale = 1, dpr = 1;
function resize() {
  const vw = Math.max(1, window.innerWidth), vh = Math.max(1, window.innerHeight);
  H = Math.max(560, Math.min(800, Math.round(W * vh / vw)));
  scale = Math.min(vw / W, vh / H);
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const pw = Math.floor(W * scale), ph = Math.floor(H * scale);
  stage.style.width = pw + 'px';
  stage.style.height = ph + 'px';
  stage.style.fontSize = (16 * scale) + 'px';
  // внутреннее разрешение ограничено, чтобы на 4K-мониторах игра не тормозила
  const rs = Math.min(scale * dpr, 3);
  cv.width = Math.floor(W * rs);
  cv.height = Math.floor(H * rs);
  // на широком мониторе по бокам показываем подсказки по управлению и усилениям
  if (!coarse && (vw - pw) / 2 >= 260) wrap.classList.add('wide'); else wrap.classList.remove('wide');
}
window.addEventListener('resize', resize);
if (tg) { try { tg.onEvent('viewportChanged', resize); } catch (e) {} }

// ======================= AUDIO =======================
let ac = null;
function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
  if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
  return ac;
}
function tone(f1, f2, dur, type, vol, delay) {
  if (!sound) return;
  const a = audio(); if (!a) return;
  try {
    const t0 = a.currentTime + (delay || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f1, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
    g.gain.setValueAtTime(vol || 0.05, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + 0.03);
  } catch (e) {}
}
const sfx = {
  jump:   () => tone(380, 620, 0.12, 'square', 0.04),
  spring: () => tone(300, 950, 0.22, 'square', 0.06),
  coin:   () => { tone(880, 880, 0.07, 'square', 0.04); tone(1320, 1320, 0.1, 'square', 0.04, 0.07); },
  stomp:  () => tone(320, 80, 0.16, 'sawtooth', 0.07),
  power:  () => { tone(500, 500, 0.08, 'square', 0.05); tone(750, 750, 0.08, 'square', 0.05, 0.08); tone(1000, 1000, 0.12, 'square', 0.05, 0.16); },
  rocket: () => tone(120, 420, 0.6, 'sawtooth', 0.06),
  crack:  () => tone(220, 60, 0.12, 'square', 0.05),
  die:    () => tone(420, 55, 0.6, 'sawtooth', 0.07)
};

// ======================= STATE =======================
let state = 'menu';   // menu | play | pause | dying | over
let G = null;
let drag = null;
const keys = { l: 0, r: 0 };
let BG = '#fff', INK = '#000';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const diff = (h) => Math.min(1, Math.max(0, h) / MAX_DIFF_HEIGHT);
const curScore = () => Math.floor(G.maxH / 10) + G.bonus;
const hs = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

function newGame() {
  G = {
    plats: [], items: [], enemies: [], parts: [], floats: [],
    genY: 0, camY: -(H - 150), maxH: 0, bonus: 0, runCoins: 0, combo: 0, paid: 0, bestStart: best,
    rowsSincePU: 99, prevSpecial: false, lastX: W / 2,
    stage: 0, prev: 0, fade: 1, bg: 255, shake: 0, t: 0, dieT: 0, tx: W / 2,
    p: { x: W / 2, y: -34, vx: 0, vy: -JUMP, face: 1, w: 30, h: 34, prevY: -34, boots: 0, shield: 0, rocket: 0, safe: 0 }
  };
  G.plats.push({ x: W / 2 - 60, y: 0, w: 120, h: 10, type: 'normal' });
  while (G.genY > G.camY - 300) genRow();
}

// ======================= GENERATION =======================
function genRow() {
  const h = -G.genY, d = diff(h);
  // расстояние между рядами: ~70–90 px внизу, до 118 на максимуме (прыжок = 144, запас остаётся всегда)
  const gap = 70 + d * 28 + Math.random() * 20;
  G.genY -= gap;
  const y = G.genY;
  const calm = G.prevSpecial;                        // после «особой» платформы — обычная
  const prevX = G.lastX;                             // x «надёжной» платформы предыдущего ряда
  const reach = 120 + 50 * d;                        // макс. сдвиг по горизонтали между соседними рядами
  const w = Math.round(66 - d * 20);
  const x = clamp(prevX + (Math.random() * 2 - 1) * reach, 8, W - w - 8);
  const pl = { x, y, w, h: 10, type: 'normal' };
  G.lastX = x;

  if (!calm) {
    const r = Math.random();
    const pg = h > 1500 ? 0.03 + 0.07 * d : 0;       // невидимые
    const pm = h > 400 ? 0.10 + 0.20 * d : 0;        // движущиеся
    const pb = h > 300 ? 0.10 + 0.18 * d : 0;        // одноразовые
    if (r < pg) pl.type = 'ghost';
    else if (r < pg + pm) { pl.type = 'moving'; pl.vx = (1 + d * 1.4) * (Math.random() < 0.5 ? -1 : 1); }
    else if (r < pg + pm + pb) pl.type = 'breaking';
    else if (h > 800 && Math.random() < 0.05 + 0.25 * d) {
      // платформа с шипами делается шире, шипы — с одного края, чтобы всегда было куда безопасно приземлиться
      pl.w = w + 14;
      pl.x = Math.min(pl.x, W - pl.w - 8);
      G.lastX = pl.x;
      const sw = 22;
      pl.spike = { ox: Math.random() < 0.5 ? 3 : pl.w - sw - 3, w: sw };
    }
  }
  G.prevSpecial = pl.type === 'ghost' || !!pl.spike;
  G.plats.push(pl);

  if (pl.type === 'breaking') {
    // одноразовая платформа никогда не единственный путь наверх: рядом всегда есть обычная,
    // и дальше уровень строится от неё — «точек невозврата» не бывает
    let x2 = null;
    for (let k = 0; k < 8 && x2 === null; k++) {
      const c = clamp(prevX + (Math.random() * 2 - 1) * reach, 8, W - w - 8);
      if (Math.abs(c - x) > w + 12) x2 = c;
    }
    if (x2 === null) x2 = x > W / 2 ? clamp(x - w - 24, 8, W - w - 8) : clamp(x + w + 24, 8, W - w - 8);
    G.plats.push({ x: x2, y: y + (Math.random() * 10 - 5), w, h: 10, type: 'normal' });
    G.lastX = x2;
  } else if (h > 300 && Math.random() < 0.22 * (1 - d)) {
    // редкая вторая платформа в ряду — чем выше, тем реже
    for (let k = 0; k < 6; k++) {
      const x2 = 8 + Math.random() * (W - w - 16);
      if (Math.abs(x2 - pl.x) > pl.w + 20) {
        G.plats.push({ x: x2, y: y + (Math.random() * 16 - 8), w, h: 10, type: 'normal' });
        break;
      }
    }
  }

  // усиления
  G.rowsSincePU++;
  if (pl.type === 'normal' && !pl.spike) {
    const r = Math.random();
    if (r < 0.07 * (1 - 0.5 * d)) {
      G.items.push({ t: 'spring', x: pl.x + w * 0.25 + Math.random() * w * 0.5, y: pl.y, pressed: 0 });
    } else if (G.rowsSincePU > 14 && h > 400) {
      const r2 = Math.random();
      const cx = pl.x + w / 2, iy = pl.y - 26;
      if (r2 < 0.025) { G.items.push({ t: 'rocket', x: cx, y: iy }); G.rowsSincePU = 0; }
      else if (r2 < 0.075) { G.items.push({ t: 'boots', x: cx, y: iy }); G.rowsSincePU = 0; }
      else if (r2 < 0.125) { G.items.push({ t: 'shield', x: cx, y: iy }); G.rowsSincePU = 0; }
    }
  }

  // монетки (по 1–3 в линию между платформами)
  if (Math.random() < 0.3) {
    const n = 1 + ((Math.random() * 3) | 0);
    const cx0 = 30 + Math.random() * (W - 100);
    const cy = y + gap * 0.5;
    for (let k = 0; k < n; k++) G.items.push({ t: 'coin', x: cx0 + k * 26, y: cy });
  }

  // враги
  if (h > 600 && Math.random() < 0.025 + 0.08 * d) {
    const ey = y + gap * 0.5;
    G.enemies.push({ x: 30 + Math.random() * (W - 60), y0: ey, y: ey,
      vx: (1 + d * 1.6) * (Math.random() < 0.5 ? -1 : 1), w: 36, h: 24, ph: Math.random() * 6 });
  }
}

// ======================= EFFECTS =======================
function addParts(x, y, n, sp) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random()) * sp;
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.5, life: 26 + Math.random() * 10, max: 36 });
  }
}
function addFloat(x, y, text) { G.floats.push({ x, y, text, life: 55 }); }
function updateFx() {
  for (const q of G.parts) { q.x += q.vx; q.y += q.vy; q.vy += 0.12; q.life--; }
  G.parts = G.parts.filter((q) => q.life > 0);
  for (const f of G.floats) { f.y -= 0.7; f.life--; }
  G.floats = G.floats.filter((f) => f.life > 0);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - 0.6);
}

// ======================= UPDATE =======================
function die(kind) {
  state = 'dying';
  G.dieT = 0;
  G.p.vx = 0;
  if (kind !== 'fall') G.p.vy = -8;
  G.shake = 10;
  addParts(G.p.x, G.p.y + 17, 14, 3);
  sfx.die(); haptic('error');
}

function update() {
  const p = G.p;
  G.t++;

  if (state === 'dying') {
    p.vy = Math.min(p.vy + GRAV, MAX_FALL + 3);
    p.y += p.vy;
    G.dieT++;
    updateFx();
    if (G.dieT > 45) endGame();
    return;
  }

  // ---- горизонтальное движение ----
  if (drag) {
    p.vx = clamp((G.tx - p.x) * 0.3, -8, 8);
  } else {
    const tv = (keys.r - keys.l) * 4.8;
    p.vx += (tv - p.vx) * 0.25;
    if (Math.abs(p.vx) < 0.05) p.vx = 0;
  }
  if (Math.abs(p.vx) > 0.4) p.face = p.vx > 0 ? 1 : -1;
  p.x += p.vx;
  if (p.x < 0) { p.x += W; if (drag) { drag.base += W; G.tx += W; } }
  else if (p.x > W) { p.x -= W; if (drag) { drag.base -= W; G.tx -= W; } }

  // ---- вертикальное движение ----
  p.prevY = p.y;
  if (p.rocket > 0) {
    p.vy = -ROCKET_SPEED;
    p.rocket--;
    if (p.rocket === 0) p.safe = 90;
    if (G.t % 2 === 0) addParts(p.x, p.y + p.h + 14, 1, 1.5);
  } else {
    p.vy = Math.min(p.vy + GRAV, MAX_FALL);
  }
  p.y += p.vy;
  if (p.boots > 0) p.boots--;
  if (p.shield > 0) p.shield--;
  if (p.safe > 0) p.safe--;

  const foot = p.y + p.h, prevFoot = p.prevY + p.h;
  const immune = p.shield > 0 || p.rocket > 0 || p.safe > 0;

  // ---- платформы ----
  for (const pl of G.plats) {
    if (pl.type === 'moving') {
      pl.x += pl.vx;
      if (pl.x < 0) { pl.x = 0; pl.vx *= -1; }
      else if (pl.x + pl.w > W) { pl.x = W - pl.w; pl.vx *= -1; }
    }
    if (pl.broken) pl.fall++;
  }
  if (p.vy > 0) {
    for (const pl of G.plats) {
      if (pl.broken) continue;
      if (prevFoot <= pl.y + 2 && foot >= pl.y && p.x + 10 > pl.x && p.x - 10 < pl.x + pl.w) {
        p.y = pl.y - p.h;
        p.vy = p.boots > 0 ? -JUMP_BOOTS : -JUMP;
        G.combo = 0;
        sfx.jump();
        addParts(p.x, pl.y, 3, 1.2);
        if (pl.type === 'breaking') { pl.broken = true; pl.fall = 0; sfx.crack(); addParts(pl.x + pl.w / 2, pl.y, 6, 2); }
        break;
      }
    }
  }
  const foot2 = p.y + p.h;

  // ---- шипы (смертельны, когда падаешь на них) ----
  if (!immune && p.vy >= 0) {
    for (const pl of G.plats) {
      if (!pl.spike || pl.broken) continue;
      const sx = pl.x + pl.spike.ox, top = pl.y - 10;
      if (p.x + 9 > sx && p.x - 9 < sx + pl.spike.w && foot2 > top + 3 && p.y < pl.y) { die('hit'); return; }
    }
  }

  // ---- враги ----
  for (const e of G.enemies) {
    e.x += e.vx;
    if (e.x < 20) { e.x = 20; e.vx = Math.abs(e.vx); }
    else if (e.x > W - 20) { e.x = W - 20; e.vx = -Math.abs(e.vx); }
    e.y = e.y0 + Math.sin(G.t * 0.05 + e.ph) * 10;
  }
  for (const e of G.enemies) {
    if (e.dead) continue;
    const overlap = Math.abs(p.x - e.x) < 10 + e.w / 2 - 3 &&
                    p.y + 4 < e.y + e.h / 2 && foot2 > e.y - e.h / 2;
    if (!overlap) continue;
    const stomp = p.vy > 0 && prevFoot <= e.y - e.h / 2 + 10;
    if (stomp) {
      e.dead = true;
      p.vy = -STOMP_BOUNCE;
      G.combo++;
      const pts = 10 * G.combo;
      G.bonus += pts;
      addFloat(e.x, e.y - 10, (G.combo > 1 ? t('combo') + ' x' + G.combo + '  ' : '') + '+' + pts);
      addParts(e.x, e.y, 10, 3);
      sfx.stomp(); haptic('medium');
    } else if (immune) {
      e.dead = true;
      G.bonus += 10;
      addFloat(e.x, e.y - 10, '+10');
      addParts(e.x, e.y, 10, 3);
      sfx.stomp(); haptic('light');
    } else { die('hit'); return; }
  }
  G.enemies = G.enemies.filter((e) => !e.dead);

  // ---- предметы ----
  for (const it of G.items) {
    if (it.taken) continue;
    if (it.pressed > 0) it.pressed--;
    if (it.t === 'spring') {
      if (p.vy > 0 && prevFoot <= it.y + 6 && foot2 >= it.y - 14 && Math.abs(p.x - it.x) < 18) {
        p.vy = -JUMP_SPRING; G.combo = 0; it.pressed = 12;
        sfx.spring(); haptic('medium'); addParts(it.x, it.y, 5, 2);
      }
      continue;
    }
    if (Math.abs(p.x - it.x) < (it.t === 'coin' ? 20 : 24) && Math.abs(p.y + p.h / 2 - it.y) < 26) {
      it.taken = true;
      if (it.t === 'coin') { G.runCoins++; sfx.coin(); }
      else if (it.t === 'boots') { p.boots = BUFF_FRAMES; sfx.power(); haptic('light'); }
      else if (it.t === 'shield') { p.shield = BUFF_FRAMES; sfx.power(); haptic('light'); }
      else if (it.t === 'rocket') { p.rocket = ROCKET_FRAMES; p.safe = 0; sfx.rocket(); haptic('heavy'); }
      addParts(it.x, it.y, 6, 2);
    }
  }

  // ---- камера, высота, окружение ----
  const target = p.y - H * 0.42;
  if (target < G.camY) G.camY += (target - G.camY) * 0.2;
  G.maxH = Math.max(G.maxH, -(p.y + p.h));

  const si = Math.floor(Math.floor(G.maxH / 10) / STAGE_SCORE) % 4;
  if (si !== G.stage) { G.prev = G.stage; G.stage = si; G.fade = 0; }
  G.fade = Math.min(1, G.fade + 0.02);
  const bgTarget = G.stage >= 2 ? 0 : 255;
  G.bg += clamp(bgTarget - G.bg, -7, 7);

  // ---- генерация и уборка ----
  while (G.genY > G.camY - 300) genRow();
  if (G.t % 60 === 0) {
    const lim = G.camY + H + 160;
    G.plats = G.plats.filter((pl) => pl.y < lim && !(pl.broken && pl.fall > 40));
    G.items = G.items.filter((it) => !it.taken && it.y < lim);
    G.enemies = G.enemies.filter((e) => e.y < lim);
  }
  if (G.t % 600 === 0) bankRun(false);              // раз в 10 секунд подстраховка: монеты и рекорд не потеряются
  updateFx();

  // ---- падение в пропасть ----
  if (p.y > G.camY + H + 20) die('fall');
}

function idle() {
  G.t++;
  G.camY -= 0.4;
  G.bg = 255; G.fade = 1;
}

// ======================= FLOW =======================
function startGame() {
  audio();
  newGame();
  state = 'play';
  drag = null;
  hide(elMenu); hide(elOver); hide(elPause); hide(elShop); show(btnPause);
}
// Зачисляет монеты и рекорд текущего забега. Безопасно вызывать сколько угодно раз:
// зачисляется только то, что ещё не было зачислено (G.paid).
function bankRun(now) {
  if (!G) return;
  const score = curScore();
  const total = G.runCoins + Math.floor(score / 50);      // собранные монеты + бонус 1 за каждые 50 очков
  let changed = false;
  if (total > G.paid) { ear[DEV] = (ear[DEV] || 0) + (total - G.paid); G.paid = total; changed = true; }
  if (score > best) { best = score; changed = true; }
  if (changed) save(now);
}
function goMenu() {
  if (state === 'play' || state === 'pause' || state === 'dying') bankRun(true);
  newGame();
  state = 'menu';
  drag = null;
  refreshMenu();
  hide(elOver); hide(elPause); hide(elShop); hide(btnPause); show(elMenu);
}

// ---- магазин ----
function drawPreview(canvas, id) {
  const pc = canvas.getContext('2d');
  if (!pc) return;
  const sCtx = ctx, sBG = BG, sINK = INK;
  ctx = pc; BG = '#fff'; INK = '#000';
  try {
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.fillStyle = '#fff'; pc.fillRect(0, 0, canvas.width, canvas.height);
    pc.setTransform(2.2, 0, 0, 2.2, 0, 0);
    drawPlayer({ x: 27.3, y: 13, face: 1, h: 34, vy: -1, boots: 0, shield: 0, rocket: 0, safe: 0 }, id);
  } finally { ctx = sCtx; BG = sBG; INK = sINK; }
}
function shopMsg(text) { $('#shopMsg').textContent = text || ''; }
function buySkin(s) {
  if (owned.indexOf(s.id) >= 0) return;
  const bal = balance();
  if (bal < s.price) { shopMsg(t('notEnough') + (s.price - bal)); haptic('error'); return; }
  owned.push(s.id); skin = s.id;                       // баланс пересчитается сам: заработано − цены скинов
  save(true);
  shopMsg(''); sfx.power(); haptic('medium');
  renderShop();
}
function equipSkin(s) {
  if (owned.indexOf(s.id) < 0) return;
  skin = s.id; save(true); shopMsg(''); sfx.coin();
  renderShop();
}
function renderShop() {
  $('#shopCoins').textContent = balance();
  const grid = $('#shopGrid');
  grid.innerHTML = '';
  for (const s of SKINS) {
    const has = owned.indexOf(s.id) >= 0, on = skin === s.id;
    const card = document.createElement('div');
    card.className = 'card' + (on ? ' on' : '');
    const pv = document.createElement('canvas');
    pv.width = 120; pv.height = 132;
    const nm = document.createElement('div');
    nm.className = 'nm'; nm.textContent = s.name[langCode];
    const b = document.createElement('button');
    if (on) { b.textContent = t('equipped'); b.className = 'cbtn eq'; b.disabled = true; }
    else if (has) { b.textContent = t('equip'); b.className = 'cbtn'; b.addEventListener('click', () => equipSkin(s)); }
    else {
      b.textContent = '● ' + s.price;
      b.className = 'cbtn buy' + (balance() < s.price ? ' dim' : '');
      b.addEventListener('click', () => buySkin(s));
    }
    card.appendChild(pv); card.appendChild(nm); card.appendChild(b);
    grid.appendChild(card);
    drawPreview(pv, s.id);
  }
}
function openShop() {
  state = 'shop'; drag = null;
  hide(elMenu); hide(elOver); hide(elPause); hide(btnPause); show(elShop);
  shopMsg('');
  renderShop();
}
function toggleFull() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  } catch (e) {}
}
function pauseGame() {
  if (state !== 'play') return;
  state = 'pause'; drag = null;
  bankRun(true);
  show(elPause);
}
function resumeGame() {
  if (state !== 'pause') return;
  state = 'play';
  hide(elPause);
}
function endGame() {
  state = 'over';
  drag = null;
  bankRun(true);
  const score = curScore();
  const record = score > G.bestStart;
  const heightCoins = Math.floor(score / 50);        // бонус: 1 монета за каждые 50 очков
  $('#overScore').textContent = score;
  $('#overBest').textContent = best;
  $('#overCoins').textContent = G.runCoins + (heightCoins ? ' (+' + heightCoins + ' ' + t('heightBonus') + ')' : '');
  if (record) show($('#overNew')); else hide($('#overNew'));
  hide(btnPause); show(elOver);
}

$('#btnPlay').addEventListener('click', startGame);
$('#btnAgain').addEventListener('click', startGame);
$('#btnMenu').addEventListener('click', goMenu);
$('#btnMenu2').addEventListener('click', goMenu);
$('#btnResume').addEventListener('click', resumeGame);
btnPause.addEventListener('click', pauseGame);
$('#btnSound').addEventListener('click', () => {
  sound = !sound; save(true); refreshMenu();
  if (sound) { audio(); sfx.coin(); }
});
$('#btnShop').addEventListener('click', openShop);
$('#btnShop2').addEventListener('click', openShop);
$('#btnShopBack').addEventListener('click', goMenu);
$('#btnFull').addEventListener('click', toggleFull);
// при потере фокуса отпускаем клавиши (иначе герой «залипает») и ставим паузу
const releaseKeys = () => { keys.l = 0; keys.r = 0; };
const inRun = () => state === 'play' || state === 'pause' || state === 'dying';
document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseKeys(); if (inRun()) bankRun(true); pauseGame(); } });
window.addEventListener('blur', () => { releaseKeys(); pauseGame(); });
window.addEventListener('pagehide', () => { if (inRun()) bankRun(true); });   // закрыли приложение посреди забега

// ======================= INPUT =======================
// Телефон: палец «тянет» героя (относительное перетаскивание — без рывков).
stage.addEventListener('pointerdown', (e) => {
  if (state !== 'play') return;
  if (e.target && e.target.closest && e.target.closest('button')) return;
  drag = { id: e.pointerId, sx: e.clientX, base: G.p.x };
  G.tx = G.p.x;
  try { stage.setPointerCapture(e.pointerId); } catch (err) {}
});
stage.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  G.tx = drag.base + (e.clientX - drag.sx) / scale * 1.15;
});
const endDrag = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('contextmenu', (e) => e.preventDefault());

// ПК: A / D или стрелки.
window.addEventListener('keydown', (e) => {
  const c = e.code;
  if (c === 'KeyA' || c === 'ArrowLeft') { keys.l = 1; e.preventDefault(); }
  else if (c === 'KeyD' || c === 'ArrowRight') { keys.r = 1; e.preventDefault(); }
  else if (c === 'Space' || c === 'Enter') {
    const onBtn = e.target && e.target.tagName === 'BUTTON';
    if (!onBtn && (state === 'menu' || state === 'over')) { e.preventDefault(); startGame(); }
  } else if (c === 'KeyP' || c === 'Escape') {
    if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame(); else if (state === 'shop') goMenu();
  } else if (c === 'KeyF' && !e.ctrlKey && !e.metaKey) {
    toggleFull();
  }
});
window.addEventListener('keyup', (e) => {
  const c = e.code;
  if (c === 'KeyA' || c === 'ArrowLeft') keys.l = 0;
  else if (c === 'KeyD' || c === 'ArrowRight') keys.r = 0;
});

// ======================= RENDER =======================
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function pattern(si, alpha, off) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 1;
  if (si === 0) {                       // тетрадная клетка
    const s = 36;
    ctx.globalAlpha = alpha * 0.12;
    ctx.beginPath();
    for (let x = 0; x <= W; x += s) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
    for (let j = Math.floor(off / s); j <= Math.ceil((off + H) / s); j++) { const y = j * s - off; ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  } else if (si === 1) {                // точки
    const s = 30;
    ctx.globalAlpha = alpha * 0.3;
    for (let j = Math.floor(off / s); j <= Math.ceil((off + H) / s); j++) {
      const y = j * s - off;
      for (let i = 0; i <= W / s + 1; i++) {
        ctx.beginPath(); ctx.arc(i * s + (j & 1 ? s / 2 : 0), y, 1.6, 0, 6.2832); ctx.fill();
      }
    }
  } else if (si === 2) {                // звёзды
    const s = 44;
    for (let j = Math.floor(off / s); j <= Math.ceil((off + H) / s); j++) {
      for (let i = 0; i <= W / s; i++) {
        const a = hs(i, j);
        if (a < 0.5) continue;
        ctx.globalAlpha = alpha * (0.25 + a * 0.5);
        ctx.beginPath(); ctx.arc(i * s + a * s, j * s - off + hs(j, i) * s, 0.8 + a * 1.8, 0, 6.2832); ctx.fill();
      }
    }
  } else {                              // диагональные линии
    const s = 38;
    ctx.globalAlpha = alpha * 0.14;
    ctx.beginPath();
    for (let k = Math.floor((-H + off) / s); k <= Math.ceil((W + off) / s); k++) {
      const c = k * s - off; ctx.moveTo(c, 0); ctx.lineTo(c + H, H);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawIcon(type, x, y, s) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = INK; ctx.strokeStyle = BG; ctx.lineWidth = 2;
  if (type === 'boots') {
    rr(-7, -10, 9, 14, 2); ctx.fill();
    rr(-7, 0, 17, 8, 3); ctx.fill();
  } else if (type === 'shield') {
    ctx.beginPath();
    ctx.moveTo(0, -11); ctx.lineTo(10, -7); ctx.lineTo(9, 2);
    ctx.quadraticCurveTo(7, 9, 0, 12); ctx.quadraticCurveTo(-7, 9, -9, 2); ctx.lineTo(-10, -7);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 6); ctx.stroke();
  } else if (type === 'rocket') {
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.quadraticCurveTo(7, -4, 5, 6); ctx.lineTo(-5, 6); ctx.quadraticCurveTo(-7, -4, 0, -12);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(5, 1); ctx.lineTo(10, 9); ctx.lineTo(5, 7); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-5, 1); ctx.lineTo(-10, 9); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = BG; ctx.beginPath(); ctx.arc(0, -3, 2.2, 0, 6.2832); ctx.fill();
  }
  ctx.restore();
}

function drawCoin(x, y, spin) {
  const rx = spin ? Math.max(1.8, 8 * Math.abs(Math.cos(G.t * 0.08 + x))) : 8;
  ctx.fillStyle = BG; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(x, y, rx, 8, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
  if (rx > 4) { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3); ctx.stroke(); }
}

function drawPlat(pl) {
  const { x, y, w } = pl;
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineJoin = 'round';
  if (pl.type === 'ghost') {
    const d = Math.abs((G.p.y + G.p.h) - y);
    const a = clamp(1 - (d - 70) / 110, 0, 1);
    if (a < 0.03) return;
    ctx.save();
    ctx.globalAlpha = a; ctx.setLineDash([6, 5]);
    rr(x, y, w, 10, 4); ctx.stroke();
    ctx.restore();
    return;
  }
  if (pl.type === 'breaking') {
    ctx.save();
    if (pl.broken) { ctx.globalAlpha = Math.max(0, 1 - pl.fall / 35); ctx.translate(0, pl.fall * pl.fall * 0.08); ctx.rotate(pl.fall * 0.01); }
    ctx.fillStyle = BG; rr(x, y, w, 10, 4); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(x + w * 0.45, y); ctx.lineTo(x + w * 0.52, y + 4); ctx.lineTo(x + w * 0.42, y + 7); ctx.lineTo(x + w * 0.5, y + 10);
    ctx.stroke();
    ctx.restore();
    return;
  }
  rr(x, y, w, 10, 4); ctx.fill();
  if (pl.type === 'moving') {
    ctx.strokeStyle = BG; ctx.lineWidth = 2;
    const cx = x + w / 2;
    ctx.beginPath();
    ctx.moveTo(cx - 5, y + 2); ctx.lineTo(cx - 9, y + 5); ctx.lineTo(cx - 5, y + 8);
    ctx.moveTo(cx + 5, y + 2); ctx.lineTo(cx + 9, y + 5); ctx.lineTo(cx + 5, y + 8);
    ctx.stroke();
  }
  if (pl.spike) {
    const sx = x + pl.spike.ox, n = 3, tw = pl.spike.w / n;
    ctx.fillStyle = INK;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(sx + i * tw, y); ctx.lineTo(sx + i * tw + tw / 2, y - 11); ctx.lineTo(sx + (i + 1) * tw, y);
      ctx.closePath(); ctx.fill();
    }
  }
}

function drawItem(it) {
  if (it.taken) return;
  if (it.t === 'coin') { drawCoin(it.x, it.y + Math.sin(G.t * 0.08 + it.x) * 2, true); return; }
  if (it.t === 'spring') {
    const k = it.pressed > 0 ? 0.45 : 1, hgt = 14 * k;
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(it.x - 8, it.y); ctx.lineTo(it.x + 8, it.y);
    ctx.moveTo(it.x - 7, it.y - 1);
    for (let i = 1; i <= 4; i++) ctx.lineTo(it.x + (i % 2 ? 7 : -7), it.y - (hgt * i) / 4);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(it.x - 9, it.y - hgt - 1); ctx.lineTo(it.x + 9, it.y - hgt - 1); ctx.stroke();
    return;
  }
  const by = it.y + Math.sin(G.t * 0.07 + it.x) * 3;
  ctx.fillStyle = BG; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(it.x, by, 16, 0, 6.2832); ctx.fill(); ctx.stroke();
  drawIcon(it.t, it.x, by, 0.95);
}

function drawEnemy(e) {
  const flap = Math.sin(G.t * 0.35 + e.ph) * 9;
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(e.x - 8, e.y - 2); ctx.lineTo(e.x - 24, e.y - 8 - flap); ctx.lineTo(e.x - 17, e.y + 3); ctx.lineTo(e.x - 10, e.y + 3);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(e.x + 8, e.y - 2); ctx.lineTo(e.x + 24, e.y - 8 - flap); ctx.lineTo(e.x + 17, e.y + 3); ctx.lineTo(e.x + 10, e.y + 3);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(e.x, e.y, 12, 9, 0, 0, 6.2832); ctx.fill();
  ctx.fillStyle = BG;
  ctx.beginPath(); ctx.arc(e.x - 4, e.y - 1, 2.4, 0, 6.2832); ctx.fill();
  ctx.beginPath(); ctx.arc(e.x + 4, e.y - 1, 2.4, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = BG; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(e.x - 6, e.y - 6); ctx.lineTo(e.x - 2, e.y - 4); ctx.moveTo(e.x + 6, e.y - 6); ctx.lineTo(e.x + 2, e.y - 4); ctx.stroke();
}

// ---- скины: всё рисуется кодом, только чёрный и белый ----
function dot(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }
function oval(x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, 6.2832); ctx.fill(); }
function tri(ax, ay, bx, by, cx, cy) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill(); }
function bodyShape(x, y, r) { rr(x - 13, y + 2, 26, 28, r); ctx.fillStyle = BG; ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; }
function eyes(x, y, f, r) { dot(x + f * 3 - 5, y + 13, r); dot(x + f * 3 + 5, y + 13, r); }
function beak(x, y, f) { ctx.beginPath(); ctx.moveTo(x + f * 11, y + 16); ctx.lineTo(x + f * 19, y + 19); ctx.lineTo(x + f * 11, y + 22); ctx.stroke(); }

function drawSkin(sk, x, y, f) {
  ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 3;
  switch (sk) {
    case 'cat':
      bodyShape(x, y, 10);
      tri(x - 12, y + 6, x - 9, y - 7, x - 2, y + 2);
      tri(x + 12, y + 6, x + 9, y - 7, x + 2, y + 2);
      eyes(x, y, f, 2.6);
      tri(x + f * 10, y + 16, x + f * 14, y + 16, x + f * 12, y + 19);
      ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(x + f * 10, y + 19); ctx.lineTo(x + f * 20, y + 16);
      ctx.moveTo(x + f * 10, y + 21); ctx.lineTo(x + f * 20, y + 23);
      ctx.stroke();
      break;
    case 'robot':
      rr(x - 13, y + 2, 26, 28, 4); ctx.fillStyle = BG; ctx.fill(); ctx.stroke(); ctx.fillStyle = INK;
      ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x, y - 5); ctx.stroke();
      dot(x, y - 6, 2.8);
      rr(x - 10, y + 8, 20, 10, 3); ctx.fill();
      ctx.fillStyle = BG; dot(x + f * 2 - 4, y + 13, 2); dot(x + f * 2 + 4, y + 13, 2); ctx.fillStyle = INK;
      ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 3; i++) { ctx.moveTo(x - 5 + i * 5, y + 22); ctx.lineTo(x - 5 + i * 5, y + 27); }
      ctx.stroke();
      break;
    case 'ninja': {
      rr(x - 13, y + 2, 26, 28, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = BG; rr(x - 11, y + 8, 22, 10, 4); ctx.fill();
      ctx.fillStyle = INK; dot(x + f * 3 - 5, y + 13, 2.3); dot(x + f * 3 + 5, y + 13, 2.3);
      const sw = Math.sin(G.t * 0.3) * 3;
      ctx.beginPath();
      ctx.moveTo(x - f * 12, y + 6); ctx.lineTo(x - f * 22, y + 3 + sw);
      ctx.moveTo(x - f * 12, y + 6); ctx.lineTo(x - f * 21, y + 10 - sw);
      ctx.stroke();
      break;
    }
    case 'astro':
      bodyShape(x, y, 10);
      oval(x + f * 1.5, y + 14, 10.5, 9);
      ctx.fillStyle = BG; oval(x + f * 1.5 - 4, y + 10.5, 2.8, 1.6, -0.5); ctx.fillStyle = INK;
      ctx.beginPath(); ctx.moveTo(x - 8, y + 3); ctx.lineTo(x - 10, y - 4); ctx.stroke();
      dot(x - 10, y - 5, 2.2);
      break;
    case 'ghost':
      ctx.beginPath();
      ctx.moveTo(x - 13, y + 33); ctx.lineTo(x - 13, y + 15);
      ctx.arc(x, y + 15, 13, Math.PI, 0);
      ctx.lineTo(x + 13, y + 33); ctx.lineTo(x + 6.5, y + 28); ctx.lineTo(x, y + 33); ctx.lineTo(x - 6.5, y + 28);
      ctx.closePath();
      ctx.fillStyle = BG; ctx.fill(); ctx.stroke(); ctx.fillStyle = INK;
      oval(x + f * 2 - 4, y + 15, 2.3, 3.4); oval(x + f * 2 + 4, y + 15, 2.3, 3.4);
      oval(x + f * 2, y + 23, 2.4, 3);
      break;
    case 'king':
      bodyShape(x, y, 10); eyes(x, y, f, 2.6); beak(x, y, f);
      ctx.beginPath();
      ctx.moveTo(x - 9, y + 4); ctx.lineTo(x - 11, y - 7); ctx.lineTo(x - 5, y - 2); ctx.lineTo(x, y - 9);
      ctx.lineTo(x + 5, y - 2); ctx.lineTo(x + 11, y - 7); ctx.lineTo(x + 9, y + 4);
      ctx.closePath(); ctx.fill();
      break;
    case 'katana': {
      // два хвостика (рисуем ПОД телом, чтобы росли из-за головы) — слегка качаются
      const sw = Math.sin(G.t * 0.18) * 2.2;
      ctx.fillStyle = INK;
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + sd * 10, y + 5);
        ctx.quadraticCurveTo(x + sd * 26 + sw, y + 8, x + sd * 20 + sw, y + 29);
        ctx.quadraticCurveTo(x + sd * 14 + sw, y + 17, x + sd * 10, y + 12);
        ctx.closePath(); ctx.fill();
      }
      bodyShape(x, y, 10);
      // чёлка и боковые пряди — заливаем верх головы внутри контура тела
      ctx.save();
      rr(x - 13, y + 2, 26, 28, 10); ctx.clip();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(x - 15, y); ctx.lineTo(x + 15, y); ctx.lineTo(x + 15, y + 8);
      for (let i = 0; i < 4; i++) { const x1 = x + 15 - i * 7.5; ctx.quadraticCurveTo(x1 - 3.75, y + 14, x1 - 7.5, y + 8); }
      ctx.closePath(); ctx.fill();
      ctx.fillRect(x - 13, y + 2, 3.4, 10); ctx.fillRect(x + 9.6, y + 2, 3.4, 10);
      ctx.restore();
      // резинки на хвостиках
      ctx.fillStyle = BG; ctx.lineWidth = 2;
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sd * 14, y + 9, 2.6, 0, 6.2832); ctx.fill(); ctx.stroke(); }
      // глаза ниже чёлки, с ресничками
      ctx.fillStyle = INK;
      const ex1 = x + f * 3 - 5, ex2 = x + f * 3 + 5;
      dot(ex1, y + 17, 2.4); dot(ex2, y + 17, 2.4);
      ctx.lineWidth = 1.8; ctx.beginPath();
      ctx.moveTo(ex1 - 2.4, y + 15.5); ctx.lineTo(ex1 - 5, y + 13.8);
      ctx.moveTo(ex2 + 2.4, y + 15.5); ctx.lineTo(ex2 + 5, y + 13.8);
      ctx.stroke();
      // маленькая улыбка вместо клюва (клюв сливался бы с хвостиком)
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + f * 3, y + 20, 3.4, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
      break;
    }
    case 'skull':
      bodyShape(x, y, 11);
      oval(x - 5, y + 13, 3.6, 4.4); oval(x + 5, y + 13, 3.6, 4.4);
      tri(x, y + 18, x - 2.5, y + 22, x + 2.5, y + 22);
      ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(x - 7, y + 25); ctx.lineTo(x + 7, y + 25);
      for (let i = 0; i < 4; i++) { ctx.moveTo(x - 6 + i * 4, y + 25); ctx.lineTo(x - 6 + i * 4, y + 30); }
      ctx.stroke();
      break;
    default:
      bodyShape(x, y, 10); eyes(x, y, f, 2.6); beak(x, y, f);
      ctx.beginPath();
      ctx.moveTo(x - 7, y + 3); ctx.lineTo(x - 9, y - 4);
      ctx.moveTo(x + 7, y + 3); ctx.lineTo(x + 9, y - 4);
      ctx.stroke();
  }
}

function drawPlayer(p, skinId) {
  const sk = skinId || skin;
  const x = p.x, y = p.y, f = p.face;
  ctx.save();
  if (p.safe > 0 && p.rocket <= 0 && !(p.shield > 0) && ((G.t >> 2) & 1)) ctx.globalAlpha = 0.4;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  if (p.rocket > 0) {                   // ракета под ногами
    const fl = 10 + Math.random() * 12;
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(x - 6, y + p.h + 8); ctx.lineTo(x, y + p.h + 12 + fl); ctx.lineTo(x + 6, y + p.h + 8); ctx.closePath(); ctx.fill();
    rr(x - 8, y + p.h - 8, 16, 18, 5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 8, y + p.h + 4); ctx.lineTo(x - 14, y + p.h + 12); ctx.lineTo(x - 8, y + p.h + 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 8, y + p.h + 4); ctx.lineTo(x + 14, y + p.h + 12); ctx.lineTo(x + 8, y + p.h + 10); ctx.closePath(); ctx.fill();
  }

  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  const spread = p.vy < 0 ? 4 : 7;      // ноги
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 28); ctx.lineTo(x - spread, y + p.h);
  ctx.moveTo(x + 6, y + 28); ctx.lineTo(x + spread, y + p.h);
  if (sk !== 'ghost') ctx.stroke();     // у призрака ног нет

  if (p.boots > 0) {                    // ботинки
    ctx.fillStyle = INK;
    rr(x - spread - 5, y + p.h - 5, 10, 7, 2); ctx.fill();
    rr(x + spread - 5, y + p.h - 5, 10, 7, 2); ctx.fill();
  }

  drawSkin(sk, x, y, f);                // тело, лицо и детали выбранного скина

  if (p.shield > 0 && (p.shield > 120 || ((G.t >> 3) & 1))) {   // щит
    ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.lineDashOffset = -G.t * 0.5;
    ctx.beginPath(); ctx.arc(x, y + p.h / 2, 28, 0, 6.2832); ctx.stroke();
  }
  ctx.restore();
}

function drawHUD() {
  const p = G.p;
  ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 26px "Courier New", monospace';
  ctx.fillText(String(curScore()), 14, 32);
  drawCoin(21, 50, false);
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.fillStyle = INK; ctx.fillText(String(G.runCoins), 36, 56);

  let hy = 80;
  const bar = (icon, frac) => {
    drawIcon(icon, 24, hy, 0.9);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; rr(40, hy - 5, 70, 10, 3); ctx.stroke();
    ctx.fillStyle = INK; rr(42, hy - 3, Math.max(0, 66 * frac), 6, 2); ctx.fill();
    hy += 26;
  };
  if (p.boots > 0) bar('boots', p.boots / BUFF_FRAMES);
  if (p.shield > 0) bar('shield', p.shield / BUFF_FRAMES);
  if (p.rocket > 0) bar('rocket', p.rocket / ROCKET_FRAMES);
}

function render() {
  if (!G) return;
  ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  const v = Math.round(G.bg);
  BG = 'rgb(' + v + ',' + v + ',' + v + ')';
  INK = v > 127 ? '#000' : '#fff';
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  const off = G.camY * 0.5;
  pattern(G.prev, 1 - G.fade, off);
  pattern(G.stage, G.fade, off);

  if (state === 'menu' || state === 'shop') {   // красивый прыгающий герой на фоне меню
    const bounce = Math.abs(Math.sin(G.t * 0.05));
    drawPlayer({ x: W / 2, y: H * 0.8 - 34 - bounce * 120, face: 1, h: 34, vy: bounce > 0.5 ? -1 : 1,
                 boots: 0, shield: 0, rocket: 0, safe: 0 });
    ctx.fillStyle = INK; rr(W / 2 - 40, H * 0.8, 80, 10, 4); ctx.fill();
    return;
  }

  ctx.save();
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
  ctx.translate(0, -G.camY);
  const top = G.camY - 60, bot = G.camY + H + 60;
  for (const pl of G.plats) if (pl.y > top && pl.y < bot) drawPlat(pl);
  for (const it of G.items) if (it.y > top && it.y < bot) drawItem(it);
  for (const e of G.enemies) if (e.y > top && e.y < bot) drawEnemy(e);
  drawPlayer(G.p);
  ctx.fillStyle = INK;
  for (const q of G.parts) {
    ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
    ctx.fillRect(q.x - 1.5, q.y - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 14px "Courier New", monospace'; ctx.textAlign = 'center';
  for (const f of G.floats) {
    ctx.globalAlpha = clamp(f.life / 30, 0, 1);
    ctx.fillText(f.text, clamp(f.x, 60, W - 60), f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawHUD();
}

// ======================= LOOP =======================
const STEP = 1000 / 60;
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= STEP) {
    if (state === 'play' || state === 'dying') update();
    else if (state === 'menu' || state === 'shop') idle();
    acc -= STEP;
  }
  render();
  requestAnimationFrame(frame);
}

// ======================= BOOT =======================
resize();
newGame();
refreshMenu();
syncCloud(2);                                   // подтягиваем и объединяем облачное сохранение (2 повтора при ошибке)
requestAnimationFrame(frame);
})();
