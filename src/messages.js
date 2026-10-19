// Тексты сообщений бота (по-русски) и кнопки.
import { escapeHtml as e } from './telegram.js';
import { SOURCES } from './sources.js';
import { STATUSES } from './store.js';

const ICON = { freelancer: '🟦', peopleperhour: '🟧', ytjobs: '🟥', freelancehunt: '🟨', kwork: '🟩', telegram: '✈️', twine: '🟪', reddit: '👽' };

export function ago(ms, now = Date.now()) {
  if (!ms) return null;
  const m = Math.max(0, Math.round((now - ms) / 60000));
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} ч назад` : `${Math.round(h / 24)} дн назад`;
}

/** Карточка заказа. row — строка из D1 (jobs). */
export function formatJob(row) {
  const src = SOURCES[row.source]?.name || row.source;
  const head = `${row.tier === 'hot' ? '🔥' : '⭐'} ${ICON[row.source] || ''} <b>${e(row.title)}</b>`;
  const facts = [
    row.budget && `💰 ${e(row.budget)}${row.usd_max && !/USD/.test(row.budget) ? ` (≈ $${row.usd_max})` : ''}`,
    row.bids != null && `📨 ${row.bids} откл.`,
    row.foreign_client ? '🌍 иностранный' : '🏠 местный',
    row.lang && row.lang !== 'en' && row.lang,
    ago(row.posted_at),
  ].filter(Boolean).join(' · ');
  const why = `🎯 <b>${row.score}</b>/100 · ${e(row.reasons || '')}`;
  const flags = row.flags ? `\n⚠️ <b>${e(row.flags)}</b>` : '';
  const desc = (row.descr || '').trim();
  const body = desc ? `\n<blockquote expandable>${e(desc.slice(0, 700))}${desc.length > 700 ? '…' : ''}</blockquote>` : '';
  const status = row.status && row.status !== 'new' ? `\nСтатус: ${STATUSES[row.status]?.label}` : '';
  const note = row.source === 'telegram' ? '\nℹ️ Пиши автору поста (контакт в тексте), не админу канала. Сначала уточни: проектная ли работа и оплачивается ли первое задание.'
    : SOURCES[row.source]?.note ? `\nℹ️ ${e(SOURCES[row.source].note)}` : '';
  return `${head}\n${src} · ${facts}\n${why}${flags}${body}${note}${status}`;
}

export function jobKeyboard(row) {
  const mark = (s) => (row.status === s ? '✅ ' : '') + STATUSES[s].label;
  return {
    inline_keyboard: [
      [{ text: '✍️ Отклик', callback_data: `p:${row.id}` }, { text: '🔗 Открыть', url: row.url }],
      [{ text: mark('applied'), callback_data: `s:applied:${row.id}` }, { text: mark('replied'), callback_data: `s:replied:${row.id}` }],
      [{ text: mark('won'), callback_data: `s:won:${row.id}` }, { text: mark('skip'), callback_data: `s:skip:${row.id}` }],
    ],
  };
}

/** Сводка: нумерованный список + кнопки «✍️ N» для отклика на каждый. */
export function formatDigest(rows, title = '📋 Сводка заказов') {
  const lines = rows.map((r, i) => {
    const facts = [r.budget, r.bids != null && `${r.bids} откл.`, r.foreign_client ? '🌍' : '🏠'].filter(Boolean).join(' · ');
    return `${i + 1}. ${ICON[r.source] || ''} <a href="${e(r.url)}">${e(r.title.slice(0, 90))}</a>\n    🎯 ${r.score} · ${e(facts)}`;
  });
  const keyboard = { inline_keyboard: [] };
  for (let i = 0; i < rows.length; i += 5) {
    keyboard.inline_keyboard.push(rows.slice(i, i + 5).map((r, k) => ({ text: `🔎 ${i + k + 1}`, callback_data: `o:${r.id}` })));
  }
  return { text: `<b>${title}</b> (${rows.length})\n\n${lines.join('\n')}\n\n🔎 N — открыть карточку с откликом и статусами.`, keyboard };
}
