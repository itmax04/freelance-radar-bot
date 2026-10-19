# Freelance Radar Bot — заказы на видео в Telegram

> **TL;DR (EN):** Cloudflare Worker that polls freelance marketplaces (Freelancer.com API, PeoplePerHour, YT Jobs API,
> Freelancehunt API, Kwork) for video work — AI video/UGC, editing, motion design, animation — scores each job 0–100
> (relevance, budget in USD via NBU rates, competition, freshness, foreign client, scam flags) and sends the best to a
> private Telegram bot with a ready-to-paste proposal and status tracking. Plain JS, D1 storage. Docs in Russian.

Главная метрика — **реально полученные заказы**: бот приносит лучшие заказы быстро (свежий отклик читают чаще),
готовит отклик со ссылкой на портфолио и считает, где отвечают и нанимают.

## Что делает

Приоритеты — по исследованию **«The first three paid freelance projects» (19.10.2026)** и брейншторму с владельцем:
продавать маленький **оплаченный пилот** покупателю, которому видео уже нужно; лучший вход — хук/вариация из готовых
материалов и короткая AI-presenter/app-реклама; явные запросы и Freelancehunt — выше популярных бирж.

| Функция | Как |
|---|---|
| Источники | **Freelancehunt** (API, основная биржа), **Telegram-каналы** (`/channels`; по умолчанию @motionhunter, @aivacancychannel, @jobforukrainians, @beejob1_ua, @creatorskit_app — только посты «ищем исполнителя»), **Freelancer.com** (API; ставки через пробный Plus до 18.11), **YT Jobs**, **Twine** (15 бесплатных откликов/мес), **Reddit** r/HireAnEditor, r/VideoEditors_forhire, r/VideoEditingRequests (только [Hiring]), **PeoplePerHour** (только сводка: отклики могут требовать подписку). Kwork — отключён (блокирует Cloudflare). Guru — вручную, напоминание по понедельникам |
| Направления | хук/вариация 32 · AI-presenter/UGC 32 · промо приложения 28 · ИИ-видео 22 · эксплейнер 18 · ролик о продукте 15 · общий монтаж 10 |
| ⚠ пометки | полная занятость/офис −25, созвоны −20, живые съёмки −25, 3D/VFX −30, фото −25, большой объём −15, длинный формат −10, 3+ лет −5, штат −10 |
| ⛔ флаги | бесплатное тестовое, оплата с исполнителя, увод с площадки, казино/18+, дипфейки, крипто, оплата за просмотры, конкурсы, автоматизация (n8n/python) |
| 🔥 сразу | оценка ≥ 65, направление из `HOT_CATEGORIES` (не общий монтаж), без ⛔; **до 8 в день** (владелец успевает 5–8), 5 за запуск |
| ⭐ сводка | ≥ 45, 9/13/17/21 по Берлину; явные запросы (Telegram/Reddit) +15 |
| Отклик | одна ближайшая работа с меткой «заказ/концепт» и **прямой ссылкой** (`…/#talkseek-ugc`), одно производственное решение, **оплаченный пилот** с ценой и объёмом (хук $25–45, AI-presenter от $79, промо $59–99, эксплейнер $60–120, монтаж от $35), один вопрос, строка про оплату на площадке; язык заказчика (укр./рус. — цена в гривнах по НБУ) |
| Цель | `/goal` и вечерний отчёт: 3 оплаченных проекта до 18.11, отклики/ответы за неделю, совет |
| Напоминания | 10:00: отменить Freelancer Plus (15.11), Guru (пн), повторный заказ через 7 дней после 🏆 |

Бот **не откликается сам** и не обходит защиту сайтов (Guru, Workana, Mandy, Behance, Truelancer, Clutch — 403/проверка).

## Поиск заказчиков (src/leads/)

Компании, которым может быть нужно видео, даже если они не публиковали заказ.

| Шаг | Как |
|---|---|
| Источники | **Product Hunt** (Atom-лента запусков), **Show HN** (только продукты со своим сайтом), **вакансии** на видео/UGC/контент (Himalayas — поиск по 6 запросам, RemoteOK). Kickstarter, Indiegogo, LaunchingNext, страницы компаний Himalayas — 403, не используются |
| Страны | **не исключаются** (решение владельца 19.10.2026). Германия (GmbH/UG, .de, Impressum, вакансия только в DE) → только отклик на вакансию или LinkedIn/X: реклама по почте/через формы без согласия запрещена (UWG §7), а владелец живёт в DE. ЕС → сначала отклик/форма/DM, почта с пометкой. Исключаются только кадровые агентства |
| Обогащение | сайт → описание, **публичные адреса только на домене компании**, форма связи, X/LinkedIn/Instagram, есть ли видео, страна (Inc./LLC/Ltd/Pty), тип: B2C (UGC) / B2B (демо, эксплейнер) |
| Оценка 0–100 | вакансия на видео +35, запуск PH +25 (Show HN +5), нет видео на сайте +15, B2C +15 / B2B +8, есть почта +12 / форма +6, US/UK/CA/AU +8 |
| Канал | вакансия → отклик на неё; почта; форма; DM в X/LinkedIn. **США + почта:** по CAN-SPAM нужен почтовый адрес отправителя → форма/DM. **ЕС/Германия** — см. «Страны» |
| Подборка | каждый день в 10:00 (Берлин) — 5 лучших карточками; `/leads` — сейчас; агентства/студии +10 → white-label пилот |
| Черновики | ✍️ письмо, 💬 коротко (форма/DM), 🎬 идея вариации для письма (не делать бесплатно — предлагать оплаченный пилот) — пишет **Workers AI** (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`, бесплатный лимит), при ошибке шаблон |
| Воронка | ✉️ Написал → через 4 дня один текст напоминания → 💬 / 🏆 / ❌; `/stats` |

Бот **ничего не отправляет заказчикам** — только готовит текст.

## Расписание (UTC)

```
*/2 * * * *  → один источник за запуск: CYCLE из 16 слотов (32 мин): fh, fl, tg, fh, ytj, tg, fh, fl, tw, tg, fh, pph, tg, fh, fl, rd
               (Freelancehunt и Telegram — каждые ~6 мин, по одному каналу; Freelancer — ~11; остальные — 32)
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
src/reminders.js цель «3 оплаченных», разовые/еженедельные напоминания, повторные заказы
src/leads/       поиск заказчиков: sources, enrich, score, drafts (Workers AI), store, bot
db/schema.sql    таблицы jobs, health, settings, leads (+ db/migrations/)
scripts/check.js локальный прогон источников и оценки
```

## Где работает

Аккаунт Cloudflare **lashkevych049@gmail.com** (отдельный), Worker https://freelance-radar-bot.lashkevych049.workers.dev,
D1 `freelance-radar-bot` (id в `wrangler.toml`). Ключи `RUN_KEY`/`WEBHOOK_SECRET` — в `.run_key`/`.webhook_secret`
(не в git), API-токен — в `.env` (не в git). Замер 19.10.2026: обычный запуск ~9 мс CPU, первый проход источника ~16 мс.

## Команды бота

`/top` — лучшие открытые за 2 дня · `/leads` — заказчики · `/goal` · `/channels add @name` · `/stats` — воронка · `/min 50` · `/mute` · `/sources` · `/help`

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
