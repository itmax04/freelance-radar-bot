// Источники потенциальных заказчиков (компаний, которым может быть нужно видео).
// Общий формат лида: { id, source, company, website?, host?, signal, signalText, desc, maker?, applyUrl?, country? }
//   signal: 'launch' — только что запустились; 'hiring' — нанимают на видео/контент; 'ads' — крутят рекламу (позже)
// Защиту сайтов не обходим: Kickstarter, Indiegogo, LaunchingNext, страницы компаний Himalayas — 403, не используются.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
async function get(url, as = 'text') {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: as === 'json' ? 'application/json' : 'text/html,application/xml,*/*' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return as === 'json' ? r.json() : r.text();
}
const decode = (s) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; }
}

// ---------- Product Hunt: публичная Atom-лента запусков (~50 в день) ----------
export async function fetchProductHunt() {
  const xml = await get('https://www.producthunt.com/feed');
  const out = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const page = (e.match(/<link rel="alternate" type="text\/html" href="([^"]+)"/) || [])[1];
    const title = decode((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
    const content = decode(decode((e.match(/<content type="html">([\s\S]*?)<\/content>/) || [])[1])).replace(/Discussion \| Link\s*$/, '').trim();
    const maker = decode((e.match(/<author>\s*<name>([\s\S]*?)<\/name>/) || [])[1]);
    const published = (e.match(/<published>([^<]+)/) || [])[1];
    if (!page) continue;
    out.push({
      id: `ph:${page.split('/products/')[1] || page}`,
      source: 'producthunt',
      company: title,
      website: null,            // берём со страницы продукта при обогащении
      pageUrl: page,
      signal: 'launch',
      signalText: `запустились на Product Hunt ${published ? published.slice(0, 10) : ''}`.trim(),
      desc: content,
      maker,
      postedAt: published ? Date.parse(published) : null,
    });
  }
  return out;
}

// ---------- Hacker News «Show HN»: только продукты с собственным сайтом (не GitHub) ----------
const NOT_A_PRODUCT_SITE = /(?:^|\.)(github\.com|gitlab\.com|github\.io|huggingface\.co|npmjs\.com|pypi\.org|arxiv\.org|youtube\.com|x\.com|twitter\.com|reddit\.com|medium\.com|substack\.com|web\.app|vercel\.app|netlify\.app|pages\.dev|workers\.dev|itch\.io|apps\.apple\.com|play\.google\.com)$/;

// «Brand – what it does» → «Brand»; фраза без названия («I built a …») → домен сайта.
function showHnName(title, url) {
  const parts = title.split(/\s[–—-]\s|:\s|,\s/);
  const first = parts[0].trim();
  if (parts.length > 1 && first.split(/\s+/).length <= 4 && !/^(i|we|my|a|an|the)\b/i.test(first)) return first.slice(0, 60);
  return hostOf(url) || first.slice(0, 60);
}

export async function fetchShowHN() {
  const d = await get('https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&hitsPerPage=50', 'json');
  return (d.hits || [])
    .filter((h) => h.url && hostOf(h.url) && !NOT_A_PRODUCT_SITE.test(hostOf(h.url)))
    .map((h) => ({
      id: `hn:${h.objectID}`,
      source: 'showhn',
      company: showHnName(decode(h.title).replace(/^Show HN:\s*/i, ''), h.url),
      website: h.url,
      pageUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
      signal: 'launch',
      signalText: `показали продукт в Show HN (${h.points || 0} очк.)`,
      desc: decode(h.title).replace(/^Show HN:\s*/i, ''),
      maker: h.author,
      postedAt: h.created_at_i ? h.created_at_i * 1000 : null,
    }));
}

// ---------- Вакансии на видео/контент: компания уже платит за видео → предлагаем фриланс ----------
const HIRING_ROLE = /\b(ugc|video|videographer|motion|animator|animation|content creator|content producer|social media|creative strategist|tiktok|youtube|editor|post[- ]production|brand designer)\b/i;
const NOT_ROLE = /\b(engineer|engineering|developer|devops|data|account(ant|ing)|sales|support|recruit\w*|nurse|teacher|dean|lawyer|legal|finance|planning|sponsorships?|program manager)\b/i;
// ЕС и Германия исключены: в ЕС холодные письма запрещены без согласия (в Германии UWG §7), владелец не работает на ЕС.
export const EU_COUNTRIES = ['germany', 'austria', 'switzerland', 'france', 'spain', 'italy', 'netherlands', 'belgium', 'poland',
  'portugal', 'ireland', 'sweden', 'denmark', 'finland', 'norway', 'czech', 'slovakia', 'hungary', 'romania', 'bulgaria',
  'greece', 'croatia', 'slovenia', 'estonia', 'latvia', 'lithuania', 'luxembourg', 'malta', 'cyprus', 'europe', 'eu'];
// Правовые формы ЕС. Короткие (AG, AB, AS, Oy, ApS) — только заглавными, иначе ловят английские «as», «ag».
const EU_LEGAL_RE = /\b(gmbh|ug \(haftungsbeschr|b\.v\.|s\.l\.|sarl|s\.r\.l\.|srl|kft|sp\. z o\.o\.|e\.k\.)(?=\W|$)/i;
const EU_LEGAL_CASE = /\b(AG|AB|AS|ApS|Oy|BV|SAS|UG)\b/;
export const isEuLegal = (name) => EU_LEGAL_RE.test(name || '') || EU_LEGAL_CASE.test(name || '');

const HIMALAYAS_QUERIES = ['video editor', 'ugc', 'motion designer', 'content creator', 'animator', 'creative strategist'];

export async function fetchHiring() {
  // Himalayas: поиск по словам (общая лента почти без творческих ролей). RemoteOK: тег-фильтр не работает — общая лента.
  const [rok, ...searches] = await Promise.all([
    get('https://remoteok.com/api', 'json').catch(() => []),
    ...HIMALAYAS_QUERIES.map((q) => get(`https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}&limit=20`, 'json').catch(() => ({ jobs: [] }))),
  ]);
  const seenJobs = new Set();
  const himJobs = searches.flatMap((r) => r.jobs || []).filter((j) => {
    const k = j.guid || `${j.companySlug}:${j.title}`;
    if (seenJobs.has(k)) return false;
    seenJobs.add(k);
    return true;
  });
  const out = [];
  for (const j of himJobs) {
    if (!HIRING_ROLE.test(j.title) || NOT_ROLE.test(j.title)) continue;
    const where = (j.locationRestrictions || []).join(', ');
    out.push({
      id: `hj:${j.guid || j.companySlug + ':' + j.title}`,
      source: 'himalayas',
      company: j.companyName,
      website: null,
      pageUrl: j.applicationLink,
      applyUrl: j.applicationLink,
      signal: 'hiring',
      signalText: `ищут «${j.title}»${where ? ` (${where})` : ''}`,
      desc: decode(j.excerpt || j.description || '').slice(0, 600),
      country: where,
      eu: isEuLegal(j.companyName) || (j.locationRestrictions || []).some((c) => EU_COUNTRIES.includes(String(c).toLowerCase())),
      postedAt: j.pubDate ? j.pubDate * 1000 : null,
    });
  }
  for (const x of (Array.isArray(rok) ? rok.slice(1) : [])) {
    if (!x.position || !HIRING_ROLE.test(x.position) || NOT_ROLE.test(x.position)) continue;
    out.push({
      id: `ro:${x.id}`,
      source: 'remoteok',
      company: x.company,
      website: null,
      pageUrl: x.url,
      applyUrl: x.apply_url || x.url,
      signal: 'hiring',
      signalText: `ищут «${x.position}»${x.location ? ` (${x.location})` : ''}`,
      desc: decode(x.description || '').slice(0, 600),
      country: x.location || '',
      eu: isEuLegal(x.company) || EU_COUNTRIES.some((c) => new RegExp(`\\b${c}\\b`, 'i').test(x.location || '')),
      postedAt: x.epoch ? x.epoch * 1000 : null,
    });
  }
  return out;
}

export const LEAD_SOURCES = {
  producthunt: { name: 'Product Hunt', fetch: fetchProductHunt },
  showhn: { name: 'Show HN', fetch: fetchShowHN },
  hiring: { name: 'Вакансии (Himalayas, RemoteOK)', fetch: fetchHiring },
};
