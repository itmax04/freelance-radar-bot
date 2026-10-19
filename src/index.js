// Радар заказов по видео: биржи → оценка → Telegram с готовым откликом.
import { SOURCES, fetchTelegram, DEFAULT_TG_CHANNELS } from './sources.js';
import { scoreJob, HOT_SCORE, GOOD_SCORE, LOCAL_GOOD_SCORE, MAX_HOT_PER_DAY, HOT_CATEGORIES } from './score.js';
import { knownIds, insertJobs, getJob, setJobFields, sentToday, getHealth, saveHealth, getSetting, getRates } from './store.js';
import { call, sendText, escapeHtml as e } from './telegram.js';
import { formatJob, jobKeyboard, formatDigest } from './messages.js';
import { handleUpdate, COMMANDS, statsText, sourcesText } from './commands.js';
import { runLeadSlot, runLeadSource, runEnrich, sendDailyLeads, sendFollowups, previewLeads } from './leads/bot.js';
import { goalText, runDailyReminders } from './reminders.js';

// Cron (UTC), см. wrangler.toml:
//   */2 * * * *  — один источник за запуск по кругу CYCLE (16 слотов = 32 мин), см. ниже
//   1 * * * *    — сводки (9, 13, 17, 21 по Берлину), отчёт дня (21:00), чистка базы (04:00),
//                  заказчики дня + напоминания (10:00)
//   */10 * * * * — поиск заказчиков (src/leads/bot.js → LEAD_CYCLE)
const CRON_SOURCES = '*/2 * * * *';
const CRON_HOURLY = '1 * * * *';
const CRON_LEADS = '*/10 * * * *'; // поиск заказчиков: источник или обогащение по кругу (LEAD_CYCLE)
const LEADS_HOUR = 10;              // подборка заказчиков и напоминания — 10:00 по Берлину
// Приоритеты по исследованию 19.10.2026: Freelancehunt и Telegram (явные запросы) — чаще всего (каждые ~6 мин),
// Freelancer.com (пробный Plus) — ~11 мин, YT Jobs, Twine, PeoplePerHour, Reddit — раз в 32 мин.
// Kwork исключён: блокирует серверы Cloudflare (см. SOURCES.kwork.blocked).
const CYCLE = ['freelancehunt', 'freelancer', 'telegram', 'freelancehunt', 'ytjobs', 'telegram', 'freelancehunt', 'freelancer',
  'twine', 'telegram', 'freelancehunt', 'peopleperhour', 'telegram', 'freelancehunt', 'freelancer', 'reddit'];
const DIGEST_HOURS = [9, 13, 17, 21];
const REPORT_HOUR = 21;
const MAX_SENDS_PER_RUN = 5;      // лимит подзапросов на запуск
const ALERT_AFTER_FAILS = 3;

const berlinHour = (d = new Date()) =>
  Number(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric', hourCycle: 'h23' }).format(d));

/** Слот по номеру двухминутки с начала эпохи (60 мин не делится на 16 слотов — считаем от эпохи). */
function slotForTime(ms) {
  const slot = Math.floor(ms / 120000);
  return { key: CYCLE[slot % CYCLE.length], slot };
}

async function tgChannels(env) {
  return getSetting(env, 'tgChannels', DEFAULT_TG_CHANNELS);
}

function tierOf(s, job) {
  if (!s.relevant) return 'skip';
  if (s.flags.length) return 'low';
  if (!job.foreign) return s.score >= LOCAL_GOOD_SCORE ? 'good' : 'low'; // приоритет — иностранные: местные только в сводку
  if (SOURCES[job.source]?.digestOnly) return s.score >= GOOD_SCORE ? 'good' : 'low'; // PeoplePerHour: подписка — только сводка
  if (s.score >= HOT_SCORE && HOT_CATEGORIES.includes(s.category)) return 'hot';
  if (s.score >= GOOD_SCORE) return 'good';
  return 'low';
}

/** Служебное сообщение: ошибка Telegram не должна обрывать проверку источника. */
async function notify(env, text) {
  try { await sendText(env, text); } catch (err) { console.log('notify failed', err.message); }
}

/** Проверить один источник: новые заказы → оценка → база → мгновенные уведомления. */
async function runSource(env, key, { dry = false, slot = 0, channel = null } = {}) {
  const src = SOURCES[key];
  const health = await getHealth(env, key);
  let jobs;
  try {
    if (key === 'telegram') {
      // Один канал за запуск, по кругу.
      const list = await tgChannels(env);
      channel = channel || list[slot % list.length];
      jobs = await fetchTelegram(channel);
    } else {
      jobs = await src.fetch();
    }
  } catch (err) {
    health.fail_count += 1;
    health.last_error = String(err.message || err).slice(0, 200);
    if (!dry) {
      await saveHealth(env, health);
      if (health.fail_count === ALERT_AFTER_FAILS) {
        await notify(env, `⚠️ ${src.name}: ${ALERT_AFTER_FAILS} ошибки подряд (${e(health.last_error)}). Проверю дальше сам; /sources — состояние.`);
      }
    }
    return { source: key, error: health.last_error };
  }

  const known = await knownIds(env, jobs.map((j) => j.id));
  const fresh = jobs.filter((j) => !known.has(j.id));
  const rates = await getRates(env);
  const now = Date.now();
  const rows = fresh.map((job) => {
    const s = scoreJob(job, rates, now);
    return { job, s, tier: tierOf(s, job), sent: 0 };
  });

  const firstRun = !health.baseline;
  const muted = await getSetting(env, 'muted', false);
  const minUsd = await getSetting(env, 'minUsd', 0);
  let budgetLeft = Math.min(MAX_SENDS_PER_RUN, MAX_HOT_PER_DAY - (dry ? 0 : await sentToday(env)));
  const instant = firstRun || muted ? [] : rows
    .filter((r) => r.tier === 'hot' && ((r.s.usdMax ?? r.s.usdMin) == null || (r.s.usdMax ?? r.s.usdMin) >= minUsd))
    .sort((a, b) => b.s.score - a.s.score)
    .slice(0, Math.max(0, budgetLeft));

  if (!dry) {
    await insertJobs(env, rows);
    for (const r of instant) {
      const row = await getJob(env, r.job.id);
      try {
        const res = await call(env, 'sendMessage', { text: formatJob(row), reply_markup: jobKeyboard(row), link_preview_options: { is_disabled: true } });
        await setJobFields(env, row.id, { sent: 1, msg_id: res.result.message_id });
      } catch (err) {
        console.log('send failed', row.id, err.message);
      }
    }
    if (firstRun) {
      const useful = rows.filter((r) => r.tier === 'hot' || r.tier === 'good').length;
      await notify(env, `🔌 Подключил ${src.name}: в выдаче ${jobs.length} заказов, подходящих — ${useful}. Старые не присылаю, лучшие придут в сводке; новые — сразу. /top — посмотреть сейчас.`);
    }
    if (health.fail_count >= ALERT_AFTER_FAILS) await notify(env, `✅ ${src.name} снова отвечает.`);
    await saveHealth(env, { ...health, last_ok: now, last_count: jobs.length, fail_count: 0, last_error: null, baseline: 1 });
  }

  return {
    source: key,
    total: jobs.length,
    fresh: fresh.length,
    tiers: rows.reduce((acc, r) => ((acc[r.tier] = (acc[r.tier] || 0) + 1), acc), {}),
    sent: dry ? 0 : instant.length,
    top: rows.filter((r) => r.tier !== 'skip').sort((a, b) => b.s.score - a.s.score).slice(0, 5)
      .map((r) => ({ score: r.s.score, tier: r.tier, title: r.job.title, budget: r.job.budgetMax, cur: r.job.currency, bids: r.job.bids, why: r.s.reasons.join(', '), flags: r.s.flags })),
  };
}

/** Сводка: хорошие заказы, которые ещё не присылали (за 12 ч), лучшие сверху, иностранные — первыми. */
async function sendDigest(env) {
  const since = Date.now() - 12 * 3600e3;
  const { results } = await env.DB.prepare(`SELECT * FROM jobs WHERE sent = 0 AND tier IN ('hot','good') AND status = 'new'
    AND created_at > ? ORDER BY foreign_client DESC, score DESC LIMIT 10`).bind(since).all();
  if (!results.length) return { digest: 0 };
  const { text, keyboard } = formatDigest(results);
  await sendText(env, text, { reply_markup: keyboard, disable_notification: true });
  await env.DB.batch(results.map((r) => env.DB.prepare('UPDATE jobs SET sent = 2 WHERE id = ?').bind(r.id)));
  return { digest: results.length };
}

async function sendReport(env) {
  const since = Date.now() - 24 * 3600e3;
  const t = await env.DB.prepare(`SELECT SUM(tier='hot') AS hot, SUM(tier='good') AS good, SUM(tier IN ('hot','good') AND foreign_client=1) AS foreign_n,
    SUM(tier IN ('low','skip')) AS rest FROM jobs WHERE created_at > ?`).bind(since).first();
  const a = await env.DB.prepare(`SELECT SUM(status IN ('applied','replied','won')) AS applied, SUM(status IN ('replied','won')) AS replied,
    SUM(status='won') AS won FROM jobs WHERE updated_at > ? AND status != 'new'`).bind(since).first();
  const text = `<b>🌙 Итоги дня</b>
Найдено: 🔥 ${t?.hot || 0} · ⭐ ${t?.good || 0} (иностранных ${t?.foreign_n || 0}), отсеяно ${t?.rest || 0}
Ты: ✉️ ${a?.applied || 0} откликов · 💬 ${a?.replied || 0} ответов · 🏆 ${a?.won || 0} заказов

${await sourcesText(env)}

${await goalText(env)}

/top — что ещё открыто.`;
  await sendText(env, text, { disable_notification: true });
}

async function cleanup(env) {
  // Отсеянные и неинтересные храним 30 дней (чтобы не проверять повторно), с откликами — всегда (статистика).
  await env.DB.prepare(`DELETE FROM jobs WHERE created_at < ? AND status IN ('new','skip')`).bind(Date.now() - 30 * 86400e3).run();
}

export default {
  async scheduled(event, env, ctx) {
    const date = new Date(event.scheduledTime);
    if (event.cron === CRON_HOURLY) {
      const h = berlinHour(date);
      if (DIGEST_HOURS.includes(h)) await sendDigest(env);
      if (h === REPORT_HOUR) await sendReport(env);
      if (h === 4) await cleanup(env);
      if (h === LEADS_HOUR) { await sendDailyLeads(env); await sendFollowups(env); await runDailyReminders(env, date); }
      return;
    }
    if (event.cron === CRON_LEADS) {
      console.log(JSON.stringify(await runLeadSlot(env, date.getUTCMinutes())));
      return;
    }
    const { key, slot } = slotForTime(event.scheduledTime);
    const res = await runSource(env, key, { slot });
    console.log(JSON.stringify({ ...res, top: undefined }));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/telegram' && request.method === 'POST') {
      if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
      try { await handleUpdate(env, await request.json()); } catch (err) { console.log('update failed', err.stack || err); }
      return new Response('ok');
    }
    if (url.searchParams.get('key') !== env.RUN_KEY || !env.RUN_KEY) return new Response('not found', { status: 404 });

    if (url.pathname === '/setup') {
      const hook = `${url.origin}/telegram`;
      const r1 = await call(env, 'setWebhook', { url: hook, secret_token: env.WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query'] }, { withChat: false });
      const r2 = await call(env, 'setMyCommands', { commands: COMMANDS }, { withChat: false });
      return Response.json({ webhook: r1.ok, commands: r2.ok, hook });
    }
    if (url.pathname === '/run') {
      const what = url.searchParams.get('source');
      const dry = url.searchParams.get('dry') === '1';
      if (what === 'digest') return Response.json(await sendDigest(env));
      if (what === 'report') { await sendReport(env); return Response.json({ report: true }); }
      if (what === 'stats') return new Response(await statsText(env));
      if (what === 'leads:enrich') return Response.json(await runEnrich(env, Number(url.searchParams.get('n') || 2)));
      if (what === 'leads:daily') return Response.json(await sendDailyLeads(env));
      if (what === 'leads:preview') return Response.json(await previewLeads(env));
      if (what === 'reminders') return Response.json(await runDailyReminders(env));
      if (what === 'goal') return new Response(await goalText(env));
      if (what === 'leads:followups') return Response.json(await sendFollowups(env));
      if (what?.startsWith('leads:')) return Response.json(await runLeadSource(env, what.slice(6)));
      const keys = what ? [what] : Object.keys(SOURCES).filter((k) => !SOURCES[k].blocked && k !== 'telegram');
      const out = [];
      for (const k of keys) {
        if (!SOURCES[k]) { out.push({ source: k, error: 'unknown source' }); continue; }
        out.push(await runSource(env, k, { dry, channel: url.searchParams.get('channel') }));
      }
      return Response.json(out);
    }
    return new Response('not found', { status: 404 });
  },
};
