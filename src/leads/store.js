// D1: потенциальные заказчики (таблица leads).
import { hostOf } from './sources.js';

export const LEAD_STATUSES = {
  contacted: { label: '✉️ Написал' },
  replied: { label: '💬 Ответили' },
  won: { label: '🏆 Заказ' },
  skip: { label: '❌ Не подходит' },
};
export const FOLLOWUP_AFTER_DAYS = 4;

const companyKey = (lead) => hostOf(lead.website || '') || String(lead.company || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export async function knownLeadIds(env, ids) {
  const out = new Set();
  for (let i = 0; i < ids.length; i += 90) {
    const part = ids.slice(i, i + 90);
    const { results } = await env.DB.prepare(`SELECT id FROM leads WHERE id IN (${part.map(() => '?').join(',')})`).bind(...part).all();
    results.forEach((r) => out.add(r.id));
  }
  return out;
}

/** Новые лиды — в очередь на обогащение (stage = raw). */
export async function insertRawLeads(env, leads) {
  if (!leads.length) return;
  const now = Date.now();
  const stmt = env.DB.prepare(`INSERT OR IGNORE INTO leads (id, source, company, company_key, website, page_url, apply_url, signal, signal_text,
    descr, maker, posted_at, country, stage, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  await env.DB.batch(leads.map((l) => stmt.bind(l.id, l.source, (l.company || '?').slice(0, 120), companyKey(l), l.website, l.pageUrl,
    l.applyUrl || null, l.signal, l.signalText, (l.desc || '').slice(0, 800), l.maker || null, l.postedAt, l.country || null,
    l.eu ? 'excluded' : 'raw', now, now)));
}

/** Очередь на обогащение: запуски (нужен сайт — до 3 запросов на лид) и вакансии (без запросов) отдельно. */
export async function nextRawLeads(env, { launches = 2, hiring = 10 } = {}) {
  const q = (signal, n) => env.DB.prepare(`SELECT * FROM leads WHERE stage = 'raw' AND signal = ? ORDER BY created_at DESC LIMIT ?`).bind(signal, n).all();
  const [a, b] = await Promise.all([q('launch', launches), q('hiring', hiring)]);
  return [...a.results, ...b.results];
}

/** Есть ли уже другой лид той же компании (по домену/названию) — тогда этот дубль. */
export async function isDuplicate(env, lead, key) {
  const r = await env.DB.prepare(`SELECT n FROM leads WHERE company_key = ? AND n != ? AND stage = 'ready' LIMIT 1`).bind(key, lead.n).first();
  return Boolean(r);
}

export async function saveEnriched(env, lead, info, s, channel) {
  const key = info.host || lead.company_key;
  const dup = !s.excluded && key && (await isDuplicate(env, lead, key));
  await env.DB.prepare(`UPDATE leads SET website = ?, company_key = ?, emails = ?, contact_url = ?, socials = ?, has_video = ?, site_desc = ?,
    country = COALESCE(?, country), kind = ?, score = ?, reasons = ?, channel = ?, stage = ?, updated_at = ? WHERE n = ?`).bind(
    ...[
      info.website || lead.website, key, (info.emails || []).join(','), info.contactUrl, JSON.stringify(info.socials || {}),
      info.hasVideo == null ? null : info.hasVideo ? 1 : 0, info.siteDesc, info.country, info.kind, s.score,
      dup ? 'дубль компании' : s.reasons.join(', '), channel.label, s.excluded || dup ? 'excluded' : 'ready', Date.now(), lead.n,
    ].map((v) => (v === undefined || v === '' ? null : v)), // D1 не принимает undefined
  ).run();
}

export async function pickDaily(env, n, minScore) {
  const { results } = await env.DB.prepare(`SELECT * FROM leads WHERE stage = 'ready' AND sent = 0 AND status = 'new' AND score >= ?
    AND created_at > ? ORDER BY score DESC LIMIT ?`).bind(minScore, Date.now() - 10 * 86400e3, n).all();
  return results;
}

export const getLead = (env, n) => env.DB.prepare('SELECT * FROM leads WHERE n = ?').bind(Number(n)).first();

export async function setLeadFields(env, n, fields) {
  const keys = Object.keys(fields);
  await env.DB.prepare(`UPDATE leads SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE n = ?`)
    .bind(...keys.map((k) => fields[k]), Date.now(), Number(n)).run();
}

export async function toggleLeadStatus(env, n, status) {
  const lead = await getLead(env, n);
  if (!lead) return null;
  const next = lead.status === status ? 'new' : status;
  const fields = { status: next };
  if (next === 'contacted' && !lead.contacted_at) fields.contacted_at = Date.now();
  await setLeadFields(env, n, fields);
  return { ...lead, ...fields };
}

export async function dueFollowups(env, limit = 5) {
  const { results } = await env.DB.prepare(`SELECT * FROM leads WHERE status = 'contacted' AND followup_sent = 0 AND contacted_at < ? LIMIT ?`)
    .bind(Date.now() - FOLLOWUP_AFTER_DAYS * 86400e3, limit).all();
  return results;
}

export async function leadStats(env, days = 30) {
  return env.DB.prepare(`SELECT COUNT(*) AS found, SUM(stage = 'ready') AS ready, SUM(sent = 1) AS shown,
    SUM(status IN ('contacted','replied','won')) AS contacted, SUM(status IN ('replied','won')) AS replied, SUM(status = 'won') AS won
    FROM leads WHERE created_at > ?`).bind(Date.now() - days * 86400e3).first();
}
