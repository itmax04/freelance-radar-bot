// Команды и кнопки Telegram (webhook).
import { call, sendText, escapeHtml as e } from './telegram.js';
import { SOURCES } from './sources.js';
import { STATUSES, getJob, toggleStatus, setJobFields, getSetting, setSetting, getRates } from './store.js';
import { formatJob, jobKeyboard, formatDigest, ago } from './messages.js';
import { buildProposal } from './proposal.js';
import { handleLeadCallback, leadStatsText, formatLead, leadKeyboard } from './leads/bot.js';
import { pickDaily } from './leads/store.js';
import { goalText, queueRepeat } from './reminders.js';
import { DEFAULT_TG_CHANNELS } from './sources.js';

export const COMMANDS = [
  { command: 'top', description: 'Лучшие открытые заказы за 2 дня' },
  { command: 'leads', description: 'Потенциальные заказчики (ещё не показанные)' },
  { command: 'stats', description: 'Отклики, ответы, заказы — по источникам' },
  { command: 'min', description: 'Мин. бюджет для мгновенных: /min 50' },
  { command: 'mute', description: 'Пауза/возобновление мгновенных уведомлений' },
  { command: 'sources', description: 'Состояние источников' },
  { command: 'goal', description: 'Цель: 3 оплаченных проекта до 18.11' },
  { command: 'channels', description: 'Telegram-каналы: /channels add @name' },
  { command: 'help', description: 'Как пользоваться' },
];

const HELP = `<b>Радар заказов по видео</b>
Источники: Freelancehunt, Telegram-каналы, Freelancer.com, YT Jobs, Twine, Reddit (найм), PeoplePerHour (только сводка).
Сверху — то, что лучше всего совпадает с портфолио: хуки и вариации, AI-presenter/UGC, промо приложений (исследование 19.10).

🔥 — сильный заказ, приходит сразу (до 8 в день). ⭐ — в сводке (9:00, 13:00, 17:00, 21:00). ⚠ — неудобные условия.
<b>✍️ Отклик</b> — готовый текст: ближайшая работа по прямой ссылке, оплаченный пилот с ценой и объёмом, один вопрос.
Отмечай ✉️ → 💬 → 🏆 или ❌. Бот сам ничего не отправляет.

/top — лучшие открытые заказы
/leads — потенциальные заказчики (подборка в 10:00)
/goal — цель: 3 оплаченных проекта до 18.11
/stats — где реально отвечают и нанимают
/channels — Telegram-каналы (добавить: /channels add @name)
/min 50 · /mute · /sources`;

export async function handleUpdate(env, update) {
  if (update.callback_query) return handleCallback(env, update.callback_query);
  const msg = update.message;
  if (!msg?.text || String(msg.chat?.id) !== String(env.TELEGRAM_CHAT_ID)) return;
  const [cmd, ...args] = msg.text.trim().split(/\s+/);
  switch (cmd.replace(/@.*$/, '').toLowerCase()) {
    case '/start':
    case '/help': return sendText(env, HELP);
    case '/top': return sendTop(env);
    case '/stats': return sendText(env, `${await statsText(env)}\n\n${await leadStatsText(env)}`);
    case '/goal': return sendText(env, await goalText(env));
    case '/channels': {
      const list = await getSetting(env, 'tgChannels', DEFAULT_TG_CHANNELS);
      const name = String(args[1] || '').replace(/^@|^https?:\/\/t\.me\/(s\/)?/i, '').replace(/\/.*$/, '');
      if (args[0] === 'add' && /^[A-Za-z0-9_]{4,32}$/.test(name)) {
        if (!list.includes(name)) list.push(name);
        await setSetting(env, 'tgChannels', list);
        return sendText(env, `Добавил @${name}. Каналы: ${list.map((c) => '@' + c).join(', ')}`);
      }
      if (['remove', 'del'].includes(args[0]) && list.includes(name)) {
        const next = list.filter((c) => c !== name);
        await setSetting(env, 'tgChannels', next);
        return sendText(env, `Убрал @${name}. Каналы: ${next.map((c) => '@' + c).join(', ')}`);
      }
      return sendText(env, `Telegram-каналы (проверяю по одному каждые ~6 мин, только посты «ищем исполнителя»):\n${list.map((c) => '@' + c).join('\n')}\n\nДобавить: /channels add @name · убрать: /channels remove @name\nКанал должен быть публичным (открываться на t.me/s/name).`);
    }
    case '/leads': {
      const leads = await pickDaily(env, 5, 0);
      if (!leads.length) return sendText(env, 'Новых заказчиков пока нет — источники проверяются каждый час, подборка в 10:00.');
      for (const [i, l] of leads.entries()) {
        const r = await call(env, 'sendMessage', { text: formatLead(l, i + 1), reply_markup: leadKeyboard(l, { demo: i < 3 }), link_preview_options: { is_disabled: true } });
        await env.DB.prepare('UPDATE leads SET sent = 1, msg_id = ? WHERE n = ?').bind(r.result.message_id, l.n).run();
      }
      return;
    }
    case '/sources': return sendText(env, await sourcesText(env));
    case '/mute': {
      const muted = !(await getSetting(env, 'muted', false));
      await setSetting(env, 'muted', muted);
      return sendText(env, muted ? '🔕 Мгновенные уведомления на паузе. Сводки продолжат приходить. /mute — включить.' : '🔔 Мгновенные уведомления включены.');
    }
    case '/min': {
      const n = Number(args[0]);
      if (!args.length || Number.isNaN(n)) return sendText(env, `Сейчас: от $${await getSetting(env, 'minUsd', 0)}. Пример: /min 50 (0 — без ограничения). Заказы без бюджета приходят всегда.`);
      await setSetting(env, 'minUsd', Math.max(0, n));
      return sendText(env, `Ок: мгновенно — только заказы с бюджетом от $${Math.max(0, n)} (или без указанного бюджета).`);
    }
    default: return sendText(env, 'Не знаю такой команды. /help');
  }
}

async function handleCallback(env, q) {
  if (String(q.message?.chat?.id) !== String(env.TELEGRAM_CHAT_ID)) return;
  const [kind, ...rest] = q.data.split(':');
  if (await handleLeadCallback(env, q, kind, rest)) return;
  const answer = (text) => call(env, 'answerCallbackQuery', { callback_query_id: q.id, text }, { withChat: false }).catch(() => {});

  if (kind === 'p') {
    const job = await getJob(env, rest.join(':'));
    if (!job) return answer('Заказ уже удалён из базы');
    const text = buildProposal({ ...job, desc: job.descr, foreign: Boolean(job.foreign_client) }, { category: job.category, rates: await getRates(env) });
    await answer('Отклик готов');
    return sendText(env, `✍️ <b>Отклик</b> — нажми на текст, чтобы скопировать, поправь под заказ:\n<pre>${e(text)}</pre>\n<a href="${e(job.url)}">Открыть заказ</a>, затем отметь ✉️ Откликнулся.`, {
      reply_parameters: { message_id: q.message.message_id, allow_sending_without_reply: true },
    });
  }

  if (kind === 's') {
    const [status, ...idParts] = rest;
    if (!STATUSES[status]) return answer('?');
    const job = await toggleStatus(env, idParts.join(':'), status);
    if (!job) return answer('Заказ не найден');
    if (job.status === 'won') await queueRepeat(env, { kind: 'job', id: job.id, title: job.title });
    await answer(job.status === 'new' ? 'Статус снят' : STATUSES[status].label);
    return call(env, 'editMessageText', {
      message_id: q.message.message_id, text: formatJob(job), reply_markup: jobKeyboard(job), link_preview_options: { is_disabled: true },
    }).catch(() => {});
  }

  if (kind === 'o') {
    const job = await getJob(env, rest.join(':'));
    if (!job) return answer('Заказ уже удалён из базы');
    await answer('');
    const r = await sendText(env, formatJob(job), { reply_markup: jobKeyboard(job) });
    return setJobFields(env, job.id, { msg_id: r.result.message_id });
  }
  return answer('');
}

async function sendTop(env) {
  const since = Date.now() - 48 * 3600e3;
  const { results } = await env.DB.prepare(`SELECT * FROM jobs WHERE created_at > ? AND tier IN ('hot','good') AND status = 'new'
    ORDER BY foreign_client DESC, score DESC LIMIT 10`).bind(since).all();
  if (!results.length) return sendText(env, 'За 2 дня подходящих открытых заказов нет — или ты уже со всеми разобрался 👍');
  const { text, keyboard } = formatDigest(results, '🏅 Лучшие открытые заказы за 2 дня');
  return sendText(env, text, { reply_markup: keyboard });
}

export async function statsText(env, days = 30) {
  const since = Date.now() - days * 86400e3;
  const { results } = await env.DB.prepare(`SELECT source,
      SUM(tier IN ('hot','good')) AS found,
      SUM(status IN ('applied','replied','won')) AS applied,
      SUM(status IN ('replied','won')) AS replied,
      SUM(status = 'won') AS won
    FROM jobs WHERE created_at > ? GROUP BY source ORDER BY found DESC`).bind(since).all();
  const { results: cats } = await env.DB.prepare(`SELECT category,
      SUM(status IN ('applied','replied','won')) AS applied, SUM(status IN ('replied','won')) AS replied, SUM(status = 'won') AS won
    FROM jobs WHERE created_at > ? AND status != 'new' GROUP BY category`).bind(since).all();
  const pct = (a, b) => (b ? ` (${Math.round((100 * a) / b)}%)` : '');
  const lines = results.map((r) => `${SOURCES[r.source]?.name || r.source}: найдено ${r.found || 0} · ✉️ ${r.applied || 0} · 💬 ${r.replied || 0}${pct(r.replied, r.applied)} · 🏆 ${r.won || 0}${pct(r.won, r.applied)}`);
  const catName = { ugc: 'ИИ-видео/UGC', motion: 'Моушн', edit: 'Монтаж' };
  const catLines = cats.filter((c) => c.applied).map((c) => `${catName[c.category] || c.category}: ✉️ ${c.applied} · 💬 ${c.replied}${pct(c.replied, c.applied)} · 🏆 ${c.won}`);
  return `<b>📊 За ${days} дней</b>\n${lines.join('\n') || 'Пока пусто.'}${catLines.length ? `\n\n<b>По направлениям</b>\n${catLines.join('\n')}` : ''}\n\nОтмечай ✉️/💬/🏆 под заказами — так видно, где реально нанимают.`;
}

export async function sourcesText(env) {
  const { results } = await env.DB.prepare('SELECT * FROM health').all();
  const by = Object.fromEntries(results.map((h) => [h.source, h]));
  const lines = Object.entries(SOURCES).map(([key, s]) => {
    if (s.blocked) return `⛔ ${s.name}: отключён — ${e(s.blocked)}`;
    const h = by[key];
    if (!h) return `⏳ ${s.name}: ещё не проверялся`;
    const ok = h.fail_count === 0;
    return `${ok ? '✅' : '⚠️'} ${s.name}: ${h.last_ok ? `ок ${ago(h.last_ok)}, ${h.last_count} заказов в выдаче` : 'ни разу не ответил'}${ok ? '' : ` · ошибок подряд: ${h.fail_count} (${e(h.last_error || '')})`}`;
  });
  return `<b>Источники</b>\n${lines.join('\n')}`;
}
