// Источники заказов. Каждый fetch* возвращает массив заказов в общем формате:
// { id, source, title, url, desc, budgetMin, budgetMax, currency, rate: 'fixed'|'hourly'|'salary'|null,
//   bids, lang, postedAt (мс), foreign (true — иностранный заказчик), lowCompetition, tags: [] }
// Разбор — строковыми операциями и JSON.parse (лимит 10 мс CPU на запуск). Защиту сайтов не обходим:
// Guru, Workana, Mandy, Behance отвечают 403 — не подключены.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' };

async function get(url, as = 'text') {
  const r = await fetch(url, { headers: { ...HEADERS, Accept: as === 'json' ? 'application/json' : 'text/html,*/*' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return as === 'json' ? r.json() : r.text();
}

const decode = (s) => String(s ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#x27;|&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim();

// ---------- Freelancer.com: открытый API, категории (jobs) по видео ----------
// id категорий получены из /api/projects/0.1/jobs/ (98 видео-категорий, ниже — относящиеся к нашим услугам).
export const FREELANCER_JOBS = [
  52, 107, 152, 171, 390, 395, 474, 475, 676, 688, 726, 733, 947, 955, 1027, 1030, 1063, 1415, 1535, 1624, 1625,
  1673, 1721, 1927, 2127, 2128, 2178, 2207, 2215, 2223, 2248, 2252, 2253, 2342, 2347, 2349, 2353, 2358, 2516,
  2521, 2565, 2891, 2909, 3105, 3138, 3196, 3197, 3325, 3401, 3554, 3562, 3590,
];
const FREELANCER_URL = 'https://www.freelancer.com/api/projects/0.1/projects/active/?limit=50&sort_field=time_submitted'
  + '&job_details=true&full_description=true&' + FREELANCER_JOBS.map((j) => `jobs[]=${j}`).join('&');

export async function fetchFreelancer() {
  const data = await get(FREELANCER_URL, 'json');
  return (data.result?.projects || []).map((p) => ({
    id: `fl:${p.id}`,
    source: 'freelancer',
    title: p.title,
    url: `https://www.freelancer.com/projects/${p.seo_url || p.id}`,
    desc: p.description || p.preview_description || '',
    budgetMin: p.budget?.minimum ?? null,
    budgetMax: p.budget?.maximum ?? null,
    currency: p.currency?.code || 'USD',
    rate: p.type === 'hourly' ? 'hourly' : 'fixed',
    bids: p.bid_stats?.bid_count ?? null,
    lang: p.language || null,
    postedAt: (p.time_submitted || 0) * 1000,
    foreign: true,
    lowCompetition: false,
    tags: (p.jobs || []).map((j) => j.name),
  }));
}

// ---------- PeoplePerHour: HTML раздела Video & Photography (в основном клиенты из Великобритании) ----------
const PPH_URL = 'https://www.peopleperhour.com/freelance-jobs/video-photography';
const PPH_LINK = /<h6[^>]*>\s*<a[^>]*href="(https:\/\/www\.peopleperhour\.com\/freelance-jobs\/[^"]+-(\d+))"[^>]*>([^<]+)<\/a>/g;

export async function fetchPeoplePerHour(html) {
  html = html ?? await get(PPH_URL);
  const out = [];
  let m;
  PPH_LINK.lastIndex = 0;
  while ((m = PPH_LINK.exec(html))) {
    const [, url, id, rawTitle] = m;
    const before = html.slice(Math.max(0, m.index - 900), m.index);
    const after = html.slice(m.index, m.index + 3000);
    const price = [...before.matchAll(/<span>([£€$])\s?([\d,.]+)(?:\s*\/\s*hr)?<\/span>/g)].pop();
    const hourly = price && /\/\s*hr/.test(price[0]);
    const desc = (after.match(/<\/h6>\s*<p[^>]*>([\s\S]*?)<\/p>/) || [])[1];
    const proposals = (after.match(/>(\d+)<!-- --> <!-- -->proposals?</) || [])[1];
    const ago = (after.match(/<span>(\d+) (minute|hour|day)s? ago<\/span>/) || []);
    const mult = { minute: 60e3, hour: 3600e3, day: 86400e3 }[ago[2]] || 0;
    const amount = price ? Number(price[2].replace(/,/g, '')) : null;
    out.push({
      id: `pph:${id}`,
      source: 'peopleperhour',
      title: decode(rawTitle),
      url,
      desc: decode(desc),
      budgetMin: amount,
      budgetMax: amount,
      currency: price ? { '£': 'GBP', '€': 'EUR', $: 'USD' }[price[1]] : null,
      rate: price ? (hourly ? 'hourly' : 'fixed') : null,
      bids: proposals !== undefined ? Number(proposals) : null,
      lang: 'en',
      postedAt: ago[1] ? Date.now() - Number(ago[1]) * mult : Date.now(),
      foreign: true,
      lowCompetition: false,
      tags: [url.split('/freelance-jobs/')[1].split('/')[1] || ''],
    });
  }
  return out;
}

// ---------- YT Jobs: вакансии монтажёров/моушн-дизайнеров для YouTube-каналов (открытый JSON) ----------
export async function fetchYtJobs() {
  const data = await get('https://app.ytjobs.co/api/jobs?limit=30&page=1', 'json');
  // Только удалённая работа: Onsite/Hybrid владельцу не подходят.
  return (data.data || []).filter((j) => !j.locationType || j.locationType === 'Remote').map((j) => ({
    id: `ytj:${j.id}`,
    source: 'ytjobs',
    title: j.jobTitle || '',
    url: `https://ytjobs.co/job/${j.id}`,
    desc: [j.functionalArea, ...(j.categories || []).map((c) => c.name || c)].filter((x) => typeof x === 'string').join(' · '),
    budgetMin: j.minSalary ?? null,
    budgetMax: j.maxSalary ?? null,
    currency: 'USD',
    // jobType: '1' — за проект, '3' — полная занятость (годовая ставка), '5' — частичная (почасовая)
    rate: j.jobType === '1' ? 'fixed' : (j.maxSalary || 0) > 5000 ? 'salary' : 'hourly',
    bids: null,
    lang: 'en',
    postedAt: null, // в выдаче нет даты; новизну определяем по тому, что id раньше не встречался
    foreign: true,
    lowCompetition: Boolean(j.isLowCompetition),
    tags: [j.jobType, j.locationType, j.company?.name, j.company?.subscribers && `${j.company.subscribers} subs`].filter(Boolean),
  }));
}

// ---------- Freelancehunt: открытый API v2, видео-навыки (в основном клиенты из Украины) ----------
// 91 Animation, 101 Video Processing, 113 Audio & Video Editing, 144 Video Advertising, 161 Video Recording, 192 AI video
export const FREELANCEHUNT_SKILLS = [91, 101, 113, 144, 161, 192];

export async function fetchFreelancehunt() {
  const data = await get(`https://api.freelancehunt.com/v2/projects?filter[skill_id]=${FREELANCEHUNT_SKILLS.join(',')}`, 'json');
  return (data.data || []).map((x) => {
    const a = x.attributes || {};
    const cur = a.budget?.currency || null;
    return {
      id: `fh:${x.id}`,
      source: 'freelancehunt',
      title: a.name || '',
      url: x.links?.self?.web || `https://freelancehunt.com/project/${x.id}.html`,
      desc: a.description || decode(a.description_html),
      budgetMin: a.budget?.amount ?? null,
      budgetMax: a.budget?.amount ?? null,
      currency: cur,
      rate: a.budget ? 'fixed' : null,
      bids: a.bid_count ?? null,
      lang: /[а-яіїєґ]/i.test(a.name || '') ? 'uk' : 'en',
      postedAt: a.published_at ? Date.parse(a.published_at) : null,
      foreign: true, // по исследованию 19.10.2026 — основная биржа владельца, без штрафа «местный рынок»
      lowCompetition: false,
      tags: (a.skills || []).map((s) => s.name),
    };
  });
}

// ---------- Kwork: биржа проектов, разделы видео (российская площадка, рубли — низкий приоритет) ----------
// 76 Видеоролики, 77 Интро и анимация логотипа, 78 Видеосъемка и монтаж, 300 ИИ-генерация видео
export const KWORK_CATEGORIES = [76, 77, 78, 300];

export async function fetchKwork(html) {
  const pages = html ? [html] : await Promise.all(KWORK_CATEGORIES.map((c) => get(`https://kwork.ru/projects?c=${c}`)));
  const seen = new Set();
  const out = [];
  let parsedPages = 0;
  for (const page of pages) {
    const i = page.indexOf('"wantsListData"');
    if (i < 0) continue;
    parsedPages++;
    const j = page.indexOf('"wants":[', i);
    if (j < 0) continue;
    // Вырезаем массив wants по балансу скобок — не парсим весь stateData (дорого по CPU).
    let depth = 0, k = j + 8, end = -1, inStr = false;
    for (; k < page.length; k++) {
      const ch = page[k];
      if (inStr) { if (ch === '\\') k++; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '[') depth++;
      else if (ch === ']') { depth--; if (depth === 0) { end = k + 1; break; } }
    }
    if (end < 0) continue;
    for (const w of JSON.parse(page.slice(j + 8, end))) {
      if (seen.has(w.id)) continue;
      seen.add(w.id);
      out.push({
        id: `kw:${w.id}`,
        source: 'kwork',
        title: w.name || '',
        url: `https://kwork.ru/projects/${w.id}/view`,
        desc: decode(w.description),
        budgetMin: w.priceLimit ? Number(w.priceLimit) : null,
        budgetMax: w.possiblePriceLimit ? Number(w.possiblePriceLimit) : null,
        currency: 'RUB',
        rate: 'fixed',
        bids: w.kwork_count ?? null,
        lang: w.lang || 'ru',
        postedAt: w.date_create ? Date.parse(w.date_create.replace(' ', 'T') + '+03:00') : null,
        foreign: w.lang && w.lang !== 'ru',
        lowCompetition: false,
        tags: [w.category_id && `cat ${w.category_id}`, w.user?.data?.wants_hired_percent && `нанимает ${w.user.data.wants_hired_percent}%`].filter(Boolean),
      });
    }
  }
  if (!parsedPages) {
    // Вместо биржи пришла другая страница (блокировка облачных IP, капча) — не обходим, сообщаем.
    const title = decode((pages[0].match(/<title>([^<]*)/i) || [])[1] || pages[0].slice(0, 80));
    throw new Error(`нет списка заказов на странице: «${title.slice(0, 80)}»`);
  }
  return out;
}


// ---------- Telegram: публичные каналы с заказами (веб-просмотр t.me/s/<канал>) ----------
// Каналы из исследования 19.10.2026; владелец может добавлять свои командой /channels.
export const DEFAULT_TG_CHANNELS = ['motionhunter', 'aivacancychannel', 'jobforukrainians', 'beejob1_ua', 'creatorskit_app'];
// «Ищут исполнителя» против «предлагают себя» (резюме, портфолио).
const TG_DEMAND = /(ищем|ищу (?:моушн|монтаж|видео|аниматор|дизайнер)|шукаємо|шукаю (?:моушн|монтаж|відео|аніматор|дизайнер)|требуется|потрібен|потрібна|потрібні|нужен|нужна|нужны|вакансия|ваканс\p{L}*|hiring|looking for|we need|we're looking|need an?\s|#job|#заказ|#проект|#задача|#фриланс|#freelance|#vacancy|#remote)/iu;
const TG_SUPPLY = /(#резюме|#resume|#cv|#ищу_работу|ищу работу|шукаю роботу|open to work|available for (?:work|hire)|ищу заказы|возьму заказ|візьму замовлення|мои услуги|мої послуги)/iu;

export async function fetchTelegram(channel) {
  const html = await get(`https://t.me/s/${channel}`);
  const out = [];
  const blocks = html.split('<div class="tgme_widget_message_wrap');
  for (const b of blocks.slice(1)) {
    const post = (b.match(/data-post="([^"]+)"/) || [])[1];
    const raw = (b.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1];
    if (!post || !raw) continue;
    const text = decode(raw.replace(/<br\s*\/?>/gi, '\n')).trim();
    if (!TG_DEMAND.test(text) || TG_SUPPLY.test(text)) continue;
    const time = (b.match(/<time[^>]+datetime="([^"]+)"/) || [])[1];
    const contacts = [...new Set([...(raw.match(/@[A-Za-z0-9_]{4,32}/g) || []), ...(raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [])])]
      .filter((c) => c.toLowerCase() !== `@${channel}`.toLowerCase()).slice(0, 3);
    const firstLine = text.split(/\n|(?<=[.!?])\s/)[0].replace(/^#\S+\s*/g, '').trim();
    out.push({
      id: `tg:${post}`,
      source: 'telegram',
      title: (firstLine || text).slice(0, 110),
      url: `https://t.me/${post}`,
      desc: text.slice(0, 1500),
      budgetMin: null, budgetMax: null, currency: null, rate: null,
      bids: null,
      lang: /[іїєґ]/i.test(text) ? 'uk' : /[а-яё]/i.test(text) ? 'ru' : 'en',
      postedAt: time ? Date.parse(time) : null,
      foreign: true,
      lowCompetition: false,
      tags: [`@${channel}`, contacts.length ? `контакт: ${contacts.join(', ')}` : 'контакт — в посте'],
    });
  }
  return out;
}

// ---------- Twine: креативная биржа (15 бесплатных откликов/мес), HTML общей ленты и раздела аниматоров ----------
export async function fetchTwine() {
  const pages = await Promise.all(['https://www.twine.net/jobs', 'https://www.twine.net/jobs/animators', 'https://www.twine.net/jobs/videographers']
    .map((u) => get(u).catch(() => '')));
  const seen = new Set();
  const out = [];
  for (const html of pages) {
    for (const m of html.matchAll(/href="\/projects\/([a-z0-9]+)-([^"?#]+)"[^>]*>([^<]{3,200})<\/a>/g)) {
      const [, id, slug, rawTitle] = m;
      if (seen.has(id)) continue;
      seen.add(id);
      const before = decode(html.slice(Math.max(0, m.index - 1500), m.index)).slice(-300);
      const after = decode(html.slice(m.index, m.index + 3000).replace(/<[^>]+>/g, ' | ')).replace(/(\|\s*)+/g, '| ');
      const parts = after.split('|').map((x) => x.trim()).filter(Boolean);
      const desc = parts.find((x) => x.length > 80) || '';
      const ago = before.match(/Posted (today|(\d+) days? ago)/);
      const money = after.match(/[£$€]\s?[\d,.]+(?:\s?[-–]\s?[£$€]?\s?[\d,.]+)?/);
      const nums = money ? money[0].replace(/[£$€\s,]/g, '').split(/[-–]/).map(Number) : [];
      out.push({
        id: `tw:${id}`,
        source: 'twine',
        title: decode(rawTitle),
        url: `https://www.twine.net/projects/${id}-${slug}`,
        desc: desc.slice(0, 1200),
        budgetMin: nums[0] ?? null, budgetMax: nums[1] ?? nums[0] ?? null,
        currency: money ? { '£': 'GBP', $: 'USD', '€': 'EUR' }[money[0][0]] : null,
        rate: money ? 'fixed' : null,
        bids: null,
        lang: 'en',
        postedAt: ago ? Date.now() - (ago[1] === 'today' ? 0 : Number(ago[2]) * 86400e3) : null,
        foreign: true,
        lowCompetition: false,
        tags: [parts[1] && parts[1].slice(0, 60), /Remote/.test(after.slice(0, 600)) && 'Remote'].filter(Boolean),
      });
    }
  }
  return out;
}

// ---------- Reddit: разделы найма (RSS); только посты [Hiring]. Reddit часто отвечает 429 — проверяем редко ----------
export const REDDIT_SUBS = ['HireAnEditor', 'VideoEditors_forhire', 'VideoEditingRequests'];
export async function fetchReddit() {
  const out = [];
  let ok = 0;
  let lastErr = null;
  for (const sub of REDDIT_SUBS) {
    let xml;
    try { xml = await get(`https://www.reddit.com/r/${sub}/new/.rss`); ok++; } catch (err) { lastErr = err; continue; }
    for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
      const e = m[1];
      const title = decode((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
      if (!/\[(hiring|paid|task|request)\]|\bhiring\b|\bpaid\b|looking for/i.test(title) || /\[(for hire|offer|available)\]|for hire/i.test(title)) continue;
      const link = (e.match(/<link href="([^"]+)"/) || [])[1];
      const id = (e.match(/<id>([^<]+)<\/id>/) || [])[1] || link;
      const updated = (e.match(/<updated>([^<]+)/) || [])[1];
      const content = decode(decode((e.match(/<content type="html">([\s\S]*?)<\/content>/) || [])[1])).slice(0, 1500);
      out.push({
        id: `rd:${id.replace(/^t3_/, '')}`,
        source: 'reddit',
        title,
        url: link,
        desc: content,
        budgetMin: null, budgetMax: null, currency: null, rate: null,
        bids: null, lang: 'en',
        postedAt: updated ? Date.parse(updated) : null,
        foreign: true, lowCompetition: false,
        tags: [`r/${sub}`],
      });
    }
  }
  if (!ok && lastErr) throw lastErr;
  return out;
}

export const SOURCES = {
  freelancer: { name: 'Freelancer.com', fetch: fetchFreelancer, foreign: true, note: 'ставки — через пробный Plus (отменить до 18.11)' },
  peopleperhour: { name: 'PeoplePerHour', fetch: fetchPeoplePerHour, foreign: true, digestOnly: true, note: 'отклики могут требовать подписку — используй только бесплатные' },
  ytjobs: { name: 'YT Jobs', fetch: fetchYtJobs, foreign: true },
  freelancehunt: { name: 'Freelancehunt', fetch: fetchFreelancehunt, foreign: true },
  telegram: { name: 'Telegram-каналы', fetch: null, foreign: true }, // вызывается по каналу: fetchTelegram(channel)
  twine: { name: 'Twine', fetch: fetchTwine, foreign: true, note: '15 бесплатных откликов в месяц — откликайся только на лучшие' },
  reddit: { name: 'Reddit (найм)', fetch: fetchReddit, foreign: true },
  // Kwork (19.10.2026): на запросы из Cloudflare отдаёт пустую страницу (защита от ботов) — не обходим, в CYCLE нет.
  kwork: { name: 'Kwork', fetch: fetchKwork, foreign: false, blocked: 'пустая страница для серверов Cloudflare (защита от ботов)' },
};
