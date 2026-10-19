# Freelance Radar Bot — заказы на видео в Telegram

> **TL;DR (EN):** Cloudflare Worker that polls freelance marketplaces (Freelancer.com API, PeoplePerHour, YT Jobs API,
> Freelancehunt API, Kwork) for video work — AI video/UGC, editing, motion design, animation — scores each job 0–100
> (relevance, budget in USD via NBU rates, competition, freshness, foreign client, scam flags) and sends the best to a
> private Telegram bot with a ready-to-paste proposal and status tracking. Plain JS, D1 storage. Docs in Russian.

Главная метрика — **реально полученные заказы**: бот приносит лучшие заказы быстро (свежий отклик читают чаще),
готовит отклик со ссылкой на портфолио и считает, где отвечают и нанимают.

## Что делает

| Функция | Как |
|---|---|
| Источники | Freelancer.com (API, 53 видео-категории), PeoplePerHour (Video & Photography), YT Jobs (API, только Remote), Freelancehunt (API, 6 видео-навыков), Kwork (разделы 76, 77, 78, 300) |
| Приоритет | иностранные заказчики: +15 к оценке; местные (Kwork, Freelancehunt в UAH) — только в сводке, после иностранных |
| Оценка 0–100 | направление (ИИ-видео/UGC 30, моушн 22, монтаж 22), реклама +8, регулярная работа +10, бюджет в USD по курсу НБУ, число откликов, свежесть, язык; признаки обмана −40 |
| 🔥 сразу | оценка ≥ 65, иностранный, без ⚠️; не больше 25 в сутки и 5 за запуск; `/min` — порог бюджета, `/mute` — пауза |
| ⭐ сводка | ≥ 45 (местные ≥ 25), 9:00 / 13:00 / 17:00 / 21:00 по Берлину, топ-10 |
| Отклик | кнопка «✍️ Отклик» → текст на языке заказа + подходящие работы из портфолио + вопрос заказчику |
| Воронка | ✉️ Откликнулся → 💬 Ответили → 🏆 Заказ / ❌ Мимо; `/stats` — по источникам и направлениям |
| Отчёт | 21:00: найдено, отклики, ответы, заказы, здоровье источников |

Бот **не откликается сам** и не обходит защиту сайтов (Guru, Workana, Mandy, Behance — 403, не подключены;
Upwork и Fiverr закрыты для ботов).

## Расписание (UTC)

```
*/2 * * * *  → один источник за запуск: CYCLE = fl, pph, fl, ytj, fl, fh, fl, kw, fl, pph
               (Freelancer.com — каждые 4 мин, остальные — каждые 20 мин)
1 * * * *    → сводки, отчёт 21:00, чистка 04:00 (по Берлину)
```

## Карта файлов

```
src/index.js     расписание (CYCLE), runSource, сводка, отчёт, HTTP-маршруты
src/sources.js   источники → общий формат заказа
src/score.js     оценка, направления, признаки обмана, пороги
src/proposal.js  тексты откликов (en/ru/uk) и подбор работ из портфолио
src/messages.js  карточка заказа, кнопки, сводка
src/commands.js  команды и кнопки Telegram, /stats, /sources
src/store.js     D1: заказы, статусы, здоровье, настройки, курсы НБУ (кэш 12 ч)
db/schema.sql    таблицы jobs, health, settings
scripts/check.js локальный прогон источников и оценки
```

## Команды бота

`/top` — лучшие открытые за 2 дня · `/stats` — воронка · `/min 50` · `/mute` · `/sources` · `/help`

## Запуск и публикация

Нужен отдельный аккаунт Cloudflare. API-токен аккаунта — в `.env` (`CLOUDFLARE_API_TOKEN=…`, файл в .gitignore),
так wrangler не трогает вход в основной аккаунт.

```bash
npm run check                                   # локальная проверка
npx wrangler d1 create freelance-radar-bot      # id → wrangler.toml
npm run db:schema
npm run deploy
npx wrangler secret put TELEGRAM_TOKEN          # вводит владелец
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put RUN_KEY
npx wrangler secret put WEBHOOK_SECRET
curl "https://freelance-radar-bot.<subdomain>.workers.dev/setup?key=$(cat .run_key)"
```

Ручной запуск: `GET /run?key=…&source=freelancer|peopleperhour|ytjobs|freelancehunt|kwork|digest|report|stats`,
`&dry=1` — без записи и сообщений.
