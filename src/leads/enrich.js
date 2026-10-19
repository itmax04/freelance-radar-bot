// Обогащение лида: сайт → описание, публичные контакты, соцсети, есть ли видео, признаки страны, тип бизнеса.
// Только публично опубликованные адреса (mailto/текст на сайте компании). Строковые операции — лимит CPU 10 мс.
import { hostOf, isEuLegal, isGermanLegal } from './sources.js';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const MAX_HTML = 400_000;

async function getHtml(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const t = await r.text();
  return { html: t.length > MAX_HTML ? t.slice(0, MAX_HTML) : t, finalUrl: r.url };
}

const decode = (s) => String(s ?? '').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const meta = (html, name) => decode((html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)`, 'i'))
  || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, 'i')) || [])[1]);

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const BAD_EMAIL = /(noreply|no-reply|donotreply|example\.|sentry|wixpress|\.png|\.jpg|\.svg|\.webp|\.gif|@2x|privacy@|legal@|abuse@|security@|dpo@|gdpr@|careers@|jobs@|you@|name@|email@|user@)/i;
const EMAIL_RANK = ['hello', 'hi', 'founders', 'founder', 'team', 'contact', 'partners', 'partnerships', 'marketing', 'growth', 'info', 'support'];

function pickEmails(html, siteHost) {
  const found = new Set();
  const add = (e) => { const v = e.toLowerCase().replace(/[\\.,;:]+$/, ''); if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) found.add(v); };
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) { try { add(decodeURIComponent(m[1])); } catch { add(m[1]); } }
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  for (const m of text.matchAll(EMAIL)) add(m[0]);
  const base = siteHost ? siteHost.split('.').slice(-2).join('.') : '';
  // Только адреса на домене самой компании: чужие (соцсети, хостинги, личные с других сайтов) — отбрасываем.
  return [...found]
    .filter((e) => !BAD_EMAIL.test(e) && (!base || e.endsWith('@' + base) || e.endsWith('.' + base)))
    .sort((a, b) => {
      const own = (e) => (base && e.endsWith('@' + base) || e.endsWith('.' + base) ? 0 : 1);
      const rank = (e) => { const i = EMAIL_RANK.indexOf(e.split('@')[0]); return i < 0 ? 50 : i; };
      return own(a) - own(b) || rank(a) - rank(b);
    })
    .slice(0, 3);
}

const SOCIAL = [
  ['x', /href=["'](https?:\/\/(?:www\.)?(?:x|twitter)\.com\/(?!share|intent|home|search|hashtag)[A-Za-z0-9_]{2,30})\/?["']/i],
  ['linkedin', /href=["'](https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in)\/[^"'?#]+)/i],
  ['instagram', /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]{2,40})\/?["']/i],
  ['tiktok', /href=["'](https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.]{2,40})/i],
  ['youtube', /href=["'](https?:\/\/(?:www\.)?youtube\.com\/(?:@|c\/|channel\/)[^"'?#]+)/i],
];
const VIDEO_ON_SITE = /<video[\s>]|youtube\.com\/embed|youtube-nocookie\.com\/embed|player\.vimeo\.com|fast\.wistia|wistia\.com\/medias|loom\.com\/embed|vidyard|mux\.com|\.mp4["'?]/i;
const CONTACT_LINK = /href=["']([^"']*(?:\/contact|\/contact-us|\/get-in-touch|\/support|\/talk-to-us)[^"']*)["']/i;

// Тип бизнеса: потребительский (UGC, реклама) или B2B/SaaS (эксплейнер, демо).
const B2C = /\b(app|apps|shop|store|brand|skincare|beauty|fitness|wellness|health|food|drink|coffee|pet|fashion|apparel|jewelry|home|kitchen|baby|kids|travel|game|games|dating|music|creator|e-?commerce|subscription box|supplement|cosmetic)\b/i;
const B2B = /\b(saas|b2b|api|platform|developers?|teams?|enterprise|workflow|crm|analytics|automation|infrastructure|dashboard|agents?|sdk|devops|compliance|security)\b/i;

// Страна по сайту: Германия — исключаем; остальной ЕС — помечаем; США/UK/CA/AU — приоритет.
function countryHints(html, host) {
  const tld = (host || '').split('.').pop();
  const EU_TLD = ['at', 'fr', 'es', 'it', 'nl', 'be', 'pl', 'pt', 'ie', 'se', 'dk', 'fi', 'cz', 'sk', 'hu', 'ro', 'bg', 'gr', 'hr', 'si', 'ee', 'lv', 'lt', 'lu', 'mt', 'cy', 'eu'];
  if (tld === 'de') return { country: 'DE', eu: true, germany: true };
  if (EU_TLD.includes(tld)) return { country: tld.toUpperCase(), eu: true, germany: false };
  if (tld === 'uk') return { country: 'UK', eu: false, germany: false };
  if (tld === 'ca') return { country: 'CA', eu: false, germany: false };
  if (tld === 'au') return { country: 'AU', eu: false, germany: false };
  if (tld === 'nz') return { country: 'NZ', eu: false, germany: false };
  const foot = html.slice(-40000);
  const footText = decode(foot.replace(/<[^>]+>/g, ' ')).slice(-3000);
  if (isGermanLegal(footText) || /\b(Deutschland|Germany)\b/.test(footText) && /\bimpressum\b/i.test(foot)) return { country: 'DE?', eu: true, germany: true };
  if (/\bimpressum\b/i.test(foot) || isEuLegal(footText)) return { country: 'ЕС?', eu: true, germany: false };
  if (/\b(Pty Ltd|Australia)\b/.test(foot)) return { country: 'AU', eu: false, germany: false };
  if (/\b(Ltd\.?|Limited|United Kingdom|London)\b/.test(foot)) return { country: 'UK', eu: false, germany: false };
  if (/\b(Inc\.?|LLC|Corp\.?|Delaware|San Francisco|New York|California|Texas|USA|United States)\b/.test(foot)) return { country: 'US', eu: false, germany: false };
  if (/\b(Canada|Toronto|Vancouver|Montreal)\b/.test(foot)) return { country: 'CA', eu: false, germany: false };
  return { country: null, eu: false, germany: false };
}

/** Сайт компании со страницы Product Hunt (ссылка с ?ref=producthunt). */
export async function websiteFromProductHunt(pageUrl) {
  const { html } = await getHtml(pageUrl);
  const m = html.match(/href="(https?:\/\/[^"]+)\?ref=producthunt/);
  return m ? m[1] : null;
}

export async function enrichLead(lead) {
  const out = { emails: [], contactUrl: null, socials: {}, hasVideo: null, siteTitle: null, siteDesc: null, country: null, eu: Boolean(lead.eu), germany: Boolean(lead.germany), kind: null, error: null };
  let website = lead.website;
  try {
    if (!website && lead.source === 'producthunt' && lead.pageUrl) website = await websiteFromProductHunt(lead.pageUrl);
  } catch (err) { out.error = `PH: ${err.message}`; }
  if (!website) return { ...out, website: null };

  const host = hostOf(website);
  try {
    const { html, finalUrl } = await getHtml(website);
    const fhost = hostOf(finalUrl) || host;
    out.siteTitle = decode((html.match(/<title[^>]*>([^<]*)/i) || [])[1]).slice(0, 120);
    out.siteDesc = (meta(html, 'description') || meta(html, 'og:description')).slice(0, 300);
    out.emails = pickEmails(html, fhost);
    const c = html.match(CONTACT_LINK);
    if (c) { try { out.contactUrl = new URL(c[1], finalUrl).href; } catch { /* битая ссылка */ } }
    for (const [k, re] of SOCIAL) { const m = html.match(re); if (m) out.socials[k] = m[1]; }
    out.hasVideo = VIDEO_ON_SITE.test(html);
    Object.assign(out, countryHints(html, fhost));
    if (lead.eu) out.eu = true;
    if (lead.germany) out.germany = true;
    const text = `${lead.desc || ''} ${out.siteTitle} ${out.siteDesc}`;
    out.kind = B2C.test(text) && !/\b(b2b|saas|enterprise|developers?|api)\b/i.test(text) ? 'b2c' : B2B.test(text) ? 'b2b' : 'other';
    // Почты нет на главной — пробуем страницу контактов (ещё 1 запрос).
    if (!out.emails.length && out.contactUrl && hostOf(out.contactUrl) === fhost) {
      try { const cp = await getHtml(out.contactUrl); out.emails = pickEmails(cp.html, fhost); } catch { /* не критично */ }
    }
    return { ...out, website: finalUrl, host: fhost };
  } catch (err) {
    return { ...out, website, host, error: `сайт: ${err.message}` };
  }
}
