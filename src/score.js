// Оценка заказа 0–100: насколько он совпадает с сильной стороной портфолио, бюджет (в USD по курсу НБУ),
// конкуренция, свежесть, признаки плохого заказа. Все пороги — здесь, в одном месте.
// Приоритеты — по исследованию «The first three paid freelance projects» (19.10.2026): лучший вход — хук/вариация
// из готовых материалов и короткая AI-presenter/app-реклама; общий монтаж — ниже; 3D/VFX/фото/автоматизация — не профиль.

export const HOT_SCORE = 65;   // ≥ — присылается сразу со звуком
export const GOOD_SCORE = 45;  // ≥ — попадает в сводку
// Мгновенно — только направления, где портфолио сильнее всего (исследование 19.10.2026); общий монтаж и ролики о продукте — в сводку.
export const HOT_CATEGORIES = ['hook', 'presenter', 'app', 'ai', 'explainer'];
export const LOCAL_GOOD_SCORE = 25; // местный рынок (Kwork, Freelancehunt в гривнах): только сводка, после иностранных
export const MAX_HOT_PER_DAY = 8; // владелец успевает 5–8 откликов в день (30 ч/нед вместе с выполнением)

// Шаблон «целые слова» с поддержкой кириллицы: в JS \b работает только для латиницы.
// В вариантах «~» = любое продолжение слова (окончания): «монтаж~» → монтажа, монтажер…
// Буквы — явным диапазоном, без \p{L}: Unicode-классы компилируются ~90 мс на холодном запуске (лимит 10 мс).
// Текст перед проверкой приводится к нижнему регистру, поэтому достаточно строчных букв.
const LETTER = 'a-z0-9\\u0430-\\u044f\\u0451\\u0456\\u0457\\u0454\\u0491';
const words = (...alts) => new RegExp(
  `(?<![${LETTER}])(?:${alts.join('|').replace(/~/g, `[${LETTER}]*`)})(?![${LETTER}])`);

// Направления — в порядке приоритета (первое совпадение задаёт «категорию» и шаблон отклика).
export const CATEGORIES = [
  { key: 'hook', label: 'хук / вариация', points: 32,
    re: words('hooks?', 'cut-?downs?', 're-?cuts?', 're-?edit~', 'variation~', 'variants?', 'resiz~', 'repurpos~', 'iteration~',
      'ad creatives?', 'creative variations?', 'new openings?', 'existing footage', 'our footage', 'нарезк~', 'варіац~', 'вариац~', 'хук~') },
  { key: 'presenter', label: 'AI-presenter / UGC', points: 32,
    re: words('ai[ -]?(?:ugc|presenter~|avatar~|actor~|spokesperson~|influencer~|talking head~)', 'ugc', 'talking head~', 'avatar~',
      'spokesperson~', 'heygen', 'ai[ -]?ads?', 'ai commercial~', 'ugc[- ]style', 'аватар~', 'ии[- ]аватар~', 'юджиси') },
  { key: 'app', label: 'промо приложения', points: 28,
    re: words('app promo~', 'app ads?', 'app video~', 'app store', 'play store', 'mobile app', 'saas', 'product demo~', 'demo video~',
      'screen recording~', 'screenshots?', 'app launch~', 'промо (?:приложени|застосунк)~', 'реклам~ (?:приложени|застосунк)~') },
  { key: 'ai', label: 'ИИ-видео', points: 22,
    re: words('ai[ -]?(?:video~|generated|animation~|content|film~|movie~|short~)', 'text[ -]to[ -]video', 'image[ -]to[ -]video', 'sora',
      'kling', 'runway', 'veo ?3?', 'seedance', 'hailuo', 'pika', 'нейросет~', 'ии[- ]видео', 'ии[- ]генерац~', 'генерац~ видео', 'ші[- ]відео',
      'ai[- ]відео~', 'ai[- ]видео~', 'ші[- ]генерац~', 'нейромереж~') },
  { key: 'explainer', label: 'эксплейнер / анимация', points: 18,
    re: words('explainer~', 'whiteboard', 'motion ?graphic~', 'motion design~', 'animat~', '2d', 'logo anim~', 'kinetic typography',
      'моушн~', 'анимац~', 'аниматор~', 'анімац~', 'аніматор~', 'інфографік~', 'эксплейнер~') },
  { key: 'product', label: 'ролик о продукте', points: 15,
    re: words('product video~', 'product photos?', 'packshot~', 'e-?commerce', 'amazon', 'shopify', 'product ads?', 'предметн~') },
  { key: 'edit', label: 'монтаж (общий)', points: 10,
    re: words('video ?edit~', 'editor~', 'editing', 'premiere', 'davinci', 'capcut', 'final cut', 'youtube', 'shorts', 'reels?',
      'tiktok', 'short[- ]form', 'podcast~', 'vlog~', 'subtitl~', 'caption~', 'colou?r grad~',
      'монтаж~', 'відеомонтаж~', 'видеомонтаж~', 'ролик~', 'клип~', 'кліп~') },
];
// Не профиль портфолио или неудобные условия: штраф и пометка (заказ остаётся видимым).
const CAUTIONS = [
  [words('full[- ]time', '40 ?h(?:ours)?(?:/| per )week', 'фул+[- ]?тайм', 'полн~ (?:день|занятост~)', 'повн~ (?:день|зайнят~)', 'в офис~', 'только офис', 'on-?site', 'onsite', 'in-?office'), -25, 'полная занятость / офис'],
  [words('daily (?:calls?|stand-?ups?)', 'weekly calls?', 'video calls?', 'zoom', 'google meet', 'interview call~', 'созвон~', 'дзвінк~'), -20, 'нужны созвоны'],
  [words('on[- ]camera', 'film yourself', 'record yourself', 'own (?:smart)?phone', 'your (?:own )?face', 'selfie videos? of yourself', 'real (?:creators?|people|person)', 'shoot (?:on|with) your', 'на камеру', 'снимать себя', 'знімати себе', 'с вашим лицом'), -25, 'нужны живые съёмки'],
  [words('blender', 'unreal', 'cinema ?4d', 'c4d', 'houdini', 'rigging', '3d model~', 'vfx', 'compositing', 'nuke'), -30, '3D/VFX — нет в портфолио'],
  [words('photo ?edit~', 'retouch~', 'photoshoot~', 'photographer~', 'фотограф~', 'ретуш~', 'фотосесс~'), -25, 'фото, а не видео'],
  [/\b(?:2[5-9]|[3-9]\d|\d{3,})\+?\s*(?:videos|reels|clips|tiktoks|shorts)\b/, -15, 'большой объём'],
  [words('long[- ]form', 'documentar~', '(?:1[0-9]|[2-9]\\d)[- ]?min(?:ute)?s?', 'feature film~', 'полнометраж~'), -10, 'длинный формат'],
  [words('[3-9]\\+? years?', '[3-9]\\+? yrs'), -5, 'просят опыт 3+ лет'],
];
const ADS = words('ads?', 'advert~', 'commercial~', 'promo~', 'product video~', 'marketing video~', 'brand video~',
  'e-?commerce', 'реклам~', 'промо~');
const ONGOING = words('ongoing', 'long[- ]term', 'monthly', 'retainer', 'recurring', 'regular~', 'weekly', 'daily',
  'per (?:week|month)', 'multiple videos', 'постоянн~', 'регулярн~', 'долгосроч~', 'постійн~', 'на постоянк~');
// «Это точно про видео»: должно быть в заголовке или ≥ 2 раз в описании. Слова вроде tiktok/youtube/editor
// без них не считаются (рекрутеры стримеров, фоторедакторы и т.п.).
const VIDEO_STRONG = words('videos?', 'відео~', 'видео~', 'ролик~', 'монтаж~', 'відеомонтаж~', 'видеомонтаж~', 'motion',
  'animat~', 'анимац~', 'анімац~', 'ugc', 'footage', 'vfx', 'after effects', 'premiere', 'davinci', 'capcut', 'final cut',
  'reels?', 'shorts', 'explainer~', 'trailer~', 'трейлер~', 'клип~', 'кліп~', 'b-roll', 'clips?', 'vlog~', 'podcast edit~');
// Признаки обмана или плохого заказа: штраф и пометка.
const RED_FLAGS = [
  [words('(?:unpaid|free) (?:test|trial|sample)~', 'test (?:task )?(?:for free|unpaid)', 'бесплатн~ тест~', 'безкоштовн~ тест~'), 'бесплатное тестовое'],
  [words('(?:registration|joining|training) fee', 'pay (?:a )?deposit'), 'просят оплату с исполнителя'],
  [/\b(?:whats ?app|telegram|wechat|signal)\b.{0,40}\b(?:me|contact|message)\b|contact me (?:on|via) (?:whats|tele)/i, 'уводят общение с площадки'],
  [words('casino~', 'betting', 'gambl~', 'onlyfans', 'nsfw', 'adult', 'xxx', 'казино', 'ставк~ на спорт'), 'азартные игры / 18+'],
  [words('deep ?fake~', 'face ?swap~'), 'лица/голоса реальных людей'],
  [words('crypto signals?', 'forex signals?', 'pump and dump'), 'крипто/форекс-схемы'],
  [words('per (?:1k |1000 |thousand )?views?', 'cpm', 'revenue[- ]share', 'commission[- ]only', 'paid per view~', 'за просмотр~', 'за перегляд~'), 'оплата за просмотры / процент'],
  [words('contests?', 'challenges?', 'competition', 'giveaway', 'конкурс~', 'челлендж~'), 'конкурс вместо оплаты'],
  [words('n8n', 'python', 'make\\.com', 'zapier', 'api integration~', 'automation pipeline~', 'автоматизац~'), 'автоматизация, а не видео'],
];

/** Курс к USD из курсов НБУ (UAH за единицу). Без курса — грубая оценка по USD = 1. */
export function toUsd(amount, currency, rates) {
  if (amount == null) return null;
  if (!currency || currency === 'USD') return amount;
  const uah = rates?.[currency], usd = rates?.USD;
  if (uah && usd) return (amount * uah) / usd;
  return null;
}

const countMatches = (re, text, limit) => {
  const g = new RegExp(re.source, 'g');
  let n = 0;
  while (n < limit && g.exec(text)) n++;
  return n;
};

export function scoreJob(job, rates, now = Date.now()) {
  // Нижний регистр один раз; описание — первые 1200 символов (Unicode-шаблоны дорогие, лимит CPU 10 мс).
  const title = String(job.title || '').toLowerCase();
  const desc = String(job.desc || '').slice(0, 1200).toLowerCase();
  const text = `${title} ${desc}`;
  const reasons = [];
  let score = 0;

  if (!VIDEO_STRONG.test(title) && countMatches(VIDEO_STRONG, desc, 2) < 2) {
    return { score: 0, category: null, reasons: ['не про видео'], flags: [], usdMin: null, usdMax: null, relevant: false };
  }

  // Направление: берём лучшее совпадение; совпадения в заголовке весят больше.
  let category = null;
  for (const c of CATEGORIES) {
    if (c.re.test(title)) { category = c; score += c.points; break; }
  }
  if (!category) {
    for (const c of CATEGORIES) {
      if (c.re.test(desc)) { category = c; score += Math.round(c.points * 0.6); break; }
    }
  }
  if (category) reasons.push(category.label);
  if (ADS.test(text)) { score += 8; reasons.push('реклама'); }
  if (ONGOING.test(text)) { score += 10; reasons.push('регулярная работа'); }

  // Бюджет в USD.
  const usdMin = toUsd(job.budgetMin, job.currency, rates);
  const usdMax = toUsd(job.budgetMax ?? job.budgetMin, job.currency, rates);
  const top = usdMax ?? usdMin;
  if (top != null) {
    if (job.rate === 'hourly') {
      if (top >= 25) score += 18; else if (top >= 15) score += 12; else if (top >= 8) score += 4; else { score -= 15; reasons.push('очень низкая ставка'); }
    } else if (job.rate === 'salary' && top > 5000) {
      score += 5;
    } else {
      if (top >= 300) score += 20; else if (top >= 150) score += 15; else if (top >= 75) score += 8; else if (top >= 40) score += 3; else { score -= 15; reasons.push('маленький бюджет'); }
    }
  }

  // Конкуренция.
  if (job.lowCompetition) { score += 12; reasons.push('мало конкурентов'); }
  if (job.bids != null) {
    if (job.bids <= 5) { score += 15; reasons.push(`всего ${job.bids} откл.`); }
    else if (job.bids <= 15) score += 8;
    else if (job.bids <= 30) score += 0;
    else if (job.bids <= 50) score -= 8;
    else { score -= 15; reasons.push(`${job.bids} откликов`); }
  }

  // Свежесть: кто откликнулся первым, того чаще читают.
  if (job.postedAt) {
    const h = (now - job.postedAt) / 3600e3;
    if (h < 1) { score += 10; reasons.push('свежий'); } else if (h < 6) score += 5; else if (h > 168) score -= 25; else if (h > 48) score -= 10;
  }

  // Явный запрос «ищем исполнителя» в сообществах (Telegram, Reddit) — канал №1 по исследованию: бюджета обычно нет,
  // но заказчик сам ищет и отвечает напрямую, без конкурса из 40 откликов.
  if (job.source === 'telegram' || job.source === 'reddit') { score += 15; reasons.push('явный запрос'); }

  // Иностранный заказчик — приоритет владельца.
  if (job.foreign) score += 15; else { score -= 10; reasons.push('местный рынок'); } // Kwork; Freelancehunt — основной
  if (job.lang && !['en', 'ru', 'uk'].includes(job.lang)) { score -= 10; reasons.push(`язык: ${job.lang}`); }

  const cautions = [];
  for (const [re, pts, label] of CAUTIONS) if (re.test(text)) { score += pts; cautions.push(label); }
  if (job.rate === 'salary') { score -= 10; cautions.push('вакансия в штат'); }

  const flags = [];
  for (const [re, label] of RED_FLAGS) if (re.test(text)) flags.push(label);
  if (flags.length) score -= 40;

  return {
    score: Math.max(0, Math.min(100, score)),
    category: category?.key || 'edit',
    cautions,
    reasons: [...reasons, ...cautions.map((c) => `⚠ ${c}`)],
    flags,
    usdMin: usdMin != null ? Math.round(usdMin) : null,
    usdMax: usdMax != null ? Math.round(usdMax) : null,
    relevant: true,
  };
}
