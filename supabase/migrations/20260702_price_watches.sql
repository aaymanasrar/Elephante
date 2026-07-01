-- ============================================================================
-- PRICE WATCHES — track product prices and alert on drops
-- ============================================================================

CREATE TABLE IF NOT EXISTS price_watches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_url  TEXT NOT NULL,
  product_name TEXT NOT NULL,
  brand        TEXT,
  image_url    TEXT,
  current_price     NUMERIC(10,2),
  target_price      NUMERIC(10,2),          -- alert when price <= this
  currency          TEXT NOT NULL DEFAULT 'USD',
  last_price_drop   NUMERIC(10,2),          -- previous price when last drop occurred
  last_checked      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_url)
);

ALTER TABLE price_watches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own price watches"
  ON price_watches FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- PRICE HISTORY — time-series of price snapshots per watch
-- ============================================================================

CREATE TABLE IF NOT EXISTS price_history (
  id         BIGSERIAL PRIMARY KEY,
  watch_id   UUID NOT NULL REFERENCES price_watches(id) ON DELETE CASCADE,
  price      NUMERIC(10,2) NOT NULL,
  currency   TEXT NOT NULL DEFAULT 'USD',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own price history"
  ON price_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM price_watches pw
      WHERE pw.id = watch_id AND pw.user_id = auth.uid()
    )
  );

CREATE INDEX idx_price_history_watch ON price_history(watch_id, checked_at DESC);
CREATE INDEX idx_price_watches_user  ON price_watches(user_id, created_at DESC);

-- ============================================================================
-- TREND CACHE — scraped outfit trend articles / looks (24h TTL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trend_cache (
  id          BIGSERIAL PRIMARY KEY,
  query       TEXT NOT NULL,
  title       TEXT,
  description TEXT,
  image_url   TEXT,
  source_url  TEXT NOT NULL,
  source_name TEXT,
  tags        TEXT[],
  scraped_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trend_cache_query ON trend_cache(query, scraped_at DESC);
