// Поиск заказчиков: сбор → обогащение → ежедневная подборка → черновики → напоминания.
import { LEAD_SOURCES, isEuLocation } from './sources.js';
import { enrichLead } from './enrich.js';
import { scoreLead, bestChannel, LEADS_PER_DAY, MIN_LEAD_SCORE } from './score.js';
import { draftEmail, draftShort, draftDemo, followUpText } from './drafts.js';
import {
  LEAD_STATUSES, FOLLOWUP_AFTER_DAYS, knownLeadIds, insertRawLeads, nextRawLeads, saveEnriched, pickDaily, getLead,
  setLeadFields, toggleLeadStatus, dueFollowups, leadStats,
} from './store.js';
import { call, sendText, escapeHtml as e } from '../telegram.js';
import { getSetting } from '../store.js';

// Cron */10: по кругу — источник или обогащение (по 2 лида: сайт + контакты = до 3 запросов на лид).
export const LEAD_CYCLE = ['producthunt', 'enrich', 'hiring', 'enrich', 'showhn', 'enrich'];
const ENRICH_LAUNCHES = 2;  // запуски: сайт + страница контактов (+ страница Product Hunt) — до 3 запросов каждый
const ENRICH_HIRING = 10;   // вакансии: без сетевых запросов
const DEMO_FOR_TOP = 3; // для 3 лучших в подборке предлагаем бесплатный демо-ролик

export async function runLeadSlot(env, minute) {
  const slot = LEAD_CYCLE[Math.floor(minute / 10) % LEAD_CYCLE.length];
  return slot === 'enrich' ? runEnrich(env) : runLeadSource(env, slot);
}

export async function runLeadSource(env, key) {
  const src = LEAD_SOURCES[key];
  const leads = await src.fetch();
  const known = await knownLeadIds(env, leads.map((l) => l.id));
  const fresh = leads.filter((l) => !known.has(l.id));
  await insertRawLeads(env, fresh);
  return { leads: key, total: leads.length, fresh: fresh.length, eu: fresh.filter((l) => l.eu).length, germany: fresh.filter((l) => l.germany).length };
}

export async function runEnrich(env, launches = ENRICH_LAUNCHES) {
  const raw = await nextRawLeads(env, { launches, hiring: ENRICH_HIRING });
  const hasPostalAddress = Boolean(await getSetting(env, 'postalAddress', null));
  const done = [];
  for (const row of raw) {
    const lead = { ...row, desc: row.descr, pageUrl: row.page_url, applyUrl: row.apply_url, signalText: row.signal_text, postedAt: row.posted_at, eu: isEuLocation(row.country) };
    const info = row.signal === 'hiring' ? { emails: [], socials: {}, country: null, eu: lead.eu, germany: false } : await enrichLead(lead);
    const s = scoreLead(lead, info);
    const ch = bestChannel(lead, info, { hasPostalAddress });
    await saveEnriched(env, row, info, s, ch);
    done.push({ company: row.company, score: s.score, excluded: s.excluded, channel: ch.label, error: info.error });
  }
  return { enriched: done };
}

// ---------- Сообщения ----------
const SIGNAL_ICON = { launch: '🚀', hiring: '🧲', ads: '📣' };
const KIND = { b2c: 'потребительский продукт', b2b: 'B2B/SaaS', other: '' };

export function formatLead(l, rank) {
  const socials = JSON.parse(l.socials || '{}');
  const links = [
    l.website && `<a href="${e(l.website)}">сайт</a>`,
    l.page_url && `<a href="${e(l.page_url)}">${l.signal === 'hiring' ? 'вакансия' : 'запуск'}</a>`,
    socials.x && `<a href="${e(socials.x)}">X</a>`,
    socials.linkedin && `<a href="${e(socials.linkedin)}">LinkedIn</a>`,
    socials.instagram && `<a href="${e(socials.instagram)}">Instagram</a>`,
    l.contact_url && `<a href="${e(l.contact_url)}">форма</a>`,
  ].filter(Boolean).join(' · ');
  const facts = [l.country && `🌍 ${e(l.country)}`, KIND[l.kind], l.has_video === 0 && 'видео на сайте нет'].filter(Boolean).join(' · ');
  const deLead = /Германия/.test(l.reasons || '');
  const euLead = /ЕС/.test(l.reasons || '');
  const usNote = l.country === 'US' && l.emails ? '\n📮 США: по закону CAN-SPAM в рекламном письме нужен почтовый адрес отправителя — пока лучше форма/DM.'
    : deLead ? '\n🇩🇪 Германия: рекламные письма и сообщения через форму без согласия запрещены (UWG §7), закон применяется к тебе напрямую — только отклик на их вакансию или LinkedIn.'
    : euLead ? '\n🇪🇺 ЕС: правила рекламных писем компаниям зависят от страны — надёжнее отклик на вакансию, форма или LinkedIn.' : '';
  const status = l.status !== 'new' ? `\nСтатус: ${LEAD_STATUSES[l.status]?.label}` : '';
  return `${SIGNAL_ICON[l.signal] || '•'} ${rank ? `${rank}. ` : ''}<b>${e(l.company)}</b>
${e(l.signal_text || '')}
${l.descr ? `<i>${e(l.descr.slice(0, 220))}</i>\n` : ''}${facts ? `${facts}\n` : ''}🎯 ${l.score}/100 · ${e(l.reasons || '')}
📬 Как связаться: <b>${e(l.channel || '—')}</b>${l.emails ? `\n✉️ ${e(l.emails.split(',').join(', '))}` : ''}
${links}${usNote}${status}`;
}

export function leadKeyboard(l, { demo = false } = {}) {
  const mark = (s) => (l.status === s ? '✅ ' : '') + LEAD_STATUSES[s].label;
  const rows = [[{ text: '✍️ Письмо', callback_data: `le:${l.n}` }, { text: '💬 Коротко (форма/DM)', callback_data: `lm:${l.n}` }]];
  if (demo) rows.push([{ text: '🎬 Идея бесплатного демо', callback_data: `lv:${l.n}` }]);
  rows.push([{ text: mark('contacted'), callback_data: `lt:contacted:${l.n}` }, { text: mark('replied'), callback_data: `lt:replied:${l.n}` }]);
  rows.push([{ text: mark('won'), callback_data: `lt:won:${l.n}` }, { text: mark('skip'), callback_data: `lt:skip:${l.n}` }]);
  return { inline_keyboard: rows };
}

/** Ежедневная подборка (10:00 по Берлину): лучшие готовые лиды, каждый отдельной карточкой. */
export async function sendDailyLeads(env, n = LEADS_PER_DAY) {
  const leads = await pickDaily(env, n, MIN_LEAD_SCORE);
  if (!leads.length) {
    await sendText(env, '🔭 Новых подходящих заказчиков сегодня нет — источники проверяются каждый час.', { disable_notification: true });
    return { leads: 0 };
  }
  await sendText(env, `🔭 <b>Заказчики дня: ${leads.length}</b>\nКому может быть нужно видео прямо сейчас. Нажми ✍️ — бот напишет письмо под компанию; отправляешь ты. Для 🎬 первых трёх — идея бесплатного демо-ролика.`);
  for (const [i, l] of leads.entries()) {
    const r = await call(env, 'sendMessage', { text: formatLead(l, i + 1), reply_markup: leadKeyboard(l, { demo: i < DEMO_FOR_TOP }), link_preview_options: { is_disabled: true }, disable_notification: i > 0 });
    await setLeadFields(env, l.n, { sent: 1, msg_id: r.result.message_id });
  }
  return { leads: leads.length };
}

export async function sendFollowups(env) {
  const due = await dueFollowups(env);
  for (const l of due) {
    await sendText(env, `⏰ <b>${e(l.company)}</b>: ${FOLLOWUP_AFTER_DAYS} дня без ответа. Одно короткое напоминание повышает шанс ответа — потом больше не пишем.\n<pre>${e(followUpText(l))}</pre>`, {
      reply_markup: { inline_keyboard: [[{ text: '💬 Ответили', callback_data: `lt:replied:${l.n}` }, { text: '❌ Не подходит', callback_data: `lt:skip:${l.n}` }]] },
    });
    await setLeadFields(env, l.n, { followup_sent: 1 });
  }
  return { followups: due.length };
}

/** Кнопки лидов: le / lm / lv / lt. Возвращает true, если обработано. */
export async function handleLeadCallback(env, q, kind, rest) {
  if (!['le', 'lm', 'lv', 'lt'].includes(kind)) return false;
  const answer = (text) => call(env, 'answerCallbackQuery', { callback_query_id: q.id, text }, { withChat: false }).catch(() => {});

  if (kind === 'lt') {
    const [status, n] = rest;
    if (!LEAD_STATUSES[status]) { await answer('?'); return true; }
    const l = await toggleLeadStatus(env, n, status);
    if (!l) { await answer('Не найдено'); return true; }
    await answer(l.status === 'new' ? 'Статус снят' : LEAD_STATUSES[status].label);
    if (q.message?.text && l.msg_id === q.message.message_id) {
      await call(env, 'editMessageText', { message_id: q.message.message_id, text: formatLead(l), reply_markup: leadKeyboard(l), link_preview_options: { is_disabled: true } }).catch(() => {});
    }
    if (status === 'contacted' && l.status === 'contacted') await sendText(env, `Ок. Если за ${FOLLOWUP_AFTER_DAYS} дня не ответят — пришлю текст одного напоминания.`, { disable_notification: true });
    return true;
  }

  const l = await getLead(env, rest[0]);
  if (!l) { await answer('Не найдено'); return true; }
  await answer('Пишу…');
  const reply = { reply_parameters: { message_id: q.message.message_id, allow_sending_without_reply: true } };
  if (kind === 'le') {
    const d = await draftEmail(env, l, { offerDemo: l.score >= 60 });
    const to = l.emails ? l.emails.split(',')[0] : null;
    await sendText(env, `✍️ <b>Письмо для ${e(l.company)}</b>${d.ai ? '' : ' (шаблон)'} — нажми на текст, чтобы скопировать, проверь факты:\n<pre>${e(d.text)}</pre>${to ? `\nКому: <code>${e(to)}</code>` : ''}\nПосле отправки нажми ✉️ Написал.`, reply);
  } else if (kind === 'lm') {
    const d = await draftShort(env, l);
    await sendText(env, `💬 <b>Короткое сообщение для ${e(l.company)}</b>${d.ai ? '' : ' (шаблон)'}:\n<pre>${e(d.text)}</pre>\n${e(l.channel || '')}`, reply);
  } else if (kind === 'lv') {
    const d = await draftDemo(env, l);
    await sendText(env, `🎬 <b>Демо для ${e(l.company)}</b>${d.ai ? '' : ' (шаблон)'}\n<pre>${e(d.text)}</pre>\nСделай 5–10 с, отправь вместе с письмом — это сильнее любого текста.`, reply);
  }
  return true;
}

/** Пробный просмотр: подборка дня + письмо ИИ для лучшего лида, без Telegram. */
export async function previewLeads(env) {
  const leads = await pickDaily(env, LEADS_PER_DAY, MIN_LEAD_SCORE);
  const top = leads[0];
  const [email, short, demo] = top ? await Promise.all([draftEmail(env, top, { offerDemo: true }), draftShort(env, top), draftDemo(env, top)]) : [];
  return {
    picks: leads.map((l) => ({ score: l.score, company: l.company, signal: l.signal_text, channel: l.channel, why: l.reasons, country: l.country })),
    sample: top ? { company: top.company, email, short, demo } : null,
  };
}

export async function leadStatsText(env) {
  const s = await leadStats(env);
  const pct = (a, b) => (b ? ` (${Math.round((100 * a) / b)}%)` : '');
  return `<b>🔭 Заказчики за 30 дней</b>\nнайдено ${s?.found || 0} · подходящих ${s?.ready || 0} · показано ${s?.shown || 0}\n✉️ написал ${s?.contacted || 0} · 💬 ответили ${s?.replied || 0}${pct(s?.replied, s?.contacted)} · 🏆 заказов ${s?.won || 0}${pct(s?.won, s?.contacted)}`;
}
