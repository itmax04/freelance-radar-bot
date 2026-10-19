// Цель «3 оплаченных проекта», разовые и регулярные напоминания, повторные заказы.
// По исследованию «The first three paid freelance projects» (19.10.2026) и решениям владельца того же дня.
import { sendText, escapeHtml as e } from './telegram.js';
import { getSetting, setSetting } from './store.js';

export const GOAL = { target: 3, start: '2026-10-19', deadline: '2026-11-18' };
const REPEAT_AFTER_DAYS = 7;

// Разовые напоминания (дата по Берлину, 10:00).
const ONE_OFF = [
  { id: 'freelancer-plus-cancel', date: '2026-11-15',
    text: '⏰ <b>Freelancer.com Plus</b>: пробный месяц (с 19.10) заканчивается примерно 18.11. Если не нужен — отмени сейчас в Membership, иначе спишут оплату. Проверь точную дату в аккаунте.' },
];

const berlinDate = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d); // YYYY-MM-DD
const berlinWeekday = (d = new Date()) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', weekday: 'short' }).format(d);

/** Сколько оплаченных проектов (🏆) с начала цели — и в заказах, и среди заказчиков. */
export async function goalProgress(env) {
  const since = Date.parse(`${GOAL.start}T00:00:00+02:00`);
  const a = await env.DB.prepare(`SELECT COUNT(*) AS n FROM jobs WHERE status = 'won' AND updated_at >= ?`).bind(since).first();
  const b = await env.DB.prepare(`SELECT COUNT(*) AS n FROM leads WHERE status = 'won' AND updated_at >= ?`).bind(since).first();
  const weekAgo = Date.now() - 7 * 86400e3;
  const w = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM jobs WHERE status IN ('applied','replied','won') AND updated_at > ?) +
      (SELECT COUNT(*) FROM leads WHERE status IN ('contacted','replied','won') AND updated_at > ?) AS applied,
      (SELECT COUNT(*) FROM jobs WHERE status IN ('replied','won') AND updated_at > ?) +
      (SELECT COUNT(*) FROM leads WHERE status IN ('replied','won') AND updated_at > ?) AS replied`).bind(weekAgo, weekAgo, weekAgo, weekAgo).first();
  const won = (a?.n || 0) + (b?.n || 0);
  const daysLeft = Math.max(0, Math.floor((Date.parse(`${GOAL.deadline}T23:59:59+01:00`) - Date.now()) / 86400e3));
  return { won, daysLeft, weekApplied: w?.applied || 0, weekReplied: w?.replied || 0 };
}

export async function goalText(env) {
  const g = await goalProgress(env);
  const bar = '🟩'.repeat(Math.min(g.won, GOAL.target)) + '⬜'.repeat(Math.max(0, GOAL.target - g.won));
  const hint = g.won >= GOAL.target ? 'Цель достигнута 🎉 Дальше — повторные заказы и цены выше.'
    : g.weekApplied < 25 ? 'Совет: 5–8 точных откликов в день — на 🔥 и ответы на явные запросы (Telegram, Reddit, Freelancehunt).'
      : g.weekReplied === 0 ? 'Откликов много, ответов нет — сузь до хуков/AI-presenter/app-промо и ставь ближайший пример по ссылке.'
        : 'Ответы есть — доводи до оплаченного пилота: фиксированный объём, цена, оплата до старта.';
  return `🎯 <b>Цель: ${GOAL.target} оплаченных проекта до ${GOAL.deadline.slice(8, 10)}.${GOAL.deadline.slice(5, 7)}</b>\n${bar} ${g.won}/${GOAL.target} · осталось ${g.daysLeft} дн · за 7 дней: ✉️ ${g.weekApplied} · 💬 ${g.weekReplied}\n${hint}`;
}

/** После 🏆: через 7 дней предложить клиенту следующую оплачиваемую вариацию (исследование, раздел 22). */
export async function queueRepeat(env, { kind, id, title }) {
  const q = await getSetting(env, 'repeatQueue', []);
  if (q.some((x) => x.kind === kind && x.id === id)) return;
  q.push({ kind, id, title, due: Date.now() + REPEAT_AFTER_DAYS * 86400e3 });
  await setSetting(env, 'repeatQueue', q.slice(-50));
}

/** Раз в день в 10:00 (Берлин): разовые, еженедельные (Guru — понедельник) и повторные заказы. */
export async function runDailyReminders(env, now = new Date()) {
  const today = berlinDate(now);
  const done = await getSetting(env, 'remindersDone', []);
  for (const r of ONE_OFF) {
    if (today >= r.date && !done.includes(r.id)) {
      await sendText(env, r.text);
      done.push(r.id);
    }
  }
  await setSetting(env, 'remindersDone', done);

  if (berlinWeekday(now) === 'Mon') {
    await sendText(env, '🗓 <b>Guru.com</b> (бот туда не заходит — сайт закрыт для ботов): ~10 бесплатных ставок в месяц, комиссия 9%. Зайди, поищи «AI video», «UGC», «app promo», «video ad» и потрать 2–3 ставки на самые точные совпадения. Текст отклика возьми из похожей карточки бота (✍️).', { disable_notification: true });
  }

  const q = await getSetting(env, 'repeatQueue', []);
  const due = q.filter((x) => x.due <= Date.now());
  for (const x of due) {
    await sendText(env, `🔁 <b>Повторный заказ: ${e(x.title)}</b>\nПрошла неделя после 🏆. Предложи клиенту следующую небольшую оплачиваемую задачу — так второй проект проще первого:\n<pre>Hi! Hope the video is working well for you. If useful, I can make a follow-up variation from the same approved assets — for example a new opening hook, a 1:1 / 4:5 version for another placement, or a version for a second product. Happy to quote it as a separate small fixed-price task.\n\nMaksym</pre>`);
  }
  if (due.length) await setSetting(env, 'repeatQueue', q.filter((x) => x.due > Date.now()));
  return { reminders: due.length };
}
