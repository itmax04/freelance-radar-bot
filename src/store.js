// Работа с D1: заказы, статусы, здоровье источников, настройки, курсы НБУ.

export const STATUSES = {
  applied: { label: '✉️ Откликнулся', short: '✉️' },
  replied: { label: '💬 Ответили', short: '💬' },
  won: { label: '🏆 Заказ', short: '🏆' },
  skip: { label: '❌ Мимо', short: '❌' },
};

/** Какие id из списка уже есть в базе. */
export async function knownIds(env, ids) {
  if (!ids.length) return new Set();
  const out = new Set();
  // D1 ограничивает число параметров в запросе — бьём на пачки по 90.
  for (let i = 0; i < ids.length; i += 90) {
    const part = ids.slice(i, i + 90);
    const { results } = await env.DB.prepare(`SELECT id FROM jobs WHERE id IN (${part.map(() => '?').join(',')})`)
      .bind(...part).all();
    results.forEach((r) => out.add(r.id));
  }
  return out;
}

export function budgetText(job) {
  const { budgetMin: a, budgetMax: b, currency: c, rate } = job;
  if (a == null && b == null) return null;
  const n = (x) => Number(x).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const range = a != null && b != null && a !== b ? `${n(a)}–${n(b)}` : n(a ?? b);
  const unit = rate === 'hourly' ? '/ч' : rate === 'salary' ? (b > 5000 ? '/год' : '') : '';
  return `${range} ${c || ''}${unit}`.trim();
}

export async function insertJobs(env, rows) {
  if (!rows.length) return;
  const now = Date.now();
  const stmt = env.DB.prepare(`INSERT OR IGNORE INTO jobs
    (id, source, title, url, descr, budget, usd_max, rate, bids, foreign_client, lang, posted_at, score, category, reasons, flags, tier, sent, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  await env.DB.batch(rows.map(({ job, s, tier, sent }) => stmt.bind(
    job.id, job.source, job.title.slice(0, 300), job.url, (job.desc || '').slice(0, 1500), budgetText(job),
    s.usdMax ?? s.usdMin, job.rate, job.bids, job.foreign ? 1 : 0, job.lang, job.postedAt, s.score, s.category,
    s.reasons.join(', '), s.flags.join(', '), tier, sent, now, now,
  )));
}

export const getJob = (env, id) => env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first();

export async function setJobFields(env, id, fields) {
  const keys = Object.keys(fields);
  await env.DB.prepare(`UPDATE jobs SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
    .bind(...keys.map((k) => fields[k]), Date.now(), id).run();
}

/** Повторное нажатие того же статуса снимает его (как в квартирном боте). */
export async function toggleStatus(env, id, status) {
  const job = await getJob(env, id);
  if (!job) return null;
  const next = job.status === status ? 'new' : status;
  await setJobFields(env, id, { status: next });
  return { ...job, status: next };
}

export async function sentToday(env) {
  const since = Date.now() - 24 * 3600e3;
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM jobs WHERE sent = 1 AND updated_at > ?').bind(since).first();
  return r?.n || 0;
}

// ---------- Здоровье источников ----------
export async function getHealth(env, source) {
  return (await env.DB.prepare('SELECT * FROM health WHERE source = ?').bind(source).first())
    || { source, last_ok: null, last_count: null, fail_count: 0, last_error: null, baseline: 0 };
}
export async function saveHealth(env, h) {
  await env.DB.prepare(`INSERT INTO health (source, last_ok, last_count, fail_count, last_error, baseline)
    VALUES (?,?,?,?,?,?) ON CONFLICT(source) DO UPDATE SET last_ok = excluded.last_ok, last_count = excluded.last_count,
    fail_count = excluded.fail_count, last_error = excluded.last_error, baseline = excluded.baseline`)
    .bind(h.source, h.last_ok, h.last_count, h.fail_count, h.last_error, h.baseline).run();
}

// ---------- Настройки ----------
export async function getSetting(env, key, fallback = null) {
  const r = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return r ? JSON.parse(r.value) : fallback;
}
export async function setSetting(env, key, value) {
  await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, JSON.stringify(value)).run();
}

// ---------- Курсы НБУ (гривен за единицу валюты), кэш 12 ч ----------
export async function getRates(env) {
  const cached = await getSetting(env, 'rates');
  if (cached && Date.now() - cached.at < 12 * 3600e3) return cached.rates;
  try {
    const r = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
    const list = await r.json();
    const rates = { UAH: 1 };
    for (const x of list) rates[x.cc] = x.rate;
    await setSetting(env, 'rates', { at: Date.now(), rates });
    return rates;
  } catch {
    return cached?.rates || null;
  }
}
