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
| Источники | Freelancer.com (API, 53 видео-категории), PeoplePerHour (Video & Photography), YT Jobs (API, только Remote), Freelancehunt (API, 6 видео-навыков). **Kwork** — код есть, но отключён: серверам Cloudflare отдаёт пустую страницу (защита от ботов) |
| Приоритет | иностранные заказчики: +15 к оценке; местные (Kwork, Freelancehunt в UAH) — только в сводке, после иностранных |
| Оценка 0–100 | направление (ИИ-видео/UGC 30, моушн 22, монтаж 22), реклама +8, регулярная работа +10, бюджет в USD по курсу НБУ, число откликов, свежесть, язык; признаки обмана −40 |
| 🔥 сразу | оценка ≥ 65, иностранный, без ⚠️; не больше 25 в сутки и 5 за запуск; `/min` — порог бюджета, `/mute` — пауза |
| ⭐ сводка | ≥ 45 (местные ≥ 25), 9:00 / 13:00 / 17:00 / 21:00 по Берлину, топ-10 |
| Отклик | кнопка «✍️ Отклик» → текст на языке заказа + подходящие работы из портфолио + вопрос заказчику |
| Воронка | ✉️ Откликнулся → 💬 Ответили → 🏆 Заказ / ❌ Мимо; `/stats` — по источникам и направлениям |
| Отчёт | 21:00: найдено, отклики, ответы, заказы, здоровье источников |

Бот **не откликается сам** и не обходит защиту сайтов (Guru, Workana, Mandy, Behance — 403, не подключены;
Upwork и Fiverr закрыты для ботов).

## Поиск заказчиков (src/leads/)

Компании, которым может быть нужно видео, даже если они не публиковали заказ.

| Шаг | Как |
|---|---|
| Источники | **Product Hunt** (Atom-лента запусков), **Show HN** (только продукты со своим сайтом), **вакансии** на видео/UGC/контент (Himalayas — поиск по 6 запросам, RemoteOK). Kickstarter, Indiegogo, LaunchingNext, страницы компаний Himalayas — 403, не используются |
| Страны | **не исключаются** (решение владельца 19.10.2026). Германия (GmbH/UG, .de, Impressum, вакансия только в DE) → только отклик на вакансию или LinkedIn/X: реклама по почте/через формы без согласия запрещена (UWG §7), а владелец живёт в DE. ЕС → сначала отклик/форма/DM, почта с пометкой. Исключаются только кадровые агентства |
| Обогащение | сайт → описание, **публичные адреса только на домене компании**, форма связи, X/LinkedIn/Instagram, есть ли видео, страна (Inc./LLC/Ltd/Pty), тип: B2C (UGC) / B2B (демо, эксплейнер) |
| Оценка 0–100 | вакансия на видео +35, запуск PH +25 (Show HN +5), нет видео на сайте +15, B2C +15 / B2B +8, есть почта +12 / форма +6, US/UK/CA/AU +8 |
| Канал | вакансия → отклик на неё; почта; форма; DM в X/LinkedIn. **США + почта:** по CAN-SPAM нужен почтовый адрес отправителя → форма/DM. **ЕС/Германия** — см. «Страны» |
| Подборка | каждый день в 10:00 (Берлин) — 10 лучших карточками; `/leads` — сейчас |
| Черновики | ✍️ письмо, 💬 коротко (форма/DM), 🎬 идея бесплатного демо (концепт + промпт для Kling/Veo/Sora) — пишет **Workers AI** (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`, бесплатный лимит), при ошибке шаблон |
| Воронка | ✉️ Написал → через 4 дня один текст напоминания → 💬 / 🏆 / ❌; `/stats` |

Бот **ничего не отправляет заказчикам** — только готовит текст.

## Расписание (UTC)

```
*/2 * * * *  → один источник за запуск: CYCLE = fl, pph, fl, ytj, fl, fh, fl, ytj, fl, pph
               (Freelancer.com — каждые 4 мин, PPH и YT Jobs — каждые 10, Freelancehunt — 20)
1 * * * *    → сводки, отчёт 21:00, заказчики дня 10:00, чистка 04:00 (по Берлину)
*/10 * * * * → заказчики: LEAD_CYCLE = producthunt, enrich, hiring, enrich, showhn, enrich
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
src/leads/       поиск заказчиков: sources, enrich, score, drafts (Workers AI), store, bot
db/schema.sql    таблицы jobs, health, settings, leads (+ db/migrations/)
scripts/check.js локальный прогон источников и оценки
```

## Где работает

Аккаунт Cloudflare **lashkevych049@gmail.com** (отдельный), Worker https://freelance-radar-bot.lashkevych049.workers.dev,
D1 `freelance-radar-bot` (id в `wrangler.toml`). Ключи `RUN_KEY`/`WEBHOOK_SECRET` — в `.run_key`/`.webhook_secret`
(не в git), API-токен — в `.env` (не в git). Замер 19.10.2026: обычный запуск ~9 мс CPU, первый проход источника ~16 мс.

## Команды бота

`/top` — лучшие открытые за 2 дня · `/leads` — заказчики · `/stats` — воронка · `/min 50` · `/mute` · `/sources` · `/help`

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
`leads:producthunt|leads:showhn|leads:hiring|leads:enrich&n=6|leads:preview` (подборка + письмо ИИ, без Telegram)|`leads:daily`,
`&dry=1` — без записи и сообщений.
