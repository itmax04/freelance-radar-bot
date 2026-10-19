// Локальная проверка: все источники + оценка, без Telegram и D1.
// npm run check            — все источники
// node scripts/check.js kwork — один источник
import { SOURCES, fetchTelegram, DEFAULT_TG_CHANNELS } from '../src/sources.js';
import { scoreJob, HOT_SCORE, GOOD_SCORE } from '../src/score.js';
import { buildProposal } from '../src/proposal.js';

const r = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
const rates = { UAH: 1 };
for (const x of await r.json()) rates[x.cc] = x.rate;

const only = process.argv[2];
let example = null;
for (const [key, src] of Object.entries(SOURCES)) {
  if (only && key !== only) continue;
  if (src.blocked) { console.log(`\n⛔ ${src.name}: ${src.blocked}`); continue; }
  if (key === 'telegram') src.fetch = async () => (await Promise.all(DEFAULT_TG_CHANNELS.map((c) => fetchTelegram(c).catch(() => [])))).flat();
  const t0 = performance.now();
  let jobs;
  try { jobs = await src.fetch(); } catch (err) { console.log(`\n✘ ${src.name}: ${err.message}`); continue; }
  const t1 = performance.now();
  const scored = jobs.map((job) => ({ job, s: scoreJob(job, rates) })).sort((a, b) => b.s.score - a.s.score);
  const t2 = performance.now();
  const hot = scored.filter((x) => x.s.score >= HOT_SCORE && !x.s.flags.length).length;
  const good = scored.filter((x) => x.s.score >= GOOD_SCORE && x.s.score < HOT_SCORE && !x.s.flags.length).length;
  const skip = scored.filter((x) => !x.s.relevant).length;
  console.log(`\n✔ ${src.name}: ${jobs.length} заказов · 🔥 ${hot} · ⭐ ${good} · не про видео ${skip} · сеть+разбор ${Math.round(t1 - t0)} мс, оценка ${(t2 - t1).toFixed(1)} мс`);
  for (const { job, s } of scored.slice(0, 5)) {
    console.log(`  ${String(s.score).padStart(3)} ${job.title.slice(0, 62).padEnd(62)} | ${job.budgetMax ?? job.budgetMin ?? '—'} ${job.currency || ''}${s.usdMax ? ` ≈$${s.usdMax}` : ''} | ${job.bids ?? '—'} откл. | ${s.reasons.join(', ')}${s.flags.length ? ` ⚠️ ${s.flags}` : ''}`);
  }
  if (!example && scored[0]?.s.score >= GOOD_SCORE) example = scored[0];
}
if (example) {
  console.log('\n— Пример отклика —\n' + buildProposal(example.job, { category: example.s.category, rates }));
}
