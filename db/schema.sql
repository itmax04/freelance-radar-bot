-- Схема D1 для freelance-radar-bot. Применить: npm run db:schema

-- Все увиденные заказы (и отсеянные — чтобы не проверять повторно).
CREATE TABLE IF NOT EXISTS jobs (
  id          TEXT PRIMARY KEY,           -- '<источник>:<id на сайте>', напр. 'fl:40123456'
  source      TEXT NOT NULL,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  descr       TEXT,                       -- до 1500 символов (для отклика и /top)
  budget      TEXT,                       -- как на сайте, напр. '250–750 USD'
  usd_max     INTEGER,                    -- бюджет в USD по курсу НБУ (для фильтров и статистики)
  rate        TEXT,                       -- fixed | hourly | salary
  bids        INTEGER,
  foreign_client INTEGER NOT NULL DEFAULT 0,
  lang        TEXT,
  posted_at   INTEGER,
  score       INTEGER NOT NULL DEFAULT 0,
  category    TEXT,                       -- ugc | motion | edit
  reasons     TEXT,                       -- «почему такая оценка», через запятую
  flags       TEXT,                       -- признаки обмана
  tier        TEXT NOT NULL,              -- hot | good | low | skip
  sent        INTEGER NOT NULL DEFAULT 0, -- 0 нет, 1 сразу, 2 в сводке
  msg_id      INTEGER,
  status      TEXT NOT NULL DEFAULT 'new', -- new | applied | replied | won | skip
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_created ON jobs (created_at);
CREATE INDEX IF NOT EXISTS jobs_queue ON jobs (sent, tier, score);

-- Здоровье источников.
CREATE TABLE IF NOT EXISTS health (
  source     TEXT PRIMARY KEY,
  last_ok    INTEGER,
  last_count INTEGER,
  fail_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  baseline   INTEGER NOT NULL DEFAULT 0  -- 1 — первый (молчаливый) проход уже был
);

-- Настройки владельца (/min, /mute) и кэш курсов НБУ.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
